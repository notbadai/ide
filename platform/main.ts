import {
    app,
    BrowserWindow,
    shell,
    protocol,
    globalShortcut,
    dialog,
    powerMonitor,
} from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import {fileHandler} from './system/file_handler'
import {terminalManager} from "./terminal/terminal_manager"
import {fileWatcher} from './system/file_watcher'
import {streamService} from "./extensions/streaming/service"
import {settings} from './system/settings'
import {createApplicationMenu} from "./menu"
import {httpServer} from "./server"
import {ipcHandlers} from "./ipc_handlers"

const isDev = !app.isPackaged
const DEBUG_PROD = true

let mainWindow: BrowserWindow | null = null

const appDist = (() => {
    const candidates = [
        path.join(process.resourcesPath, 'app.asar', 'dist'),
        path.join(__dirname, '..'),                    // dist  (packaged & dev)
        path.join(app.getAppPath(), 'dist'),           // dist  (packaged, fallback)
        path.join(app.getAppPath(), 'ui', 'dist')      // ui/dist (dev, fallback)
    ];
    for (const p of candidates) {
        if (fs.existsSync(path.join(p, 'index.html'))) {
            return p
        }
    }
    throw new Error('Unable to locate built UI assets (index.html not found)')
})()

app.whenReady().then(() => {
    protocol.interceptFileProtocol('file', (request, callback) => {
        const rawPath = request.url.substr(7) // strip 'file://'
        const urlPath = decodeURIComponent(rawPath)
        const parsedURL = new URL(request.url)

        const hasPathParam = parsedURL.searchParams.has('path')
        if (hasPathParam) {
            return callback({path: path.join(appDist, 'index.html')})
        }

        // static assets
        if (urlPath.startsWith('/js/') || urlPath.startsWith('/css/') || urlPath.startsWith('/xterm/')) {
            const assetPath = path.join(appDist, urlPath)
            return callback({path: assetPath})
        }

        // client-side routes (no extension) -> index.html
        if (!path.extname(urlPath)) {
            return callback({path: path.join(appDist, 'index.html')})
        }

        callback({path: path.normalize(urlPath)})
    })

    if (isDev || DEBUG_PROD) {
        globalShortcut.register('CommandOrControl+Shift+I', () => {
            const win = BrowserWindow.getFocusedWindow()
            win?.webContents.toggleDevTools()
        })
    }

    // handle system wake from sleep
    powerMonitor.on('resume', () => {
        console.log('System resumed from sleep')
        handleExtensionRestart()
    })

    ipcHandlers.init({mainWindow: mainWindow, onSetUpProject: setUpProject})
    ipcHandlers.setupHandlers()

    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', async () => {
    await performCleanup()

    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('will-quit', () => {

})

app.on('before-quit', async (event) => {
    event.preventDefault()

    if (isDev || DEBUG_PROD) {
        globalShortcut.unregisterAll()
    }

    await performCleanup()
    app.exit(0)
})

function createWindow(): void {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            devTools: isDev || DEBUG_PROD
        }
    })

    mainWindow = win

    createApplicationMenu({handleProject: handleOpenProject})

    win.on('closed', () => {
        terminalManager?.dispose()
    })

    win.loadFile(path.join(appDist, 'index.html')).then()

    // open external links in the default browser
    win.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url).then()
        return {action: 'deny'}
    })

    // handles normal in-window navigations
    win.webContents.on('will-navigate', (e, url) => {
        if (/^https?:\/\//i.test(url)) {
            e.preventDefault()
            shell.openExternal(url).then()
        }
    })
}


async function handleOpenProject(): Promise<void> {
    const {canceled, filePaths} = await dialog.showOpenDialog({
        properties: ['openDirectory']
    })

    if (canceled || filePaths.length === 0) {
        return
    }

    const projectPath = filePaths[0]
    settings.saveCachedProjectPath(projectPath).then()

    // restart the entire Electron app
    app.relaunch()
    app.quit()
}

async function setUpProject(projectPath: string) {
    fileHandler.init(projectPath)
    fileWatcher.init(mainWindow)
    terminalManager.init(mainWindow, projectPath)
    streamService.init(mainWindow)
    settings.init()
    httpServer.init({port: 7520, host: 'localhost'})
}

function handleExtensionRestart() {
    streamService.onRestart()
}

async function performCleanup() {
    try {
        terminalManager.dispose()
        await httpServer.stop()
        streamService.cleanup()
        await fileWatcher.dispose()
        await fileHandler.onExit()
        console.log('Cleanup completed successfully')
    } catch (error) {
        console.error('Error during cleanup:', error)
    }
}

function reportErrorToRenderer(source: string, err: unknown) {
    const payload = {
        source,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
    }

    console.error(`[${source}]`, payload.message, payload.stack)
    mainWindow?.webContents.send('network:error', payload)
}

process.on('uncaughtException', err => reportErrorToRenderer('uncaughtException', err))
process.on('unhandledRejection', reason => reportErrorToRenderer('unhandledRejection', reason))