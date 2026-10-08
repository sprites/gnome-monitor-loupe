// SPDX-License-Identifier: GPL-2.0-or-later
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));

// Wheel resizing changes by 10% per step, preserving the rectangle's aspect.
// Stop at both schema limits and the current monitor's logical dimensions.
export function nextLensSize(width, height, radius, shape, direction, monitor) {
    const factor = Math.pow(1.1, direction);
    if (shape !== 'rectangle') {
        const [w, h] = shapeSize(shape);
        const maxRadius = Math.max(60, Math.floor(Math.min(2160, monitor.width / w, monitor.height / h)));
        return {radius: Math.round(clamp(Math.min(radius, maxRadius) * factor, 60, maxRadius))};
    }
    const minimum = Math.max(160 / width, 90 / height);
    const maximum = Math.max(minimum, Math.min(7680 / width, 4320 / height,
        monitor.width / width, monitor.height / height));
    // An oversized saved rectangle cannot grow further on a smaller monitor.
    if (direction > 0 && maximum < 1)
        return {width, height};
    const scale = clamp(factor, minimum, maximum);
    return {width: Math.round(width * scale), height: Math.round(height * scale)};
}

export function lensGeometry(monitors, px, py, xZoom, yZoom,
    requestedWidth = 640, requestedHeight = 360, shape = 'rectangle', radius = 300) {
    const monitor = monitors.find(m => px >= m.x && py >= m.y &&
        px < m.x + m.width && py < m.y + m.height);
    if (!monitor)
        return null;
    if (shape !== 'rectangle') {
        const [w, h] = shapeSize(shape);
        const fittedRadius = Math.min(radius, monitor.width / w, monitor.height / h);
        requestedWidth = w * fittedRadius;
        requestedHeight = h * fittedRadius;
    }
    const width = Math.max(1, Math.floor(Math.min(requestedWidth, monitor.width)));
    const height = Math.max(1, Math.floor(Math.min(requestedHeight, monitor.height)));
    // Keep the pointer at the lens center. The Shell clips the portion of the
    // lens that lies beyond the physical desktop edge.
    const x = Math.round(px - width / 2);
    const y = Math.round(py - height / 2);
    const zx = Math.max(1, xZoom);
    const zy = Math.max(1, yZoom);
    return {
        viewport: {x, y, width, height},
        xCenter: px + (x + width / 2 - px) / zx,
        yCenter: py + (y + height / 2 - py) / zy,
        xMagFactor: zx,
        yMagFactor: zy,
    };
}

// Dimensions in units of the requested radius; preserve round lenses on small monitors.
export function shapeSize(shape) {
    if (shape === 'binoculars')
        return [3.4, 2];
    return shape === 'loupe' ? [2.6, 2.6] : [2, 2];
}

export function insideLens(shape, x, y, width, height) {
    if (shape === 'rectangle')
        return x >= 0 && y >= 0 && x < width && y < height;
    const [w, h] = shapeSize(shape);
    const px = x / width * w;
    const py = y / height * h;
    const distance = Math.min(Math.hypot(px - 1, py - 1),
        shape === 'binoculars' ? Math.hypot(px - 2.4, py - 1) : Infinity);
    return distance < (shape === 'telescope' ? 0.84 : 0.90);
}
