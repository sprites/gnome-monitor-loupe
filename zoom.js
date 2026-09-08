// SPDX-License-Identifier: GPL-2.0-or-later

// Rounding keeps repeated fractional steps reversible and reaches exactly 1×.
export function nextZoom(current, step, direction) {
    return Math.max(1, Math.min(32,
        Math.round((current + step * direction) * 100) / 100));
}
