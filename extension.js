// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {lensGeometry} from './geometry.js';
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
        this._lastScrollTime = 0;
        this._region = Main.magnifier.getZoomRegions()[0];
        const region = this._region;
        if (!region || typeof region._changeROI !== 'function' ||
            typeof region._setViewPort !== 'function' ||
            typeof region._updateScreenPosition !== 'function' ||
            typeof region.scrollToMousePos !== 'function' ||
            typeof region._isMouseOverRegion !== 'function')
            throw new Error('Unsupported GNOME magnifier API');
        this._injections = new InjectionManager();
        const originalSetViewPort = region._setViewPort;
        const geometry = (params = {}) => {
            const [x, y] = global.get_pointer();
            return lensGeometry(Main.layoutManager.monitors, x, y,
                params.xMagFactor ?? region._xMagFactor,
                params.yMagFactor ?? region._yMagFactor,
                this._settings.get_int('lens-width'),
                this._settings.get_int('lens-height'));
        };
        this._injections.overrideMethod(region, '_setViewPort', original =>
            function (viewport, fromROIUpdate) {
                const lens = geometry();
                return original.call(this, lens?.viewport ?? viewport, fromROIUpdate);
            });
        this._injections.overrideMethod(region, '_changeROI', original =>
            function (params = {}) {
                const lens = geometry(params);
                if (!lens)
                    return original.call(this, params);
                originalSetViewPort.call(this, lens.viewport, true);
                const lensMode = this._lensMode;
                const clampEdges = this._clampScrollingAtEdges;
                // Geometry above handles both viewport and source bounds per monitor.
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
            if (key === 'lens-width' || key === 'lens-height')
                region._changeROI();
            this._scrollRemainder = 0;
        });
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
    }

    _onEvent(event) {
        if (event.type() !== Clutter.EventType.SCROLL)
            return Clutter.EVENT_PROPAGATE;
        const state = event.get_state();
        const superHeld = state & (Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.MOD4_MASK);
        const altHeld = state & Clutter.ModifierType.MOD1_MASK;
        const extraHeld = state & (Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.SHIFT_MASK);
        if (!this._settings.get_boolean('scroll-zoom') ||
            !(Main.actionMode & (Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW)) ||
            !superHeld || !altHeld || extraHeld) {
            this._scrollRemainder = 0;
            return Clutter.EVENT_PROPAGATE;
        }
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
            this._scrollRemainder = 0;
            this._zoom(1);
            break;
        case Clutter.ScrollDirection.DOWN:
            this._scrollRemainder = 0;
            this._zoom(-1);
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
            const steps = Math.trunc(this._scrollRemainder);
            this._scrollRemainder -= steps;
            if (steps !== 0)
                this._zoom(-steps);
            break;
        }
        default:
            return Clutter.EVENT_PROPAGATE;
        }
        return Clutter.EVENT_STOP;
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
        const restoreRegion = this._injections !== undefined && this._injections !== null;
        this._injections?.clear();
        this._injections = null;
        const region = this._region;
        this._region = null;
        this._settings = null;
        this._a11y = null;
        this._magnifierSettings = null;
        this._scrollRemainder = 0;
        this._lastScrollTime = 0;
        if (restoreRegion && region) {
            region._updateScreenPosition();
            region.scrollToMousePos();
        }
    }
}
