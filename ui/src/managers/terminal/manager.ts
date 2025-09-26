import {Weya as $, WeyaElementFunction} from '../../../../lib/weya/weya'
import {BaseComponent} from '../../components/base'
import {TerminalPanel} from './terminal'
import {clearChildElements} from "../../utils/document"
import {Dropdown} from "../../components/dropdown"

export interface TerminalTab {
    id: string
    name: string
    terminal: TerminalPanel
}

export class TerminalManager extends BaseComponent {
    private elem: HTMLDivElement
    private terminalContainerElem: HTMLDivElement
    private actionPanelElem: HTMLDivElement

    private readonly terminals: TerminalTab[]
    private activeTerminalId: string
    private terminalCounter: number
    private activeDropdown: Dropdown | null = null

    constructor() {
        super()

        this.terminals = []
        this.terminalCounter = 1

        this.setupTerminalDataListener()
        this.activeDropdown = new Dropdown({
            options: [
                {text: 'Close', onClick: null},
                {text: 'Clear Buffer', onClick: null},
            ]
        })
    }

    private setupTerminalDataListener() {
        window.electronAPI.onTerminalDataRequest?.((data) => {
            const terminalData = this.getTerminalData(data.terminalName)
            window.electronAPI.sendTerminalDataResponse?.(data.requestId, terminalData)
        })
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.terminal-manager', $ => {
            this.terminalContainerElem = $('div', '.terminals-container')
        })

        await this.createTerminal()
        document.body.appendChild(this.activeDropdown.render($))
        document.addEventListener("click", () => this.activeDropdown.display(false))

        return this.elem
    }

    public setActionPanelElem(actionPanelElem: HTMLDivElement) {
        this.actionPanelElem = actionPanelElem
    }

    public async createTerminal(): Promise<string> {
        const terminalId = await window.electronAPI.terminalCreate()
        const terminalName = `Terminal ${this.terminalCounter++}`

        const terminal = new TerminalPanel(terminalId)

        const tab: TerminalTab = {
            id: terminalId,
            name: terminalName,
            terminal: terminal,
        }

        this.terminals.push(tab)
        this.activeTerminalId = terminalId

        this.renderTabs()
        this.renderActiveTerminal()

        return terminalId
    }

    public renderActionPanel() {
        this.renderTabs()
    }

    private renderTabs() {
        clearChildElements(this.actionPanelElem)
        $(this.actionPanelElem, $ => {
            $('div', '.tab-list', $ => {
                this.terminals.forEach(tab => {
                    const tabElem = $('div', `.tab${tab.id === this.activeTerminalId ? '.active' : ''}`, $ => {
                        const titleElem = $('span', '.tab-title')
                        titleElem.textContent = tab.name

                        // only show close button if there's more than one tab
                        if (this.terminals.length > 1) {
                            $('button', '.close', {
                                on: {
                                    click: (e: MouseEvent) => {
                                        e.stopPropagation()
                                        this.destroyTerminal(tab.id)
                                    }
                                }
                            }, $ => {
                                $('i', '.fas.fa-times')
                            })
                        }
                    })

                    tabElem.onclick = (e: MouseEvent) => {
                        e.stopPropagation()
                        this.selectTab(tab.id)
                    }
                    // add right-click context menu
                    tabElem.oncontextmenu = (e: MouseEvent) => {
                        e.preventDefault()
                        e.stopPropagation()
                        this.onContextMenu(e, tab.id)
                    }
                })
                $('button', '.add-tab-btn', {
                    on: {
                        click: () => {
                            this.createTerminal().then()
                        }
                    }
                }, $ => {
                    $('i', '.fas.fa-plus')
                })
            })
        })
    }

    private onContextMenu(e: MouseEvent, tabId: string): void {
        const tab = this.terminals.find(t => t.id === tabId)
        if (!tab) {
            return
        }

        const binds = [
            () => {
                this.destroyTerminal(tabId)
            },
            () => {
                this.clearTerminalBuffer(tabId)
            }
        ]

        e.preventDefault()
        e.stopPropagation()
        this.activeDropdown.rePosition(e)
        this.activeDropdown.bindOptions(binds)
        this.activeDropdown.display(true)
    }

    private clearTerminalBuffer(tabId: string): void {
        const tab = this.terminals.find(t => t.id === tabId)
        if (tab) {
            tab.terminal.resetTerminal()
        }
    }

    private selectTab(tabId: string): void {
        if (this.activeTerminalId === tabId) {
            return
        }

        this.activeTerminalId = tabId
        this.renderTabs()
        this.renderActiveTerminal()
    }

    private renderActiveTerminal() {
        clearChildElements(this.terminalContainerElem)

        const activeTerminal = this.terminals.find(tab => tab.id === this.activeTerminalId)
        if (!activeTerminal) {
            return
        }

        // render the specific chat instance for this tab
        $(this.terminalContainerElem, async $ => {
            let terminalElement = activeTerminal.terminal.getElement()
            if (terminalElement == null) {
                terminalElement = await activeTerminal.terminal.render($)
            }
            this.terminalContainerElem.appendChild(terminalElement)
        })
        activeTerminal.terminal.focus()
    }

    public getTerminalData(terminalName: string): { snapshot: string[], before_reset: string[] } {
        const terminal = this.terminals.find(tab => tab.name === terminalName)

        if (terminal == null) {
            return {snapshot: [], before_reset: []}
        }

        return {
            snapshot: terminal.terminal.getSnapshot(),
            before_reset: terminal.terminal.getLinesBeforeReset()
        }
    }

    public destroyTerminal(terminalId: string) {
        const tabIndex = this.terminals.findIndex(tab => tab.id === terminalId)
        if (tabIndex === -1) {
            return
        }

        // don't allow removing the last tab
        if (this.terminals.length === 1) {
            return
        }

        // get the tab to remove and destroy its chat instance
        const tabToRemove = this.terminals[tabIndex]
        tabToRemove.terminal.destroy()

        // remove the tab
        this.terminals.splice(tabIndex, 1)

        // update active tab if needed
        if (this.activeTerminalId === terminalId) {
            // select the previous tab, or the first one if we removed the first tab
            const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0
            this.activeTerminalId = this.terminals[newActiveIndex]?.id || null
        }
        this.renderTabs()
        this.renderActiveTerminal()
    }

    public destroy() {
        this.terminals.forEach(tab => {
            tab.terminal.destroy()
        })
    }

    public get activateTerminal(): TerminalTab {
        return this.terminals.find(tab => tab.id === this.activeTerminalId)
    }

    public getAllTerminalNames(): string[] {
        return this.terminals.map(tab => tab.name)
    }

    public getCurrentTerminalName(): string | null {
        const activeTerminal = this.terminals.find(tab => tab.id === this.activeTerminalId)
        return activeTerminal ? activeTerminal.name : null
    }
}

export const terminalManager = new TerminalManager()