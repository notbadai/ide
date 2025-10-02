import fs from "fs"
import {BrowserWindow, dialog, ipcMain} from 'electron'
import {terminalManager} from "./terminal/terminal_manager"
import {fileHandler} from "./system/file_handler"
import {streamService} from "./extensions/streaming/service"
import {settings} from "./system/settings"
import {workspaceConfig} from "./system/workspace_config"
import {FileOperationData} from "../ui/src/models/file_operation"

export interface IPCHandlersOptions {
    mainWindow: BrowserWindow
    onSetUpProject: ((projectPath: string) => Promise<void>)
}

class IPCHandlers {
    private mainWindow: BrowserWindow
    private onSetUpProject: ((projectPath: string) => Promise<void>)

    constructor() {
    }

    public init(opt: IPCHandlersOptions) {
        this.mainWindow = opt.mainWindow
        this.onSetUpProject = opt.onSetUpProject
    }

    private handleIPC<T extends any[], R>(
        channel: string,
        handler: (...args: T) => R | Promise<R>
    ) {
        ipcMain.handle(channel, async (event, ...args: T) => {
            try {
                return await handler(...args)
            } catch (err) {
                console.error(`Error in IPC handler '${channel}':`, err)
                this.reportErrorToRenderer(`ipc:${channel}`, err)
                throw err
            }
        })
    }

    private reportErrorToRenderer(source: string, err: unknown) {
        const payload = {
            source,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        }

        console.error(`[${source}]`, payload.message, payload.stack)
        this.mainWindow?.webContents.send('network:error', payload)
    }

    public setupHandlers() {
        this.setupCachedProjectHandlers()
        this.setupDialogHandlers()
        this.setupSystemHandlers()
        this.setupStreamHandlers()
        this.setupTerminalHandlers()
    }

    private setupCachedProjectHandlers() {
        this.handleIPC('cachedProject:getPath', async () => {
            const cachedPath = await settings.getCachedProjectPath()
            if (cachedPath == null) {
                return null
            }

            if (!fs.existsSync(cachedPath)) {
                settings.deleteCachedProjectPath().then()
                return null
            }

            return cachedPath
        })

        this.handleIPC('cachedProject:setUpFromCache', async () => {
            const cachedPath = await settings.getCachedProjectPath()
            await this.onSetUpProject(cachedPath)
        })
    }

    private setupDialogHandlers() {
        this.handleIPC('dialog:openDirectory', async () => {
            const {canceled, filePaths} = await dialog.showOpenDialog({
                properties: ['openDirectory']
            })

            if (canceled || filePaths.length === 0) {
                return null
            }

            const projectPath = filePaths[0]

            await this.onSetUpProject(projectPath)
            settings.saveCachedProjectPath(projectPath).then()

            return projectPath
        })
    }

    private setupSystemHandlers() {
        this.handleIPC('fs:getRoot', () => fileHandler.getRoot())
        this.handleIPC('fs:getProjectName', () => fileHandler.getProjectName())
        this.handleIPC('fs:getProject', () => fileHandler.getProject())
        this.handleIPC('fs:getCachedProject', () => fileHandler?.getCachedProject())

        this.handleIPC('fs:fileOperation', (data: FileOperationData) => fileHandler.fileOperation(data))
        this.handleIPC('fs:checkContentMatch', (filePath: string, content: string) => fileHandler.checkContentMatch(filePath, content))

        this.handleIPC('fs:updateWorkspaceConfig', async (updates) => {
            try {
                workspaceConfig.update(updates)
            } catch (error) {
                console.error('Failed to update workspace config:', error)
                throw error
            }
        })
    }

    private setupStreamHandlers() {
        this.handleIPC('stream:receive', (data: any) => streamService.onReceive(data))
    }

    private setupTerminalHandlers() {
        // create a new terminal
        this.handleIPC('terminal:create', () => {
            return terminalManager.create()
        })

        // send data to specific terminal
        ipcMain.on('terminal:send', (_e, terminalId: string, data: string) => {
            terminalManager.send(terminalId, data)
        })

        // resize specific terminal
        ipcMain.on('terminal:resize', (_e, terminalId: string, cols: number, rows: number) => {
            terminalManager.resize(terminalId, cols, rows)
        })

        this.handleIPC('terminal:destroy', (terminalId: string) => {
            terminalManager.destroy(terminalId)
        })
    }
}

export const ipcHandlers = new IPCHandlers()