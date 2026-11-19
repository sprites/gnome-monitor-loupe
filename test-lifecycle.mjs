import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {lensGeometry, insideLens, shapeSize, nextLensSize} from './geometry.js';
import {nextZoom} from './zoom.js';
import {frameColor} from './color.js';
import {capturePlan, maskLenses} from './capture.js';

// Run the real extension against a small Shell boundary, without a live desktop.
class Signals {
    handlers = new Map();
    nextId = 1;
    connect(name, fn) {
        const id = this.nextId++;
        this.handlers.set(id, {name, fn});
        return id;
    }
    disconnect(id) {
        assert(this.handlers.delete(id), `Signal ${id} must exist`);
    }
    emit(name, ...args) {
        let result;
        for (const handler of this.handlers.values()) {
            if (handler.name === name)
                result = handler.fn(this, ...args);
        }
        return result;
    }
}
class Settings extends Signals {
    constructor(values) { super(); this.values = values; }
    get_int(key) { return this.values[key]; }
    get_string(key) { return this.values[key]; }
    get_double(key) { return this.values[key]; }
    get_boolean(key) { return this.values[key]; }
    is_writable() { return true; }
    set_int(key, value) { this.values[key] = value; this.emit('changed', key); }
    set_boolean(key, value) { this.values[key] = value; }
    set_double(key, value) { this.values[key] = value; }
}
class InjectionManager {
    restores = [];
    overrideMethod(object, key, create) {
        const original = object[key];
        this.restores.push(() => { object[key] = original; });
        object[key] = create(original);
    }
    clear() { this.restores.reverse().forEach(restore => restore()); }
}
const source = readFileSync(new URL('./extension.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export default class MonitorLoupe', 'class MonitorLoupe');
const settings = new Settings({
    'lens-width': 640, 'lens-height': 360, 'zoom-step': 0.25, 'scroll-zoom': true,
    'lens-shape': 'rectangle', 'lens-radius': 300, 'scroll-zoom-modifiers': 9,
    'frame-color': '#242b33', 'rectangle-border-width': 2,
    'scroll-resize': false, 'scroll-resize-modifiers': 13,
    'screenshot-lens': false,
    'screenshot-decoration': true, 'screenshot-shutter': false,
    'screenshot-transparent': true,
});
const a11y = new Settings({'screen-magnifier-enabled': false});
const magnifierSettings = new Settings({'mag-factor': 2});
const stage = new Signals();
const layout = new Signals();
layout.monitors = [{x: 0, y: 0, width: 1920, height: 1080}];
const keys = new Map();
let screenshotHandler;
let snapshot;
let snapshotCount = 0;
const captures = [];
let shutterCount = 0;
const shutters = [];
const Screenshot = {
    showScreenshotUI() { return 'screenshot-ui'; },
    async captureScreenshot(...args) { captures.push(args); },
};
let restoreCount = 0;
let failROI = false;
const region = {
    _magnifier: {hideSystemCursor() {}},
    _xMagFactor: 2, _yMagFactor: 2, _lensMode: true, _clampScrollingAtEdges: true,
    _setViewPort(viewport) {
        this.viewport = viewport;
        this._viewPortX = viewport.x;
        this._viewPortY = viewport.y;
        this._viewPortWidth = viewport.width;
        this._viewPortHeight = viewport.height;
        this._updateMagViewGeometry();
    },
    _updateMagViewGeometry() {},
    _destroyActors() { this._magView = null; },
    _isFullScreen() { return true; },
    isActive() { return false; },
    _changeROI(params) {
        if (failROI)
            throw new Error('ROI failure');
        this.roi = params;
    },
    scrollToMousePos() {},
    _isMouseOverRegion() { return true; },
    _updateScreenPosition() { restoreCount++; },
};
const originals = {...region};
const Main = {
    actionMode: 1,
    uiGroup: {set_opacity(value) { this.opacity = value; }},
    layoutManager: layout,
    magnifier: {getZoomRegions: () => [region]},
    wm: {
        handleWorkspaceScroll: event => { Main.workspaceFallback = event; return 'fallback'; },
        addKeybinding: (key, _settings, _flags, _mode, callback) => keys.set(key, callback),
        removeKeybinding: key => keys.delete(key),
        setCustomKeybindingHandler: (key, _modes, handler) => {
            assert.equal(key, 'show-screenshot-ui');
            screenshotHandler = handler;
        },
    },
};
const Clutter = {
    Image: class {
        set_data(pixels) { this.pixels = pixels; }
        get_texture() { return this.pixels; }
    },
    EVENT_PROPAGATE: false, EVENT_STOP: true, EventType: {SCROLL: 1},
    ScrollDirection: {UP: 0, DOWN: 1, SMOOTH: 2, LEFT: 3},
    ModifierType: {SUPER_MASK: 1, MOD4_MASK: 2, MOD1_MASK: 4, CONTROL_MASK: 8, SHIFT_MASK: 16},
};
const ExtensionClass = vm.runInNewContext(`${source}\nMonitorLoupe;`, {
    Extension: class { getSettings() { return settings; } },
    InjectionManager, lensGeometry, insideLens, shapeSize, nextLensSize, nextZoom, Main, Clutter,
    Screenshot, capturePlan, maskLenses, frameColor,
    showShutter: () => {
        shutterCount++;
        const actor = new Signals();
        actor.destroy = () => { actor.emit('destroy'); actor.destroyed = true; };
        shutters.push(actor);
        return actor;
    },
    createLensEffect: (shape, color, borderWidth, radius) => ({shape, color, borderWidth, radius}),
    Gio: {MemoryOutputStream: {new_resizable: () => ({close() {}})}, Settings: class {
        constructor({schema_id}) {
            return schema_id.endsWith('.applications') ? a11y : magnifierSettings;
        }
    }},
    Meta: {KeyBindingFlags: {NONE: 0}}, Shell: {
        ActionMode: {NORMAL: 1, OVERVIEW: 2, ALL: 255, LOGIN_SCREEN: 128},
        Screenshot: class {
            static async composite_to_stream() {
                return {add_alpha: () => ({width: 20, height: 20, rowstride: 80,
                    get_pixels: () => new Uint8Array(1600).fill(255)})};
            }
            screenshot_stage_to_content() {
                snapshotCount++;
                return new Promise((resolve, reject) => { snapshot = {resolve, reject}; });
            }
        },
    },
    Cogl: {PixelFormat: {RGBA_8888: 1}},
    St: {ImageContent: {new_with_preferred_size: () => new Clutter.Image()}},
    global: {stage, get_pointer: () => [10, 10]},
});
const extension = new ExtensionClass();
let eventTime = 100;
const scroll = (direction, state = 9, dy = 0, dx = 0) => stage.emit('captured-event', {
    type: () => 1, get_state: () => state, get_scroll_direction: () => direction,
    get_scroll_delta: () => [dx, dy], get_time: () => eventTime++,
});

extension.enable();
assert.equal(keys.size, 2);
assert.equal(screenshotHandler, undefined, 'Default must leave PrintScreen alone');
assert.notEqual(Main.wm.handleWorkspaceScroll, Main.wm.handleWorkspaceScroll.__original);
assert.equal(region.viewport.width, 640);
assert.equal(region.viewport.x, -310, 'Lens must stay centered while the stage clips its off-screen part');
assert.equal(region._viewPortX, -310, 'Do not restore GNOME edge clamping after viewport updates');
settings.values['lens-width'] = 900;
settings.emit('changed', 'lens-width');
assert.equal(region.viewport.width, 900, 'Resize must apply without re-enabling');
layout.monitors = [{x: 0, y: 0, width: 500, height: 300}];
layout.emit('monitors-changed');
assert.equal(region.viewport.width, 500);
assert.equal(region.viewport.height, 300);

function mockActor() {
    return {
        style: 'original', effects: new Set(),
        get_style() { return this.style; },
        set_style(style) { this.style = style; },
        add_effect(effect) { this.effects.add(effect); },
        remove_effect(effect) { assert(this.effects.delete(effect)); },
    };
}
const actor = mockActor();
region._magView = actor;
for (const shape of ['loupe', 'binoculars', 'telescope']) {
    settings.values['lens-shape'] = shape;
    settings.emit('changed', 'lens-shape');
    assert.equal(actor.effects.size, 1, 'Shape changes must replace the effect');
    assert.equal([...actor.effects][0].shape, shape);
    assert.equal([...actor.effects][0].borderWidth, 2, 'Frame thickness must apply to every round shape');
    assert.equal(region._isFullScreen(), false, 'Desktop must remain visible through the mask');
    assert.equal(region._isMouseOverRegion(), true, 'Keep the cursor centered in the lens at desktop edges');
}
settings.values['lens-radius'] = 60;
settings.emit('changed', 'lens-radius');
assert.equal(region.viewport.width, 120, 'Radius must apply immediately');
region._destroyActors();
assert.equal(actor.effects.size, 0, 'Release effects before GNOME destroys its actor');
assert.equal(actor.style, 'original');
region._magView = mockActor();
region._updateMagViewGeometry();
assert.equal(region._magView.effects.size, 1, 'Reactivation must recreate the mask');
settings.values['lens-shape'] = 'rectangle';
settings.emit('changed', 'lens-shape');
assert.equal(region._magView.effects.size, 0);
assert.match(region._magView.style, /border: 2px solid #242b33/);
settings.values['frame-color'] = '#ff8800';
settings.emit('changed', 'frame-color');
settings.values['rectangle-border-width'] = 12;
settings.emit('changed', 'rectangle-border-width');
assert.match(region._magView.style, /border: 12px solid #ff8800/);
settings.values['rectangle-border-width'] = 0;
settings.emit('changed', 'rectangle-border-width');
assert.match(region._magView.style, /border: 0px/);
settings.values['lens-shape'] = 'loupe';
settings.emit('changed', 'lens-shape');
assert.equal([...region._magView.effects][0].color, '#ff8800');
assert.equal([...region._magView.effects][0].borderWidth, 0, 'Frame thickness 0 must hide round frames');
settings.values['frame-color'] = '#00AAFF';
settings.emit('changed', 'frame-color');
assert.equal(region._magView.effects.size, 1);
assert.equal([...region._magView.effects][0].color, '#00aaff');
settings.values['frame-color'] = 'invalid; color: red';
settings.emit('changed', 'frame-color');
assert.equal([...region._magView.effects][0].color, '#242b33');
settings.values['lens-shape'] = 'rectangle';
settings.emit('changed', 'lens-shape');
assert.equal(region._isFullScreen(), true);

assert.equal(scroll(0, 0), false);
assert.equal(a11y.values['screen-magnifier-enabled'], false);
assert.equal(scroll(0), true);
assert.equal(a11y.values['screen-magnifier-enabled'], true);
assert.equal(magnifierSettings.values['mag-factor'], 1.25);
const workspaceHandler = Main.wm.handleWorkspaceScroll;
assert.equal(workspaceHandler({type: () => 1, get_state: () => 9,
    get_scroll_direction: () => 0, get_scroll_delta: () => [0, 1], get_time: () => 1}), true,
    'Events forwarded by GNOME over application windows must zoom');
assert.equal(magnifierSettings.values['mag-factor'], 1.5);
keys.get('loupe-zoom-in')();
assert.equal(magnifierSettings.values['mag-factor'], 1.75);
settings.values['zoom-step'] = 0.5;
scroll(0);
assert.equal(magnifierSettings.values['mag-factor'], 2.25);
scroll(1);
scroll(1);
scroll(1);
assert.equal(a11y.values['screen-magnifier-enabled'], false);
assert.equal(magnifierSettings.values['mag-factor'], 1.25, 'Keep a usable factor for the system toggle');
scroll(1);
assert.equal(a11y.values['screen-magnifier-enabled'], false);

scroll(2, 9, -0.4);
assert.equal(a11y.values['screen-magnifier-enabled'], false);
scroll(2, 9, -0.6);
assert.equal(a11y.values['screen-magnifier-enabled'], true);
assert.equal(magnifierSettings.values['mag-factor'], 1.5);
assert.equal(scroll(2, 9, 0, 1), false, 'Horizontal gestures must pass through');
assert.equal(scroll(0, 9 | 4), false, 'Extra modifiers must pass through');
assert.equal(scroll(0, 5), false, 'The old Super+Alt default must pass through');
assert.equal(scroll(0, 8 | 2), true, 'MOD4 must also count as Super');
assert.equal(scroll(0, 8 | 1 | 2), true, 'Both Super masks must count as one modifier');
// Every selectable combination must match exactly and apply without restarting.
for (let configured = 1; configured <= 15; configured++) {
    settings.values['scroll-zoom-modifiers'] = configured;
    settings.emit('changed', 'scroll-zoom-modifiers');
    for (let held = 0; held <= 15; held++) {
        const state = (held & 1 ? 8 : 0) | (held & 2 ? 4 : 0) |
            (held & 4 ? 16 : 0) | (held & 8 ? 1 : 0);
        assert.equal(scroll(0, state), held === configured,
            `Configured modifiers ${configured}, held ${held}`);
    }
}
settings.values['scroll-zoom-modifiers'] = 9;
magnifierSettings.values['mag-factor'] = 2;
// Partial smooth scrolling must not carry over to a new combination.
scroll(2, 9, -0.4);
settings.values['scroll-zoom-modifiers'] = 10;
settings.emit('changed', 'scroll-zoom-modifiers');
const factorBefore = magnifierSettings.values['mag-factor'];
scroll(2, 5, -0.6);
assert.equal(magnifierSettings.values['mag-factor'], factorBefore);
scroll(2, 5, -0.4);
assert.equal(magnifierSettings.values['mag-factor'], factorBefore + 0.5);
settings.values['scroll-zoom-modifiers'] = 9;
settings.values['scroll-zoom'] = false;
assert.equal(scroll(0), false);
settings.values['scroll-zoom'] = true;
Main.actionMode = 4;
assert.equal(scroll(0), false, 'Do not intercept lock-screen or modal input');
Main.actionMode = 1;

// Size gestures change dimensions, never the magnification or enabled state.
settings.values['scroll-resize'] = true;
settings.values['lens-shape'] = 'rectangle';
settings.values['lens-width'] = 640;
settings.values['lens-height'] = 360;
layout.monitors = [{x: 0, y: 0, width: 1920, height: 1080}];
const zoomBeforeResize = magnifierSettings.values['mag-factor'];
const enabledBeforeResize = a11y.values['screen-magnifier-enabled'];
assert.equal(scroll(0, 25), true); // Ctrl + Shift + Super
assert.equal(settings.values['lens-width'], 704);
assert.equal(settings.values['lens-height'], 396);
assert.equal(region.viewport.width, 704, 'Resize must update the visible lens');
assert.equal(magnifierSettings.values['mag-factor'], zoomBeforeResize);
assert.equal(a11y.values['screen-magnifier-enabled'], enabledBeforeResize);
scroll(1, 25);
assert.equal(settings.values['lens-width'], 640);
assert.equal(settings.values['lens-height'], 360);
for (let i = 0; i < 50; i++) scroll(0, 25);
assert(settings.values['lens-width'] <= 1920);
assert(settings.values['lens-height'] <= 1080);
for (let i = 0; i < 100; i++) scroll(1, 25);
assert(settings.values['lens-width'] >= 160);
assert(settings.values['lens-height'] >= 90);
settings.values['lens-shape'] = 'loupe';
settings.values['lens-radius'] = 300;
scroll(0, 25);
assert.equal(settings.values['lens-radius'], 330);
scroll(1, 25);
assert.equal(settings.values['lens-radius'], 300);
// Smooth-wheel fractions must survive our own dimension writes.
scroll(2, 25, -1.4);
assert.equal(settings.values['lens-radius'], 330);
scroll(2, 25, -0.6);
assert.equal(settings.values['lens-radius'], 363);
// A partial zoom gesture must not leak into a size gesture.
scroll(2, 9, -0.4);
scroll(2, 25, -0.6);
assert.equal(settings.values['lens-radius'], 363);
settings.values['scroll-resize-modifiers'] = 10; // Alt + Super
settings.emit('changed', 'scroll-resize-modifiers');
assert.equal(scroll(0, 25), false);
assert.equal(scroll(0, 5), true);
assert.equal(settings.values['lens-radius'], 399);
assert.equal(scroll(2, 5, 0, 1), false, 'Horizontal resizing gestures pass through');
settings.values['scroll-resize'] = false;
assert.equal(scroll(0, 5), false);
settings.values['scroll-resize'] = true;
Main.actionMode = 4;
assert.equal(scroll(0, 5), false, 'Size gestures must not intercept the lock screen');
Main.actionMode = 1;

failROI = true;
assert.throws(() => region._changeROI(), /ROI failure/);
assert.equal(region._lensMode, true);
assert.equal(region._clampScrollingAtEdges, true);
failROI = false;
settings.values['lens-shape'] = 'loupe';
settings.emit('changed', 'lens-shape');
extension.disable();
assert.equal(region._magView.effects.size, 0, 'Disable must remove the mask');
assert.equal(region._magView.style, 'original');
assert.equal(Main.wm.handleWorkspaceScroll({}), 'fallback');
assert.equal(stage.handlers.size, 0);
assert.equal(layout.handlers.size, 0);
assert.equal(settings.handlers.size, 0);
assert.equal(keys.size, 0);
for (const key of ['_setViewPort', '_changeROI', 'scrollToMousePos',
    '_updateMagViewGeometry', '_destroyActors', '_isFullScreen', '_isMouseOverRegion'])
    assert.equal(region[key], originals[key]);
assert.equal(restoreCount, 1);
extension.disable();
assert.equal(restoreCount, 1, 'Repeated disable must be harmless');
extension.enable();
extension.disable();


failROI = true;
assert.throws(() => extension.enable(), /ROI failure/);
assert.equal(region._changeROI, originals._changeROI);
assert.equal(region._setViewPort, originals._setViewPort);
assert.equal(keys.size, 0);
assert.equal(stage.handlers.size, 0);
assert.equal(extension._settings, null);
failROI = false;
// Screenshot binding is opt-in; crop the actual magnified viewport, excluding
// both cursor layers. Cover asynchronous failure and disable during capture.
extension.enable();
settings.values['screenshot-lens'] = true;
settings.emit('changed', 'screenshot-lens');
assert.equal(screenshotHandler(), undefined);
// Inactive magnifier takes the usual GNOME path.
assert.equal(snapshotCount, 0);
const inactive = region.isActive;
region.isActive = () => true;
settings.values['lens-shape'] = 'rectangle';
stage.width = 1920;
stage.height = 1080;
Object.assign(region, {
    _viewPortX: -50, _viewPortY: 20, _viewPortWidth: 640, _viewPortHeight: 360,
    _mouseActor: {visible: true}, _crossHairsActor: {visible: false},
});
const texture = {};
const result = [{get_texture: () => texture}, 2];
const capturing = extension._captureLens();
assert.equal(region._mouseActor.visible, false);
assert.equal(region._crossHairsActor.visible, false);
const roiBeforeCapture = region.roi;
region._changeROI();
assert.equal(region.roi, roiBeforeCapture, 'Freeze lens position while snapshotting');
await extension._captureLens();
assert.equal(snapshotCount, 1, 'Repeated PrintScreen must not overlap captures');
snapshot.resolve(result);
await capturing;
assert.equal(region._mouseActor.visible, true);
assert.equal(region._crossHairsActor.visible, false, 'Preserve originally hidden crosshairs');
assert.equal(captures[0][0], texture);
assert.deepEqual(Array.from(captures[0][1]), [0, 40, 1180, 720]);
assert.equal(captures[0][2], 2);
assert.equal(captures[0][3], null, 'Do not composite the system cursor');

const failedCapture = extension._captureLens();
snapshot.reject(new Error('Snapshot failed'));
await assert.rejects(failedCapture, /Snapshot failed/);
assert.equal(region._mouseActor.visible, true, 'Restore pointer after failure');
assert.equal(extension._screenshotPending, null);
Main.actionMode = 4;
screenshotHandler();
assert.equal(snapshotCount, 2, 'Modal and lock screen input must use GNOME');
Main.actionMode = 1;

settings.values['screenshot-lens'] = false;
settings.emit('changed', 'screenshot-lens');
assert.equal(screenshotHandler, Screenshot.showScreenshotUI);
settings.values['screenshot-lens'] = true;
settings.emit('changed', 'screenshot-lens');
const cancelledCapture = extension._captureLens();
extension.disable();
assert.equal(region._mouseActor.visible, true, 'Disable restores the cursor immediately');
assert.equal(screenshotHandler, Screenshot.showScreenshotUI);
snapshot.resolve(result);
await cancelledCapture;
assert.equal(captures.length, 1, 'Disable must cancel pending capture storage');
extension.enable();
region._viewPortX = 100;
region._viewPortY = 100;
region._viewPortWidth = 520;
region._viewPortHeight = 520;
settings.values['lens-shape'] = 'loupe';
settings.values['screenshot-decoration'] = false;
settings.values['screenshot-shutter'] = true;
const glassCapture = extension._captureLens();
assert.equal(shutterCount, 0, 'Never draw shutter before the snapshot');
snapshot.resolve(result);
await glassCapture;
assert.equal(shutterCount, 1);
assert.equal(captures.length, 2);
assert.equal(captures[1][0][3], 0, 'Saved texture has transparent corners');
assert.equal(captures[1][1], null, 'Masked image is already cropped');
assert.equal(captures[1][2], 1);
settings.values['screenshot-transparent'] = false;
settings.values['screenshot-shutter'] = false;
settings.emit('changed', 'lens-shape');
const originalEffect = extension._shapeEffect;
const captureActor = region._magView;
assert(originalEffect);
const withBackground = extension._captureLens();
assert(!captureActor.effects.has(originalEffect), 'Hide the frame and handle before snapshotting');
snapshot.resolve(result);
await withBackground;
assert(captureActor.effects.has(originalEffect), 'Restore appearance after snapshotting');
assert.equal(captures[2][0], texture, 'With background, retain the original scene texture');
assert.notEqual(captures[2][1], null);
assert.equal(captures[2][2], 2);
const failedBackground = extension._captureLens();
snapshot.reject(new Error('Snapshot failed'));
await assert.rejects(failedBackground, /Snapshot failed/);
assert(captureActor.effects.has(originalEffect), 'Restore decoration after capture failure');
extension.disable();
assert.equal(shutters[0].destroyed, true, 'Disable removes the animation');
assert.equal(extension._shutter, null);
settings.values['screenshot-shutter'] = false;
region.isActive = inactive;
settings.values['screenshot-lens'] = false;
extension.enable();
extension.disable();

const originalAPI = region._setViewPort;
region._setViewPort = undefined;
assert.throws(() => extension.enable(), /Unsupported GNOME magnifier API/);
assert.equal(stage.handlers.size, 0);
region._setViewPort = originalAPI;
console.log('Extension lifecycle passed: resize, hotplug, shortcuts, scroll, rollback and cleanup (mock Shell).');
