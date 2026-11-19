// SPDX-License-Identifier: GPL-2.0-or-later
// Render the actual preferences widgets, one group per image, without changing
// saved settings. Run in a GNOME GTK session with GJS and GNOME's prefs resource:
// LANG=de_DE.UTF-8 gjs -m tools/capture-preferences.js screenshots EXTENSION_DIR OUTPUT_DIR
// Modes: appearance, round, controls, screenshots, shortcuts. Use en_US.UTF-8 for English.
// On Fedora, also set GI_TYPELIB_PATH=/usr/lib64/gnome-shell/girepository-1.0
// and LD_LIBRARY_PATH=/usr/lib64/gnome-shell if Shew is not on the default search path.
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

GLib.setenv('GSETTINGS_BACKEND', 'memory', true);
Gio.resources_register(Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
const {ExtensionPreferences} = await import('resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js');
const [mode = 'screenshots', path = `${GLib.get_home_dir()}/.local/share/gnome-shell/extensions/monitor-loupe@sprites.github.io`, outputDir = '/tmp'] = ARGV;
const heights = {appearance: 560, round: 500, controls: 420, screenshots: 380, shortcuts: 540};
if (!(mode in heights))
    throw new Error(`Unknown preferences section: ${mode}`);
GLib.mkdir_with_parents(outputDir, 0o755);
const {default: Preferences} = await import(`file://${path}/prefs.js`);
const metadata = JSON.parse(new TextDecoder().decode(GLib.file_get_contents(`${path}/metadata.json`)[1]));
metadata.path = path;
metadata.dir = Gio.File.new_for_path(path);
const prefs = new Preferences(metadata);
ExtensionPreferences.lookupByUUID = uuid => uuid === metadata.uuid ? prefs : null;
const settings = prefs.getSettings();
settings.set_boolean('screenshot-lens', true);
if (mode === 'round')
    settings.set_string('lens-shape', 'loupe');
const lang = (GLib.getenv('LANG') ?? 'en').startsWith('de') ? 'de' : 'en';
let failure = null;
const app = new Adw.Application({application_id: 'io.github.sprites.MonitorLoupe.Docs',
    flags: Gio.ApplicationFlags.NON_UNIQUE});
app.connect('activate', () => {
    Adw.StyleManager.get_default().color_scheme = Adw.ColorScheme.FORCE_LIGHT;
    const window = new Adw.PreferencesWindow({application: app, title: `Monitor Loupe ${metadata.version}`});
    prefs.fillPreferencesWindow(window);
    const page = window.visible_page;
    const groups = [];
    function find(widget) {
        if (widget instanceof Adw.PreferencesGroup)
            groups.push(widget);
        else {
            for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
                find(child);
        }
    }
    find(page);
    const index = {appearance: 0, round: 0, controls: 1, screenshots: 2, shortcuts: 3}[mode];
    groups.forEach((group, i) => { if (i !== index) page.remove(group); });
    window.set_default_size(800, heights[mode]);
    window.search_enabled = false;
    window.present();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
        try {
            const paintable = new Gtk.WidgetPaintable({widget: window});
            const snapshot = new Gtk.Snapshot();
            paintable.snapshot(snapshot, window.get_width(), window.get_height());
            const node = snapshot.to_node();
            const texture = window.get_renderer().render_texture(node, null);
            const output = `${outputDir}/preferences-${mode}-v${metadata.version}-${lang}.png`;
            if (!texture.save_to_png(output))
                throw new Error(`Could not save ${output}`);
            print(output);
        } catch (error) {
            failure = error;
            logError(error);
        }
        window.close();
        return GLib.SOURCE_REMOVE;
    });
});
app.run([]);
if (failure)
    throw failure;
