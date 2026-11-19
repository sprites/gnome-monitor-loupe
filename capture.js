// SPDX-License-Identifier: GPL-2.0-or-later
import {shapeSize} from './geometry.js';

// Coordinates stay in logical stage pixels until the texture is read back.
export function capturePlan(viewport, stage, shape, border, decorated, transparent = true) {
    const {x, y, width, height} = viewport;
    let left = x, top = y, right = x + width, bottom = y + height;
    let circles = null;
    let handle;
    if (shape === 'rectangle') {
        if (!decorated) {
            left += border;
            top += border;
            right -= border;
            bottom -= border;
        }
    } else {
        const [sw, sh] = shapeSize(shape);
        const radius = Math.min(width / sw, height / sh);
        const glass = Math.max(0, 0.96 * radius - (decorated ? 0 : border));
        circles = [1, ...(shape === 'binoculars' ? [2.4] : [])]
            .map(cx => ({x: x + cx * width / sw, y: y + height / sh, radius: glass}));
        left = Math.min(...circles.map(c => c.x - c.radius));
        top = circles[0].y - glass;
        right = Math.max(...circles.map(c => c.x + c.radius));
        bottom = circles[0].y + glass;
        if (decorated && shape === 'loupe') {
            // Match the capsule used for the handle in appearance.js.
            handle = {ax: x + 1.62 * radius, ay: y + 1.62 * radius,
                bx: x + 2.40 * radius, by: y + 2.40 * radius,
                radius: 0.14 * radius};
            right = Math.max(right, handle.bx + handle.radius);
            bottom = Math.max(bottom, handle.by + handle.radius);
        }
    }
    left = Math.max(0, Math.ceil(left));
    top = Math.max(0, Math.ceil(top));
    right = Math.min(stage.width, Math.floor(right));
    bottom = Math.min(stage.height, Math.floor(bottom));
    if (right <= left || bottom <= top)
        return null;
    const plan = {x: left, y: top, width: right - left, height: bottom - top,
        circles: transparent ? circles : null};
    if (handle && transparent)
        plan.handle = handle;
    return plan;
}

// Use the union of the lenses and optional handle, with an antialiased edge.
// Pixels outside the instrument have zero RGB as well as zero alpha.
export function maskLenses(pixels, width, height, stride, plan) {
    const handle = plan.handle;
    const dx = handle ? handle.bx - handle.ax : 0;
    const dy = handle ? handle.by - handle.ay : 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const px = plan.x + (x + 0.5) * plan.width / width;
            const py = plan.y + (y + 0.5) * plan.height / height;
            let distance = -Infinity;
            for (const circle of plan.circles)
                distance = Math.max(distance,
                    circle.radius - Math.hypot(px - circle.x, py - circle.y));
            if (handle) {
                const t = Math.max(0, Math.min(1,
                    ((px - handle.ax) * dx + (py - handle.ay) * dy) / (dx * dx + dy * dy)));
                distance = Math.max(distance, handle.radius -
                    Math.hypot(px - handle.ax - t * dx, py - handle.ay - t * dy));
            }
            // Fade inward so neither frame nor the desktop outside the lens leaks in.
            const alpha = Math.max(0, Math.min(1, distance / (plan.width / width)));
            const offset = y * stride + x * 4;
            pixels[offset + 3] = Math.round(pixels[offset + 3] * alpha);
            if (pixels[offset + 3] === 0)
                pixels.fill(0, offset, offset + 3);
        }
    }
    return pixels;
}
