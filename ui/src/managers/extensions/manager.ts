import {ExtensionData, ExtensionResponse, ExtensionType} from '../../models/extension'
import {generateUUID} from "../../utils/uuid"
import {extensionPane} from "./extension_pane"
import {banner} from "../../components/banner"
import {projectManager} from "../project/manager"
import {tabsManager} from "../tabs/manager"
import {terminalManager} from "../terminal/manager"
import {activityBarManager, EXTENSIONS} from "../activity_bar/manager"

export interface Extension {
    uuid?: string
    type: ExtensionType
    name: string
    description?: string
    onReceive: (data: any) => void
    onTerminate?: () => void
}

class ExtensionManager {
    private extensions: Map<string, Extension>
    private active: Set<string>

    constructor() {
        this.extensions = new Map<string, Extension>()
        this.active = new Set()

        window.electronAPI.onStreamSend(this.onReceive.bind(this))
    }

    // all the new extensions will be registered here
    public register(extension: Extension): string {
        extension.uuid = generateUUID()
        this.extensions.set(extension.uuid, extension)

        return extension.uuid
    }

    public unregister(uuid: string): void {
        this.extensions.delete(uuid)
    }

    private async sendData(data: ExtensionData): Promise<void> {
        await window.electronAPI.onStreamReceive(data)
    }

    public async run(uuid: string, data: Partial<ExtensionData>, show_in_panel: boolean = true) {
        const extension = this.extensions.get(uuid)
        if (extension == null) {
            return
        }

        this.active.add(uuid)

        if (show_in_panel) {
            extensionPane.addRunningExtension({
                id: extension.uuid,
                name: extension.name,
                description: extension.description,
                startTime: new Date(),
                onTerminate: () => {
                    this.terminate(uuid)
                }
            })
        }

        const codeEditor = projectManager.codeEditor
        const activateTerminal = terminalManager.activateTerminal?.terminal
        const completeData: ExtensionData = {
            uuid: uuid,
            type: extension.type,
            requestId: data.requestId,

            cursor: data.cursor ?? codeEditor?.getCursorPosition() ?? {line: 0, column: 0},
            selection: data.selection ?? codeEditor?.getSelectedText() ?? '',
            clip_board: data.clip_board ?? codeEditor ? await codeEditor.getClipboardText() : '',
            current_file_path: data.current_file_path ?? codeEditor?.file?.path ?? null,
            current_file_content: data.current_file_content ?? codeEditor?.content ?? '',
            terminal_snapshot: activateTerminal?.getSnapshot(),
            terminal_before_reset: activateTerminal?.getLinesBeforeReset(),
            active_terminal_name: terminalManager.getCurrentTerminalName(),
            terminal_names: terminalManager.getAllTerminalNames(),
            open_file_paths: tabsManager.getOpenFiles(),

            extension: data.extension ?? extension.name,

            // optional fields - only include if provided
            ...(data.resend && {resend: data.resend}),
            ...(data.edit_file_path && {edit_file_path: data.edit_file_path}),
            ...(data.prompt && {prompt: data.prompt}),
            ...(data.messages && {messages: data.messages}),
            ...(data.symbol && {symbol: data.symbol}),
            ...(data.terminal_snapshot && {terminal_snapshot: data.terminal_snapshot}),
            ...(data.terminal_before_reset && {terminal_before_reset: data.terminal_before_reset}),
            ...(data.context_paths && {context_paths: data.context_paths}),
            ...(data.audio_blob && {audio_blob: data.audio_blob}),
            ...(data.tool_action && {tool_action: data.tool_action}),
            ...(data.tool_state && {tool_state: data.tool_state}),
        }

        await this.sendData(completeData)
    }

    public stop(uuid: string) {
        const extension = this.extensions.get(uuid)
        if (extension == null) {
            return
        }
        this.active.delete(uuid)
        extensionPane.removeRunningExtension(uuid)
    }

    public terminate = async (uuid: string) => {
        const extension = this.extensions.get(uuid)
        let sendData = {
            type: 'terminate',
            uuid: uuid,
        }
        await this.sendData(sendData)
    }

    public onReceive(data: ExtensionResponse): void {
        const extension = this.extensions.get(data.uuid)

        // extension is not valid
        if (extension == null) {
            return
        }
        // extension is not active
        if (!this.active.has(extension.uuid)) {
            return
        }

        if (data.error != null) {
            console.error(`${extension.name} error:\n` + data.error.message)
            extensionPane.addError(data.error.message, extension.name)
            banner.error(`${extension.name} failed with an error. Click here to see the full error log.`, false, () => {
                activityBarManager.openTab(EXTENSIONS)
                extensionPane.openErrorsTab()
                banner.hide(true)
            })
            this.stop(extension.uuid)
            extension.onTerminate?.()
            extension.onReceive(data)
        } else if (data.log != null) {
            console.log(`# ${extension.name} logger:\n` + data.log.message)
        } else if (data.notification != null) {
            const notification = data.notification
            extensionPane.addNotification(notification.message, notification.title, extension.name)
        } else if (data.progress != null) {
            const progress = data.progress
            extensionPane.updateExtensionProgress(extension.uuid, progress.progress)
            extensionPane.addUpdate(progress.message, extension.name)
        } else if (data.is_stopped) {
            extension.onReceive(data)
            this.stop(extension.uuid)
        } else {
            extension.onReceive(data)
        }
    }
}

export const extensionManager = new ExtensionManager()