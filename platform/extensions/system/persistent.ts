import {BaseExtension, BaseExtensionOptions} from "./base"
import {EditorState} from "../../../ui/src/models/extension"
import {ChildProcess, spawn} from "child_process"
import path from "path"
import fs from "fs"
import {fileHandler} from "../../system/file_handler"
import {fileWatcher} from "../../system/file_watcher"
import {httpServer} from "../../server"
import {buildEnv, createPersistentRunner} from "./runner"
import os from "os"
import readline from "readline"
import {registerConfigSaveCallback} from "../../system/extension_config"

const MAX_PERSISTENT_REQUESTS = 250

export abstract class PersistentExtension extends BaseExtension {
    protected isPersistentProcessDirty: boolean = false
    protected persistentRequestCount: number = 0

    protected constructor(opt: BaseExtensionOptions) {
        super(opt)

        fileWatcher.registerPathCallback(fileHandler.localRelExtensionsDirPath, () => this.markPersistentProcessDirty())
        registerConfigSaveCallback(() => this.markPersistentProcessDirty())
    }

    protected async run(name: string, data: EditorState): Promise<void> {
        const requestId = data.request_id

        this.persistentRequestCount++
        if (this.persistentRequestCount >= MAX_PERSISTENT_REQUESTS) {
            this.isPersistentProcessDirty = true
            this.persistentRequestCount = 0
        }

        try {
            // get or create persistent process for this extension
            const proc = await this.getOrCreatePersistentProcess(name, requestId)
            proc.stdin?.write('PROCESS_REQUEST\n')

            console.log(`Sent request ${requestId} to persistent extension ${name}`)
        } catch (error) {
            console.error('Error in runPersistentProcess:', error)
            const message = error instanceof Error ? error.message : String(error)
            await this.channel.sendResponse({is_stopped: true, error: {message: message}}, requestId)
        }
    }

    protected async getOrCreatePersistentProcess(name: string, requestId: string): Promise<ChildProcess> {
        // check if process exists, is healthy, and extension hasn't changed
        if (this.proc &&
            !this.proc.killed &&
            this.proc.exitCode === null &&
            !this.isPersistentProcessDirty) {
            return this.proc
        }

        // clean up old process if it exists
        if (this.proc) {
            this.proc.kill()
            this.proc = null
        }

        // create new persistent process and track version
        this.proc = await this.createPersistentProcess(name, requestId)
        this.isPersistentProcessDirty = false
        this.persistentRequestCount = 0

        await this.setUpErrorHandling(requestId)

        return this.proc
    }

    protected async setUpErrorHandling(requestId?: string): Promise<void> {
        let error: string [] = []

        if (!this.proc || !this.proc.stderr) {
            return
        }

        const rl = readline.createInterface({
            input: this.proc.stderr,
            crlfDelay: Infinity
        })

        rl.on('line', (line) => {
            if (line.trim()) {
                error.push(line)
            }
        })

        rl.on('close', async () => {
            if (error.length > 0) {
                console.log('error1', error)
                await this.channel.sendResponse({is_stopped: true, error: {message: error.join('\n')}}, requestId)
            }
        })

        this.proc.stdin?.on('error', async (error: Error) => {
            console.error(`Extension stdin error:`, error)
            await this.channel.sendResponse({
                is_stopped: true,
                error: {message: `Stdin error: ${error.message}`}
            }, requestId)
        })
    }

    protected async createPersistentProcess(name: string, requestId: string): Promise<ChildProcess> {
        const root = fileHandler.getRoot()

        const persistentRunner = createPersistentRunner(this.extensionDirPath, name)
        const {host, port} = httpServer.getServerConfig()
        const env = buildEnv(this.extensionDirPath, this.channel.uuid, host, port)

        if (this.pythonPath == null) {
            throw new Error('`python_path` path not set in your extension management or config.yaml file')
        }

        if (this.pythonPath.startsWith('~/')) {
            this.pythonPath = path.join(os.homedir(), this.pythonPath.slice(2))
        }

        const proc = spawn(this.pythonPath, [persistentRunner], {
            cwd: root,
            env: env,
            stdio: ['pipe', 'pipe', 'pipe']
        })

        console.log(`Started persistent process for extension ${name}`)

        // clean up temp file when process exits
        proc.on('exit', (code) => {
            console.log(`Extension ${name} persistent process exited with code ${code}`)
            try {
                fs.unlinkSync(persistentRunner)
            } catch (error) {
                console.warn('Failed to clean up temp file:', error)
            }
            this.proc = null
        })

        proc.on('error', async (error) => {
            console.error(`Extension ${name} persistent process error:`, error)
            await this.channel.sendResponse({is_stopped: true, error: {message: error.message}}, requestId)
            this.proc = null
        })

        return proc
    }

    public cleanup(): void {
        if (this.proc && !this.proc.killed) {
            console.log('Killing persistent process')
            this.proc.kill('SIGTERM')
            this.proc = null
        }
    }

    public markPersistentProcessDirty = () => {
        console.log('Extension directory changed, marking as dirty')
        this.isPersistentProcessDirty = true
    }
}