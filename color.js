// SPDX-License-Identifier: GPL-2.0-or-later
export const DEFAULT_FRAME_COLOR = '#242b33';

export function frameColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_FRAME_COLOR;
}
