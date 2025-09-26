import {Weya as $} from '../../../lib/weya/weya'

class Banner {
    private elem: HTMLDivElement
    private messageElem: HTMLSpanElement
    private clickHandler: (() => void) | null = null

    constructor() {
    }

    public render() {
        this.elem = $('div', '.banner.shadow', $ => {
            this.messageElem = $('span')
            $('span', '.close-btn', {on: {click: this.hide.bind(this, true)}}, $ => {
                $('i', '.fas.fa-times')
            })
        })

        this.elem.onclick = (e: MouseEvent) => {
            if (this.clickHandler && !((e.target as HTMLElement).closest('.close-btn'))) {
                this.clickHandler()
            }
        }

        return this.elem
    }

    private setMessage(message: string, type: string, onClick?: () => void) {
        this.messageElem.innerText = message
        this.elem.className = `banner ${type}`
        this.clickHandler = onClick || null
        this.elem.style.cursor = onClick ? 'pointer' : 'default'
    }

    public hide(isHidden: boolean, setTimeoutRemove: boolean = false) {
        if (isHidden) {
            this.elem.classList.remove('show')
            this.clickHandler = null
            // wait for animation to complete before hiding
            setTimeout(() => {
                this.elem.style.display = 'none'
            }, 300)
        } else {
            this.elem.style.display = 'flex'
            // force reflow then add show class for animation
            this.elem.offsetHeight
            this.elem.classList.add('show')
        }

        if (setTimeoutRemove) {
            setTimeout(() => {
                this.hide(true)
            }, 2500)
        }
    }

    public error(message: string, setTimeoutRemove: boolean = false, onClick?: () => void) {
        this.setMessage(message, 'error', onClick)
        this.hide(false, setTimeoutRemove)
    }

    public success(message: string, onClick?: () => void) {
        this.setMessage(message, 'success', onClick)
        this.hide(false, true)
    }

    public warning(message: string, setTimeoutRemove: boolean = true, onClick?: () => void) {
        this.setMessage(message, 'warning', onClick)
        this.hide(false, setTimeoutRemove)
    }

    public info(message: string, onClick?: () => void) {
        this.setMessage(message, 'info', onClick)
        this.hide(false)
    }

    public infoLoader(message: string, onClick?: () => void) {
        this.setMessage(message, 'info', onClick)
        this.hide(false)
    }
}

export const banner = new Banner()