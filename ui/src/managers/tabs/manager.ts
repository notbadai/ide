import {Weya as $, WeyaElementFunction} from "../../../../lib/weya/weya"
import {BaseComponent} from "../../components/base"
import {File} from "../../models/file"
import {clearChildElements} from "../../utils/document"
import {CodeEditor} from "../../editor/editor"
import {projectManager} from "../project/manager"
import {statusBar} from "../../components/status_bar"
import {ProjectChanges} from "../../models/project"
import {TabSwitcher} from "./switcher"
import {Dropdown} from "../../components/dropdown"

interface Tab {
    file: File
}

const MAX_RESTORED_TABS = 10

class TabsManager extends BaseComponent {
    private elem: HTMLElement
    private tabListElem: HTMLDivElement
    private contentElem: HTMLDivElement

    private codeEditor: CodeEditor
    private editorCache: Map<string, CodeEditor> = new Map()

    private active: number
    private readonly tabs: Tab[]
    private readonly tabIndex: Record<string, number>

    private tabSwitcher: TabSwitcher
    private switcherTimeout: number | null = null
    private activeDropdown: Dropdown | null = null

    constructor() {
        super()

        this.tabs = []
        this.tabIndex = {}
        this.tabSwitcher = new TabSwitcher()

        this.activeDropdown = new Dropdown({
            options: [
                {text: 'Close', onClick: null},
                {text: 'Close All Tabs', onClick: null},
            ]
        })

        document.addEventListener('keydown', this.handleKeyDown.bind(this))
        document.addEventListener('keyup', this.handleKeyUp.bind(this))
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.tabs-manager', $ => {
            this.activeDropdown.render($)
            this.tabListElem = $('div', '.tab-list')
            this.contentElem = $('div', '.tab-content')
        })

        this.tabSwitcher.render($)
        document.addEventListener("click", () => this.activeDropdown.display(false))

        return this.elem
    }

    private handleKeyDown(event: KeyboardEvent): void {
        // handle Ctrl+Tab and Ctrl+Shift+Tab
        if (event.ctrlKey && event.key === 'Tab') {
            event.preventDefault()

            if (this.tabs.length <= 1) {
                return
            }

            if (!this.tabSwitcher.isOpen()) {
                // open tab switcher with all tabs
                const allTabs = this.tabs.map(tab => tab.file)
                this.tabSwitcher.show(allTabs, this.active)
            }

            // navigate
            if (event.shiftKey) {
                this.tabSwitcher.movePrevious()
            } else {
                this.tabSwitcher.moveNext()
            }

            // clear any existing timeout
            if (this.switcherTimeout) {
                clearTimeout(this.switcherTimeout)
                this.switcherTimeout = null
            }
        }

        // handle Escape key
        if (event.key === 'Escape' && this.tabSwitcher.isOpen()) {
            event.preventDefault()
            this.tabSwitcher.hide()
        }
    }

    private handleKeyUp(event: KeyboardEvent): void {
        // when Ctrl is released, switch to selected tab
        if (event.key === 'Control' && this.tabSwitcher.isOpen()) {
            // small delay to allow for quick Ctrl+Tab sequences
            this.switcherTimeout = window.setTimeout(() => {
                const selectedIndex = this.tabSwitcher.getSelectedTabIndex()
                if (selectedIndex !== -1 && selectedIndex !== this.active) {
                    this.select(selectedIndex)
                }
                this.tabSwitcher.hide()
                this.switcherTimeout = null
            }, 50)
        }
    }

    private renderTabContent(initLineNumber: number = null) {
        this.renderTabList()

        clearChildElements(this.contentElem)

        if (this.codeEditor != null) {
            this.codeEditor = null as any
            projectManager.codeEditor = this.codeEditor
        }

        if (this.tabs[this.active] == null) {
            this.updatePath()
            return
        }

        const file = this.tabs[this.active].file

        // check cache first
        if (this.editorCache.has(file.path)) {
            this.codeEditor = this.editorCache.get(file.path)
            projectManager.codeEditor = this.codeEditor

            // re-append to DOM
            $(this.contentElem, $ => {
                this.contentElem.appendChild(this.codeEditor.getElement())
            })

            // jump to line if specified, otherwise restore scroll position
            if (initLineNumber != null) {
                this.codeEditor.JumpToLine(initLineNumber)
            } else {
                const savedState = file.getState()
                if (savedState) {
                    this.codeEditor.restoreScrollTop(savedState.viewScrollTop)
                }
            }

            this.codeEditor.focus()
        } else {
            // create new editor and add to cache
            this.codeEditor = new CodeEditor({file: file, initLineNumber: initLineNumber})
            this.editorCache.set(file.path, this.codeEditor)
            projectManager.codeEditor = this.codeEditor

            $(this.contentElem, $ => {
                this.codeEditor.render($).then()
            })
        }

        file.setDirtyOrUncommitChangeCallback = () => {
            this.renderTabList()
        }

        this.updatePath()
    }

    private renderTabList() {
        clearChildElements(this.tabListElem)
        $(this.tabListElem, $ => {
            this.tabs.forEach((tab, index) => {
                let className = '.tab' + (index === this.active ? '.active' : '')

                if (tab.file.dirty) {
                    className += '.dirty'
                } else if (tab.file.uncommitted) {
                    className += '.uncommitted'
                }

                const tabElem = $('div', `${className}`, $ => {
                    let tabNameElem = $('span')
                    tabNameElem.innerText = tab.file.fileName

                    const closeButton = $('button', '.close', $ => {
                            $('i', '.fas.fa-times')
                        }
                    )

                    closeButton.onclick = (e: MouseEvent) => {
                        e.stopPropagation()
                        this.close(index)
                    }
                })

                tabElem.onclick = (e: MouseEvent) => {
                    e.stopPropagation()
                    this.select(index)
                }

                tabElem.oncontextmenu = (e: MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    this.onContextMenu(e, index)
                }
            })
        })
        this.updateConfig()
    }

    private onContextMenu(e: MouseEvent, tabIndex: number): void {
        let binds = [() => {
            this.close(tabIndex)
        }, () => {
            this.closeAllTabs()
        }]
        e.preventDefault()
        e.stopPropagation()
        this.activeDropdown.rePosition(e)
        this.activeDropdown.bindOptions(binds)
        this.activeDropdown.display(true)
    }

    private closeAllTabs(): void {
        while (this.tabs.length > 0) {
            this.close(0)
        }
    }

    public addTab(file: File, initLineNumber: number = null): void {
        const currentActivePath = this.tabs[this.active]?.file.path
        if (currentActivePath == file.path) {
            return
        }

        let tabIndex: number
        if (this.tabIndex[file.path] == null) {
            this.tabs.push({file})
            tabIndex = this.tabs.length - 1
            this.tabIndex[file.path] = tabIndex
        } else {
            tabIndex = this.tabIndex[file.path]
        }

        this.active = tabIndex

        if (this.codeEditor != null) {
            this.codeEditor.saveFile()
            this.codeEditor.file.setState(this.codeEditor.editorState)
        }

        this.renderTabContent(initLineNumber)
    }

    private select(index: number) {
        if (this.active == index) {
            return
        }
        this.active = index

        // save current tab on selecting a new tab
        this.codeEditor.saveFile()
        this.codeEditor.file.setState(this.codeEditor.editorState)

        // update workspace config with the new active tab
        const activeFile = this.tabs[this.active].file
        window.electronAPI.updateWorkspaceConfig({currentActiveTab: activeFile.path}).then()

        this.renderTabContent()
    }

    private setActivateTab() {
        if (this.tabs.length === 0) {
            this.active = undefined as any
            return
        }

        if (this.active >= this.tabs.length) {
            this.active = this.tabs.length - 1
        }
    }

    private close(index: number) {
        const removed = this.tabs[index]

        this.tabs.splice(index, 1)
        delete this.tabIndex[removed.file.path]

        Object.keys(this.tabIndex).forEach(k => delete this.tabIndex[k])
        this.tabs.forEach((tab, idx) => this.tabIndex[tab.file.path] = idx)

        const wasActive = index === this.active

        if (wasActive) {
            this.codeEditor.saveFile()

            this.setActivateTab()
            this.renderTabContent()
        } else {
            if (index < this.active) {
                this.active -= 1
            }
            this.renderTabList()
        }

        removed.file.close()

        this.deleteEditorCache(removed.file.path)
    }

    public fileRename(oldPath: string, renamedFile: File) {
        if (this.tabIndex[oldPath] == null) {
            // file not in tabs
            return
        }

        const index = this.tabIndex[oldPath]
        this.tabs[index] = {file: renamedFile}

        delete this.tabIndex[oldPath]
        this.tabIndex[renamedFile.path] = index

        // Update cache key for renamed file
        if (this.editorCache.has(oldPath)) {
            const editor = this.editorCache.get(oldPath)
            editor.renderPath()
            this.editorCache.delete(oldPath)
            this.editorCache.set(renamedFile.path, editor)
        }

        if (index == this.active) {
            this.updatePath()
        }

        this.renderTabList()
    }

    public deleteEditorCache(path: string, destroy: boolean = false): boolean {
        if (!this.editorCache.has(path)) {
            return false
        }
        const cachedEditor = this.editorCache.get(path)
        if (destroy) {
            cachedEditor.destroy()
        }
        this.editorCache.delete(path)
    }

    public deleteFiles(paths: string[]) {
        if (paths.length === 0) {
            return
        }

        const pathSet = new Set(paths)

        // remove deleted files from cache
        for (const path of paths) {
            this.deleteEditorCache(path, true)
        }

        const currentActivePath = this.tabs[this.active]?.file.path
        const activeTabDeleted = currentActivePath != null && pathSet.has(currentActivePath)

        for (let i = this.tabs.length - 1; i >= 0; i--) {
            const filePath = this.tabs[i].file.path
            if (!pathSet.has(filePath)) {
                continue
            }
            this.tabs.splice(i, 1)
            delete this.tabIndex[filePath]
        }

        for (const key in this.tabIndex) {
            delete this.tabIndex[key]
        }
        this.tabs.forEach((tab, idx) => {
            this.tabIndex[tab.file.path] = idx
        })

        if (activeTabDeleted) {
            this.setActivateTab()
            this.renderTabContent()
        } else {
            this.active = this.tabIndex[currentActivePath]
            this.renderTabList()
        }
    }

    private updatePath() {
        if (this.tabs[this.active] == null) {
            statusBar.updateFileName("", "")
            window.history.pushState("object or string", "Title", `?path=`)
            return
        }
        const file = this.tabs[this.active].file

        if (file.path != null && !file.isEmptyPath) {
            statusBar.updateFileName(file.fileName, file.language)
        } else {
            statusBar.updateFileName("", "")
        }

        window.history.pushState("object or string", "Title", `?path=${file.path}`)
    }

    public syncWithProject(changes: ProjectChanges) {
        const deletedPaths = new Set(changes.deletedPaths)
        const updatedPaths = new Set(changes.updatedPaths)

        const tabsToDelete: string[] = []

        for (const tab of this.tabs) {
            if (deletedPaths.has(tab.file.path)) {
                tabsToDelete.push(tab.file.path)
            }
            if (updatedPaths.has(tab.file.path)) {
                const isCurrentTab = tab.file.path === this.tabs[this.active]?.file.path
                this.deleteEditorCache(tab.file.path, !isCurrentTab)
            }
        }

        if (tabsToDelete.length > 0) {
            this.deleteFiles(tabsToDelete)
        }

        for (const tab of this.tabs) {
            tab.file = projectManager.project.getFile(tab.file.path)
            tab.file.fileOrFolderNode.setDirtyOrUncommitted()
        }

        if (this.shouldUpdateEditor(changes.updatedPaths)) {
            this.renderTabContent()
        } else {
            this.renderTabList()
        }
    }

    private shouldUpdateEditor(updatedPaths: string[]): boolean {
        if (this.codeEditor == null) {
            return false
        }
        if (this.tabs[this.active] == null) {
            return false
        }
        if (!this.codeEditor.isEditorReady) {
            return false
        }
        const updatedPathsSet = new Set(updatedPaths)
        const currentFile = this.tabs[this.active].file
        if (!updatedPathsSet.has(currentFile.path)) {
            return false
        }

        // console.log('updating the current tab ...')

        return currentFile.content != this.codeEditor.content
    }

    private updateConfig() {
        let openTabs = []
        let index = 0
        for (const tab of this.tabs) {
            const isActive = index === this.active
            openTabs.push({path: tab.file.path, isActive: isActive})
            index++
        }
        window.electronAPI.updateWorkspaceConfig({
                openTabs: openTabs
            }
        ).then()
    }

    public closeCurrentTab(): boolean {
        if (this.active == null || this.tabs.length === 0) {
            return false
        }

        this.close(this.active)
        return true
    }

    public restoreTabsFromWorkspace(): void {
        const workspace = projectManager.project.workspace

        if (!workspace || !workspace.openTabs || workspace.openTabs.length === 0) {
            return
        }

        const sortedTabs = [...workspace.openTabs]
            .sort((a, b) => a.isActive === b.isActive ? 0 : a.isActive ? 1 : -1)
            .slice(-MAX_RESTORED_TABS)

        for (const tabState of sortedTabs) {
            const file = projectManager.project.getFile(tabState.path)
            if (file) {
                this.addTab(file)
            }
        }
    }

    public destroy(): void {
        document.removeEventListener('keydown', this.handleKeyDown.bind(this))
        document.removeEventListener('keyup', this.handleKeyUp.bind(this))
        if (this.switcherTimeout) {
            clearTimeout(this.switcherTimeout)
        }
    }

    public getCodeEditor(filePath: string): CodeEditor | null {
        if (filePath == null) {
            return null
        }
        if (!this.editorCache.has(filePath)) {
            return null
        }
        const editor = this.editorCache.get(filePath)
        if (!editor.isEditorReady) {
            return null
        }
        return editor
    }

    public getOpenFiles(): string[] {
        let paths = []
        for (const tab of this.tabs) {
            paths.push(tab.file.path)
        }

        return paths
    }

    public isFileOpenInTab(filePath: string): boolean {
        return this.tabIndex[filePath] != null
    }
}

export const tabsManager = new TabsManager()