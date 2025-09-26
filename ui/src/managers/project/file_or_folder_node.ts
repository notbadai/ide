import {Weya as $, WeyaElementFunction} from "../../../../lib/weya/weya"

import {clearChildElements} from "../../utils/document"
import {File} from "../../models/file"
import {Dropdown} from "../../components/dropdown"
import {projectManager} from "./manager"

interface FileOrFolderNodeOptions {
    title: string
    file?: File
    onFileChange?: (fileOrFolderNode: FileOrFolderNode) => void
    utilsDropDown: Dropdown
    parent: FileOrFolderNode
    isEditable: boolean
}

export class FileOrFolderNode {
    private elem: HTMLDivElement
    private headerElem: HTMLDivElement
    private titleElem: HTMLSpanElement
    private titleContentElem: HTMLSpanElement
    private inputElem: HTMLInputElement
    private childNodesElem: HTMLDivElement

    public file: File
    private readonly childNodes: { [identifier: string]: FileOrFolderNode }
    private readonly onFileChange: (fileOrFolderNode: FileOrFolderNode) => void

    private readonly utilsDropDown: Dropdown
    private readonly parent: FileOrFolderNode
    private isEditable: boolean
    private title: string
    private isCollapsed: boolean

    private readonly onClickBind: () => void
    private readonly onNewNodeBind: (e?: MouseEvent) => void
    private readonly onUnEditBind: (e: MouseEvent) => void

    constructor(opt: FileOrFolderNodeOptions) {
        this.title = opt.title
        this.file = opt.file
        this.onFileChange = opt.onFileChange
        this.utilsDropDown = opt.utilsDropDown
        this.parent = opt.parent
        this.isEditable = opt.isEditable

        this.isCollapsed = true
        this.childNodes = {}

        this.onClickBind = this.onClick.bind(this)
        this.onNewNodeBind = this.onNewNode.bind(this)
        this.onUnEditBind = this.onUnEdit.bind(this)

        if (this.isEditable) {
            document.addEventListener("click", this.onNewNodeBind)
        }
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.file-node', $ => {
            this.headerElem = $('div', '.header-title', $ => {
                this.titleElem = $('span')

            })
            this.childNodesElem = $('div', '.child-nodes')
        })

        this.elem.addEventListener("contextmenu", this.onContextMenu.bind(this))
        this.renderTitle(this.isEditable)

        if (this.file != null) {
            this.setDirtyOrUncommitted()
        }

        return this.elem
    }

    private renderTitle(isEditable: boolean) {
        clearChildElements(this.titleElem)
        $(this.titleElem, $ => {
            if (isEditable) {
                this.inputElem = $('input', '.input', {
                    value: this.title,
                    on: {
                        keydown: this.onEnter.bind(this),
                    }
                })
                this.headerElem.removeEventListener('click', this.onClickBind)
            } else {
                this.titleContentElem = $('span', '.title-content', $ => {
                    if (this.file != null) {
                        $('i', '.far.fa-file')
                    } else {
                        $('i', '.fas.fa-folder')
                    }
                    $('span', '.title', this.title)
                })
                this.headerElem.addEventListener('click', this.onClickBind)
            }
        })

        if (isEditable && this.inputElem != null) {
            requestAnimationFrame(() => {
                this.inputElem?.focus()
                this.inputElem?.select()   // put caret at end / highlight text
            })
        }

    }

    private onContextMenu(e: MouseEvent) {
        let binds = [this.onNewFile, this.onNewFolder, this.onRename, this.onDelete]
        e.preventDefault()
        e.stopPropagation()
        this.utilsDropDown.rePosition(e)
        this.utilsDropDown.bindOptions(binds)
        this.utilsDropDown.display(true)
    }

    public addChildNode(opt: FileOrFolderNodeOptions) {
        if (this.childNodes[opt.title] != null) {
            return this.childNodes[opt.title]
        }
        let childNode = new FileOrFolderNode(opt)
        // don't keep the node adds from UI
        if (opt.title != null) {
            this.childNodes[opt.title] = childNode
        }

        if (childNode.file != null) {
            childNode.file.fileOrFolderNode = childNode
        }

        return childNode
    }

    public insertChildNode(opt: FileOrFolderNodeOptions) {
        const childNode = this.addChildNode(opt)
        const el = childNode.render($)

        if (this.childNodesElem.firstChild) {
            this.childNodesElem.insertBefore(el, this.childNodesElem.firstChild)
        } else {
            this.childNodesElem.appendChild(el)
        }
    }

    private onClick() {
        clearChildElements(this.childNodesElem)
        if (this.isCollapsed) {
            $(this.childNodesElem, $ => {
                const sortedChildKeys = this.getSortedChildKeys()
                for (let key of sortedChildKeys) {
                    this.childNodes[key].render($)
                }
            })
        }

        this.isCollapsed = !this.isCollapsed
        if (this.file != null) {
            this.onFileChange(this)
        }
    }

    private getSortedChildKeys(): string[] {
        return Object.keys(this.childNodes).sort((a, b) => {
            const nodeA = this.childNodes[a]
            const nodeB = this.childNodes[b]
            
            const aIsDir = nodeA.file == null // null file means directory
            const bIsDir = nodeB.file == null
            
            // directories come first
            if (aIsDir && !bIsDir) return -1
            if (!aIsDir && bIsDir) return 1
            
            // same type, sort alphabetically (case-insensitive)
            return a.toLowerCase().localeCompare(b.toLowerCase())
        })
    }

    public unCollapse() {
        this.onClick()
    }

    public selected(selected: boolean) {
        if (this.elem.classList.contains('selected')) {
            this.elem.classList.remove('selected')
        }

        if (selected) {
            this.elem.classList.add('selected')
        }
    }

    public remove() {
        this.elem.remove()
    }

    private onUnEdit(e: MouseEvent) {
        if (e.target == this.inputElem) {
            return
        }
        this.renderTitle(false)
        document.removeEventListener("click", this.onUnEditBind)
    }

    private onEnter(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            if (this.isEditable) {
                // first time the node added from UI
                this.onNewNode()
            } else {
                let title = this.inputValue
                // usual renames
                projectManager.onFileOrFolderRename(this.fullPath, title,
                    () => {
                        this.title = title
                        this.renderTitle(false)
                    }, () => {
                        this.renderTitle(false)
                    })
                document.removeEventListener("click", this.onUnEditBind)
            }
        }
    }

    private get inputValue() {
        return this.inputElem.value.trim() != '' ? this.inputElem.value : this.title
    }

    private onNewNode(e: MouseEvent = null) {
        if (e != null && e.target == this.inputElem) {
            return
        }

        let title = this.inputValue

        if (title == null) {
            this.remove()
            return
        }
        if (this.file != null) {
            this.file.path += `/${title}`
        }
        this.title = title
        this.inputElem.disabled = true
        projectManager.onFileOrFolderCreate(
            this.fullPath,
            this.file != null,
            null,
            () => {
                this.isEditable = false
                this.renderTitle(false)
                this.parent.childNodes[this.title] = this
                // update the file object with the latest
                if (this.file != null) {
                    this.file = projectManager.project.getFile(this.file.path)
                    this.file.fileOrFolderNode = this
                    this.setDirtyOrUncommitted()
                }
            }, () => {
                this.remove()
            })
        document.removeEventListener('click', this.onNewNodeBind)
    }

    private onRename = () => {
        this.renderTitle(true)
        document.addEventListener("click", this.onUnEditBind)
    }

    private getAllChildren(childNodes: { [identifier: string]: FileOrFolderNode }) {
        let childPaths: string[] = []
        for (const node of Object.values(childNodes)) {
            if (node.file == null) {
                childPaths = [...childPaths, ...this.getAllChildren(node.childNodes)]
            } else {
                childPaths.push(node.file.path)
            }
        }

        return childPaths
    }

    private onDelete = () => {
        const childPaths = this.getAllChildren(this.childNodes)
        projectManager.onFileOrFolderDelete(this.fullPath, childPaths, () => {
            delete this.parent.childNodes[this.title]
            this.remove()
        })
    }

    private onNewFile = () => {
        let parent = this.file != null ? this.parent : this
        parent.insertChildNode({
            title: null,
            file: new File({path: this.getParentPath(parent), content: ''}),
            onFileChange: this.onFileChange,
            utilsDropDown: this.utilsDropDown,
            parent: parent,
            isEditable: true,
        })
    }

    private onNewFolder = () => {
        let parent = this.file != null ? this.parent : this
        parent.insertChildNode({
            title: null,
            file: null,
            onFileChange: this.onFileChange,
            utilsDropDown: this.utilsDropDown,
            parent: parent,
            isEditable: true,
        })
    }

    private getParentPath(parent: FileOrFolderNode) {
        // main Node
        if (parent == null) {
            return this.title
        }

        let res = []
        while (parent != null) {
            res.push(parent.title)
            parent = parent.parent
        }

        return res.reverse().join('/')
    }

    public get fullPath() {
        // sudo node
        if (this.parent == null && this.title == '') {
            return null
        }
        return `${this.getParentPath(this.parent)}/${this.title}`
    }

    public setDirtyOrUncommitted(): void {
        if (this.file.dirty) {
            this.setDirty(true)
            this.setUnCommited(false)
        } else if (this.file.uncommitted) {
            this.setDirty(false)
            this.setUnCommited(true)
        } else {
            this.setDirty(false)
            this.setUnCommited(false)
        }
    }

    private setDirty(dirty: boolean) {
        // TODO this should not be the case, added since I couldn't find the reason
        if (this.titleContentElem == null) {
            return
        }

        if (dirty && this.titleContentElem.classList.contains('dirty')) {
            return
        }
        if (!dirty && this.titleContentElem.classList.contains('dirty')) {
            this.titleContentElem.classList.remove('dirty')
            return
        }
        if (dirty) {
            this.titleContentElem.classList.add('dirty')
            return
        }
    }

    private setUnCommited(unCommitted: boolean) {
        // [TODO] this should not be the case, added since I couldn't find the reason
        if (this.titleContentElem == null) {
            return
        }

        if (unCommitted && this.titleContentElem.classList.contains('uncommitted')) {
            return
        }
        if (!unCommitted && this.titleContentElem.classList.contains('uncommitted')) {
            this.titleContentElem.classList.remove('uncommitted')
            return
        }
        if (unCommitted) {
            this.titleContentElem.classList.add('uncommitted')
            return
        }
    }

    public getFileAndFolderList(): Array<{ path: string, isFile: boolean }> {
        const result: Array<{ path: string, isFile: boolean }> = []

        const traverseNode = (node: FileOrFolderNode, skipSelf: boolean = false) => {
            if (!skipSelf && node.fullPath) {
                result.push({
                    path: node.fullPath,
                    isFile: node.file != null
                })
            }

            const sortedChildren = Object.keys(node.childNodes).sort()
            for (const childKey of sortedChildren) {
                traverseNode(node.childNodes[childKey])
            }
        }

        traverseNode(this, true)
        return result
    }
}

