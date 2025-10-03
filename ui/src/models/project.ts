import {File, FileModel} from "./file"

export interface DiffSettings {
    min_collapse_lines: number
    min_auto_collapse_lines: number
    context_lines: number
    ignore_whitespace: boolean
}

export interface Tool {
    name: string
    extension: string
    description?: string
    shortcut?: string
}

export interface Extensions {
    chat: string[]
    autocomplete: string | null
    diff: DiffSettings
    tools?: Tool[]
    error?: string
    isLocal: boolean
}

export interface TabState {
    path: string
    isActive: boolean
}

export interface PaneLayoutState {
    leftPanePercent: number
    bottomPanePercent: number
    leftPaneHidden: boolean
    bottomPaneCollapsed: boolean
}

export interface ActivityState {
    topActivity: string
    bottomActivity: string
}

export interface Workspace {
    openTabs?: TabState[]
    paneLayoutState?: PaneLayoutState
    activityState?: ActivityState
}


export interface ProjectModel {
    project_name: string
    git_branch: string
    files: FileModel[]
    extensions: Extensions
    workspace?: Workspace
}

export interface ProjectChanges {
    deletedPaths: string[]
    updatedPaths: string[]
    addedPaths: string[]
}

export class Project {
    projectName: string
    gitBranch: string
    fileRecords: Record<string, File>
    extensions: Extensions
    workspace?: Workspace

    constructor(project: ProjectModel) {
        this.projectName = project.project_name
        this.gitBranch = project.git_branch
        this.extensions = project.extensions
        this.workspace = project.workspace

        this.fileRecords = {}
        for (let file of project.files) {
            this.fileRecords[file.path] = new File(file)
        }
    }

    public get files(): File[] {
        let files: File[] = []
        for (const filePath in this.fileRecords) {
            files.push(this.fileRecords[filePath])
        }

        files.sort((a, b) => (a.path < b.path ? -1 : 1));

        return files
    }

    public create(path: string, isEmptyDir: boolean, version: number) {
        this.fileRecords[path] = new File({path: path, is_empty_dir: isEmptyDir, version: version})
        this.fileRecords[path].uncommitted = true
        this.fileRecords[path].setForceDirty(true)
    }

    public delete(path: string) {
        delete this.fileRecords[path]
    }

    public rename(oldPath: string, newPath: string) {
        let file = this.fileRecords[oldPath]
        delete this.fileRecords[oldPath]
        file.path = newPath
        this.fileRecords[newPath] = file

        return file
    }

    public read(path: string, content: string, version: number) {
        let file = this.fileRecords[path]
        file.content = content
        file.savedContent = content
        file.version = version
        file.setState(null)
    }

    public getFile(path: string): File {
        return this.fileRecords[path]
    }

    public isValidPath(path: string): boolean {
        return this.fileRecords[path] != null
    }

    public getProjectName(): string {
        return this.projectName
    }

    public async update(projectModel: ProjectModel): Promise<ProjectChanges> {
        this.gitBranch = projectModel.git_branch
        this.extensions = projectModel.extensions

        const deletedPaths: string[] = []
        const updatedPaths: string[] = []
        const addedPaths: string[] = []

        const newFilePaths = new Set(projectModel.files.map(f => f.path))

        for (const existingPath in this.fileRecords) {
            if (!newFilePaths.has(existingPath)) {
                const deletedFile = this.fileRecords[existingPath]
                deletedFile.close()
                delete this.fileRecords[existingPath]
                deletedPaths.push(existingPath)
            }
        }

        for (let fileModel of projectModel.files) {
            const existingFile = this.fileRecords[fileModel.path]

            if (existingFile) {
                existingFile.is_empty_dir = fileModel.is_empty_dir

                if (fileModel.is_uncommitted != null) {
                    existingFile.uncommitted = fileModel.is_uncommitted
                }
                if (existingFile.version === fileModel.version) {
                    continue
                }

                if (!existingFile.isEmpty()) {
                    const contentMatches = await window.electronAPI.checkContentMatch(existingFile.path, existingFile.content)
                    if (contentMatches) {
                        continue
                    }
                }

                console.log('changed', existingFile.path, existingFile.version, fileModel.version)

                existingFile.close()
                updatedPaths.push(fileModel.path)
            } else {
                this.fileRecords[fileModel.path] = new File(fileModel)
                addedPaths.push(fileModel.path)
            }
        }

        return {deletedPaths, updatedPaths, addedPaths}
    }
}