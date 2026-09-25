import assert from 'node:assert/strict';
import {lensGeometry, shapeSize, insideLens} from './geometry.js';
const layouts = [
    [{x: 0, y: 0, width: 1920, height: 1080}, {x: 1920, y: 0, width: 2560, height: 1440}],
    [{x: 0, y: 1080, width: 1920, height: 1080}, {x: 320, y: 0, width: 1280, height: 1080}],
    [{x: -1920, y: 0, width: 1920, height: 1080}, {x: 0, y: 0, width: 1536, height: 864}],
];
let count = 0;
for (const monitors of layouts) {
    for (const m of monitors) {
        for (const dx of [0, 1, m.width / 2, m.width - 1]) {
            for (const dy of [0, 1, m.height / 2, m.height - 1]) {
                for (const [width, height] of [[640, 360], [160, 90], [900, 700], [7680, 4320]]) {
                for (const zoom of [1, 1.25, 2, 8, 32]) {
                    const px = m.x + dx, py = m.y + dy;
                    const g = lensGeometry(monitors, px, py, zoom, zoom, width, height);
                    const v = g.viewport;
                    assert.equal(v.x, Math.round(px - v.width / 2));
                    assert.equal(v.y, Math.round(py - v.height / 2));
                    assert(Math.abs(v.x + v.width / 2 + (px - g.xCenter) * zoom - px) < 1e-9);
                    assert.equal(v.width, Math.min(width, m.width));
                    assert.equal(v.height, Math.min(height, m.height));
                    count++;
                }
                }
            }
        }
    }
}
assert.equal(lensGeometry(layouts[0], -100, -100, 2, 2), null);
for (const monitors of layouts) {
    for (const m of monitors) {
        for (const shape of ['loupe', 'binoculars', 'telescope']) {
            for (const radius of [60, 300, 2160]) {
                for (const [px, py] of [[m.x, m.y], [m.x + m.width - 1, m.y + m.height - 1]]) {
                    const g = lensGeometry(monitors, px, py, 2, 2, 1000, 650, shape, radius);
                    const v = g.viewport;
                    const [w, h] = shapeSize(shape);
                    assert.equal(v.x, Math.round(px - v.width / 2));
                    assert.equal(v.y, Math.round(py - v.height / 2));
                    assert(Math.abs(v.width / w - v.height / h) < 1, 'Lenses must stay round');
                    assert(Math.abs(v.x + v.width / 2 + (px - g.xCenter) * 2 - px) < 1e-9);
                    assert(Math.abs(v.y + v.height / 2 + (py - g.yCenter) * 2 - py) < 1e-9);
                    assert(!insideLens(shape, 0, 0, v.width, v.height));
                    assert(insideLens(shape, v.width / w, v.height / h, v.width, v.height));
                    count++;
                }
            }
        }
    }
}
assert(insideLens('binoculars', 240, 100, 340, 200));
assert(!insideLens('loupe', 240, 240, 260, 260), 'Handle is not glass');
console.log(`${count} geometry cases passed (edges, monitor switches, scaling, pointer alignment).`);
