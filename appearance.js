// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import {shapeSize} from './geometry.js';
import {frameColor} from './color.js';

// Mask the complete magnifier actor, including GNOME's background and cursor.
// Transparent pixels reveal the original desktop; a CSS border alone cannot do this.
export function createLensEffect(shape, color) {
    const [width, height] = shapeSize(shape);
    const rgb = frameColor(color).slice(1).match(/../g)
        .map(channel => (parseInt(channel, 16) / 255).toFixed(6));
    const effect = new Clutter.ShaderEffect({shader_type: Cogl.ShaderType.FRAGMENT});
    effect.set_shader_source(`
        uniform sampler2D tex;
        void main() {
            vec2 uv = cogl_tex_coord_in[0].xy;
            vec2 p = uv * vec2(${width.toFixed(1)}, ${height.toFixed(1)});
            float d = length(p - vec2(1.0));
            ${shape === 'binoculars' ? 'd = min(d, length(p - vec2(2.4, 1.0)));' : ''}
            float outer = 1.0 - smoothstep(0.955, 0.965, d);
            float glass = 1.0 - smoothstep(${shape === 'telescope' ? '0.835, 0.845' : '0.895, 0.905'}, d);
            vec3 rim = vec3(${rgb.join(', ')});
            ${shape === 'loupe' ? `
                vec2 a = vec2(1.62);
                vec2 b = vec2(2.40);
                vec2 ab = b - a;
                float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
                float handle = 1.0 - smoothstep(0.13, 0.14, length(p - a - t * ab));
                outer = max(outer, handle);` : ''}
            vec4 scene = texture2D(tex, uv);
            cogl_color_out = mix(vec4(rim * outer, outer), scene, glass) * cogl_color_in;
        }
    `);
    effect.set_uniform_value('tex', 0);
    return effect;
}
