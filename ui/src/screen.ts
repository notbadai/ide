import {Weya as $} from '../../lib/weya/weya'

import {getWindowDimensions} from "./utils/window"
import {Loader} from './components/loader'
import {clearChildElements, setTitle} from './utils/document'
import {ScreenView} from './screen_view'
import {banner} from "./components/banner"
import {statusBar} from "./components/status_bar"


class ScreenContainer {
    view?: ScreenView

    private loader: Loader

    private windowWidth: number

    constructor() {
        this.view = null
        this.loader = new Loader()

        window.addEventListener('resize', this.onResize.bind(this))
        window.addEventListener('beforeunload', this.onClose.bind(this))
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this))
    }

    onResize = () => {
        let windowWidth = getWindowDimensions().width
        // Prevent mobile browser addressBar visibility from triggering a resize event
        if (this.windowWidth !== windowWidth && this.view) {
            this.windowWidth = windowWidth
            this.view.onResize(windowWidth)
        }
    }

    onVisibilityChange() {
        if (this.view) {
            this.view.onVisibilityChange()
        }
    }

    onClose() {
        if (this.view) {
            this.view.onClose()
        }
    }

    async setView(view: ScreenView, ...args: any[]) {
        if (this.view) {
            if (this.view.canUpdate(...args)) {
                this.view.onUpdate(...args)
                return
            }
            this.view.destroy()
            setTitle({})
        }
        this.view = view
        clearChildElements(document.body)
        this.loader.render($)
        clearChildElements(document.body)
        this.windowWidth = null
        this.onResize()
        document.body.append(banner.render())
        document.body.append(await this.view.render())

        if (window.location.pathname.startsWith('/editor')) {
            document.body.classList.add('has-status-bar')
            document.body.append(statusBar.render())
        } else {
            document.body.classList.remove('has-status-bar')
        }

        window.electronAPI.onNetworkError(({message}) => banner.error(message))
    }
}

export {ScreenContainer}