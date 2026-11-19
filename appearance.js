// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import St from 'gi://St';
import Cairo from 'cairo';
import {shapeSize} from './geometry.js';
import {frameColor} from './color.js';

// Render feedback only after the stage snapshot, so it never enters the PNG.
export function showShutter(viewport, shape) {
    const area = new St.DrawingArea({
        x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height,
        reactive: false, can_focus: false,
    });
    const timeline = new Clutter.Timeline({duration: 360, actor: area});
    area.connect('repaint', () => {
        const cr = area.get_context();
        const [width, height] = area.get_surface_size();
        const progress = timeline.get_progress();
        const opening = Math.abs(2 * progress - 1);
        const [sw, sh] = shapeSize(shape);
        const radius = Math.min(width / sw, height / sh);
        const lenses = shape === 'rectangle'
            ? [{x: width / 2, y: height / 2, radius: Math.hypot(width, height)}]
            : [1, ...(shape === 'binoculars' ? [2.4] : [])]
                .map(x => ({x: x * width / sw, y: height / sh, radius: radius * 0.96}));
        for (const lens of lenses) {
            cr.save();
            if (shape !== 'rectangle') {
                cr.arc(lens.x, lens.y, lens.radius, 0, Math.PI * 2);
                cr.clip();
            }
            cr.rectangle(0, 0, width, height);
            const aperture = lens.radius * 1.2 * opening;
            for (let blade = 0; blade < 6; blade++) {
                const angle = blade * Math.PI / 3 + progress * 0.5;
                const x = lens.x + Math.cos(angle) * aperture;
                const y = lens.y + Math.sin(angle) * aperture;
                if (blade === 0)
                    cr.moveTo(x, y);
                else
                    cr.lineTo(x, y);
            }
            cr.closePath();
            cr.setFillRule(Cairo.FillRule.EVEN_ODD);
            cr.setSourceRGBA(0.04, 0.05, 0.06, 0.9);
            cr.fill();
            cr.setSourceRGBA(0.25, 0.28, 0.30, 0.6 * (1 - opening));
            cr.setLineWidth(1);
            for (let blade = 0; blade < 6; blade++) {
                const angle = blade * Math.PI / 3 + progress * 0.5;
                cr.moveTo(lens.x + Math.cos(angle) * aperture,
                    lens.y + Math.sin(angle) * aperture);
                cr.lineTo(lens.x + Math.cos(angle + 0.5) * lens.radius * 2,
                    lens.y + Math.sin(angle + 0.5) * lens.radius * 2);
            }
            cr.stroke();
            cr.restore();
        }
        cr.$dispose();
    });
    const frameId = timeline.connect('new-frame', () => area.queue_repaint());
    const completedId = timeline.connect('completed', () => area.destroy());
    area.connect('destroy', () => {
        timeline.stop();
        timeline.disconnect(frameId);
        timeline.disconnect(completedId);
    });
    global.stage.add_child(area);
    timeline.start();
    return area;
}

// Mask the complete magnifier actor, including GNOME's background and cursor.
// Transparent pixels reveal the original desktop; a CSS border alone cannot do this.
export function createLensEffect(shape, color, borderWidth = 2, radius = 300,
    {includeHandle = true, outerRadius = 0.96} = {}) {
    const [width, height] = shapeSize(shape);
    const rgb = frameColor(color).slice(1).match(/../g)
        .map(channel => (parseInt(channel, 16) / 255).toFixed(6));
    const borderRadius = Math.min(borderWidth, radius) / Math.max(radius, 1);
    const glassRadius = Math.max(0, outerRadius - borderRadius);
    const antialias = (0.5 / Math.max(radius, 1)).toFixed(6);
    // GNOME 51 uses pipeline snippets instead of standalone shader programs.
    const useSnippet = typeof Clutter.ShaderEffect.new_with_snippet === 'function';
    const fragment = `
            vec2 uv = ${useSnippet ? 'cogl_tex_coord0_in' : 'cogl_tex_coord_in[0]'}.xy;
            vec2 p = uv * vec2(${width.toFixed(1)}, ${height.toFixed(1)});
            float d = length(p - vec2(1.0));
            ${shape === 'binoculars' ? 'd = min(d, length(p - vec2(2.4, 1.0)));' : ''}
            float outer = 1.0 - smoothstep(${outerRadius} - ${antialias}, ${outerRadius} + ${antialias}, d);
            float glass = 1.0 - smoothstep(${glassRadius.toFixed(6)} - ${antialias}, ${glassRadius.toFixed(6)} + ${antialias}, d);
            vec3 rim = vec3(${rgb.join(', ')});
            ${shape === 'loupe' && includeHandle ? `
                vec2 a = vec2(1.62);
                vec2 b = vec2(2.40);
                vec2 ab = b - a;
                float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
                float handle = 1.0 - smoothstep(0.13, 0.14, length(p - a - t * ab));
                outer = max(outer, handle);` : ''}
            vec4 scene = ${useSnippet ? 'texture(cogl_sampler0, uv)' : 'texture2D(tex, uv)'};
            cogl_color_out = mix(vec4(rim * outer, outer), scene, glass) * cogl_color_in;
    `;
    if (useSnippet) {
        const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, null, null);
        snippet.set_replace(fragment);
        return Clutter.ShaderEffect.new_with_snippet(snippet);
    }
    const effect = new Clutter.ShaderEffect({shader_type: Cogl.ShaderType.FRAGMENT});
    effect.set_shader_source(`uniform sampler2D tex;\nvoid main() {\n${fragment}\n}`);
    effect.set_uniform_value('tex', 0);
    return effect;
}
