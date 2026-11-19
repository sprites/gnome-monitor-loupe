// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';
import {lensGeometry, insideLens, shapeSize, nextLensSize} from './geometry.js';
import {createLensEffect, showShutter} from './appearance.js';
import {capturePlan, maskLenses} from './capture.js';
import {frameColor} from './color.js';
import {nextZoom} from './zoom.js';

const SHORTCUTS = ['loupe-zoom-in', 'loupe-zoom-out'];

export default class MonitorLoupe extends Extension {
    enable() {
        try {
            this._enable();
        } catch (error) {
            this.disable();
            throw error;
        }
    }

    _enable() {
        this._settings = this.getSettings();
        this._a11y = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.applications'});
        this._magnifierSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.magnifier'});
        this._boundShortcuts = [];
        this._scrollRemainder = 0;
        this._scrollAction = null;
        this._lastScrollTime = 0;
        this._addIndicator();
        this._indicatorVisibilityId = this._a11y.connect(
            'changed::screen-magnifier-enabled', () => this._updateIndicatorVisibility());
        this._updateIndicatorVisibility();
        this._region = Main.magnifier.getZoomRegions()[0];
        const region = this._region;
        if (!region || typeof region._changeROI !== 'function' ||
            typeof region._setViewPort !== 'function' ||
            typeof region._updateScreenPosition !== 'function' ||
            typeof region.scrollToMousePos !== 'function' ||
            typeof region._isMouseOverRegion !== 'function' ||
            typeof region._updateMagViewGeometry !== 'function' ||
            typeof region._destroyActors !== 'function' ||
            typeof region._isFullScreen !== 'function')
            throw new Error('Unsupported GNOME magnifier API');
        this._injections = new InjectionManager();
        const geometry = (params = {}) => {
            const [x, y] = global.get_pointer();
            return lensGeometry(Main.layoutManager.monitors, x, y,
                params.xMagFactor ?? region._xMagFactor,
                params.yMagFactor ?? region._yMagFactor,
                this._settings.get_int('lens-width'),
                this._settings.get_int('lens-height'),
                this._settings.get_string('lens-shape'),
                this._settings.get_int('lens-radius'));
        };
        const extension = this;
        this._injections.overrideMethod(region, '_updateMagViewGeometry', original =>
            function (...args) {
                const result = original.apply(this, args);
                extension._syncAppearance();
                return result;
            });
        this._injections.overrideMethod(region, '_destroyActors', original =>
            function (...args) {
                extension._restoreScreenshotCursor?.();
                extension._clearAppearance();
                return original.apply(this, args);
            });
        this._injections.overrideMethod(region, '_isFullScreen', original =>
            function () {
                return extension._settings.get_string('lens-shape') === 'rectangle' &&
                    original.call(this);
            });
        this._injections.overrideMethod(region, '_isMouseOverRegion', original =>
            function () {
                if (!original.call(this))
                    return false;
                const [x, y] = global.get_pointer();
                return insideLens(extension._settings.get_string('lens-shape'),
                    x - this._viewPortX, y - this._viewPortY,
                    this._viewPortWidth, this._viewPortHeight);
            });
        this._injections.overrideMethod(region, '_setViewPort', original =>
            function (viewport, fromROIUpdate) {
                const lens = geometry();
                const result = original.call(this, lens?.viewport ?? viewport, fromROIUpdate);
                if (lens) {
                    // GNOME clamps the magnifier window to the desktop rectangle.
                    // Restore its pointer-centered position; the stage clips the
                    // part that cannot be displayed beyond a physical edge.
                    this._viewPortX = lens.viewport.x;
                    this._viewPortY = lens.viewport.y;
                    this._updateMagViewGeometry();
                    if (this.isActive() && this._isMouseOverRegion())
                        this._magnifier.hideSystemCursor();
                    Main.uiGroup.set_opacity(this.isActive() && this._isFullScreen() ? 0 : 255);
                }
                return result;
            });
        this._injections.overrideMethod(region, '_changeROI', original =>
            function (params = {}) {
                if (extension._restoreScreenshotCursor)
                    return;
                const lens = geometry(params);
                if (!lens)
                    return original.call(this, params);
                this._setViewPort(lens.viewport, true);
                const lensMode = this._lensMode;
                const clampEdges = this._clampScrollingAtEdges;
                // The viewport stays pointer-centered; the Shell clips it at desktop edges.
                this._lensMode = false;
                this._clampScrollingAtEdges = false;
                try {
                    return original.call(this, {
                        ...params,
                        xCenter: lens.xCenter,
                        yCenter: lens.yCenter,
                        xMagFactor: lens.xMagFactor,
                        yMagFactor: lens.yMagFactor,
                        redoCursorTracking: false,
                        animate: false,
                    });
                } finally {
                    this._lensMode = lensMode;
                    this._clampScrollingAtEdges = clampEdges;
                }
            });
        this._injections.overrideMethod(region, 'scrollToMousePos', () =>
            function () {
                this._followingCursor = true;
                this._changeROI();
                return this._isMouseOverRegion();
            });
        region._changeROI();
        this._settingsChangedId = this._settings.connect('changed', (_settings, key) => {
            if (key === 'screenshot-lens')
                this._syncScreenshotBinding();
            if (['lens-width', 'lens-height', 'lens-shape', 'lens-radius',
                'frame-color', 'rectangle-border-width'].includes(key))
                region._changeROI();
            if (!this._resizing)
                this._scrollRemainder = 0;
        });
        this._syncScreenshotBinding();
        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () =>
            region._changeROI());
        for (const [index, key] of SHORTCUTS.entries()) {
            Main.wm.addKeybinding(key, this._settings, Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                () => this._zoom(index === 0 ? 1 : -1));
            this._boundShortcuts.push(key);
        }
        // Capture before GNOME's workspace-scroll handler and before applications.
        // Super is the default compositor modifier, so these events reach Shell
        // even when the pointer is over a Wayland client.
        this._scrollId = global.stage.connect('captured-event', (_stage, event) =>
            this._onEvent(event));
        // Events over application windows are forwarded by GNOME's compositor
        // to this handler instead of the stage signal above.
        this._originalWorkspaceScroll = Main.wm.handleWorkspaceScroll;
        this._workspaceScrollHandler = event => {
            const result = this._onEvent(event);
            if (result === Clutter.EVENT_STOP)
                return result;
            return this._originalWorkspaceScroll?.call(Main.wm, event) ?? result;
        };
        Main.wm.handleWorkspaceScroll = this._workspaceScrollHandler;
    }

    _addIndicator() {
        if (!Main.panel || typeof PanelMenu === 'undefined')
            return;
        this._indicator = new PanelMenu.Button(0.0, 'Monitor Loupe', true);
        this._indicator.can_focus = false;
        const preferences = new St.Button({
            accessible_name: 'Monitor Loupe',
            can_focus: true,
            track_hover: true,
        });
        preferences.set_child(new St.Icon({
            gicon: Gio.FileIcon.new(Gio.file_new_for_path(`${this.path}/monitor-loupe.svg`)),
            icon_size: 24,
            style_class: 'system-status-icon',
        }));
        preferences.connect('clicked', () => this.openPreferences());
        this._indicator.add_child(preferences);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    _syncScreenshotBinding() {
        const enabled = this._settings.get_boolean('screenshot-lens');
        if (enabled === Boolean(this._screenshotBinding))
            return;
        const modes = Shell.ActionMode.ALL & ~Shell.ActionMode.LOGIN_SCREEN;
        Main.wm.setCustomKeybindingHandler('show-screenshot-ui', modes,
            enabled ? () => {
                if (!(Main.actionMode & (Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW)) ||
                    !this._region?.isActive()) {
                    Screenshot.showScreenshotUI();
                    return;
                }
                this._captureLens().catch(error => {
                    console.error('Monitor Loupe: screenshot failed', error);
                    if (this._settings)
                        Main.notifyError(this.gettext('Could not capture the zoom window'), error.message);
                });
            } : Screenshot.showScreenshotUI);
        this._screenshotBinding = enabled;
    }

    async _captureLens() {
        if (this._screenshotPending)
            return;
        const region = this._region;
        const viewport = {x: region._viewPortX, y: region._viewPortY,
            width: region._viewPortWidth, height: region._viewPortHeight};
        const shape = this._settings.get_string('lens-shape');
        const decorated = this._settings.get_boolean('screenshot-decoration');
        const transparent = this._settings.get_boolean('screenshot-transparent');
        const border = this._settings.get_int('rectangle-border-width');
        const plan = capturePlan(viewport, global.stage, shape,
            border, decorated, transparent);
        if (!plan)
            return;
        const pending = {};
        this._screenshotPending = pending;
        // The magnified pointer is a stage actor, separate from the system cursor.
        const cursors = ['_mouseActor', '_crossHairsActor']
            .map(key => [key, region[key], region[key]?.visible]);
        let restored = false;
        let restoreDecoration = () => {};
        const restore = () => {
            if (restored)
                return;
            restored = true;
            restoreDecoration();
            for (const [key, actor, visible] of cursors) {
                if (actor && region[key] === actor)
                    actor.visible = visible;
            }
            if (this._restoreScreenshotCursor === restore)
                this._restoreScreenshotCursor = null;
        };
        this._restoreScreenshotCursor = restore;
        try {
            // With an opaque background, remove the instrument itself before
            // snapshotting so its frame/handle cannot remain in the surroundings.
            if (!transparent && !decorated && shape !== 'rectangle' && this._shapeEffect) {
                const actor = this._appearanceActor;
                const original = this._shapeEffect;
                const [sw, sh] = shapeSize(shape);
                const radius = Math.max(1, Math.min(viewport.width / sw, viewport.height / sh));
                const clean = createLensEffect(shape, this._settings.get_string('frame-color'),
                    0, radius, {includeHandle: false, outerRadius: Math.max(0, 0.96 - border / radius)});
                actor.remove_effect(original);
                actor.add_effect(clean);
                restoreDecoration = () => {
                    actor.remove_effect(clean);
                    if (this._shapeEffect === original)
                        actor.add_effect(original);
                };
            }
            for (const [, actor] of cursors) {
                if (actor)
                    actor.visible = false;
            }
            const shooter = new Shell.Screenshot();
            const [content, scale] = await shooter.screenshot_stage_to_content();
            restore();
            if (this._screenshotPending !== pending || !region.isActive() ||
                !(Main.actionMode & (Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW)))
                return;
            if (this._settings.get_boolean('screenshot-shutter')) {
                this._shutter?.destroy();
                this._shutter = showShutter(viewport, shape);
                const shutter = this._shutter;
                shutter.connect('destroy', () => {
                    if (this._shutter === shutter)
                        this._shutter = null;
                });
            }
            const geometry = [plan.x, plan.y, plan.width, plan.height]
                .map(value => Math.round(value * scale));
            let texture = content.get_texture();
            let image;
            if (plan.circles) {
                const stream = Gio.MemoryOutputStream.new_resizable();
                let pixbuf;
                try {
                    pixbuf = await Shell.Screenshot.composite_to_stream(texture,
                        ...geometry, scale, null, 0, 0, 1, stream);
                } finally {
                    stream.close(null);
                }
                const rgba = pixbuf.add_alpha(false, 0, 0, 0);
                const pixels = maskLenses(new Uint8Array(rgba.get_pixels()),
                    rgba.width, rgba.height, rgba.rowstride, plan);
                image = St.ImageContent.new_with_preferred_size(rgba.width, rgba.height);
                const data = [pixels, Cogl.PixelFormat.RGBA_8888,
                    rgba.width, rgba.height, rgba.rowstride];
                // GNOME 51 moved image uploads out of Clutter and requires a context.
                if (typeof Clutter.Image !== 'function')
                    data.unshift(global.stage.get_context().get_backend().get_cogl_context());
                image.set_data(...data);
                texture = image.get_texture();
                if (this._screenshotPending !== pending)
                    return;
            }
            // GNOME handles PNG storage, clipboard and the screenshot notification.
            await Screenshot.captureScreenshot(texture,
                plan.circles ? null : geometry, plan.circles ? 1 : scale, null);
        } finally {
            restore();
            if (this._screenshotPending === pending)
                this._screenshotPending = null;
        }
    }

    _updateIndicatorVisibility() {
        if (this._indicator)
            this._indicator.visible = this._a11y.get_boolean('screen-magnifier-enabled');
    }

    _clearAppearance() {
        if (this._appearanceActor) {
            if (this._shapeEffect)
                this._appearanceActor.remove_effect(this._shapeEffect);
            this._appearanceActor.set_style(this._originalLensStyle);
        }
        this._appearanceActor = null;
        this._shapeEffect = null;
        this._appearanceShape = null;
    }

    _syncAppearance() {
        const actor = this._region._magView;
        const shape = this._settings.get_string('lens-shape');
        const color = frameColor(this._settings.get_string('frame-color'));
        const borderWidth = this._settings.get_int('rectangle-border-width');
        const [shapeWidth, shapeHeight] = shape === 'rectangle' ? [1, 1] : shapeSize(shape);
        const radius = Math.max(1, Math.min(
            this._region._viewPortWidth / shapeWidth,
            this._region._viewPortHeight / shapeHeight));
        const appearance = `${shape}:${color}:${borderWidth}:${radius}`;
        if (actor === this._appearanceActor && appearance === this._appearanceShape)
            return;
        this._clearAppearance();
        if (!actor)
            return;
        this._originalLensStyle = actor.get_style();
        this._appearanceActor = actor;
        this._appearanceShape = appearance;
        if (shape === 'rectangle') {
            actor.set_style(`border: ${borderWidth}px solid ${color}; border-radius: 0; padding: 0;`);
            return;
        }
        this._shapeEffect = createLensEffect(shape, color, borderWidth, radius);
        actor.set_style('border: 0; padding: 0; background-color: transparent; box-shadow: none;');
        actor.add_effect(this._shapeEffect);
    }

    _onEvent(event) {
        if (event.type() !== Clutter.EventType.SCROLL)
            return Clutter.EVENT_PROPAGATE;
        const state = event.get_state();
        // Store portable modifier bits rather than Clutter's platform masks.
        // Super can be reported as its virtual mask, MOD4, or both.
        const modifiers =
            (state & Clutter.ModifierType.CONTROL_MASK ? 1 : 0) |
            (state & Clutter.ModifierType.MOD1_MASK ? 2 : 0) |
            (state & Clutter.ModifierType.SHIFT_MASK ? 4 : 0) |
            (state & (Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.MOD4_MASK) ? 8 : 0);
        const resize = this._settings.get_boolean('scroll-resize') &&
            modifiers === this._settings.get_int('scroll-resize-modifiers');
        const zoom = this._settings.get_boolean('scroll-zoom') &&
            modifiers === this._settings.get_int('scroll-zoom-modifiers');
        const action = resize ? 'resize' : zoom ? 'zoom' : null;
        if (!(Main.actionMode & (Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW)) || !action) {
            this._scrollRemainder = 0;
            this._scrollAction = null;
            return Clutter.EVENT_PROPAGATE;
        }
        if (action !== this._scrollAction)
            this._scrollRemainder = 0;
        this._scrollAction = action;
        const apply = direction => resize ? this._resize(direction) : this._zoom(direction);
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
            this._scrollRemainder = 0;
            apply(1);
            break;
        case Clutter.ScrollDirection.DOWN:
            this._scrollRemainder = 0;
            apply(-1);
            break;
        case Clutter.ScrollDirection.SMOOTH: {
            const [dx, dy] = event.get_scroll_delta();
            if (Math.abs(dx) > Math.abs(dy)) {
                this._scrollRemainder = 0;
                return Clutter.EVENT_PROPAGATE;
            }
            const time = event.get_time();
            if (time - this._lastScrollTime > 250 ||
                Math.sign(this._scrollRemainder) !== Math.sign(dy))
                this._scrollRemainder = 0;
            this._lastScrollTime = time;
            this._scrollRemainder += dy;
            const steps = Math.trunc(this._scrollRemainder + Math.sign(this._scrollRemainder) * 1e-9);
            this._scrollRemainder -= steps;
            if (Math.abs(this._scrollRemainder) < 1e-9)
                this._scrollRemainder = 0;
            if (steps !== 0)
                apply(-steps);
            break;
        }
        default:
            return Clutter.EVENT_PROPAGATE;
        }
        return Clutter.EVENT_STOP;
    }

    _resize(direction) {
        const [x, y] = global.get_pointer();
        const monitor = Main.layoutManager.monitors.find(m =>
            x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height);
        if (!monitor)
            return;
        const size = nextLensSize(this._settings.get_int('lens-width'),
            this._settings.get_int('lens-height'), this._settings.get_int('lens-radius'),
            this._settings.get_string('lens-shape'), direction, monitor);
        if (Object.keys(size).some(dimension => !this._settings.is_writable(`lens-${dimension}`)))
            return;
        this._resizing = true;
        try {
            for (const [dimension, value] of Object.entries(size)) {
                const key = `lens-${dimension}`;
                if (value !== this._settings.get_int(key))
                    this._settings.set_int(key, value);
            }
        } finally {
            this._resizing = false;
        }
    }

    _zoom(direction) {
        const active = this._a11y.get_boolean('screen-magnifier-enabled');
        if (!active && direction < 0)
            return;
        const current = active ? this._magnifierSettings.get_double('mag-factor') : 1;
        const zoom = nextZoom(current, this._settings.get_double('zoom-step'), direction);
        if (zoom <= 1) {
            // Keep the last useful factor so GNOME's toggle can turn the lens on again.
            this._a11y.set_boolean('screen-magnifier-enabled', false);
        } else {
            this._magnifierSettings.set_double('mag-factor', zoom);
            this._a11y.set_boolean('screen-magnifier-enabled', true);
        }
    }

    disable() {
        this._shutter?.destroy();
        this._shutter = null;
        this._restoreScreenshotCursor?.();
        this._screenshotPending = null;
        if (this._screenshotBinding) {
            Main.wm.setCustomKeybindingHandler('show-screenshot-ui',
                Shell.ActionMode.ALL & ~Shell.ActionMode.LOGIN_SCREEN,
                Screenshot.showScreenshotUI);
        }
        this._screenshotBinding = false;
        this._indicator?.destroy();
        this._indicator = null;
        if (this._indicatorVisibilityId)
            this._a11y.disconnect(this._indicatorVisibilityId);
        this._indicatorVisibilityId = 0;
        if (Main.wm.handleWorkspaceScroll === this._workspaceScrollHandler)
            Main.wm.handleWorkspaceScroll = this._originalWorkspaceScroll;
        this._workspaceScrollHandler = null;
        this._originalWorkspaceScroll = null;
        if (this._scrollId)
            global.stage.disconnect(this._scrollId);
        this._scrollId = 0;
        if (this._settingsChangedId)
            this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = 0;
        if (this._monitorsChangedId)
            Main.layoutManager.disconnect(this._monitorsChangedId);
        this._monitorsChangedId = 0;
        for (const key of this._boundShortcuts ?? [])
            Main.wm.removeKeybinding(key);
        this._boundShortcuts = null;
        this._clearAppearance();
        const restoreRegion = this._injections !== undefined && this._injections !== null;
        this._injections?.clear();
        this._injections = null;
        const region = this._region;
        this._region = null;
        this._settings = null;
        this._a11y = null;
        this._magnifierSettings = null;
        this._scrollRemainder = 0;
        this._scrollAction = null;
        this._lastScrollTime = 0;
        if (restoreRegion && region) {
            region._updateScreenPosition();
            region.scrollToMousePos();
        }
    }
}
