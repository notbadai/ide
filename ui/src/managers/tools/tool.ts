import {statusBar} from "../../components/status_bar"
import {banner} from "../../components/banner"
import {projectManager} from "../project/manager"
import {TerminalPanel} from "../terminal/terminal"
import {inspectPanel} from "../../components/inspect_panel"
import {getCorrectPath} from "../../utils/paths"
import {BaseExtension} from "../../extensions/base_extension"
import {ExtensionResponse} from "../../models/extension"
import {extensionManager} from "../extensions/manager"
import {chatManager} from "../chat/manager"
import {inspectWidget} from "../../editor/widgets/inspect/widget"
import {tabsManager} from "../tabs/manager"
import {applyWidget} from "../../editor/widgets/apply/widget"
import {toolsManager} from "./manager"
import {ComponentState, CustomToolInterface} from "./custom_tool_interface"


export interface ToopOptions {
    name: string
    extension: string
}

export class ToolExtension extends BaseExtension {
    private readonly name: string
    private readonly extension: string
    private readonly terminal: TerminalPanel

    private currentChatId: string | null
    private currentFilePath: string
    private customToolInterface: CustomToolInterface

    constructor(opt: ToopOptions) {
        super()

        this.name = opt.name
        this.extension = opt.extension

        this.uuid = extensionManager.register({
            type: "tool",
            name: opt.name,
            onTerminate: this.onTerminate.bind(this),
            onReceive: this.onReceive.bind(this)
        })

        this.currentChatId = null
        this.currentFilePath = null
        this.customToolInterface = null
    }

    protected onTerminate(): void {
        statusBar.stopLoading()
        toolsManager.onTerminate()

        if (this.currentChatId !== null) {
            chatManager.getExternalChat(this.currentChatId)?.endExternalMessage()
        }

        this.currentFilePath = null
        this.isStopped = true
    }

    private async runTool() {
        this.isStopped = false
        this.currentFilePath = projectManager.codeEditor?.file.path

        const sendData = {
            ui_action: {action: 'init', state: {}},
            extension: this.extension,
            method: 'run_key_bind',
            terminal_snapshot: this.terminal == null ? [] : this.terminal.getSnapshot(),
            terminal_before_reset: this.terminal == null ? [] : this.terminal.getLinesBeforeReset(),
        }

        await extensionManager.run(this.uuid, sendData)
    }

    protected async onReceive(data: ExtensionResponse) {
        if (data.chat && data.chat.start_chat) {
            const chat = await chatManager.getOrStartExternalChat(this.currentChatId, this.name)
            this.currentChatId = chat?.getUUID()
        } else if (data.chat && data.chat.terminate_chat) {
            chatManager.getExternalChat(this.currentChatId)?.endExternalMessage()
        } else if (data.chat && data.chat.push_chat) {
            chatManager.getExternalChat(this.currentChatId)?.onExternalReceive(data)
        } else if (data.inline_completion) {
            const response = data.inline_completion
            const codeEditor = tabsManager.getCodeEditor(this.currentFilePath)
            codeEditor?.applyInlineCompletion(response.inline_completion, response.cursor_row, response.cursor_column)
        } else if (data.highlight) {
            statusBar.updateMessage(`${data.highlight.results.length} results found`)

            const results = data.highlight.results.map(res => ({
                file_path: res.file_path ? getCorrectPath(res.file_path, projectManager.project.projectName) : this.currentFilePath,
                row_from: res.row_from,
                row_to: res.row_to,
                column_from: res.column_from,
                column_to: res.column_to,
                description: res.description
            }))
            inspectWidget.showResults(this.currentFilePath, results)
        } else if (data.apply) {
            const applyData = data.apply
            applyData.file_path = this.currentFilePath
            applyWidget.apply(applyData).then()
        }
        if (data.state) {
            toolsManager.onTerminate()
            this.customToolInterface = new CustomToolInterface({
                toolInterface: data.state,
                onButtonClick: this.onButtonClick.bind(this)
            })
            toolsManager.renderCustomTool(this.customToolInterface)
        } else if (data.is_stopped) {
            this.onTerminate()
        }
    }

    private async onButtonClick(action: string, state: { [name: string]: ComponentState }): Promise<void> {
        toolsManager.onRun()
        await extensionManager.run(this.uuid, {ui_action: {action: action, state: state}, extension: this.extension})
    }

    public async run(): Promise<void> {
        if (!this.isStopped) {
            this.onTerminate()
        }

        statusBar.startLoading(`Running ${this.name}...`)
        toolsManager.onRun(true)

        await this.runTool()
        inspectPanel.update([])

        try {
            await this.waitUntilStopped()
        } catch (e) {
            banner.error(e.message || String(e))
        }
    }
}
