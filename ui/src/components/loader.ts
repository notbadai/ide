import {Weya as $, WeyaElement, WeyaElementFunction} from '../../../lib/weya/weya'
import {ErrorMessage} from './error_message'
import {waitForFrame} from '../utils/render'

export class Loader {
    private elem: WeyaElement

    private readonly display: string
    private readonly loaderType: string

    constructor(loaderType: string = 'spin', display?: string) {
        this.elem = null
        this.loaderType = loaderType
        this.display = display
    }

    render($: WeyaElementFunction) {
        this.elem = $('div', '.text-center.loader-container', $ => {
            if (this.loaderType === 'spin') {
                $('div', '.spin-loader', '')
            } else if (this.loaderType === 'line') {
                $('div', '.line-loader', '')
            } else if (this.loaderType === 'dot') {
                $('div', '.dot-loader', $ => {
                    $('div', '.dot', '')
                    $('div', '.dot', '')
                    $('div', '.dot', '')
                })
            } else if (this.loaderType === 'minimal') {
                $('div', '.minimal-loader', '')
            } else {
                throw new Error('Unknown Loader Type')
            }
        })

        if (this.display != null) {
            this.elem.style.display = this.display
        }

        return this.elem
    }

    hide = (isHidden: boolean) => {
        if (this.elem == null) {
            return
        }
        if (isHidden) {
            this.elem.classList.add('hide')
        } else {
            this.elem.classList.remove('hide')
        }
    }

    remove() {
        if (this.elem == null) {
            return
        }
        this.elem.remove()
        this.elem = null
    }
}

export class DataLoader {
    loader: Loader
    private readonly _load: (force: boolean, ...args: any[]) => Promise<void>
    private loaded: boolean
    private elem: HTMLDivElement
    private errorMessage: ErrorMessage

    constructor(load: (force: boolean, ...args: any[]) => Promise<void>) {
        this._load = load
        this.loaded = false
        this.loader = new Loader()
        this.errorMessage = new ErrorMessage()
    }

    render($: WeyaElementFunction) {
        this.elem = $('div', '.data-loader')
    }

    async load(force: boolean = false, ...args: any[]) {
        this.errorMessage.remove()
        if (!this.loaded) {
            this.elem.appendChild(this.loader.render($))
            await waitForFrame()
        }

        try {
            await this._load(force, ...args)
            this.loaded = true
        } catch (e) {
            this.loaded = false
            // this.errorMessage.render(this.elem)
            throw e
        } finally {
            this.loader.hide(true)
        }
    }

    reset() {
        this.loaded = false
    }
}