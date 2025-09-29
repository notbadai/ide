.PHONY: compile-ui watch package clean install

compile:
	npm install
	rm -rf dist*
	mkdir -p dist/js/sourcemaps
	cp -r ui/static/* dist
	cp dist/index.html dist/404.html
	mkdir -p dist/xterm
	cp node_modules/@xterm/xterm/css/xterm.css dist/xterm/
	cp node_modules/@xterm/xterm/lib/xterm.js dist/xterm/
	npm run build:sass
	npm run build:ui
	npm run build:electron

watch: compile
	npm run watch:ui & npm run watch:sass & npm run electron

package: compile
	npm run package:electron