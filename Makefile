compile-ui: ## Compile JS
	rm -rf dist*
	mkdir -p dist/js/sourcemaps
	cp -r ui/static/* dist
	cp dist/index.html dist/404.html
	mkdir -p dist/xterm
	cp node_modules/@xterm/xterm/css/xterm.css dist/xterm/
	cp node_modules/@xterm/xterm/lib/xterm.js dist/xterm/
	npm install --ignore-scripts && npm run build

compile-prod-ui: compile-ui
	$(eval JS_CHECKSUM := $(shell md5sum dist/js/bundle.min.js | cut -f 1 -d " "))
	$(eval CSS_CHECKSUM := $(shell md5sum dist/css/style.css | cut -f 1 -d " "))
	sed -i 's/bundle.min.js/$(JS_CHECKSUM).min.js/g' dist/index.html
	sed -i 's/bundle.min.js.map/$(JS_CHECKSUM).min.js.map/g' dist/js/bundle.min.js
	sed -i 's/style.css/$(CSS_CHECKSUM).css/g' dist/index.html
	sed -i 's/style.css.map/$(CSS_CHECKSUM).css.map/g' dist/css/style.css
	mv dist/js/bundle.min.js dist/js/$(JS_CHECKSUM).min.js
	mv dist/js/bundle.min.js.map dist/js/sourcemaps/$(JS_CHECKSUM).min.js.map
	mv dist/css/style.css dist/css/$(CSS_CHECKSUM).css
	mv dist/css/style.css.map dist/css/$(CSS_CHECKSUM).css.map
	
watch: compile-ui ## Watch assets & auto-reload Electron
	npm install && npm run electron:dev

package: compile-ui ## Build & package the Electron app (current OS/arch)
	npm install && npm run package:electron