# Release von Monitor Loupe

GNOME Extensions und GitHub haben getrennte Freigaben. Für eine neue Version
bleibt der Branch `main` auf der bisher veröffentlichten Versionsnummer, bis
GNOME.org den Upload angenommen hat.

## 1. GNOME-Upload vorbereiten

Alle Änderungen committen und pushen. Anschliessend im Projektverzeichnis:

```sh
make release-candidate
```

Der Befehl prüft die Tests und baut ein ZIP mit der nächsten Versionsnummer in
`dist/release-candidates/vN/`. Die Versionsnummer in `metadata.json`, auf GitHub
und in der installierten Erweiterung bleibt dabei unverändert. Dieses ZIP bei
[GNOME Extensions hochladen](https://extensions.gnome.org/upload/).

## 2. Erst nach der Annahme auf GNOME.org

Wenn GNOME.org die neue Version akzeptiert und anzeigt, die Versionsnummer in
`metadata.json` auf diese Nummer setzen und ausführen:

```sh
make release-verify VERSION=N
```

Der Befehl prüft die Tests und vergleicht alle Paketdateien mit dem angenommenen
GNOME-Kandidaten. Er gibt das ZIP unter `dist/` für GitHub Releases frei. Danach
die Metadaten-Version committen und pushen und das geprüfte ZIP an das passende
GitHub Release anhängen.

So wird GitHub und die lokale Installation erst nach GNOME.org aktualisiert.
Die GNOME-Freigabe selbst bleibt ein manueller Upload und kann nicht durch den
Build-Befehl veröffentlicht werden.
