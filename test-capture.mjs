import assert from 'node:assert/strict';
import {capturePlan, maskLenses} from './capture.js';

const stage = {width: 1920, height: 1080};
const rect = {x: 100, y: 100, width: 480, height: 280};
assert.deepEqual(capturePlan(rect, stage, 'rectangle', 4, false),
    {x: 104, y: 104, width: 472, height: 272, circles: null});
assert.deepEqual(capturePlan(rect, stage, 'rectangle', 4, true),
    {x: 100, y: 100, width: 480, height: 280, circles: null});
assert.deepEqual(capturePlan({...rect, x: -200}, stage, 'rectangle', 4, false),
    {x: 0, y: 104, width: 276, height: 272, circles: null});
assert.equal(capturePlan({...rect, x: -500}, stage, 'rectangle', 4, false), null);

for (const [shape, width, height] of [
    ['loupe', 520, 520], ['telescope', 400, 400], ['binoculars', 680, 400],
]) {
    const plan = capturePlan({x: 100, y: 100, width, height}, stage, shape, 2, false);
    assert.equal(plan.circles.length, shape === 'binoculars' ? 2 : 1);
    assert.equal(plan.height, 380);
    assert.equal(plan.width, shape === 'binoculars' ? 660 : 380,
        'Crop tightly to the glass; omit handle and border');
    const stride = plan.width * 4 + 8;
    const pixels = new Uint8Array(stride * plan.height).fill(255);
    maskLenses(pixels, plan.width, plan.height, stride, plan);
    const alpha = (x, y) => pixels[y * stride + x * 4 + 3];
    assert.equal(alpha(0, 0), 0, 'Corners must be transparent');
    assert.equal(pixels[0], 0, 'Transparent pixels must not retain desktop RGB');
    assert.equal(alpha(190, 190), 255, 'Lens center stays opaque');
    assert.equal(alpha(190, 0), 127, 'Antialiased glass edge');
    assert.equal(pixels[stride - 1], 255, 'Respect row padding');
    if (shape === 'binoculars') {
        assert.equal(alpha(470, 190), 255, 'Both lenses must be present');
        assert.equal(alpha(330, 190), 255, 'Overlapping glass remains opaque');
        assert.equal(alpha(330, 0), 0, 'Desktop between top edges is transparent');
    }
    // The same geometry must mask correctly when clipped at a screen edge.
    const clipped = capturePlan({x: -100, y: -100, width, height}, stage, shape, 2, false);
    assert.equal(clipped.x, 0);
    assert.equal(clipped.y, 0);

    const decorated = capturePlan({x: 100, y: 100, width, height}, stage, shape, 2, true);
    const decoratedPixels = new Uint8Array(decorated.width * decorated.height * 4).fill(255);
    maskLenses(decoratedPixels, decorated.width, decorated.height, decorated.width * 4, decorated);
    const at = (x, y) => decoratedPixels[
        ((y - decorated.y) * decorated.width + x - decorated.x) * 4 + 3];
    assert.equal(decoratedPixels[3], 0, 'Decorated instruments also have transparent corners');
    assert.equal(at(490, 300), 255, 'Preserve the frame when enabled');
    if (shape === 'loupe') {
        assert.equal(decorated.width, 500);
        assert.equal(at(550, 550), 255, 'Keep the handle');
        assert.equal(at(580, 300), 0, 'Remove desktop beside the handle');
        assert.equal(at(300, 580), 0, 'Remove desktop below the lens');
    } else {
        assert.equal(decorated.handle, undefined);
        assert.equal(decorated.height, 384);
    }
    for (const includeFrame of [false, true]) {
        const clear = capturePlan({x: 100, y: 100, width, height}, stage,
            shape, 2, includeFrame, true);
        const opaque = capturePlan({x: 100, y: 100, width, height}, stage,
            shape, 2, includeFrame, false);
        assert.deepEqual([opaque.x, opaque.y, opaque.width, opaque.height],
            [clear.x, clear.y, clear.width, clear.height], 'Background toggle preserves the crop');
        assert.equal(opaque.circles, null, 'With background, do not apply an alpha mask');
        assert.equal(opaque.handle, undefined);
    }
}
console.log('Capture geometry and alpha masks passed: frame, handle, circles, binocular union and desktop edges.');
