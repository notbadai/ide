.PHONY: compile-ui watch package clean install

compile-ui:
	rm -rf dist*
	npm install --ignore-scripts && npm run build
	mkdir -p dist/js/sourcemaps
	cp -r ui/static/* dist/
	cp dist/index.html dist/404.html
	mkdir -p dist/xterm
	cp node_modules/@xterm/xterm/css/xterm.css dist/xterm/
	cp node_modules/@xterm/xterm/lib/xterm.js dist/xterm/

watch: compile-ui
	npm run electron:dev

package: compile-ui
	npm run package:electron