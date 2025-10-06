import {BaseExtension} from "./base_extension"
import {ExtensionResponse} from "../models/extension"
import {statusBar} from "../components/status_bar"
import {banner} from "../components/banner"
import {projectManager} from "../managers/project/manager"
import {extensionManager} from "../managers/extensions/manager"
import {inspectPanel} from "../components/inspect_panel"


export class SymbolLookupExtension extends BaseExtension {
    constructor() {
        super()

        this.uuid = extensionManager.register({
            type: "symbolLookup",
            name: "symbolLookup",
            onTerminate: this.onTerminate.bind(this),
            onReceive: this.onReceive.bind(this)
        })
    }

    protected onTerminate(): void {
        statusBar.stopLoading()
        this.isStopped = true
    }

    private async getSymbolLookups(symbol: string) {
        this.isStopped = false

        const sendData = {
            symbol: symbol,
        }

        await extensionManager.run(this.uuid, sendData)
    }

    public async onSymbolLookup(symbol: string, symbolLineNumber: number): Promise<void> {
        if (!this.isStopped) {
            this.onTerminate()
        }

        statusBar.startLoading(`symbol lookup for line no: ${symbolLineNumber}, symbol: ${symbol}`)

        await this.getSymbolLookups(symbol)

        try {
            await this.waitUntilStopped()
        } catch (e) {
            banner.error(e.message || String(e))
        }

        statusBar.stopLoading()
    }

    protected async onReceive(data: ExtensionResponse): Promise<void> {
        if (data.is_stopped) {
            this.onTerminate()
            return
        }
        if (data.highlight == null) {
            return
        }

        const results = data.highlight

        const formattedResults = results.results.map(result => ({
            file_path: `${projectManager.project.getProjectName()}/${result.file_path}`,
            row_from: result.row_from,
            description: result.description
        }))
        inspectPanel.update(formattedResults)
        this.onTerminate()
    }
}