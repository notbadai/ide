import {BaseExtension, BaseExtensionOptions} from "./base"
import readline from "readline"
import {EditorState} from "../../../ui/src/models/extension"
import {fileHandler} from "../../system/file_handler"
import path from "path"
import {buildEnv, createVirtualRunner} from "./runner"
import fs from "fs"
import os from "os"
import {spawn} from "child_process"

export abstract class OnDemandExtension extends BaseExtension {
    protected constructor(opt: BaseExtensionOptions) {
        super(opt)
    }

    protected async setUpErrorHandling(): Promise<void> {
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
                await this.channel.sendResponse({is_stopped: true, error: {message: error.join('\n')}})
                this.channel.terminate()
            }
        })

        this.proc.stdin?.on('error', async (error: Error) => {
            console.error(`Extension stdin error:`, error)
            await this.channel.sendResponse({is_stopped: true, error: {message: `Stdin error: ${error.message}`}})
            this.channel.terminate()
        })
    }

    protected async watchAndTerminateOnDemand(): Promise<void> {
        while (!this.channel.isTerminated) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        await this.channel.sendResponse({is_stopped: true})

        if (this.proc && !this.proc.killed) {
            try {
                this.proc.kill('SIGKILL')

                // wait for process to terminate with timeout
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        this.proc?.kill('SIGTERM')
                        reject(new Error('Process termination timeout'))
                    }, 2000)

                    this.proc?.on('exit', () => {
                        clearTimeout(timeout)
                        resolve()
                    })
                })
            } catch (error) {
                console.warn('Process already terminated:', error)
            }
        }
    }

    protected async run(name: string, data: EditorState): Promise<void> {
        this.watchAndTerminateOnDemand().then()

        const extPath = path.join(this.extensionDirPath, `${name}.py`)
        const virtualRunner = createVirtualRunner(this.extensionDirPath, extPath)
        const env = buildEnv(this.extensionDirPath, this.channel.uuid)
        const root = fileHandler.getRoot()

        try {
            // check if extension file exists before trying to create process
            if (!fs.existsSync(extPath)) {
                throw new Error(`Extension file not found: ${extPath}`)
            }

            if (this.pythonPath == null) {
                throw new Error('`python_path` path not set in your extension management or config.yaml file')
            }

            if (this.pythonPath.startsWith('~/')) {
                this.pythonPath = path.join(os.homedir(), this.pythonPath.slice(2))
            }

            this.proc = spawn(this.pythonPath, [virtualRunner], {
                cwd: root,
                env: env,
                stdio: ['pipe', 'pipe', 'pipe']
            })

            console.log(`Launching extension ${name} in ${root}`)

            await this.setUpErrorHandling()

            const payload = JSON.stringify(data) + '\n'
            this.proc.stdin?.write(payload)
            this.proc.stdin?.end()

            console.log(`Receiving output from extension ${name} in ${root}`)

            this.proc.on('error', async (error) => {
                console.error(`Extension ${name} error:`, error)
                await this.channel.sendResponse({is_stopped: true, error: {message: error.message}})
                this.channel.terminate()
            })

            this.proc.on('exit', async (code) => {
                console.log(`Extension ${name} has finished in ${root} with code ${code}`)

                this.channel.terminate()
                await this.channel.sendResponse({is_stopped: true})
                try {
                    fs.unlinkSync(virtualRunner)
                } catch (error) {
                    console.warn('Failed to clean up temp file:', error)
                }
            })

        } catch (error) {
            console.error('Error running extension:', error)
            const message = error instanceof Error ? error.message : String(error)
            await this.channel.sendResponse({is_stopped: true, error: {message: message}})
            this.channel.terminate()
        }
    }
}