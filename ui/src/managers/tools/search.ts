import {Weya as $, WeyaElementFunction} from '../../../../lib/weya/weya'
import {renderHighlightedText, fuzzyMatch} from '../../utils/search'
import {clearChildElements} from "../../utils/document"

export interface SearchableObject {
    name: string
    [key: string]: any
}

export interface ToolSearchOptions {
    objects: SearchableObject[]
    onSuggestionSelected?: (obj: SearchableObject) => void
}

export interface Hint {
    obj: SearchableObject
    elem: HTMLElement
}

export class ToolSearch {
    private elem: HTMLElement
    private inputElem: HTMLInputElement
    private suggestBoxElem: HTMLUListElement

    private readonly onSuggestionSelected: (obj: SearchableObject) => void

    private current: number
    private hints: Hint[]
    private objects: SearchableObject[]

    constructor(opt: ToolSearchOptions) {
        this.onSuggestionSelected = opt.onSuggestionSelected ?? (() => {
        })
        this.objects = opt.objects
        this.current = -1
        this.hints = []
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.search', $ => {
            this.inputElem = $('input', '.input', {
                placeholder: 'Search tools by name…'
            })
            this.suggestBoxElem = $('ul', '.suggestions')
        })

        document.addEventListener('click', (e: MouseEvent) => {
            if (!this.elem?.contains(e.target as Node)) {
                this.hideSuggestions(true)
            }
        })

        this.inputElem.addEventListener('input', () => {
            this.current = 0
            this.renderSuggestions()
        })

        this.inputElem.addEventListener('focus', () => {
            this.current = 0
            this.renderSuggestions()
        })

        this.inputElem.addEventListener('keydown', e => {
            if (this.hints.length <= 0) {
                return
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                this.current = (this.current + 1) % this.hints.length
                this.highlight()
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                this.current = (this.current - 1 + this.hints.length) % this.hints.length
                this.highlight()
            } else if (e.key === 'Enter') {
                e.preventDefault()
                if (this.current > -1) {
                    this.select(this.hints[this.current].obj)
                }
            } else if (e.key === 'Escape') {
                this.hideSuggestions(true)
            }
        })

        this.renderSuggestions()
    }

    public updateObjects(objects: SearchableObject[]) {
        this.objects = objects
        this.renderSuggestions()
    }

    private renderSuggestions(): void {
        if (this.elem == null) {
            return
        }
        const value = this.inputElem.value.trim().toLowerCase()

        let hints = []
        if (value === '') {
            for (const obj of this.objects) {
                hints.push({
                    obj,
                    match: {matched: true, score: 1, matches: []}
                })
            }
        } else {
            // filter items based on search value (existing logic)
            for (const obj of this.objects) {
                const name = obj.name.toLowerCase()
                const fuzzyMatchItem = fuzzyMatch(name, value)
                if (fuzzyMatchItem.matched) {
                    hints.push({
                        obj,
                        match: fuzzyMatchItem
                    })
                }
            }
        }

        if (hints.length <= 0) {
            this.hideSuggestions(true)
            return
        }

        // only sort by score when there's a search value
        if (value !== '') {
            hints.sort((a, b) => b.match.score - a.match.score)
        }

        clearChildElements(this.suggestBoxElem)
        this.hints = []
        let index = 0
        hints.forEach(hint => {
            const suggestion = $('li', $ => {
                $('div', '.name', $ => {
                    renderHighlightedText($, hint.obj.name, hint.match.matches)
                    if (hint.obj.shortcut) {
                        $('span', '.shortcut', hint.obj.shortcut)
                    }
                })
                if (hint.obj.description) {
                    $('div', '.path', hint.obj.description)
                }
            })
            suggestion.onclick = () => {
                this.select(hint.obj)
            }
            if (index === this.current) {
                suggestion.classList.add('active')
            }
            index += 1
            this.suggestBoxElem.appendChild(suggestion)
            this.hints.push({obj: hint.obj, elem: suggestion})
        })

        this.hideSuggestions(false)
    }

    private select(obj: SearchableObject): void {
        this.hideSuggestions(true)
        this.current = -1
        this.inputElem.value = ''
        this.hints = []
        if (this.onSuggestionSelected) {
            this.onSuggestionSelected(obj)
        }
    }

    private highlight() {
        this.hints.forEach(hint => hint.elem.classList.remove('active'))
        if (this.current >= 0) {
            this.hints[this.current].elem.classList.add('active')
            this.hints[this.current].elem.scrollIntoView({block: 'nearest'})
        }
    }

    private hideSuggestions(hide: boolean): void {
        const classList = this.suggestBoxElem.classList

        if (hide && classList.contains('hidden')) {
            return
        }
        if (!hide && !classList.contains('hidden')) {
            return
        }
        if (hide && !classList.contains('hidden')) {
            this.suggestBoxElem.classList.add('hidden')
            return
        }
        if (!hide && classList.contains('hidden')) {
            this.suggestBoxElem.classList.remove('hidden')
            return
        }
    }

    public focus(): void {
        if (this.inputElem) {
            this.inputElem.focus()
        }
    }

    public setEnabled(enabled: boolean): void {
        if (this.inputElem) {
            this.inputElem.disabled = !enabled
            if (!enabled) {
                this.hideSuggestions(true)
            }
        }
    }
}