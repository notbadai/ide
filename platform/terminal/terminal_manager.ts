import {BrowserWindow, ipcMain} from 'electron'
import {Terminal} from './terminal'

export interface TerminalInfo {
    id: string
    terminal: Terminal
    created: Date
}

class TerminalManager {
    private terminals: Map<string, TerminalInfo> = new Map()

    private win: BrowserWindow
    private cwd: string

    private nextId: number = 1

    public init(win: BrowserWindow, projectCwd: string) {
        this.win = win
        this.cwd = projectCwd
    }

    public create(): string {
        const id = this.generateId()

        const terminal = new Terminal()

        // initialize the terminal with the window and cwd
        terminal.init({
            win: this.win!,
            cwd: this.cwd,
            terminalId: id
        })

        const terminalInfo: TerminalInfo = {
            id,
            terminal,
            created: new Date()
        }

        this.terminals.set(id, terminalInfo)

        return id
    }

    public send(terminalId: string, data: string) {
        const terminalInfo = this.terminals.get(terminalId)
        terminalInfo.terminal.write(data)
    }

    public resize(terminalId: string, cols: number, rows: number) {
        const terminalInfo = this.terminals.get(terminalId)
        terminalInfo.terminal.resize(cols, rows)
    }

    public destroy(terminalId: string) {
        const terminalInfo = this.terminals.get(terminalId)
        terminalInfo.terminal.dispose()
        this.terminals.delete(terminalId)
    }

    public getTerminal(terminalId: string): Terminal | null {
        const terminalInfo = this.terminals.get(terminalId)
        return terminalInfo?.terminal || null
    }

    public async getTerminalData(terminalName: string): Promise<{ snapshot: string[], before_reset: string[] }> {
        if (this.win == null) {
            return {snapshot: [], before_reset: []}
        }

        return new Promise((resolve) => {
            const requestId = Date.now()

            const responseHandler = (event: any, responseId: number, data: {
                snapshot: string[],
                before_reset: string[]
            }) => {
                if (responseId === requestId) {
                    ipcMain.removeListener('terminal:dataResponse', responseHandler)
                    resolve(data)
                }
            }

            ipcMain.on('terminal:dataResponse', responseHandler)

            this.win.webContents.send('terminal:requestData', {terminalName, requestId})

            setTimeout(() => {
                ipcMain.removeListener('terminal:dataResponse', responseHandler)
                resolve({snapshot: [], before_reset: []})
            }, 5000)
        })
    }

    public dispose(): void {
        for (const [_, terminalInfo] of this.terminals) {
            terminalInfo.terminal.dispose()
        }
        this.terminals.clear()
    }

    private generateId(): string {
        return `terminal_${this.nextId++}`
    }
}

export const terminalManager = new TerminalManager()