# GNOME Monitor Loupe

Eine Lupe für **GNOME Shell 48–51**, die dem Mauszeiger folgt. An Bildschirmrändern
bleibt sie auf dem Mauszeiger zentriert; GNOME schneidet nur den Teil ab, der
ausserhalb des sichtbaren Desktops liegt. An Monitorübergängen kann die Lupe auf
den Nachbarmonitor reichen.

[English documentation](README.md)

[PrintScreen-Aufnahmen](#bildschirmaufnahmen-mit-printscreen) · [Einstellungen im Bild](#einstellungen-im-bild) · [Installation](#installation)

## Bildschirmaufnahmen mit PrintScreen

Mit **Druck / PrintScreen** kannst du den vergrößerten Lupenbereich direkt als
PNG aufnehmen – ohne Mauszeiger und ohne Fadenkreuz. Das Bild wird gespeichert
und in die Zwischenablage kopiert. Mit **Strg + V** kannst du es beispielsweise
in einen Bildeditor einfügen.

### So startest du

1. Öffne die Einstellungen von Monitor Loupe. Scrolle unter „Vergrößerung“ zum Bereich **„Bildschirmaufnahmen“**.
2. Schalte **„Lupenfenster mit Druck aufnehmen“** ein. Bei der Installation ist diese Funktion ausgeschaltet.
3. Schalte die Lupe ein, zum Beispiel mit **Strg + Super + Mausrad nach oben**, und drücke **Druck / PrintScreen**.

Die Aufnahme erfolgt sofort. Du musst keinen Bereich im GNOME-Aufnahmefenster
auswählen. Falls du GNOMEs Bildschirmfoto-Kürzel geändert hast, verwendest du
statt PrintScreen dieses Kürzel.

![Bildschirmaufnahmen in Version 16: direkte Aufnahme, Rahmen und Griff sowie transparenter Hintergrund](docs/preferences-screenshots-v16-de.png)

*Im Bild sind alle drei Schalter eingeschaltet. Die folgenden Standardwerte
gelten nach einer neuen Installation oder dem Zurücksetzen.*

| Einstellung | Einfach erklärt | Standard |
| --- | --- | --- |
| **Lupenfenster mit Druck aufnehmen** | Ein: PrintScreen nimmt die aktive Lupe direkt auf. Aus: GNOMEs normale Aufnahme-Auswahl öffnet sich. | Aus |
| **Rahmen und Griff mit aufnehmen** | Ein: Das Lupeninstrument bleibt im Bild. Aus: Nur der vergrößerte Linseninhalt wird aufgenommen. | Ein |
| **Transparenter Hintergrund** | Ein: Die Fläche außerhalb der Linse oder des Instruments wird transparent. Aus: Der sichtbare Desktop-Hintergrund bleibt im rechteckigen PNG erhalten. | Ein |

### Welche Kombination brauche ich?

| Dein Ziel | Rahmen und Griff | Transparenter Hintergrund |
| --- | --- | --- |
| Nur den vergrößerten Inhalt freistellen | Aus | Ein |
| Die ganze Lupe samt Rahmen und Griff freistellen | Ein | Ein |
| Die Lupe mit der sichtbaren Desktop-Umgebung aufnehmen | Ein | Aus |

Ohne Rahmen entsteht beim Rechteck ein Bild ohne Rand, bei Lupe und Fernrohr
eine kreisförmige Linse und beim Feldstecher zwei überlappende Linsen. Transparenz
gilt auch für das Bild in der Zwischenablage. Ein Bildbetrachter kann transparente
Flächen weiß, schwarz oder kariert anzeigen; diese Fläche ist nicht im PNG gespeichert.
Beim Rechteck füllt der Bildinhalt die ganze Form, daher gibt es keine freien Ecken.

Beim Auslösen schließt und öffnet sich kurz eine **Kamerablende**. Dieser Effekt
erscheint nicht im gespeicherten Bild und hat keinen eigenen Einstellungsschalter.

**Die GNOME-Auswahl erscheint weiterhin?** Die Lupe und „Lupenfenster mit Druck
aufnehmen“ müssen beide eingeschaltet sein. Nach einem Update einmal vollständig
abmelden und wieder anmelden; den Bildschirm zu sperren reicht nicht.

An Bildschirmrändern wird nur der sichtbare Teil aufgenommen. GNOME übernimmt
den Speicherort und die Benachrichtigung für das Bildschirmfoto.

## Wähle deine Lupenansicht

| Rechteck | Lupe | Feldstecher | Fernrohr |
| :---: | :---: | :---: | :---: |
| ![Rechteck-Symbol](docs/icons/rectangle.svg) | ![Lupen-Symbol](docs/icons/loupe.svg) | ![Feldstecher-Symbol](docs/icons/binoculars.svg) | ![Fernrohr-Symbol](docs/icons/telescope.svg) |
| Klassische rechteckige Ansicht | Runde Linse mit Griff | Zwei überlappende Linsen | Runde Ansicht mit breitem Rahmen |
| Breite, Höhe und Rahmendicke | Radius einstellbar | Radius pro Linse einstellbar | Radius einstellbar |

*Die Symbole veranschaulichen die vier Formen; sie sind keine Desktop-Screenshots.*

Die **Rahmen- und Symbolfarbe** sowie die **Rahmendicke** sind für alle vier Ansichten einstellbar.
Die Lupe passt sich mitsamt Rahmen und Griff an die aktuelle Monitorgrösse an.
Wähle die Form über eines der **vier Symbolfelder ganz oben in den Einstellungen**.
Das aktive Feld ist hervorgehoben; darunter erscheinen die passenden Größenregler.

## Die Lupenansichten in Bewegung

Die Animation zeigt, wie die Linse schwungvoll hin und her wandert, dabei
mehrfach größer und kleiner wird und weich zwischen allen vier Formen wechselt. Mit **Umschalt + Strg + Super +
Mausrad** lässt sich das Lupenfenster vergrössern und verkleinern: beim Rechteck
proportional, bei runden Formen über den Radius. Die Vergrößerungsstufe bleibt gleich.

![Animation aller vier Lupenformen mit größer und kleiner werdendem Lupenfenster](docs/monitor-loupe-demo-v14-slow.gif)

*Die Desktop-Szene ist eine Illustration und keine Live-Aufnahme von GNOME.*
[Statisches PNG-Vorschaubild](docs/monitor-loupe-demo.png)

## Einstellungen im Bild

Die Bilder zeigen die Einstellungsbereiche von Version 16 unter GNOME 51,
jeweils einen Bereich. Alle Bereiche gehören zur selben Einstellungsseite;
scrolle im Fenster nach unten, um die weiteren Einstellungen zu sehen.
Farben und Fensterstil können je nach Desktop abweichen.

**Rechteck — Abmessungen, Rahmendicke und Farbe**

![Rechteck-Einstellungen in Version 16 mit Breite, Höhe, Rahmendicke und Farbauswahl](docs/preferences-appearance-v16-de.png)

Wähle oben eine Form. Beim Rechteck stellst du **Breite** und **Höhe** ein.
**Rahmendicke** bestimmt die Stärke des sichtbaren Randes; das Farbfeld daneben
ändert die Farbe von Rahmen, Griff und Symbolen.

**Runde Formen — Radius und Farbe**

![Einstellungen einer runden Lupe in Version 16 mit Radius, Rahmendicke und Farbe](docs/preferences-round-v16-de.png)

Klicke auf das Farbfeld, um eine Farbe auszuwählen. Mit Rahmendicke **0** blendest
du den Rahmen aller Formen aus. Änderungen an der Ansicht werden sofort übernommen.
Bei runden Formen ersetzt der **Radius** die Regler für Breite und Höhe.
Ein größerer Radius bedeutet eine größere Linse; die Vergrößerungsstufe bleibt gleich.

**Mausrad-Steuerung — Zoom und Lupengröße**

![Mausrad-Einstellungen in Version 16 mit getrennten Schaltern für Zoom und Lupengröße](docs/preferences-controls-v16-de.png)

| Funktion | Standardkombination mit Mausrad | Wirkung |
| --- | --- | --- |
| Zoom | Strg + Super | Ändert die Vergrößerungsstufe des Inhalts. |
| Lupengröße | Umschalt + Strg + Super | Ändert den Radius oder skaliert das Rechteck proportional. |

Beide Tastenkombinationen lassen sich über ihren Kürzel-Button ändern:
anklicken, die gewünschten Zusatztasten gemeinsam drücken und loslassen.
Der jeweilige Schalter rechts daneben aktiviert oder deaktiviert die Funktion.
Die gewählten Kürzel bleiben beim Ausschalten erhalten. Bereits für die andere
Mausrad-Funktion verwendete Kombinationen werden beim Eingeben abgelehnt.

**Tastenkombinationen — Lupe einschalten und Zoom steuern**

![Tastenkombinationen in Version 16 für das Ein- und Ausschalten der Lupe sowie eigene Zoomkürzel](docs/preferences-shortcuts-v16-de.png)

**Lupe ein-/ausschalten** zeigt dein GNOME-Systemkürzel. Klicke auf einen
Kürzel-Button und drücke eine neue Kombination. **Vergrößern** und **Verkleinern**
sind eigene, anfangs unbelegte Kürzel für den eingestellten Zoomschritt.
Rücktaste entfernt ein Kürzel, Escape bricht die Eingabe ab.

## Einstellungen

In der App **Erweiterungen** bei Monitor Loupe auf die Einstellungen klicken, oder:

```sh
gnome-extensions prefs monitor-loupe@sprites.github.io
```

- **Strg + Super + Mausrad** ist standardmäßig aktiv. Nach oben vergrößert,
  nach unten verkleinert. Unter **Vergrößerung → Tastenkombination für Mausrad-Zoom**
  den Tastenkürzel-Button anklicken, die gewünschte Kombination aus Strg, Alt,
  Umschalt und Super zusammen drücken und loslassen. Die Kombination wird direkt
  übernommen; Escape bricht ab, Rücktaste deaktiviert den Mausrad-Zoom.
  Der Ein-/Aus-Schalter direkt rechts neben dem Tastenkürzel-Button schaltet die
  Funktion um. Die gewählte Kombination bleibt dabei erhalten und lässt sich
  auch bei ausgeschaltetem Mausrad-Zoom ändern.
  Mit Super funktioniert der Zoom bei GNOMEs Standard-Compositor-Modifikator
  auch über Anwendungsfenstern.
- **Zoomschritt:** standardmäßig 0,25×, einstellbar von 0,05× bis 5×.
  Beispiel: 2× → 2,25×. Die maximale Vergrößerung ist 32×.
- **Bildschirmaufnahmen:** Die Anleitung mit Screenshot, Schalter-Erklärung und
  Beispielen steht oben unter [Bildschirmaufnahmen mit PrintScreen](#bildschirmaufnahmen-mit-printscreen).
- **Lupengröße per Mausrad:** standardmäßig **Umschalt + Strg + Super + Mausrad**.
  Nach oben vergrößert die Linse, nach unten verkleinert sie. Runde Formen ändern
  den Radius; beim Rechteck werden Breite und Höhe proportional skaliert.
  Ein Schritt skaliert die Größe mit dem Faktor 1,1 beziehungsweise 1/1,1.
  Der Radius bleibt zwischen 60 und 2160 logischen Pixeln; das Rechteck mindestens
  160 × 90 und höchstens 7680 × 4320. Die Obergrenze berücksichtigt zusätzlich den
  Monitor unter dem Mauszeiger. Die Vergrößerungsstufe bleibt dabei gleich.
  Unter **Vergrößerung → Tastenkombination für Lupengröße** lässt sich das Kürzel ändern oder
  die Funktion mit dem Schalter daneben ausschalten. Zoom und Größenänderung
  verwenden unterschiedliche Tastenkombinationen. Die Größenänderung wird sofort
  übernommen und gespeichert. Beim Bearbeiten des Kürzels deaktiviert Rücktaste
  die Größensteuerung; Escape bricht die Eingabe ab.
- Aus dem ausgeschalteten Zustand beginnt der Zoom bei 1× plus einem Schritt.
  Beim Verkleinern auf 1× wird die Lupe ausgeschaltet.
- **Lupe ein-/ausschalten:** zeigt und bearbeitet das vorhandene GNOME-Kürzel
  (beispielsweise Alt+Super+L). Diese Änderung gilt systemweit und bleibt auch
  nach dem Deaktivieren der Erweiterung erhalten.
- **Vergrößern/Verkleinern:** eigene Tastenkürzel für den eingestellten
  Zoomschritt. Zunächst sind keine belegt, um bestehende Kürzel zu erhalten.
  Kürzel anklicken und die neue Kombination drücken. Rücktaste deaktiviert,
  Escape bricht ab. Eine noch freie Kombination wählen.
- **Form:** Rechteck (Standard), runde Lupe, Feldstecher mit zwei
  überlappenden Linsen oder Fernrohr. Außerhalb der Form
  bleibt der normale Desktop sichtbar.
- **Radius:** für die runden Formen von 60 bis 2160 logischen Pixeln wählbar,
  standardmäßig 300. Beim Feldstecher gilt der Radius für jede Linse. Die gesamte
  Form wird bei Bedarf proportional verkleinert, damit sie auf den Monitor passt.
- **Rahmen- und Symbolfarbe:** frei wählbare Farbe für alle Formen und den Lupengriff.
- **Rahmendicke:** bei allen Formen von 0 bis 20 logischen Pixeln, standardmäßig 2.
  Mit 0 wird der Rahmen ausgeblendet. Farbe und Dicke werden sofort übernommen.
- **Breite/Höhe:** für das Rechteck, standardmäßig 1000 × 650 logische Pixel. Änderungen werden
  sofort übernommen. Die Lupe wird höchstens so gross wie der aktuelle Monitor.
- **Zurücksetzen:** stellt die Erweiterungswerte wieder her. Das systemweite
  Ein/Aus-Kürzel bleibt erhalten.

GNOMEs eigene Zoomkürzel behalten ihre bisherige Schrittweite. Für den
einstellbaren Zoomschritt die eigenen Kürzel dieser Erweiterung verwenden.

## Installation

Das ZIP aus den [GitHub-Releases](https://github.com/sprites/gnome-monitor-loupe/releases)
herunterladen und installieren:

```sh
gnome-extensions install --force monitor-loupe@sprites.github.io.shell-extension.zip
```

Bei der ersten Installation einmal ab- und wieder anmelden. Anschließend:

```sh
gnome-extensions enable monitor-loupe@sprites.github.io
```

Better Desktop Zoom wird nicht benötigt. Dieselbe Mausradgeste sollte nur von
einer Erweiterung gleichzeitig verarbeitet werden.

Deaktivieren:

```sh
gnome-extensions disable monitor-loupe@sprites.github.io
```

Dabei werden die GNOME-Methoden und die konfigurierte Lupenansicht wiederhergestellt.
Die Fenstergröße überschreibt keine gespeicherten GNOME-Ansichtseinstellungen.
Bewusste Zoomaktionen ändern den Zoomfaktor und den Ein/Aus-Zustand der Systemlupe.

## Entwicklung und Status

`make test` prüft Geometrie, Zoom und den Lebenszyklus mit einer simulierten Shell.
`make pack` erstellt das installierbare ZIP in `dist/`.

Der abgestimmte Ablauf für GNOME- und GitHub-Releases steht in der
[Release-Anleitung](docs/release.de.md). `make release-candidate` baut zuerst
das GNOME-Upload-Paket mit der nächsten Nummer, ohne die Versionsnummer auf
GitHub oder lokal vorwegzunehmen.

Version 16 ist für **GNOME Shell 48, 49, 50 und 51** freigegeben.
Isolierte Wayland-VM-Tests auf GNOME 48.0, 49.1, 50.0 und 51.0 prüfen Laden,
Formwechsel und wiederholtes Deaktivieren/Aktivieren. Die Shader-Anpassung für
GNOME 51 wurde unter GNOME 50.0 und 51.0 geprüft, einschließlich einer Bildprüfung
der runden Formen unter GNOME 51. Vollständige Tests mit physischen Monitoren
und Eingabegeräten stehen noch aus.

Die Erweiterung verwendet interne GNOME-Lupenmethoden. Zur Laufzeitprüfung auf
jeder unterstützten Version gehören Mausrad, Monitorwechsel, unterschiedliche
Skalierung und Sperren/Entsperren.
Bei einem geänderten GNOME-Compositor-Modifikator kann Mausrad-Zoom über
Anwendungsfenstern abweichen; GNOMEs Standard ist Super.

Fehler bitte mit GNOME-Version, Monitoranordnung und Skalierung unter
[GitHub Issues](https://github.com/sprites/gnome-monitor-loupe/issues) melden.

Lizenz: GPL-2.0-or-later, siehe [LICENSE](LICENSE).
