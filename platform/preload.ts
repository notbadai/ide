import {contextBridge, ipcRenderer} from 'electron'
import {FileOperationData} from '../ui/src/models/file_operation'
import {Extensions, Project} from "./system/models"

export interface ElectronAPI {
    openDirectory: () => Promise<string | null>

    fsGetProjectName: () => Promise<string>
    fsGetRoot: () => Promise<string>
    fsGetProject: () => Promise<Project>
    fsGetCachedProject: () => Promise<Project>

    fileOperation: (data: FileOperationData) => Promise<any>
    checkContentMatch: (filePath: string, content: string) => Promise<boolean>

    updateWorkspaceConfig: (updates: any) => Promise<void>

    loadExtensionConfigContent: () => Promise<string>
    saveExtensionConfig: (configContent: string) => Promise<Extensions>

    onFileWatcherChanges: (cb: () => void) => void

    getCompletions: (data: Record<string, any>) => Promise<any>

    terminalCreate: () => Promise<string>
    terminalSend: (terminalId: string, data: string) => void
    terminalResize: (terminalId: string, cols: number, rows: number) => void
    terminalDestroy: (terminalId: string) => Promise<void>
    onTerminalOutput: (cb: (data: { terminalId: string, data: string }) => void) => void
    terminalGetData: (terminalName: string) => Promise<{
        snapshot: string[],
        linesBeforeReset: string[]
    }>
    onTerminalDataRequest: (cb: (data: { terminalName: string, requestId: number }) => void) => void
    sendTerminalDataResponse: (requestId: number, data: { snapshot: string[], before_reset: string[] }) => void

    onNetworkError: (cb: (err: { message: string, statusCode?: number }) => void) => void

    onStreamReceive: (data: any) => Promise<void> // UI → Electron
    onStreamSend: (cb: (data: any) => void) => void  // Electron → UI

    cachedProjectGetPath: () => Promise<string | null>
    cachedProjectSetUpFromCache: () => Promise<string>
}

const api: ElectronAPI = {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

    fsGetRoot: () => ipcRenderer.invoke('fs:getRoot'),
    fsGetProjectName: () => ipcRenderer.invoke('fs:getProjectName'),
    fsGetProject: () => ipcRenderer.invoke('fs:getProject'),
    fsGetCachedProject: () => ipcRenderer.invoke('fs:getCachedProject'),

    fileOperation: (data: FileOperationData) => ipcRenderer.invoke('fs:fileOperation', data),
    checkContentMatch: (filePath: string, content: string) => ipcRenderer.invoke('fs:checkContentMatch', filePath, content),

    updateWorkspaceConfig: (updates: any) => ipcRenderer.invoke('fs:updateWorkspaceConfig', updates),

    loadExtensionConfigContent: () => ipcRenderer.invoke('fs:loadExtensionConfigContent'),
    saveExtensionConfig: (configContent: string) => ipcRenderer.invoke('fs:saveExtensionConfig', configContent),

    onFileWatcherChanges: (cb) => ipcRenderer.on('fileWatcher:changes', cb),

    getCompletions: (data) => ipcRenderer.invoke('fs:getCompletions', data),

    terminalCreate: () => ipcRenderer.invoke('terminal:create'),
    terminalSend: (terminalId, data) => ipcRenderer.send('terminal:send', terminalId, data),
    terminalResize: (terminalId, cols, rows) => ipcRenderer.send('terminal:resize', terminalId, cols, rows),
    terminalDestroy: (terminalId) => ipcRenderer.invoke('terminal:destroy', terminalId),
    onTerminalOutput: (cb) => ipcRenderer.on('terminal:data', (_e, data: {
        terminalId: string,
        data: string
    }) => cb(data)),

    onNetworkError: (cb) => ipcRenderer.on('network:error', (_e, err) => cb(err)),

    onStreamReceive: (data) => ipcRenderer.invoke('stream:receive', data),  // UI → Electron
    onStreamSend: (cb) => ipcRenderer.on('stream:send', (_e, data) => cb(data)),  // Electron → UI

    terminalGetData: (terminalName: string, maxLines = 1000) => ipcRenderer.invoke('terminal:getData', terminalName, maxLines),

    onTerminalDataRequest: (cb) => ipcRenderer.on('terminal:requestData', (_e, data) => cb(data)),

    sendTerminalDataResponse: (requestId: number, data: { snapshot: string[], before_reset: string[] }) =>
        ipcRenderer.send('terminal:dataResponse', requestId, data),

    cachedProjectGetPath: () => ipcRenderer.invoke('cachedProject:getPath'),
    cachedProjectSetUpFromCache: () => ipcRenderer.invoke('cachedProject:setUpFromCache')
}

// expose to the renderer as `window.electronAPI`
contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}