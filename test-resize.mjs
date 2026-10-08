import assert from 'node:assert/strict';
import {nextLensSize, shapeSize} from './geometry.js';

const monitor = {width: 1920, height: 1080};
assert.deepEqual(nextLensSize(1000, 650, 300, 'rectangle', 1, monitor),
    {width: 1100, height: 715});
assert.deepEqual(nextLensSize(1100, 715, 300, 'rectangle', -1, monitor),
    {width: 1000, height: 650});
assert.deepEqual(nextLensSize(1000, 650, 300, 'loupe', 1, monitor), {radius: 330});
assert.deepEqual(nextLensSize(1000, 650, 330, 'loupe', -1, monitor), {radius: 300});

let cases = 0;
for (const screen of [monitor, {width: 800, height: 600}, {width: 7680, height: 4320}]) {
    for (const shape of ['loupe', 'binoculars', 'telescope']) {
        const [w, h] = shapeSize(shape);
        const max = Math.max(60, Math.floor(Math.min(2160, screen.width / w, screen.height / h)));
        assert.equal(nextLensSize(1000, 650, 300, shape, 1000, screen).radius, max);
        assert.equal(nextLensSize(1000, 650, 300, shape, -1000, screen).radius, 60);
        // Starting with an oversized saved radius must shrink from its visible size.
        assert(nextLensSize(1000, 650, 2160, shape, -1, screen).radius < max);
        cases += 3;
    }
    for (const [width, height] of [[640, 360], [1000, 650], [160, 90], [1000, 90], [160, 1000]]) {
        for (const direction of [-1000, -1, 1, 1000]) {
            const size = nextLensSize(width, height, 300, 'rectangle', direction, screen);
            assert(size.width >= 160 && size.width <= 7680);
            assert(size.height >= 90 && size.height <= 4320);
            assert(Math.abs(size.width / width - size.height / height) <= 1 / width + 1 / height,
                'Both dimensions must use the same scale, within integer rounding');
            if (width <= screen.width && height <= screen.height) {
                // Very tall/thin rectangles can hit schema minima before fitting;
                // the renderer still clips them to the monitor.
                assert(size.width <= screen.width && size.height <= screen.height);
            }
            cases++;
        }
    }
}
console.log(`${cases} size cases passed: proportional scaling, all shapes, monitor caps and schema limits.`);
