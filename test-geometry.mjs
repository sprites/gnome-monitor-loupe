import assert from 'node:assert/strict';
import {lensGeometry} from './geometry.js';
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
                    assert(v.x >= m.x && v.y >= m.y);
                    assert(v.x + v.width <= m.x + m.width);
                    assert(v.y + v.height <= m.y + m.height);
                    assert(g.xCenter - v.width / zoom / 2 >= m.x - 1e-9);
                    assert(g.xCenter + v.width / zoom / 2 <= m.x + m.width + 1e-9);
                    assert(g.yCenter - v.height / zoom / 2 >= m.y - 1e-9);
                    assert(g.yCenter + v.height / zoom / 2 <= m.y + m.height + 1e-9);
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
console.log(`${count} geometry cases passed (edges, monitor switches, scaling, source bounds).`);
