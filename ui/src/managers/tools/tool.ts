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
import {diagnosticWidget} from "../../editor/widgets/diagnostic/widget"
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
            tool_action: 'init',
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
        } else if (data.inspect) {
            statusBar.updateMessage(`${data.inspect.results.length} inspection results found`)
            const results = data.inspect.results.map(res => ({
                file_path: getCorrectPath(res.file_path, projectManager.project.projectName),
                line_number: res.line_number,
                description: res.description
            }))
            inspectPanel.update(results)
        } else if (data.inline_completion) {
            const response = data.inline_completion
            const codeEditor = tabsManager.getCodeEditor(this.currentFilePath)
            codeEditor?.applyInlineCompletion(response.inline_completion, response.cursor_row, response.cursor_column)
        } else if (data.diagnostics) {
            const response = data.diagnostics
            statusBar.updateMessage(`${response.results.length} errors found`)
            const results = response.results.map(d => ({
                start_line: d.line_number,
                start_char: 0,
                end_line: d.line_number,
                end_char: -1,
                description: d.description
            }))
            diagnosticWidget.showDiagnostics(this.currentFilePath, results)
        } else if (data.apply) {
            const applyData = data.apply
            applyData.file_path = this.currentFilePath
            applyWidget.apply(applyData).then()
        }
        if (data.tool_interface) {
            toolsManager.onTerminate()
            this.customToolInterface = new CustomToolInterface({
                toolInterface: data.tool_interface,
                onButtonClick: this.onButtonClick.bind(this)
            })
            toolsManager.renderCustomTool(this.customToolInterface)
        } else if (data.is_stopped) {
            this.onTerminate()
        }
    }

    private async onButtonClick(action: string, state: { [name: string]: ComponentState }): Promise<void> {
        toolsManager.onRun()
        await extensionManager.run(this.uuid, {tool_action: action, extension: this.extension, tool_state: state})
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
