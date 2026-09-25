UUID = monitor-loupe@sprites.github.io

.PHONY: test pack release-candidate release-verify clean

test:
	node --experimental-default-type=module test-geometry.mjs
	node --experimental-default-type=module test-zoom.mjs
	node --experimental-default-type=module test-lifecycle.mjs
	glib-compile-schemas --strict --dry-run schemas
	msgfmt --check --output-file=/dev/null po/de.po

pack: test
	mkdir -p dist
	gnome-extensions pack --force --extra-source=geometry.js --extra-source=zoom.js --extra-source=appearance.js --extra-source=color.js --extra-source=monitor-loupe-symbolic.svg --extra-source=LICENSE --podir=po --out-dir=dist .

release-candidate:
	python3 tools/release.py candidate

release-verify:
	@test -n "$(VERSION)" || (echo 'Usage: make release-verify VERSION=7' >&2; exit 2)
	python3 tools/release.py verify "$(VERSION)"

clean:
	rm -f dist/$(UUID).shell-extension.zip
