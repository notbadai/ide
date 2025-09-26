import {BrowserWindow} from 'electron'
import * as fs from 'fs'
import * as pty from 'node-pty'
import type {IPty} from 'node-pty'

const CLEAR_SEQ = '\x1b[2J'

export interface TerminalOptions {
    win: BrowserWindow
    cwd: string
    terminalId: string
}

export class Terminal {
    private shell: IPty
    private win: BrowserWindow
    private history: string
    private terminalId: string

    constructor() {
    }

    public init(opt: TerminalOptions) {
        this.win = opt.win
        this.terminalId = opt.terminalId
        this.history = ''

        const shellCmd = (() => {
            if (process.platform === 'win32') {
                return process.env.COMSPEC || 'cmd.exe'
            }

            const envShell = process.env.SHELL
            if (envShell && envShell.startsWith('/')) {
                return envShell
            }

            const fallbacks = ['/bin/bash', '/bin/zsh', '/bin/sh']
            for (const p of fallbacks) {
                if (fs.existsSync(p)) {
                    return p
                }
            }
            return '/bin/sh'
        })()

        const env = {...process.env}
        if (!env.PATH || env.PATH.trim() === '') {
            env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
        }

        this.shell = pty.spawn(shellCmd, [], {
            name: 'xterm-color',
            cwd: opt.cwd,
            env,
            cols: 80,
            rows: 24
        })

        this.shell.onData(data => {
            if (data.includes(CLEAR_SEQ)) {
                this.handleClear().then()
            } else {
                this.history += data
            }

            this.emit(data)
        })

        this.shell.onExit(({exitCode}) => {
            this.history = ''
            this.emit(`\n[process exited with code ${exitCode}]\n`)
        })
    }

    public write(data: string) {
        this.shell.write(data)
    }

    public resize(cols: number, rows: number) {
        this.shell.resize(cols, rows)
    }

    public dispose() {
        this.history = ''
        this.shell.kill()
    }

    private emit(data: string) {
        if (!this.win.isDestroyed() && !this.win.webContents.isDestroyed()) {
            this.win.webContents.send('terminal:data', {terminalId: this.terminalId, data})
        }
    }

    private async handleClear() {
        this.history = ''
    }
}