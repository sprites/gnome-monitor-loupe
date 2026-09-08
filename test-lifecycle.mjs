import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {lensGeometry} from './geometry.js';
import {nextZoom} from './zoom.js';

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
    get_double(key) { return this.values[key]; }
    get_boolean(key) { return this.values[key]; }
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
});
const a11y = new Settings({'screen-magnifier-enabled': false});
const magnifierSettings = new Settings({'mag-factor': 2});
const stage = new Signals();
const layout = new Signals();
layout.monitors = [{x: 0, y: 0, width: 1920, height: 1080}];
const keys = new Map();
let restoreCount = 0;
let failROI = false;
const region = {
    _xMagFactor: 2, _yMagFactor: 2, _lensMode: true, _clampScrollingAtEdges: true,
    _setViewPort(viewport) { this.viewport = viewport; },
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
    layoutManager: layout,
    magnifier: {getZoomRegions: () => [region]},
    wm: {
        addKeybinding: (key, _settings, _flags, _mode, callback) => keys.set(key, callback),
        removeKeybinding: key => keys.delete(key),
    },
};
const Clutter = {
    EVENT_PROPAGATE: false, EVENT_STOP: true, EventType: {SCROLL: 1},
    ScrollDirection: {UP: 0, DOWN: 1, SMOOTH: 2, LEFT: 3},
    ModifierType: {SUPER_MASK: 1, MOD4_MASK: 2, MOD1_MASK: 4, CONTROL_MASK: 8, SHIFT_MASK: 16},
};
const ExtensionClass = vm.runInNewContext(`${source}\nMonitorLoupe;`, {
    Extension: class { getSettings() { return settings; } },
    InjectionManager, lensGeometry, nextZoom, Main, Clutter,
    Gio: {Settings: class {
        constructor({schema_id}) {
            return schema_id.endsWith('.applications') ? a11y : magnifierSettings;
        }
    }},
    Meta: {KeyBindingFlags: {NONE: 0}}, Shell: {ActionMode: {NORMAL: 1, OVERVIEW: 2}},
    global: {stage, get_pointer: () => [10, 10]},
});
const extension = new ExtensionClass();
let eventTime = 100;
const scroll = (direction, state = 5, dy = 0, dx = 0) => stage.emit('captured-event', {
    type: () => 1, get_state: () => state, get_scroll_direction: () => direction,
    get_scroll_delta: () => [dx, dy], get_time: () => eventTime++,
});

extension.enable();
assert.equal(keys.size, 2);
assert.equal(region.viewport.width, 640);
settings.values['lens-width'] = 900;
settings.emit('changed', 'lens-width');
assert.equal(region.viewport.width, 900, 'Resize must apply without re-enabling');
layout.monitors = [{x: 0, y: 0, width: 500, height: 300}];
layout.emit('monitors-changed');
assert.equal(region.viewport.width, 500);
assert.equal(region.viewport.height, 300);

assert.equal(scroll(0, 0), false);
assert.equal(a11y.values['screen-magnifier-enabled'], false);
assert.equal(scroll(0), true);
assert.equal(a11y.values['screen-magnifier-enabled'], true);
assert.equal(magnifierSettings.values['mag-factor'], 1.25);
keys.get('loupe-zoom-in')();
assert.equal(magnifierSettings.values['mag-factor'], 1.5);
settings.values['zoom-step'] = 0.5;
scroll(0);
assert.equal(magnifierSettings.values['mag-factor'], 2);
scroll(1);
scroll(1);
assert.equal(a11y.values['screen-magnifier-enabled'], false);
assert.equal(magnifierSettings.values['mag-factor'], 1.5, 'Keep a usable factor for the system toggle');
scroll(1);
assert.equal(a11y.values['screen-magnifier-enabled'], false);

scroll(2, 5, -0.4);
assert.equal(a11y.values['screen-magnifier-enabled'], false);
scroll(2, 5, -0.6);
assert.equal(a11y.values['screen-magnifier-enabled'], true);
assert.equal(magnifierSettings.values['mag-factor'], 1.5);
assert.equal(scroll(2, 5, 0, 1), false, 'Horizontal gestures must pass through');
assert.equal(scroll(0, 5 | 8), false, 'Extra modifiers must pass through');
settings.values['scroll-zoom'] = false;
assert.equal(scroll(0), false);
settings.values['scroll-zoom'] = true;
Main.actionMode = 4;
assert.equal(scroll(0), false, 'Do not intercept lock-screen or modal input');
Main.actionMode = 1;

failROI = true;
assert.throws(() => region._changeROI(), /ROI failure/);
assert.equal(region._lensMode, true);
assert.equal(region._clampScrollingAtEdges, true);
failROI = false;
extension.disable();
assert.equal(stage.handlers.size, 0);
assert.equal(layout.handlers.size, 0);
assert.equal(settings.handlers.size, 0);
assert.equal(keys.size, 0);
for (const key of ['_setViewPort', '_changeROI', 'scrollToMousePos'])
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
const originalAPI = region._setViewPort;
region._setViewPort = undefined;
assert.throws(() => extension.enable(), /Unsupported GNOME magnifier API/);
assert.equal(stage.handlers.size, 0);
region._setViewPort = originalAPI;
console.log('Extension lifecycle passed: resize, hotplug, shortcuts, scroll, rollback and cleanup (mock Shell).');
