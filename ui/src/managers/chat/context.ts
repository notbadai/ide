import {Weya as $, WeyaElementFunction} from '../../../../lib/weya/weya'
import {clearChildElements} from '../../utils/document'
import {matchFile, stripTopDirectory, fuzzyMatch, renderHighlightedText} from '../../utils/search'
import {projectManager} from '../project/manager'

interface ContextItem {
    path: string
    isFile: boolean
}

interface ContextOptions {
    onSelectionChange: (count: number) => void
}

export class Context {
    private elem: HTMLDivElement
    private contentElem: HTMLDivElement
    private selectedItemsElem: HTMLDivElement
    private searchInputElem: HTMLInputElement
    private selectedItems: Map<string, ContextItem> = new Map()
    private searchQuery: string = ''
    private readonly onSelectionChangeCallback: ((count: number) => void)

    constructor(opt: ContextOptions) {
        this.onSelectionChangeCallback = opt.onSelectionChange
    }

    public getNumSelection(): number {
        return this.selectedItems.size
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.context', $ => {
            this.selectedItemsElem = $('div', '.context-selected-items')

            $('div', '.context-search', $ => {
                this.searchInputElem = $('input', '.input', {
                    type: 'text',
                    placeholder: 'Filter files and folders...',
                    value: this.searchQuery,
                    on: {
                        input: this.onSearchInput.bind(this)
                    }
                })
            })

            this.contentElem = $('div', '.context-content')
        })

        this.update()

        return this.elem
    }

    private onSearchInput() {
        this.searchQuery = this.searchInputElem.value.trim().toLowerCase()
        this.updateContent()
    }

    public update() {
        if (!this.contentElem || !projectManager.project) {
            return
        }

        this.updateSelectedItems()
        this.updateContent()
    }

    private updateSelectedItems() {
        if (!this.selectedItemsElem) return

        clearChildElements(this.selectedItemsElem)

        $(this.selectedItemsElem, $ => {
            for (const [path, item] of this.selectedItems) {
                $('span', '.context-selected-tag', $ => {
                    if (item.isFile) {
                        $('i', '.fas.fa-file.context-file-icon')
                    } else {
                        $('i', '.fas.fa-folder.context-folder-icon')
                    }
                    $('span', '.tag-name', this.getFileName(path))
                    $('i', '.fas.fa-times.tag-remove', {
                        on: {
                            click: (e: MouseEvent) => {
                                e.stopPropagation()
                                this.toggleSelection(path, item.isFile)
                            }
                        }
                    })
                })
            }
        })

        // scroll to bottom to show newly added items
        if (this.selectedItems.size > 0) {
            requestAnimationFrame(() => {
                this.selectedItemsElem.scrollTop = this.selectedItemsElem.scrollHeight
            })
        }
    }

    private updateContent() {
        clearChildElements(this.contentElem)

        const fileAndFolderList = projectManager.getFileAndFolderList()
        let itemsWithMatches: Array<ContextItem & { fileNameMatches?: number[], pathMatches?: number[] }> = []

        // filter items if search query exists
        if (this.searchQuery) {
            itemsWithMatches = this.filterItems(fileAndFolderList) as Array<ContextItem & {
                fileNameMatches?: number[],
                pathMatches?: number[]
            }>
        } else {
            itemsWithMatches = fileAndFolderList.map(item => ({...item, fileNameMatches: [], pathMatches: []}))
        }

        $(this.contentElem, $ => {
            for (const item of itemsWithMatches) {
                const contextItemElem = $('div', '.context-item', {
                    on: {
                        click: () => this.toggleSelection(item.path, item.isFile)
                    }
                }, $ => {
                    $('div', '.context-item-info', $ => {
                        if (item.isFile) {
                            $('i', '.fas.fa-file.context-file-icon')
                        } else {
                            $('i', '.fas.fa-folder.context-folder-icon')
                        }

                        $('span', '.context-name', $ => {
                            const fileName = this.getFileName(item.path)
                            renderHighlightedText($, fileName, item.fileNameMatches || [])
                        })

                        const directoryPath = stripTopDirectory(item.path)
                        if (directoryPath) {
                            $('span', '.context-path', $ => {
                                renderHighlightedText($, directoryPath, item.pathMatches || [])
                            })
                        }
                    })
                })

                if (this.selectedItems.has(item.path)) {
                    contextItemElem.classList.add('selected')
                }
            }
        })
    }

    private filterItems(items: ContextItem[]): ContextItem[] {
        if (!this.searchQuery) {
            return items
        }

        const results: Array<{
            item: ContextItem,
            score: number,
            fileNameMatches?: number[],
            pathMatches?: number[]
        }> = []

        for (const item of items) {
            if (item.isFile) {
                // for files, use the existing matchFile logic
                const file = projectManager.project.getFile(item.path)
                if (file) {
                    const match = matchFile(file, this.searchQuery)
                    if (match) {
                        results.push({
                            item,
                            score: match.score,
                            fileNameMatches: match.fileNameMatches,
                            pathMatches: match.pathMatches
                        })
                    }
                }
            } else {
                // for folders, do a fuzzy match
                const folderName = this.getFileName(item.path).toLowerCase()
                const folderPath = stripTopDirectory(item.path).toLowerCase()

                const nameMatch = fuzzyMatch(folderName, this.searchQuery)
                const pathMatch = fuzzyMatch(folderPath, this.searchQuery)

                if (nameMatch.matched || pathMatch.matched) {
                    let score = 0
                    let fileNameMatches: number[] = []
                    let pathMatches: number[] = []

                    if (nameMatch.matched) {
                        if (folderName === this.searchQuery) {
                            score = 1000
                        } else if (folderName.startsWith(this.searchQuery)) {
                            score = 800
                        } else {
                            score = 400 + nameMatch.score
                        }
                        fileNameMatches = nameMatch.matches
                    }

                    if (pathMatch.matched) {
                        score += 200 + pathMatch.score
                        pathMatches = pathMatch.matches
                    }

                    results.push({item, score, fileNameMatches, pathMatches})
                }
            }
        }

        // sort by score (higher is better)
        results.sort((a, b) => b.score - a.score)
        return results.map(r => ({
            ...r.item,
            fileNameMatches: r.fileNameMatches || [],
            pathMatches: r.pathMatches || []
        }))
    }

    private toggleSelection(path: string, isFile: boolean) {
        if (this.selectedItems.has(path)) {
            this.selectedItems.delete(path)
        } else {
            this.selectedItems.set(path, {path, isFile})
        }

        this.update()

        if (this.onSelectionChangeCallback != null) {
            this.onSelectionChangeCallback(this.getNumSelection())
        }
    }

    public getSelectedPaths(): string[] {
        return Array.from(this.selectedItems.keys())
    }

    public clearSelection() {
        this.selectedItems.clear()
        this.update()

       
        if (this.onSelectionChangeCallback != null) {
            this.onSelectionChangeCallback(0)
        }
    }

    private getFileName(path: string): string {
        const parts = path.split('/').filter(Boolean)
        return parts.length > 0 ? parts[parts.length - 1] : path
    }
}