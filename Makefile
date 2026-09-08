UUID = monitor-loupe@sprites.github.io

.PHONY: test pack clean

test:
	node --experimental-default-type=module test-geometry.mjs
	node --experimental-default-type=module test-zoom.mjs
	node --experimental-default-type=module test-lifecycle.mjs
	glib-compile-schemas --strict --dry-run schemas
	msgfmt --check --output-file=/dev/null po/de.po

pack: test
	mkdir -p dist
	gnome-extensions pack --force --extra-source=geometry.js --extra-source=zoom.js --extra-source=LICENSE --podir=po --out-dir=dist .

clean:
	rm -f dist/$(UUID).shell-extension.zip
