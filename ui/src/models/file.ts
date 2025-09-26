import DiffMatchPatch from 'diff-match-patch'
import {FileOrFolderNode} from "../managers/project/file_or_folder_node"

const dmp = new DiffMatchPatch()

export interface FileModel {
    identifier?: string
    path: string
    is_empty_dir?: boolean
    content?: string
    version?: number
    is_uncommitted?: boolean,
}

export interface EditorPersistentState {
    viewCursor: number
    viewScrollTop: number
}

export class File {
    private identifier: string

    public path: string
    public is_empty_dir: boolean
    public version: number
    public content: string
    public savedContent: string

    private editorState: EditorPersistentState

    private lastUpdated: number

    private isDirty: boolean
    private isUncommitted: boolean

    private onDirtyOrUncommitChangeCallback: (() => void)

    private _fileOrFolderNode: FileOrFolderNode

    constructor(file: FileModel) {
        this.identifier = file.identifier
        this.path = file.path
        this.is_empty_dir = file.is_empty_dir
        this.content = file.content
        this.version = file.version

        this.lastUpdated = Date.now()
        this.editorState = null

        this.isDirty = false
        if (file.is_uncommitted == null) {
            this.isUncommitted = false
        }
        this.isUncommitted = file.is_uncommitted

        this.onDirtyOrUncommitChangeCallback = null

        this.fileOrFolderNode = null

        this.savedContent = file.content
    }

    public get isEmptyPath(): boolean {
        return this.path.trim().length == 0
    }

    public isEmpty(): boolean {
        return this.content == null
    }

    public get language() {
        const ext = (this.path.split('.').pop() ?? '').toLowerCase()

        if (ext === 'py') {
            return 'Python'
        } else if (ext === 'js') {
            return 'JavaScript'
        } else if (ext === 'ts') {
            return 'TypeScript'
        } else if (ext === 'jsx') {
            return 'JSX'
        } else if (ext === 'tsx') {
            return 'TSX'
        } else if (ext === 'json') {
            return 'JSON'
        } else if (ext === 'html') {
            return 'HTML'
        } else if (ext === 'htm') {
            return 'HTML'
        } else if (ext === 'css') {
            return 'CSS'
        } else if (ext === 'md') {
            return 'Markdown'
        } else if (ext === 'markdown') {
            return 'Markdown'
        } else if (ext === 'scss') {
            return 'SCSS'
        } else if (ext === 'yml') {
            return 'YAML'
        } else if (ext === 'yaml') {
            return 'YAML'
        } else if (ext === 'sql') {
            return 'SQL'
        }

        return 'Unknown'
    }

    public get fileName(): string {
        return this.path.split('/').pop() ?? ''
    }

    public getState(): EditorPersistentState {
        return this.editorState
    }

    public setState(state: EditorPersistentState): void {
        this.editorState = state
    }

    public deleteState(): void {
        this.editorState = null
    }

    public close() {
        this.deleteState()
        this.content = null
    }

    private setDirtyOrUncommitted(): void {
        if (this.onDirtyOrUncommitChangeCallback != null) {
            this.onDirtyOrUncommitChangeCallback()
        }
        if (this.fileOrFolderNode != null) {
            this.fileOrFolderNode.setDirtyOrUncommitted()
        }
    }

    public set dirty(newContent: string) {
        this.isDirty = dmp.patch_toText(dmp.patch_make(this.savedContent, newContent)).trim() !== ''
        this.setDirtyOrUncommitted()
    }

    public get dirty(): boolean {
        return this.isDirty
    }

    public setForceDirty(isDirty: boolean) {
        this.isDirty = isDirty
    }

    public set uncommitted(isUncommitted: boolean) {
        this.isUncommitted = isUncommitted
        this.setDirtyOrUncommitted()
    }

    public get uncommitted(): boolean {
        return this.isUncommitted
    }

    public set setDirtyOrUncommitChangeCallback(onDirtyOrUncommitChangeCallback: () => void) {
        this.onDirtyOrUncommitChangeCallback = onDirtyOrUncommitChangeCallback
    }

    public set fileOrFolderNode(node: FileOrFolderNode) {
        this._fileOrFolderNode = node
    }

    public get fileOrFolderNode(): FileOrFolderNode {
        return this._fileOrFolderNode
    }
}