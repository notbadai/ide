import {Weya as $, WeyaElementFunction} from "../../../../lib/weya/weya"
import {File} from "../../models/file"

interface TabSwitcherItem {
    file: File
    index: number
}

export class TabSwitcher  {
    private elem: HTMLElement
    private listElem: HTMLElement
    private items: TabSwitcherItem[] = []
    private selectedIndex: number = 0
    private currentTabIndex: number = -1
    private isVisible: boolean = false

    constructor() {
    }

    public render($: WeyaElementFunction): HTMLElement {
        this.elem = $('div', '.tab-switcher-overlay.hide', $ => {
            $('div', '.tab-switcher-popup', $ => {
                $('div', '.tab-switcher-header', $ => {
                    $('i', '.fas.fa-exchange-alt')
                    $('span', 'Switch Tab')
                })
                this.listElem = $('div', '.tab-switcher-list')
            })
        })

        // close on click outside
        this.elem.addEventListener('click', (e) => {
            if (e.target === this.elem) {
                this.hide()
            }
        })

        return this.elem
    }

    public show(tabs: File[], currentTabIndex: number): void {
        this.items = tabs.map((file, index) => ({ file, index }))
        this.currentTabIndex = currentTabIndex
        this.selectedIndex = currentTabIndex
        this.isVisible = true

        this.renderList()
        this.elem.classList.remove('hide')
        
        // focus for keyboard events
        this.elem.focus()
    }

    public hide(): void {
        this.isVisible = false
        this.elem.classList.add('hide')
        this.items = []
    }

    public moveNext(): void {
        if (this.items.length <= 1) return
        this.selectedIndex = (this.selectedIndex + 1) % this.items.length
        this.updateSelection()
    }

    public movePrevious(): void {
        if (this.items.length <= 1) return
        this.selectedIndex = this.selectedIndex === 0 
            ? this.items.length - 1 
            : this.selectedIndex - 1
        this.updateSelection()
    }

    public getSelectedTabIndex(): number {
        return this.items[this.selectedIndex]?.index ?? -1
    }

    public isOpen(): boolean {
        return this.isVisible
    }

    private renderList(): void {
        if (!this.listElem) return

        this.listElem.innerHTML = ''
        
        $(this.listElem, $ => {
            this.items.forEach((item, listIndex) => {
                const isSelected = listIndex === this.selectedIndex
                const isCurrent = item.index === this.currentTabIndex  // Check if this is current tab
                
                let className = '.tab-switcher-item'
                if (isSelected) className += '.selected'
                if (isCurrent) className += '.current'  // Add current class
                if (item.file.dirty) {
                    className += '.dirty'
                } else if (item.file.uncommitted) {
                    className += '.uncommitted'
                }

                $('div', className, {
                    'data-tab-index': item.index.toString()
                }, $ => {
                    $('div', '.tab-info', $ => {
                        $('i', '.fas.fa-file')
                        $('span', '.filename', item.file.fileName)
                        $('span', '.filepath', this.truncatePath(item.file.path))
                    })
                })
            })
        })
    }

    private updateSelection(): void {
        const items = this.listElem.querySelectorAll('.tab-switcher-item')
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected')
            } else {
                item.classList.remove('selected')
            }
        })

        
        const selectedItem = items[this.selectedIndex] as HTMLElement
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
    }

    private truncatePath(path: string, maxLength: number = 60): string {
        if (path.length <= maxLength) {
            return path
        }

        const parts = path.split('/')
        let result = parts[parts.length - 1] 
        let remaining = maxLength - result.length - 3 

        for (let i = parts.length - 2; i >= 0 && remaining > 0; i--) {
            const part = parts[i]
            if (remaining >= part.length + 1) { 
                result = part + '/' + result
                remaining -= part.length + 1
            } else {
                break
            }
        }

    
        if (result !== path) {
            result = '...' + result
        }

        return result
    }
}