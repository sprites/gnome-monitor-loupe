// SPDX-License-Identifier: GPL-2.0-or-later
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

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
            title: _('Lens size'),
            description: _('Logical pixels. The lens is automatically limited to the current monitor.'),
        });
        page.add(lens);
        this._spin(lens, settings, 'lens-width', _('Width'), 160, 7680, 20, 0);
        this._spin(lens, settings, 'lens-height', _('Height'), 90, 4320, 10, 0);

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
