// SPDX-License-Identifier: GPL-2.0-or-later
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));

export function lensGeometry(monitors, px, py, xZoom, yZoom,
    requestedWidth = 640, requestedHeight = 360) {
    const monitor = monitors.find(m => px >= m.x && py >= m.y &&
        px < m.x + m.width && py < m.y + m.height);
    if (!monitor)
        return null;
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
