import {WeyaElementFunction} from "../../../lib/weya/weya"
import {InspectResult} from "../models/extension"


export interface InspectResultsOptions {
    results: InspectResult[]
    onItemClick: (result: InspectResult) => void
    emptyMessage?: string
}

export class InspectResults {
    private elem: HTMLDivElement

    private readonly results: InspectResult[]
    private readonly onItemClick: (result: InspectResult) => void
    private readonly emptyMessage?: string

    constructor(opt: InspectResultsOptions) {
        this.results = opt.results

        this.onItemClick = opt.onItemClick
        if (opt.emptyMessage != null) {
            this.emptyMessage = opt.emptyMessage
        } else {
            this.emptyMessage = 'No results found'
        }
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
                    this.onItemClick(result)
                }
            })

        })

        return this.elem
    }

    private getFileName(fullPath: string): string {
        const parts = fullPath.split('/')
        return parts[parts.length - 1] || fullPath
    }
}
