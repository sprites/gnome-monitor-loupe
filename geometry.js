// SPDX-License-Identifier: GPL-2.0-or-later
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));

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
    const x = clamp(Math.round(px - width / 2), monitor.x, monitor.x + monitor.width - width);
    const y = clamp(Math.round(py - height / 2), monitor.y, monitor.y + monitor.height - height);
    // Keep the magnified pointer at its real position, including at monitor edges.
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
