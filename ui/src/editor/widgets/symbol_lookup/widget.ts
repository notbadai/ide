import {Weya as $, WeyaElementFunction} from "../../../../../lib/weya/weya"
import {clearChildElements} from "../../../utils/document"
import {projectManager} from "../../../managers/project/manager"
import {CodeResults, CodeResult} from "../../../components/code_results"


type Coords = {
    left: number
    top: number
    bottom: number
}

const POPUP_MARGIN = 6

export class SymbolLookupWidget {
    private elem: HTMLElement
    private listElem: HTMLElement
    private symbolElem: HTMLSpanElement
    private usageCountElem: HTMLSpanElement
    private intentElem: HTMLSpanElement

    private codeResults: CodeResults

    private isVisible: boolean = false
    private readonly boundDocumentClick: (e: MouseEvent) => void

    constructor() {
        this.boundDocumentClick = this.onDocumentClick.bind(this)
    }

    private onClose() {
        const codeEditor = projectManager.codeEditor
        if (codeEditor == null) {
            return
        }
        if (!codeEditor.isEditorReady) {
            return
        }
        codeEditor.focus()
    }

    public render ($: WeyaElementFunction): HTMLElement {
        this.elem = $('div', '.usage-list', $ => {
            $('div', '.usage-header', $ => {
                $('div', '.usage-title', $ => {
                    $('i', '.fas.fa-search')
                    this.intentElem = $('span', '.intent-badge')
                    this.symbolElem = $('span', '.symbol-name')
                    this.usageCountElem = $('span', '.usage-count')
                })
                $('button', '.close-btn', $ => {
                    $('i', '.fas.fa-times')
                }).onclick = () => {
                    this.hide()
                }
            })

            this.listElem = $('div', '.usage-items')
        })

        this.elem.tabIndex = 0
        this.bindEvents()

        return this.elem
    }

    private onSymbolLookupClick(result: CodeResult) {
        projectManager.jumpToEditorLine({
            lineNumber: result.line_number,
            filePath: result.file_path
        })
    }

    public renderSymbolLookupResults(results: CodeResult[], intent: string, symbol: string, coords: Coords) {
        clearChildElements(this.listElem)

        this.usageCountElem.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`
        this.symbolElem.textContent = symbol

        this.intentElem.textContent = intent

        $(this.listElem, $ => {
            this.codeResults = new CodeResults({
                results: results,
                onItemClick: this.onSymbolLookupClick,
                onClose: () => {
                    this.hide()
                    this.onClose()
                }
            })
            this.codeResults.render($)
        })

        this.show(coords)
    }

    private onDocumentClick(e: MouseEvent) {
        if (this.isVisible && !this.elem.contains(e.target as Node)) {
            this.hide()
        }
    }

    private show(coords: { left: number, top: number, bottom: number }) {
        if (this.isVisible) {
            return
        }

        this.isVisible = true

        this.elem.classList.add('visible')
        this.elem.style.visibility = "hidden"
        this.elem.style.left = '-9999px'
        this.elem.style.top = '-9999px'

        const popupH = this.elem.offsetHeight
        const popupW = this.elem.offsetWidth

        const editorBox = projectManager.codeEditor.getEditorView().dom.getBoundingClientRect()

        const roomBelow = editorBox.bottom - coords.bottom
        const shouldFlip = roomBelow < popupH + POPUP_MARGIN

        const finalTop = shouldFlip ? coords.top - popupH - POPUP_MARGIN : coords.bottom + POPUP_MARGIN

        const minTop = POPUP_MARGIN
        const maxTop = window.innerHeight - popupH - POPUP_MARGIN

        const minLeft = 4
        const roomRight = editorBox.right - (coords.left + popupW)
        const finalLeft = roomRight < 0 ? editorBox.right - popupW : coords.left

        this.elem.style.top = `${Math.max(minTop, Math.min(maxTop, finalTop))}px`
        this.elem.style.left = `${Math.max(minLeft, finalLeft)}px`

        this.elem.style.visibility = 'visible'

        document.addEventListener('click', this.boundDocumentClick)

        projectManager.codeEditor.getEditorView().focus()

        setTimeout(() => {
            this.elem.focus()
        }, 10)
    }

    private bindEvents() {
        this.elem.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault()
                    this.codeResults?.moveSelection(1)
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    this.codeResults?.moveSelection(-1)
                    break
                case 'Enter':
                    e.preventDefault()
                    this.codeResults?.onSelect()
                    break
                case 'Escape':
                    e.preventDefault()
                    this.hide()
                    break
            }
        })
    }

    public hide() {
        if (!this.isVisible) {
            return
        }

        this.isVisible = false
        this.elem.classList.remove('visible')

        document.removeEventListener('click', this.boundDocumentClick)
        this.onClose()
    }

    public destroy() {
        document.removeEventListener('click', this.boundDocumentClick)
        if (this.elem && this.elem.parentNode) {
            this.elem.parentNode.removeChild(this.elem)
        }
    }
}