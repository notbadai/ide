import {WeyaElementFunction} from "../../../lib/weya/weya"
import {InspectResult} from "../models/extension"


export interface InspectResultsOptions {
    results: InspectResult[]
    onItemClick: (result: InspectResult) => void
    onClose: () => void
    emptyMessage?: string
}

export class InspectResults {
    private elem: HTMLDivElement

    private readonly results: InspectResult[]
    private readonly onItemClick: (result: InspectResult) => void
    private readonly onClose: () => void
    private readonly emptyMessage?: string

    private selectedIndex: number

    constructor(opt: InspectResultsOptions) {
        this.results = opt.results

        this.onItemClick = opt.onItemClick
        this.onClose = opt.onClose
        if (opt.emptyMessage != null) {
            this.emptyMessage = opt.emptyMessage
        } else {
            this.emptyMessage = 'No results found'
        }


        this.selectedIndex = 0
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.code-results', $ => {
            if (this.results.length === 0) {
                $('div', '.no-results', $ => {
                    $('i', '.fas.fa-info-circle')
                    $('span', this.emptyMessage)
                })
                return
            }

            this.results.forEach((result: InspectResult, index: number) => {
                const usageElem = $('div', '.code-result', $ => {
                    $('div', '.result-file', $ => {
                        $('i', '.fas.fa-file-code')
                        $('span', '.file-name', this.getFileName(result.file_path))
                        $('span', '.line-number', `Line ${result.row_from}`)
                    })
                    $('div', '.result-excerpt', $ => {
                        $('span', '.line-content', result.description || '')
                    })
                })

                // add data attribute to track the index
                usageElem.dataset.index = index.toString()

                usageElem.onclick = () => {
                    this.setSelectedIndex(index)
                    this.onItemClick(result)
                    this.onClose()
                }

                if (index === this.selectedIndex) {
                    usageElem.classList.add('selected')
                }
            })

        })

        return this.elem
    }

    private getFileName(fullPath: string): string {
        const parts = fullPath.split('/')
        return parts[parts.length - 1] || fullPath
    }

    private setSelectedIndex(index: number) {
        const oldSelected = this.elem.querySelector('.code-result.selected')
        if (oldSelected) {
            oldSelected.classList.remove('selected')
        }

        this.selectedIndex = index
        // use querySelector with data attribute instead of children[index]
        const newSelected = this.elem.querySelector(`[data-index="${index}"]`) as HTMLElement
        if (newSelected) {
            newSelected.classList.add('selected')
            newSelected.scrollIntoView({block: 'nearest'})
        }
    }

    public moveSelection(direction: number) {
        if (this.results.length === 0) {
            return
        }

        const newIndex = Math.max(0, Math.min(this.results.length - 1, this.selectedIndex + direction))
        this.setSelectedIndex(newIndex)
    }

    public onSelect() {
        if (this.results[this.selectedIndex]) {
            this.onItemClick(this.results[this.selectedIndex])
            this.onClose()
        }
    }
}
