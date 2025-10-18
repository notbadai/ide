import {WeyaElementFunction} from "../../../../lib/weya/weya"

import {File} from "../../models/file"
import {Project} from "../../models/project"
import {DataLoader} from "../../components/loader"
import CACHE, {ProjectCache} from "../../cache/cache"
import {banner} from "../../components/banner"
import {CodeEditor} from "../../editor/editor"
import {BaseComponent} from "../../components/base"
import {FileExplorer} from "./file_explorer"

export interface ProjectHandlerOptions {
    onFileDeleteCallback: (paths: string []) => void
    onFileRenameCallback: (oldPath: string, renamedFile: File) => void
    onFileChangeClick: (file: File, initLineNumber?: number) => void
}

class ProjectManager extends BaseComponent {
    private elem: HTMLDivElement

    private _project: Project
    private _codeEditor: CodeEditor
    private projectHandleCache: ProjectCache

    private loader: DataLoader
    private fileExplorer: FileExplorer

    private onFileChangeClick: (file: File, initLineNumber?: number) => void
    private onFileDeleteCallback: (paths: string []) => void
    private onFileRenameCallback: (oldPath: string, renamedFile: File) => void

    private readonly onFileSaveCallbacks: (() => void)[]
    private readonly onLoadProject: (() => void) []

    constructor() {
        super()

        this.onLoadProject = []
        this.onFileSaveCallbacks = []
    }

    public init(opt: ProjectHandlerOptions) {
        this.projectHandleCache = CACHE.getProject()
        this.loader = new DataLoader(async (force) => {
            this._project = await this.projectHandleCache.get()
        })

        this.onFileDeleteCallback = opt.onFileDeleteCallback
        this.onFileRenameCallback = opt.onFileRenameCallback
        this.onFileChangeClick = opt.onFileChangeClick

        this.fileExplorer = new FileExplorer({onFileChangeClick: this.onFileChangeClick.bind(this)})
    }

    public runOnProjectLoad(callback: () => void = null) {
        this.onLoadProject.push(callback)
    }

    public setOnFileSaveCallback(onSave: () => void) {
        this.onFileSaveCallbacks.push(onSave)
    }

    public set codeEditor(codeEditor: CodeEditor) {
        this._codeEditor = codeEditor
    }

    public get codeEditor(): CodeEditor {
        return this._codeEditor
    }

    public get project(): Project {
        return this._project
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.project-handler', $ => {
            this.loader.render($)
            this.fileExplorer.render($)
        })

        await this.loader.load()
        this.fileExplorer.renderFiles(this._project)
        for (const onLoadProject of this.onLoadProject) {
            onLoadProject()
        }

        return this.elem
    }

    public reRenderFiles(project?: Project) {
        if (project != null) {
            this._project = project
        }
        this.fileExplorer.renderFiles(this._project)
    }

    public jumpToEditorLine(result: { filePath: string, lineNumber: number }) {
        const {filePath, lineNumber} = result

        if (!this.codeEditor.isEditorReady) {
            return
        }

        if (!this._project.isValidPath(filePath)) {
            banner.error(`Error: invalid file path ${filePath} received`)
            return
        }
        if (this.codeEditor.file.path != filePath) {
            const file = this._project.getFile(filePath)
            projectManager.onFileChangeClick(file, lineNumber)
            return
        }
        this.codeEditor.JumpToLine(lineNumber)
    }

    public onFileOrFolderDelete(path: string, childPaths: string[], onSuccess: () => void = null, onError: () => void = null) {
        const pathsToDelete = [...childPaths, path]

        this.projectHandleCache.fileOperation({
            operation: 'delete',
            file_path: path
        }).then((res) => {
            // console.log(res)
            if (!res.success) {
                banner.error(`${res.error}`)
                if (onError != null) {
                    onError()
                }
            } else {
                this._project.delete(path)
                this.onFileDeleteCallback(pathsToDelete)
                if (onSuccess != null) {
                    onSuccess()
                }
            }
        })
    }

    private onFileRename(path: string, newFileName: string, onSuccess: () => void = null, onError: () => void = null) {
        this.projectHandleCache.fileOperation({
            operation: 'rename',
            file_path: path,
            new_file_name: newFileName
        }).then((res) => {
            if (!res.success) {
                banner.error(`${res.error}`)
                if (onError != null) {
                    onError()
                }
            } else {
                const renamedFile = this._project.rename(path, res.result.path)
                this.onFileRenameCallback(path, renamedFile)
                if (onSuccess != null) {
                    onSuccess()
                }
            }
        })
    }

    private onFolderRename(path: string, newFolderName: string, onSuccess: () => void = null, onError: () => void = null) {
        const affectedFiles = this._project.files.filter(file =>
            file.path === path || file.path.startsWith(path + '/')
        )

        if (affectedFiles.length === 0) {
            if (onError) {
                onError()
            }
            return
        }

        const pathMappings: { oldRel: string, newRel: string }[] = []
        for (const file of affectedFiles) {
            const oldPath = file.path

            const relativePath = oldPath.substring(path.length + 1)
            const pathParts = path.split('/')
            pathParts[pathParts.length - 1] = newFolderName
            const newPath = pathParts.join('/') + '/' + relativePath

            pathMappings.push({oldRel: oldPath, newRel: newPath})
        }

        this.projectHandleCache.fileOperation({
            operation: 'folderRename',
            affected_paths: pathMappings,
            old_path: path,
            new_folder_name: newFolderName,
        }).then((res) => {
            if (!res.success) {
                banner.error(`${res.error}`)
                if (onError != null) {
                    onError()
                }
            } else {
                for (const mapping of pathMappings) {
                    const renamedFile = this._project.rename(mapping.oldRel, mapping.newRel)
                    this.onFileRenameCallback(mapping.oldRel, renamedFile)
                }

                if (onSuccess != null) {
                    onSuccess()
                }
            }
        })
    }

    public onFileOrFolderRename(path: string, newFileName: string, onSuccess: () => void = null, onError: () => void = null) {
        const doc = this._project.getFile(path)
        if (doc == null) {
            // console.log(`renaming a directory: ${path}: ${newFileName}`);
            this.onFolderRename(path, newFileName, onSuccess, onError)
        } else {
            // empty directories also comes here
            // console.log(`renaming a file: ${path}: ${newFileName}`);
            this.onFileRename(path, newFileName, onSuccess, onError)
        }
    }

    public onFileOrFolderCreate(path: string, isFile: boolean, content: string = null, onSuccess: () => void = null, onError: () => void = null) {
        this.projectHandleCache.fileOperation({
            operation: 'create',
            file_path: path,
            is_file: isFile,
            content: content,
        }).then((res) => {
            if (!res.success) {
                banner.error(`${res.error}`)
                if (onError != null) {
                    onError()
                }
            } else {
                this._project.create(path, !isFile, res.result.version)
                if (onSuccess != null) {
                    onSuccess()
                }
            }
        })
    }

    public async onFileRead(path: string) {
        const file = this._project.getFile(path)
        if (file == null) {
            return
        }

        const res = await this.projectHandleCache.fileOperation({
            operation: 'read',
            file_path: path,
        })

        if (res.success) {
            this._project.read(path, res.result.content, res.result.version)
        }
    }

    public async onFileSave(file: File, content: string): Promise<void> {
        // this also update the file content with the editor content
        file.version++
        file.content = content
        const res = await this.projectHandleCache.fileOperation({
            operation: 'update',
            file_path: file.path,
            version: file.version,
            content: content,
        })

        if (res.success) {
            file.savedContent = content
            file.dirty = content
            this._project.extensions = res.extensions
            for (const onFileSave of this.onFileSaveCallbacks) {
                onFileSave()
            }
            this.setUncommittedFiles(res.uncommitted_paths)
        }
    }

    public runOnFileSaveCallbacks() {
        for (const onFileSave of this.onFileSaveCallbacks) {
            onFileSave()
        }
    }

    private setUncommittedFiles(uncommitted_paths: string[]) {
        const uncommittedPathSet = new Set(uncommitted_paths)
        for (const file of this._project.files) {
            const isUncommitted = uncommittedPathSet.has(file.path)
            if (file.uncommitted != isUncommitted) {
                file.uncommitted = isUncommitted
            }
        }
    }

    public getFileAndFolderList(): Array<{ path: string, isFile: boolean }> {
        return this.fileExplorer.getFileAndFolderList()
    }
}

export const projectManager = new ProjectManager()