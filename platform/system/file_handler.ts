import {promises as fs} from 'fs'
import * as path from 'path'

import {Document, Data, Summary} from './document'
import {FileOperationData} from '../../ui/src/models/file_operation'
import {GitClient} from '../git/git_client'
import {filterGitIgnorePaths} from '../helpers/helpers'
import {fileWatcher} from './file_watcher'
import {loadExtensionConfig, ExtensionConfig} from './extension_config'
import {workspaceConfig} from './workspace_config'
import {httpServer} from "../server"
import {Project, Extensions} from "./models"

export const MAX_TEXT_FILE_BYTES = 1024 * 256


class FileHandler {
    private root: string
    private rootName: string

    private readonly docs: Map<string, Document>
    private isLocalConfig: boolean

    constructor() {
        this.docs = new Map()
        this.isLocalConfig = false
    }

    public init(rootDir: string) {
        this.root = path.resolve(rootDir)
        this.rootName = path.basename(this.root)
    }

    private _clientRel(absPath: string): string {
        const innerRel = path.relative(this.root, absPath)
        return path.join(this.rootName, innerRel)
    }

    private _resolve(p: string): string {
        if (p === this.rootName) {
            p = '.'
        } else if (p.startsWith(this.rootName + path.sep)) {
            p = p.slice(this.rootName.length + 1)
        }

        const abs = path.resolve(this.root, p)
        if (!abs.startsWith(this.root)) {
            throw new Error(`Path escapes workspace: ${p}`)
        }

        return abs
    }

    private async _walk(dir: string, acc: string[] = [], ignoreHidden = true): Promise<string[]> {
        const entries = await fs.readdir(dir, {withFileTypes: true})

        for (const e of entries) {
            if (e.isSymbolicLink()) {
                continue
            }

            const absPath = path.join(dir, e.name)
            const rel = this._clientRel(absPath)

            if (ignoreHidden && e.isDirectory() && e.name.startsWith('.')) {
                continue
            }
            if (rel.includes('__pycache__')) {
                continue
            }
            if (e.name === '.workspace.yaml') {
                continue
            }

            if (e.isDirectory()) {
                const children = await fs.readdir(absPath)
                if (children.length === 0) {
                    acc.push(rel)
                }
                await this._walk(absPath, acc, ignoreHidden)
            } else {
                acc.push(rel)
            }
        }

        return acc
    }

    public getRoot(): string {
        return this.root
    }

    public getProjectName(): string {
        return this.rootName
    }

    public async getExtensions(): Promise<Extensions> {
        try {
            const config = await this.getExtensionConfig()
            const {host, port} = config.getServerConfig()
            httpServer.restart(host, port).then()
            return {
                chat: config.getChatExtensions(),
                autocomplete: config.getAutocompleteExtension(),
                diff: config.getDiffSettings(),
                tools: config.getTools(),
                isLocal: this.isLocalConfig,
                apiProviders: config.getApiProviders()
            }
        } catch (error) {
            return {
                chat: [],
                autocomplete: null,
                diff: null,
                error: error.message,
                isLocal: this.isLocalConfig,
                apiProviders: []
            }
        }
    }

    public getDocs(): Map<string, Document> {
        return this.docs
    }

    public getRelPath(absPath: string): string {
        return this._clientRel(absPath)
    }

    public async getFilePaths(): Promise<Summary[]> {
        let relPaths = await this._walk(this.root, [])
        console.log('relPaths', relPaths.length)
        relPaths = await filterGitIgnorePaths(this.root, relPaths)
        console.log('relPaths', relPaths.length)

        const res: Summary[] = []
        for (const rel of relPaths) {
            let doc = this.docs.get(rel)

            if (doc == null) {
                const abs = this._resolve(rel)
                let isEmptyDir = false

                try {
                    const stat = await fs.stat(abs)
                    if (stat.isDirectory()) {
                        const children = await fs.readdir(abs)
                        isEmptyDir = children.length === 0
                    } else if (stat.size > MAX_TEXT_FILE_BYTES) {
                        continue
                    }
                } catch {
                    continue
                }

                doc = new Document(rel, isEmptyDir)
                this.docs.set(rel, doc)
            }

            res.push(doc.toSummary())
        }

        return res
    }

    private async read(relPath: string): Promise<Data> {
        console.log(`read ${relPath}`)

        let doc = this.docs.get(relPath)

        let content = null
        const absPath = this._resolve(relPath)
        try {
            const content = await fs.readFile(absPath, 'utf8')

            if (doc == null) {
                doc = new Document(relPath, false)
                this.docs.set(relPath, doc)
            }

            return doc.toData(content)
        } catch (e) {
            return new Document(relPath, false).toData(content)
        }
    }

    private async delete(relPath: string): Promise<{}> {
        console.log(`delete ${relPath}`)

        for (const key of Array.from(this.docs.keys())) {
            if (key === relPath || key.startsWith(relPath + path.sep) || key.startsWith(relPath + '/')) {
                fileWatcher.markLocalEdit(key)
                this.docs.delete(key)
            }
        }

        const abs = this._resolve(relPath)

        try {
            const stat = await fs.stat(abs)

            if (stat.isDirectory()) {
                await fs.rm(abs, {recursive: true, force: true})
            } else {
                await fs.unlink(abs)
            }
        } catch (err) {
            console.log(err)
            throw new Error(String(err))
        }

        return {}
    }

    private async rename(oldRel: string, newName: string): Promise<{ path: string }> {
        const oldAbs = this._resolve(oldRel)
        const newAbs = path.join(path.dirname(oldAbs), newName)
        const newRel = this._clientRel(newAbs)

        fileWatcher.markLocalEdit(oldRel)
        fileWatcher.markLocalEdit(newRel)

        try {
            await fs.rename(oldAbs, newAbs)
        } catch (err) {
            throw new Error(String(err))
        }

        const doc = this.docs.get(oldRel)
        doc.path = newRel
        this.docs.set(newRel, doc)
        this.docs.delete(oldRel)

        console.log(`rename ${oldRel} ${newRel}`)

        return {path: newRel}
    }

    private async folderRename(oldRel: string, newName: string, affectedPaths: { oldRel: string, newRel: string }[]) {
        const oldAbs = this._resolve(oldRel)
        const newAbs = path.join(path.dirname(oldAbs), newName)
        const newRel = this._clientRel(newAbs)

        fileWatcher.markLocalEdit(oldRel)
        fileWatcher.markLocalEdit(newRel)

        try {
            await fs.rename(oldAbs, newAbs)
        } catch (err) {
            throw new Error(String(err))
        }

        let toSend = []
        for (const affectedPath of affectedPaths) {
            const doc = this.docs.get(affectedPath.oldRel)
            doc.path = affectedPath.newRel
            this.docs.set(affectedPath.newRel, doc)
            this.docs.delete(affectedPath.oldRel)

            toSend.push({old_path: affectedPath.oldRel})

            console.log(`rename ${oldRel} ${newRel}`)
        }

        return {}
    }

    public async update(relPath: string, content: string, version: number): Promise<{
        path: string
    }> {
        fileWatcher.markLocalEdit(relPath)

        const doc = this.docs.get(relPath)

        console.log(`update ${relPath}:${doc.version}/${version}`)

        doc.version = version

        const abs = this._resolve(relPath)

        try {
            await fs.writeFile(abs, content, 'utf8')
            fileWatcher.markLocalEdit(relPath)
        } catch (err) {
            throw new Error(String(err))
        }

        return {'path': doc.path}
    }

    private async create(relPath: string, isFile = false, content: string = null): Promise<Data> {
        fileWatcher.markLocalEdit(relPath)

        const abs = this._resolve(relPath)

        console.log(`create ${relPath} ${abs} ${isFile}`)

        try {
            if (isFile) {
                const parentDir = path.dirname(abs)
                await fs.mkdir(parentDir, {recursive: true})

                content = content || ''
                await fs.writeFile(abs, content, 'utf8')
                const doc = new Document(relPath, false)
                this.docs.set(relPath, doc)

                return doc.toData(content)
            } else {
                await fs.mkdir(abs, {recursive: true})
                const doc = new Document(relPath, true)
                this.docs.set(relPath, doc)

                return doc.toData(content)
            }
        } catch (err) {
            throw new Error(String(err))
        }
    }

    public async getProject(): Promise<Project> {
        const files = await this.getFilePaths()
        await workspaceConfig.init()

        const cl = new GitClient(this.root)
        const uncommittedPaths = new Set(await cl.getUncommittedPaths())
        for (const file of files) {
            file.is_uncommitted = uncommittedPaths.has(file.path)
        }
        const branch = await cl.getCurrentBranch()
        const extensions = await this.getExtensions()
        const workspace = workspaceConfig.getConfig()

        return {
            project_name: this.rootName,
            git_branch: branch,
            files: files,
            extensions: extensions,
            workspace: workspace
        }
    }

    public async getCachedProject(): Promise<Project> {
        const files: Summary[] = []
        for (const doc of this.docs.values()) {
            const docSummary = doc.toSummary()
            files.push(docSummary)
        }

        const cl = new GitClient(this.root)
        const uncommittedPaths = new Set(await cl.getUncommittedPaths())
        for (const file of files) {
            file.is_uncommitted = uncommittedPaths.has(file.path)
        }
        const branch = await cl.getCurrentBranch()
        const extensions = await this.getExtensions()

        return {project_name: this.rootName, git_branch: branch, files: files, extensions: extensions}
    }

    public async fileOperation(data: FileOperationData): Promise<any> {
        const operation = data.operation

        let res = {}
        let unCommitedPaths = []
        switch (operation) {
            case 'create':
                res = await this.create(data.file_path, data.is_file, data.content)
                break
            case 'read':
                res = await this.read(data.file_path)
                break
            case 'delete':
                res = await this.delete(data.file_path)
                break
            case 'rename':
                res = await this.rename(data.file_path, data.new_file_name)
                break
            case 'folderRename':
                res = await this.folderRename(data.old_path, data.new_folder_name, data.affected_paths)
                break
            case 'update':
                res = await this.update(
                    data.file_path,
                    data.content,
                    data.version,
                )
                const cl = new GitClient(this.root)
                unCommitedPaths = await cl.getUncommittedPaths()
                break
            default:
                throw new Error(`Unknown operation: ${operation}`)
        }

        const extensions = await this.getExtensions()

        return {success: true, result: res, uncommitted_paths: unCommitedPaths, extensions: extensions}
    }

    public async checkContentMatch(relPath: string, content: string): Promise<boolean> {
        console.log(`checkContentMatch ${relPath}`)

        try {
            const absPath = this._resolve(relPath)
            const currentContent = await fs.readFile(absPath, 'utf8')
            return currentContent === content
        } catch (error) {
            // if file doesn't exist or can't be read, content doesn't match
            console.log(`Failed to read file ${relPath}: ${error.message}`)
            return false
        }
    }

    public async onExit(): Promise<void> {
        await workspaceConfig?.save()
    }

    public get localRelExtensionsDirPath(): string {
        return this.getRelPath(path.join(this.root, 'extensions'))
    }

    public get localExtensionsDirPath(): string {
        return path.join(this.root, 'extensions')
    }

    public async getExtensionConfig(): Promise<ExtensionConfig> {
        const configPath = path.join(this.localExtensionsDirPath, 'config.yaml')

        try {
            await fs.access(configPath)
            this.isLocalConfig = true
            return await loadExtensionConfig(configPath)
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.isLocalConfig = false
                // if local extensions not exist load global
                return await loadExtensionConfig(null)
            }
            throw error
        }
    }
}

export const fileHandler = new FileHandler()