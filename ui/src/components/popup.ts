import {Weya as $, WeyaElementFunction} from "../../../lib/weya/weya"
import {clearChildElements} from "../utils/document"


class Popup {
    private elem: HTMLDivElement
    private contentElem: HTMLDivElement
    private popupElem: HTMLElement

    private readonly onPopupClose: () => {}

    constructor() {
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.popup', $ => {
            this.popupElem = $('div', '.popup-content.shadow', $ => {
                $('span', '.close', {on: {click: this.onClose.bind(this)}}, $ => {
                    $('i', '.fas.fa-times.fa-lg')
                })
                this.contentElem = $('div', '.content')
            })
        })

        document.addEventListener('keydown', this.onKeyDown.bind(this))
    }

    public onClose() {
        this.elem.style.display = 'none'
        if (this.onPopupClose != null) {
            this.onPopupClose()
        }
    }

    private display() {
        this.elem.style.display = 'block'
    }

    private onKeyDown(e: KeyboardEvent) {
        if (e.key == 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            this.onClose()
        }
    }

    public renderContent(elem: any, fitContent = false) {
        clearChildElements(this.contentElem)
        $(this.contentElem, $ => {
            elem.render($)
        })
        if (fitContent) {
            this.popupElem.style.width = 'max-content'
        } else {
            this.popupElem.style.width = '98%'
        }
        this.display()
    }

    public isRendered(): boolean {
        return this.elem.style.display == 'block'
    }
}

export const popup = new Popup()