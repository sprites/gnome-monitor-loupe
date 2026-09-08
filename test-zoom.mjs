import assert from 'node:assert/strict';
import {nextZoom} from './zoom.js';

assert.equal(nextZoom(2, 0.25, 1), 2.25);
assert.equal(nextZoom(2.25, 0.25, -1), 2);
assert.equal(nextZoom(1, 0.25, -1), 1);
assert.equal(nextZoom(31.9, 0.25, 1), 32);
assert.equal(nextZoom(2, 0.25, -100), 1);
assert.equal(nextZoom(2, 0.25, 1000), 32);
for (const step of [0.05, 0.1, 0.25, 0.5, 1, 5]) {
    let zoom = 1;
    for (let i = 0; i < 4; i++)
        zoom = nextZoom(zoom, step, 1);
    for (let i = 0; i < 4; i++)
        zoom = nextZoom(zoom, step, -1);
    assert.equal(zoom, 1, `Zoom step ${step} must return to 1×`);
}
console.log('Zoom arithmetic passed: fractional steps, reversibility and 1×–32× limits.');
