import {spawn} from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {BrowserWindow} from "electron"
import {ApiKey} from "../../ui/src/models/extension"

const REPO_URL = 'https://github.com/hnipun/extensions.git'
const DIR_NAME = '.notbadaiide'
const API_KEY_NAME = 'api_keys'
const PYTHON_PATH_NAME = 'python_path'
const CACHED_PROJECT_PATH = 'cachedProjectPath'

export interface ExtensionRepositoryStatus {
    isInitialized: boolean
    remoteUrl?: string
    lastUpdate?: Date
    currentBranch?: string
}

export interface RepositoryProgress {
    percentage: number
    message: string
}

class GlobalSettings {
    private readonly baseDir: string
    private readonly extensionsDir: string
    private readonly keysFile: string
    private keysCache: Record<string, any> | null

    private mainWindow: BrowserWindow
    private onRestart: () => void
    private lastUpdatedTimeStamp: Date | null = null
    private updateCheckInterval: NodeJS.Timeout | null = null
    private pythonPathCallbacks: Set<() => void> = new Set()

    constructor() {
        this.baseDir = path.join(os.homedir(), DIR_NAME)
        this.extensionsDir = path.join(this.baseDir, 'extensions')
        this.keysFile = path.join(this.baseDir, 'api-keys.json')

        this.keysCache = null
    }

    public init(mainWindow: BrowserWindow, onRestart: () => void) {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, {recursive: true})
        }

        this.mainWindow = mainWindow
        this.onRestart = onRestart

        this.startDailyUpdateCheck()
    }

    private startDailyUpdateCheck(): void {
        this.updateCheckInterval = setInterval(() => {
            this.performDailyUpdateCheck().then()
        }, 24 * 60 * 60 * 1000)
    }

    private async performDailyUpdateCheck(): Promise<void> {
        const hasUpdates = await this.checkForUpdates()
        if (!hasUpdates) {
            console.log('updates not available for extensions')
            return
        }
        this.updateExtensions().then()
        console.log('updates available for extensions')
    }

    public stopDailyUpdateCheck(): void {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval)
            this.updateCheckInterval = null
        }
    }

    public getExtensionsDirectory(): string {
        return this.extensionsDir
    }

    public getBaseDirectory(): string {
        return this.baseDir
    }

    public async getStatus(): Promise<ExtensionRepositoryStatus> {
        const status: ExtensionRepositoryStatus = {
            isInitialized: this.isGitRepository()
        }

        if (status.isInitialized) {
            try {
                status.remoteUrl = await this.getRemoteUrl()
                status.currentBranch = await this.getCurrentBranch()
                status.lastUpdate = await this.getLastUpdateTime()
            } catch (error) {
                console.warn('Failed to get repository status:', error)
            }
        }

        return status
    }

    private async onRestartExtensions() {
        const lastUpdatedTimeStamp = await this.getLastUpdateTime()
        if (lastUpdatedTimeStamp != this.lastUpdatedTimeStamp) {
            console.log('restarting the extensions')
            this.onRestart()
            this.mainWindow?.webContents.send('fileWatcher:changes')
            this.lastUpdatedTimeStamp = lastUpdatedTimeStamp
        }
    }

    public async downloadExtensions(onProgress?: (progress: RepositoryProgress) => void): Promise<void> {
        if (this.isGitRepository()) {
            return
        }
        // ensure parent directory exists
        const parentDir = path.dirname(this.extensionsDir)
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, {recursive: true})
        }

        // remove existing directory if it exists
        if (fs.existsSync(this.extensionsDir)) {
            await this.removeDirectory(this.extensionsDir)
        }

        return new Promise((resolve, reject) => {
            const gitProcess = spawn('git', ['clone', '--progress', REPO_URL, this.extensionsDir])

            onProgress?.({percentage: 0, message: 'Starting download...'})

            gitProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString()
                const progress = this.parseGitProgress(output)
                if (progress && onProgress) {
                    onProgress(progress)
                }
            })

            gitProcess.on('close', (code) => {
                if (code === 0) {
                    onProgress?.({percentage: 100, message: 'Download completed!'})
                    this.onRestartExtensions().then()
                    resolve()
                } else {
                    reject(new Error(`Git clone failed with code ${code}`))
                }
            })

            gitProcess.on('error', (error) => {
                reject(new Error(`Failed to execute git: ${error.message}`))
            })
        })
    }

    public async updateExtensions(onProgress?: (progress: RepositoryProgress) => void): Promise<void> {
        if (!this.isGitRepository()) {
            throw new Error('Extensions directory is not a Git repository. Please download first.')
        }

        return new Promise((resolve, reject) => {
            const gitProcess = spawn('git', ['pull', '--progress', 'origin', 'main'], {
                cwd: this.extensionsDir
            })

            onProgress?.({percentage: 0, message: 'Checking for updates...'})

            let hasUpdates = false

            gitProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString()
                if (output.includes('Already up to date')) {
                    onProgress?.({percentage: 100, message: 'Already up to date'})
                } else {
                    hasUpdates = true
                    onProgress?.({percentage: 50, message: 'Downloading updates...'})
                }
            })

            gitProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString()
                const progress = this.parseGitProgress(output)
                if (progress && onProgress) {
                    onProgress(progress)
                }
            })

            gitProcess.on('close', (code) => {
                if (code === 0) {
                    const message = hasUpdates ? 'Extensions updated successfully!' : 'Already up to date'
                    onProgress?.({percentage: 100, message})
                    this.onRestartExtensions().then()
                    resolve()
                } else {
                    reject(new Error(`Git pull failed with code ${code}`))
                }
            })

            gitProcess.on('error', (error) => {
                reject(new Error(`Failed to execute git: ${error.message}`))
            })
        })
    }

    public async checkForUpdates(): Promise<boolean> {
        if (!this.isGitRepository()) {
            return false
        }

        try {
            // fetch without merging
            await this.executeGitCommand(['fetch', 'origin'])

            // check if local branch is behind remote
            const output = await this.executeGitCommand(['status', '-uno'])
            return output.includes('Your branch is behind')
        } catch (error) {
            console.warn('Failed to check for updates:', error)
            return false
        }
    }

    private isGitRepository(): boolean {
        return fs.existsSync(path.join(this.extensionsDir, '.git'))
    }

    private async getRemoteUrl(): Promise<string> {
        return await this.executeGitCommand(['config', '--get', 'remote.origin.url'])
    }

    private async getCurrentBranch(): Promise<string> {
        return await this.executeGitCommand(['branch', '--show-current'])
    }

    private async getLastUpdateTime(): Promise<Date> {
        const timestamp = await this.executeGitCommand(['log', '-1', '--format=%ct'])
        return new Date(parseInt(timestamp.trim()) * 1000)
    }

    private executeGitCommand(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const git = spawn('git', args, {cwd: this.extensionsDir})

            let output = ''
            let error = ''

            git.stdout.on('data', (data: Buffer) => {
                output += data.toString()
            })

            git.stderr.on('data', (data: Buffer) => {
                error += data.toString()
            })

            git.on('close', (code: number) => {
                if (code === 0) {
                    resolve(output.trim())
                } else {
                    reject(new Error(error.trim() || `Git command failed with code ${code}`))
                }
            })
        })
    }

    private parseGitProgress(output: string): RepositoryProgress | null {
        // parse git progress output like "Receiving objects: 75% (3/4)"
        const progressMatch = output.match(/(\w+\s+\w+):\s*(\d+)%/)
        if (progressMatch) {
            return {
                percentage: parseInt(progressMatch[2]),
                message: `${progressMatch[1]}: ${progressMatch[2]}%`
            }
        }

        // parse counting objects output
        if (output.includes('Counting objects')) {
            return {percentage: 10, message: 'Counting objects...'}
        }

        if (output.includes('Compressing objects')) {
            return {percentage: 30, message: 'Compressing objects...'}
        }

        return null
    }

    private async removeDirectory(dirPath: string): Promise<void> {
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath)

            for (const file of files) {
                const curPath = path.join(dirPath, file)
                if (fs.lstatSync(curPath).isDirectory()) {
                    await this.removeDirectory(curPath)
                } else {
                    fs.unlinkSync(curPath)
                }
            }

            fs.rmdirSync(dirPath)
        }
    }

    private async loadKeysCache(): Promise<void> {
        if (this.keysCache != null) {
            return
        }

        try {
            if (fs.existsSync(this.keysFile)) {
                const data = fs.readFileSync(this.keysFile, 'utf8')
                this.keysCache = JSON.parse(data)
            } else {
                this.keysCache = null
            }
        } catch (error) {
            this.keysCache = null
            throw new Error(`Failed to read keys: ${error.message}`)
        }
    }

    private async saveKey(key: string, value: any): Promise<void> {
        await this.loadKeysCache()

        try {
            // ensure the .ai-editor directory exists
            const aiEditorDir = path.join(os.homedir(), '.ai-editor')
            if (!fs.existsSync(aiEditorDir)) {
                fs.mkdirSync(aiEditorDir, {recursive: true})
            }

            // initialize cache if null
            if (this.keysCache === null) {
                this.keysCache = {}
            }

            // add/update the key and provider
            this.keysCache[key] = value

            // write back to file with restricted permissions
            fs.writeFileSync(this.keysFile, JSON.stringify(this.keysCache, null, 2), {mode: 0o600})

        } catch (error) {
            throw new Error(`Failed to save ${key}: ${error.message}`)
        }
    }

    private async getKey(key: string): Promise<any | null> {
        await this.loadKeysCache()
        if (this.keysCache == null) {
            return null
        }

        return this.keysCache[key] || null
    }

    private async deleteKey(key: string): Promise<boolean> {
        await this.loadKeysCache()

        try {
            delete this.keysCache[key]

            // write back to file
            fs.writeFileSync(this.keysFile, JSON.stringify(this.keysCache, null, 2), {mode: 0o600})

            return true
        } catch (error) {
            throw new Error(`Failed to delete ${key}: ${error.message}`)
        }
    }

    public async getApiKeys(): Promise<ApiKey[] | null> {
        return this.getKey(API_KEY_NAME)
    }

    public async saveApiKeys(keys: ApiKey[]): Promise<void> {
        return this.saveKey(API_KEY_NAME, keys)
    }

    public async deletePythonPath(): Promise<boolean> {
        const result = await this.deleteKey(PYTHON_PATH_NAME)
        if (result) {
            this.notifyPythonPathCallbacks()
        }
        return result
    }

    public async getPythonPath(): Promise<string | null> {
        return this.getKey(PYTHON_PATH_NAME)
    }

    public async savePythonPath(pythonPath: string): Promise<void> {
        await this.saveKey(PYTHON_PATH_NAME, pythonPath)
        this.notifyPythonPathCallbacks()
    }

    public async getCachedProjectPath(): Promise<string | null> {
        return this.getKey(CACHED_PROJECT_PATH)
    }

    public async saveCachedProjectPath(cachedProjectPath: string): Promise<void> {
        return this.saveKey(CACHED_PROJECT_PATH, cachedProjectPath)
    }

    public async deleteCachedProjectPath(): Promise<boolean> {
        return this.deleteKey(CACHED_PROJECT_PATH)
    }

    public registerPythonPathCallback(callback: () => void): void {
        this.pythonPathCallbacks.add(callback)
    }

    private notifyPythonPathCallbacks(): void {
        for (const callback of this.pythonPathCallbacks) {
            callback()
        }
    }
}

export const globalSettings = new GlobalSettings()