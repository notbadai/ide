import { WeyaElementFunction } from "../../../lib/weya/weya"
import { getMarkDownParsed } from "../utils/markdown"

export interface CollapseBlockOptions {
    content: string,
    isExpanded: boolean
}

export class CollapseBlock {
    private elem: HTMLDivElement
    private contentElem: HTMLDivElement
    private headerElem: HTMLDivElement

    private readonly content: string
    private readonly isExpanded: boolean

    constructor(opt: CollapseBlockOptions) {
        this.content = opt.content
        this.isExpanded = opt.isExpanded
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.collapsible.active', $ => {
            this.headerElem = $('div', '.header', 'Thinking')
            this.contentElem = $('div', '.content')
        })

        // render markdown content
        this.contentElem.innerHTML = getMarkDownParsed(this.content)

        this.headerElem.onclick = () => {
            this.togglePanel()
        }

        if (!this.isExpanded) {
            this.togglePanel()
        }
    }

    private togglePanel() {
        if (this.elem.classList.contains('active')) {
            this.elem.classList.remove('active')
        } else {
            this.elem.classList.add('active')
        }
    }
}