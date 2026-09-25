// SPDX-License-Identifier: GPL-2.0-or-later
import Adw from 'gi://Adw';
import Cairo from 'cairo';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {frameColor} from './color.js';

export default class MonitorLoupePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const mediaKeys = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.media-keys'});
        const connections = [];
        window.set_default_size(620, 700);
        window.search_enabled = true;

        const page = new Adw.PreferencesPage({title: _('General'), icon_name: 'preferences-system-symbolic'});
        window.add(page);

        const lens = new Adw.PreferencesGroup({
            title: _('Lens appearance'),
            description: _('Logical pixels. The lens is automatically limited to the current monitor.'),
        });
        page.add(lens);
        const shapes = ['rectangle', 'loupe', 'binoculars', 'telescope'];
        const titles = [_('Rectangle'), _('Magnifier'), _('Binoculars'), _('Telescope')];
        const shapeGrid = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL, homogeneous: true,
            spacing: 8, margin_top: 8, margin_bottom: 8,
            margin_start: 8, margin_end: 8,
        });
        let updatingShape = false;
        const shapeAreas = [];
        const shapeButtons = shapes.map((value, index) => {
            const button = new Gtk.ToggleButton({hexpand: true, tooltip_text: titles[index]});
            button.update_property([Gtk.AccessibleProperty.LABEL], [titles[index]]);
            const content = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL, spacing: 8,
                margin_top: 12, margin_bottom: 12,
            });
            const symbol = new Gtk.DrawingArea({content_width: 64, content_height: 64});
            symbol.set_draw_func((_area, cr, width, height) =>
                this._drawShapeSymbol(cr, width, height, value, settings));
            shapeAreas.push(symbol);
            content.append(symbol);
            content.append(new Gtk.Label({
                label: titles[index], wrap: true, justify: Gtk.Justification.CENTER,
                height_request: 36,
            }));
            button.child = content;
            button.connect('toggled', () => {
                if (!updatingShape && button.active && value !== settings.get_string('lens-shape'))
                    settings.set_string('lens-shape', value);
            });
            shapeGrid.append(button);
            return button;
        });
        for (const button of shapeButtons.slice(1))
            button.set_group(shapeButtons[0]);
        lens.add(new Adw.PreferencesRow({child: shapeGrid, activatable: false, selectable: false}));
        const width = this._spin(lens, settings, 'lens-width', _('Width'), 160, 7680, 20, 0);
        const height = this._spin(lens, settings, 'lens-height', _('Height'), 90, 4320, 10, 0);
        const radius = this._spin(lens, settings, 'lens-radius', _('Radius'), 60, 2160, 10, 0);
        radius.subtitle = _('Radius of each lens. The frame and handle are included when fitting to the monitor.');
        const border = this._spin(lens, settings, 'rectangle-border-width', _('Frame thickness'), 0, 20, 1, 0);
        border.subtitle = _('Logical pixels. Applies to every shape; set to 0 to hide the frame.');
        const colorRow = new Adw.ActionRow({
            title: _('Frame and symbol color'),
            subtitle: _('Colors all four symbols and the lens frame and handle.'),
        });
        const colorButton = new Gtk.MenuButton({
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Frame and symbol color'),
            has_frame: false,
        });
        const colorSwatch = new Gtk.DrawingArea({content_width: 32, content_height: 32});
        colorSwatch.set_draw_func((_area, cr, width, height) => {
            const rgba = new Gdk.RGBA();
            rgba.parse(frameColor(settings.get_string('frame-color')));
            const size = Math.min(width, height);
            cr.arc(width / 2, height / 2, size * 0.32, 0, Math.PI * 2);
            cr.setSourceRGBA(rgba.red, rgba.green, rgba.blue, 1);
            cr.fillPreserve();
            cr.setSourceRGBA(0.45, 0.48, 0.52, 1);
            cr.setLineWidth(1.5);
            cr.stroke();
        });
        colorButton.child = colorSwatch;
        const colorChooser = new Gtk.ColorChooserWidget({use_alpha: false, show_editor: false});
        colorButton.set_popover(new Gtk.Popover({child: colorChooser}));
        let updatingColor = false;
        const updateColor = () => {
            const rgba = new Gdk.RGBA();
            rgba.parse(frameColor(settings.get_string('frame-color')));
            updatingColor = true;
            colorChooser.rgba = rgba;
            updatingColor = false;
            colorButton.sensitive = settings.is_writable('frame-color');
            colorSwatch.queue_draw();
            for (const area of shapeAreas)
                area.queue_draw();
        };
        updateColor();
        colorChooser.connect('notify::rgba', () => {
            if (updatingColor)
                return;
            const rgba = colorChooser.rgba;
            const hex = '#' + [rgba.red, rgba.green, rgba.blue]
                .map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('');
            if (hex !== settings.get_string('frame-color'))
                settings.set_string('frame-color', hex);
        });
        connections.push([settings, settings.connect('changed::frame-color', updateColor)]);
        colorRow.add_suffix(colorButton);
        colorRow.activatable_widget = colorButton;
        lens.add(colorRow);
        const updateShape = () => {
            const selected = shapes.indexOf(settings.get_string('lens-shape'));
            updatingShape = true;
            shapeButtons.forEach((button, index) => {
                button.active = index === selected;
                button.sensitive = settings.is_writable('lens-shape');
                if (button.active)
                    button.add_css_class('suggested-action');
                else
                    button.remove_css_class('suggested-action');
            });
            updatingShape = false;
            width.visible = height.visible = selected === 0;
            border.visible = true;
            radius.visible = selected !== 0;
        };
        updateShape();
        connections.push([settings, settings.connect('changed::lens-shape', updateShape)]);

        const zoom = new Adw.PreferencesGroup({title: _('Zoom')});
        page.add(zoom);
        const scroll = new Adw.SwitchRow({
            title: _('Super + Alt + scroll wheel'),
            subtitle: _('Scroll up to zoom in, down to zoom out. Use only one scroll-zoom extension at a time.'),
        });
        zoom.add(scroll);
        settings.bind('scroll-zoom', scroll, 'active', Gio.SettingsBindFlags.DEFAULT);
        const step = this._spin(zoom, settings, 'zoom-step', _('Zoom step'), 0.05, 5, 0.05, 2);
        step.subtitle = _('Added per step: 0.25 means 2× → 2.25×. Zooming out to 1× turns the lens off. Maximum: 32×.');

        const shortcuts = new Adw.PreferencesGroup({
            title: _('Keyboard shortcuts'),
            description: _('Click a shortcut and press the new combination. Backspace disables it; Escape cancels.'),
        });
        page.add(shortcuts);
        const bindings = [
            {settings: mediaKeys, key: 'magnifier', title: _('Toggle magnifier'),
                subtitle: _('GNOME system shortcut. Changes also apply when this extension is disabled.')},
            {settings, key: 'loupe-zoom-in', title: _('Zoom in'), subtitle: _('Uses the zoom step above.')},
            {settings, key: 'loupe-zoom-out', title: _('Zoom out'), subtitle: _('Uses the zoom step above.')},
        ];
        const reserved = [
            ...bindings,
            {settings: mediaKeys, key: 'magnifier-zoom-in', title: _('GNOME zoom in')},
            {settings: mediaKeys, key: 'magnifier-zoom-out', title: _('GNOME zoom out')},
        ];
        for (const binding of bindings) {
            const row = new Adw.ActionRow({title: binding.title, subtitle: binding.subtitle});
            const button = new Gtk.Button({valign: Gtk.Align.CENTER});
            const update = () => {
                const values = binding.settings.get_strv(binding.key);
                button.label = values.length ? values.map(value => {
                    const [valid, key, mods] = Gtk.accelerator_parse(value);
                    return valid ? Gtk.accelerator_get_label(key, mods) : value;
                }).join(', ') : _('Disabled');
                button.sensitive = binding.settings.is_writable(binding.key);
            };
            update();
            connections.push([binding.settings, binding.settings.connect(`changed::${binding.key}`, update)]);
            button.connect('clicked', () => this._capture(window, binding, reserved));
            row.add_suffix(button);
            row.activatable_widget = button;
            shortcuts.add(row);
        }
        const note = new Adw.ActionRow({
            title: _('Existing system zoom shortcuts'),
            subtitle: _('GNOME’s own zoom-in/out shortcuts keep their system step. Assign different shortcuts here to use Monitor Loupe’s step.'),
        });
        shortcuts.add(note);

        const resetGroup = new Adw.PreferencesGroup();
        page.add(resetGroup);
        const reset = new Gtk.Button({label: _('Reset extension settings'), halign: Gtk.Align.CENTER});
        reset.connect('clicked', () => {
            for (const key of settings.settings_schema.list_keys())
                settings.reset(key);
        });
        resetGroup.add(reset);
        resetGroup.description = _('The GNOME system shortcut is not reset.');
        window.connect('close-request', () => {
            for (const [source, id] of connections)
                source.disconnect(id);
            connections.length = 0;
            return false;
        });
    }

    _spin(group, settings, key, title, lower, upper, increment, digits) {
        const row = new Adw.SpinRow({
            title, digits,
            adjustment: new Gtk.Adjustment({lower, upper, step_increment: increment, page_increment: increment * 10}),
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
        return row;
    }

    _drawShapeSymbol(cr, width, height, shape, settings) {
        const rgba = new Gdk.RGBA();
        rgba.parse(frameColor(settings.get_string('frame-color')));
        cr.save();
        const size = Math.min(width, height);
        cr.translate((width - size) / 2, (height - size) / 2);
        cr.scale(size / 160, size / 160);
        cr.setSourceRGBA(rgba.red, rgba.green, rgba.blue, 1);
        cr.setLineWidth(8);
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);
        if (shape === 'rectangle') {
            cr.rectangle(20, 36, 120, 88);
            cr.stroke();
        } else if (shape === 'loupe') {
            cr.arc(67, 67, 45, 0, Math.PI * 2);
            cr.stroke();
            cr.setLineWidth(16);
            cr.moveTo(101, 101);
            cr.lineTo(137, 137);
            cr.stroke();
        } else if (shape === 'binoculars') {
            cr.moveTo(80, 42);
            cr.curveTo(48, 7, 3, 35, 8, 80);
            cr.curveTo(12, 123, 55, 137, 80, 102);
            cr.curveTo(105, 137, 148, 123, 152, 80);
            cr.curveTo(157, 35, 112, 7, 80, 42);
            cr.closePath();
            cr.stroke();
        } else {
            cr.arc(80, 80, 60, 0, Math.PI * 2);
            cr.stroke();
            cr.setLineWidth(2);
            cr.arc(80, 80, 46, 0, Math.PI * 2);
            cr.stroke();
        }
        cr.restore();
    }

    _capture(parent, binding, reserved) {
        const dialog = new Adw.Window({
            title: binding.title, transient_for: parent, modal: true,
            default_width: 440, default_height: 230, resizable: false,
        });
        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 24});
        box.append(new Adw.HeaderBar());
        const prompt = new Gtk.Label({
            label: _('Press your new shortcut'), wrap: true,
            margin_start: 24, margin_end: 24, margin_bottom: 24,
        });
        box.append(prompt);
        dialog.content = box;
        const controller = new Gtk.EventControllerKey();
        controller.set_name('monitor-loupe-shortcut-capture');
        controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
            if (keyval === Gdk.KEY_Escape) {
                dialog.close();
                return true;
            }
            if (keyval === Gdk.KEY_BackSpace) {
                binding.settings.set_strv(binding.key, []);
                dialog.close();
                return true;
            }
            const mods = state & Gtk.accelerator_get_default_mod_mask();
            keyval = Gdk.keyval_to_lower(keyval);
            const strongModifier = mods & (Gdk.ModifierType.CONTROL_MASK |
                Gdk.ModifierType.ALT_MASK | Gdk.ModifierType.SUPER_MASK);
            const functionKey = keyval >= Gdk.KEY_F1 && keyval <= Gdk.KEY_F35;
            if (!Gtk.accelerator_valid(keyval, mods) || (!strongModifier && !functionKey)) {
                prompt.label = _('Use Ctrl, Alt or Super together with a key.');
                return true;
            }
            const accelerator = Gtk.accelerator_name(keyval, mods);
            const conflict = reserved.find(other => other !== binding &&
                other.settings.get_strv(other.key).some(value => {
                    const [valid, otherKey, otherMods] = Gtk.accelerator_parse(value);
                    return valid && otherKey === keyval && otherMods === mods;
                }));
            if (conflict) {
                prompt.label = `${_('Already used by:')} ${conflict.title}`;
                return true;
            }
            binding.settings.set_strv(binding.key, [accelerator]);
            dialog.close();
            return true;
        });
        dialog.add_controller(controller);
        dialog.present();
    }
}
