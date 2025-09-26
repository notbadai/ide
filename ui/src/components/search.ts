import {Weya as $, WeyaElementFunction} from "../../../lib/weya/weya"
import {clearChildElements} from "../utils/document"
import {projectManager} from "../managers/project/manager"
import {File} from "../models/file"
import {stripTopDirectory, matchFile, renderHighlightedText} from "../utils/search"

export interface SearchOptions {
    onSuggestionSelected?: (file: File, initLineNumber?: number) => void
}

export interface Hint {
    file: File
    elem: HTMLElement
}

export class Search {
    private elem: HTMLElement
    private inputElem: HTMLInputElement
    private suggestBoxElem: HTMLUListElement

    private readonly onSuggestionSelected: (file: File, initLineNumber?: number) => void

    private current: number
    private hints: Hint[]

    constructor(opt: SearchOptions) {
        this.onSuggestionSelected = opt.onSuggestionSelected

        this.current = -1
        this.hints = []
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.search', $ => {
            this.inputElem = $('input', '.input', {
                placeholder: "Search files by name…"
            })
            this.suggestBoxElem = $('ul', '.suggestions')
        })

        document.addEventListener('click', (e: MouseEvent) => {
            if (!this.suggestBoxElem?.contains(e.target as Node)) {
                this.hideSuggestions(true)
            }
        })
        this.inputElem.addEventListener('input', e => {
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
                    this.select(this.hints[this.current].file)
                }
            } else if (e.key === 'Escape') {
                this.hideSuggestions(true)
            }
        })

        this.hideSuggestions(true)
        this.setupGlobalKeyListener()
    }

    private setupGlobalKeyListener(): void {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.metaKey && e.key === 'p') {
                e.preventDefault()
                this.focus()
            }
        })
    }

    public focus(): void {
        if (this.inputElem) {
            this.inputElem.focus()
        }
    }

    private renderSuggestions(): void {
        const value = this.inputElem.value.trim().toLowerCase()

        if (value === '') {
            this.hideSuggestions(true)
            return
        }
        const files = projectManager.project.files

        let hints = []
        for (const file of files) {
            const match = matchFile(file, value)
            if (match) {
                hints.push({
                    file,
                    match,
                    score: match.score
                })
            }
        }

        if (hints.length <= 0) {
            this.hideSuggestions(true)
            return
        }

        // Sort by score (higher is better)
        hints.sort((a, b) => b.score - a.score)

        clearChildElements(this.suggestBoxElem)

        this.hints = []
        let index = 0
        hints.forEach(hint => {
            const suggestion = $('li', $ => {
                $('span', '.name', $ => {
                    renderHighlightedText($, hint.file.fileName, hint.match.fileNameMatches)
                })
                const pathText = stripTopDirectory(hint.file.path)
                if (pathText) {
                    $('span', '.path', $ => {
                        renderHighlightedText($, pathText, hint.match.pathMatches)
                    })
                }
            })
            suggestion.onclick = () => {
                this.select(hint.file)
            }
            if (index == this.current) {
                suggestion.classList.add('active')
            }
            index = index + 1
            this.suggestBoxElem.appendChild(suggestion)
            this.hints.push({file: hint.file, elem: suggestion})
        })

        this.hideSuggestions(false)
    }

    private select(file: File): void {
        this.hideSuggestions(true)
        this.current = -1
        this.inputElem.value = ''
        this.hints = []
        if (this.onSuggestionSelected != null) {
            this.onSuggestionSelected(file)
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
}