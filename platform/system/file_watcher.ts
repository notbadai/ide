import * as chokidar from 'chokidar'
import * as path from 'path'
import {promises as fs} from 'fs'
import {MAX_TEXT_FILE_BYTES} from './file_handler'
import {Document} from './document'
import {BrowserWindow} from 'electron'
import ignore from 'ignore'
import {fileHandler} from "./file_handler"

const DEBOUNCE_MS = 1000
const FLUSH_MS = 2000

type ChangeType = 'addDir' | 'addFile' | 'update' | 'delete'

interface PendingChange {
    type: ChangeType
    relPath: string
    absPath: string
}

class FileWatcher {
    private watcher: chokidar.FSWatcher

    private readonly localEdits: Set<string>
    private pendingChanges: PendingChange[]
    private debounceTimer?: NodeJS.Timeout

    private root: string
    private rootName: string

    private gitignore: any = null

    private mainWindow: BrowserWindow

    private pathCallbacks: Map<string, Set<() => void>> = new Map()

    constructor() {
        this.localEdits = new Set<string>()
        this.pendingChanges = []
    }

    public markLocalEdit(relPath: string): void {
        this.localEdits.add(relPath)
        setTimeout(() => this.localEdits.delete(relPath), DEBOUNCE_MS)
    }

    public init(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow

        this.root = fileHandler.getRoot()
        this.rootName = path.basename(this.root)

        this.initializeGitignore().then()

        this.watcher = chokidar.watch(this.root, {
            ignoreInitial: true,
            depth: 99
        })
            .on('add', this.onAddFile)
            .on('addDir', this.onAddDir)
            .on('change', this.onChange)
            .on('unlink', this.onUnlink)
            .on('unlinkDir', this.onUnlink)
    }

    public async dispose() {
        clearTimeout(this.debounceTimer)
        await this.watcher.close()
    }

    private async initializeGitignore() {
        try {
            const gitignorePath = path.join(this.root, '.gitignore')
            const gitignoreContent = await fs.readFile(gitignorePath, 'utf8')
            this.gitignore = ignore().add(gitignoreContent)
            console.log(`gitignore initialized`)
        } catch {
            console.log(`Failed to read .gitignore. It may not exist`)
            this.gitignore = null
        }
    }

    private clientRel(absPath: string): string {
        const innerRel = path.relative(this.root, absPath)
        return path.join(this.rootName, innerRel)
    }

    private isCommitIndicatorPath(relPath: string): boolean {
        const gitPath = relPath.replace(`${this.rootName}/`, '')
        return gitPath.startsWith('.git/refs/heads/') ||
            gitPath === '.git/logs/HEAD' ||
            gitPath.startsWith('.git/logs/refs/heads/')
    }

    public registerPathCallback(watchPath: string, callback: () => void): void {
        if (!this.pathCallbacks.has(watchPath)) {
            this.pathCallbacks.set(watchPath, new Set())
        }
        this.pathCallbacks.get(watchPath)!.add(callback)
    }

    private notifyPathCallbacks(relPath: string): void {
        for (const [watchPath, callbacks] of this.pathCallbacks.entries()) {
            if (this.isPathUnderWatch(relPath, watchPath)) {
                console.log(`Path change detected for watch: ${watchPath}, changed path: ${relPath}`)
                for (const callback of callbacks) {
                    try {
                        callback()
                    } catch (error) {
                        console.error(`Error in path callback for ${watchPath}:`, error)
                    }
                }
            }
        }
    }

    private isPathUnderWatch(relPath: string, watchPath: string): boolean {
        const normalizedRelPath = relPath.split(path.sep).join('/')
        const normalizedWatchPath = watchPath.split(path.sep).join('/')

        return normalizedRelPath.startsWith(normalizedWatchPath + '/') || normalizedRelPath === normalizedWatchPath
    }

    private async registerChange(absPath: string, type: ChangeType) {
        const relPath = this.clientRel(absPath)

        this.notifyPathCallbacks(relPath)

        if (this.isLocal(relPath)) {
            console.log(`${relPath} is a Local edit, skipping`)
            return
        }

        if (this.isCommitIndicatorPath(relPath)) {
            console.log(`${relPath} is a git commit path, scheduling flush`)
            this.scheduleFlush()
            return
        }

        if (this.isGitIgnored(relPath)) {
            console.log(`${relPath} is in .gitignore, skipping`)
            return
        }

        if (await this.isHiddenPath(absPath)) {
            console.log(`${relPath} is a hidden directory, skipping`)
            return
        }

        console.log(`registerChange ${relPath}`)
        this.pendingChanges.push({type: type, relPath: relPath, absPath: absPath})
        this.scheduleFlush()
    }

    private isGitPath(relPath: string): boolean {
        return relPath.startsWith(`${this.rootName}/.git`) || relPath === `${this.rootName}/.git`
    }

    private async isHiddenPath(absPath: string): Promise<boolean> {
        const relativePath = path.relative(this.root, absPath)
        const pathParts = relativePath.split(path.sep).filter(part => part !== '')

        // if there are multiple parts, check if any parent directory is hidden
        if (pathParts.length > 1) {
            for (let i = 0; i < pathParts.length - 1; i++) {
                if (pathParts[i].startsWith('.')) {
                    return true // File is inside a hidden directory
                }
            }
        }

        // if it's a single part (root level), check if it's a hidden directory
        if (pathParts.length === 1 && pathParts[0].startsWith('.')) {
            try {
                const stat = await fs.stat(absPath)
                return stat.isDirectory() // only hide if it's a directory
            } catch {
                return false
            }
        }

        return false
    }

    private isGitIgnored(relPath: string): boolean {
        if (!this.gitignore) {
            return false
        }

        let pathForMatch = relPath
        if (pathForMatch.startsWith(this.rootName + path.sep) || pathForMatch.startsWith(this.rootName + '/')) {
            pathForMatch = pathForMatch.slice(this.rootName.length + 1)
        }

        pathForMatch = pathForMatch.split(path.sep).join('/')

        return this.gitignore.ignores(pathForMatch)
    }

    private scheduleFlush(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer)
        }
        this.debounceTimer = setTimeout(() => this.flushChanges(), FLUSH_MS)
    }

    private async flushChanges() {
        if (this.pendingChanges.length === 0) {
            console.log(`No Changes to process`)
            this.mainWindow?.webContents.send('fileWatcher:changes')
            return
        }

        console.log(`Processing ${this.pendingChanges.length} pending changes`)

        const currentDocs = fileHandler.getDocs()
        const processedChanges = new Set<string>()

        while (this.pendingChanges.length > 0) {
            const change = this.pendingChanges.shift()

            if (processedChanges.has(change.relPath)) {
                continue
            }
            console.log(`Change type ${change.type} on: ${change.relPath}`)
            processedChanges.add(change.relPath)
            await this.processChange(change, currentDocs)
        }

        // send event to renderer after processing all changes
        this.mainWindow?.webContents.send('fileWatcher:changes')
    }

    private async pathExists(absPath: string): Promise<boolean> {
        try {
            await fs.access(absPath)
            return true
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false
            }
            throw error
        }
    }

    private async processChange(change: PendingChange, currentDocs: Map<string, Document>) {
        switch (change.type) {
            case 'update':
                await this.handleFileUpdate(change, currentDocs)
                break
            case 'addFile':
                await this.handleFileAdd(change, currentDocs)
                break
            case 'addDir':
                await this.handleDirAdd(change, currentDocs)
                break
            case 'delete':
                await this.handleDelete(change, currentDocs)
                break
            default:
                throw new Error(`Unknown change type: ${change.type}`)
        }
    }

    private async handleDelete(change: PendingChange, currentDocs: Map<string, Document>) {
        const doc = currentDocs.get(change.relPath)

        if (doc == null) {
            return
        }

        currentDocs.delete(change.relPath)
        console.log(`Deleted doc: ${change.relPath}`)
    }

    private async handleFileUpdate(change: PendingChange, currentDocs: Map<string, Document>) {
        const doc = currentDocs.get(change.relPath)

        if (doc == null) {
            return
        }
        if (doc.isEmptyDir) {
            return
        }
        if (!await this.pathExists(change.absPath)) {
            return
        }
        doc.version = Math.floor(Math.random() * 1000)

        console.log(`Updated doc content: ${change.relPath} version: ${doc.version}`)
    }

    private async handleFileAdd(change: PendingChange, currentDocs: Map<string, Document>) {
        if (currentDocs.has(change.relPath)) {
            return
        }
        if (!await this.pathExists(change.absPath)) {
            return
        }

        const stat = await fs.stat(change.absPath)
        if (stat.size > MAX_TEXT_FILE_BYTES) {
            return
        }

        const doc = new Document(change.relPath, false)
        currentDocs.set(change.relPath, doc)

        console.log(`Added new file doc: ${change.relPath}`)
    }

    private async handleDirAdd(change: PendingChange, currentDocs: Map<string, Document>) {
        if (currentDocs.has(change.relPath)) {
            return
        }
        if (!await this.pathExists(change.absPath)) {
            return
        }

        const children = await fs.readdir(change.absPath)
        if (children.length > 0) {
            return
        }

        const doc = new Document(change.relPath, true)
        currentDocs.set(change.relPath, doc)

        console.log(`Added new empty dir doc: ${change.relPath}`)
    }

    private isLocal(relPath: string): boolean {
        for (const p of this.localEdits) {
            if (relPath === p) {
                return true
            }

            if (relPath.startsWith(p + path.sep)) {
                return true
            }
        }

        return false
    }

    private onAddFile = async (absPath: string): Promise<void> => await this.registerChange(absPath, 'addFile')
    private onAddDir = async (absPath: string): Promise<void> => await this.registerChange(absPath, 'addDir')
    private onChange = async (absPath: string): Promise<void> => await this.registerChange(absPath, 'update')
    private onUnlink = async (absPath: string): Promise<void> => await this.registerChange(absPath, 'delete')
}

export const fileWatcher = new FileWatcher()