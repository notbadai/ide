import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const DIR_NAME = '.notbadaiide'
const CACHED_PROJECT_PATH = 'cachedProjectPath'


class Settings {
    private readonly baseDir: string
    private readonly keysFile: string
    private keysCache: Record<string, any> | null

    constructor() {
        this.baseDir = path.join(os.homedir(), DIR_NAME)
        this.keysFile = path.join(this.baseDir, 'settings.json')

        this.keysCache = null
    }

    public init() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, {recursive: true})
        }
    }

    public getBaseDirectory(): string {
        return this.baseDir
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

    private async getKey(key: string): Promise<any | null> {
        await this.loadKeysCache()
        if (this.keysCache == null) {
            return null
        }

        return this.keysCache[key] || null
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
}

export const settings = new Settings()