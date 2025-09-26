import {BaseExtension} from "./base_extension"
import {ExtensionResponse, SymbolLookupResults} from "../models/extension"
import {statusBar} from "../components/status_bar"
import {banner} from "../components/banner"
import {projectManager} from "../managers/project/manager"
import {extensionManager} from "../managers/extensions/manager"


export class SymbolLookupExtension extends BaseExtension {
    private symbolLookupResults: SymbolLookupResults

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

    private async getSymbolLookups(symbol: string, lineNumber: number) {
        this.isStopped = false

        const sendData = {
            symbol: symbol,
        }

        await extensionManager.run(this.uuid, sendData)
    }

    public async onSymbolLookup(symbol: string, symbolLineNumber: number): Promise<SymbolLookupResults> {
        if (!this.isStopped) {
            this.onTerminate()
        }

        statusBar.startLoading(`symbol lookup for line no: ${symbolLineNumber}, symbol: ${symbol}`)

        await this.getSymbolLookups(symbol, symbolLineNumber)

        try {
            await this.waitUntilStopped()
        } catch (e) {
            banner.error(e.message || String(e))
        }

        statusBar.stopLoading()

        return this.symbolLookupResults
    }

    protected async onReceive(data: ExtensionResponse): Promise<void> {
        if (data.is_stopped){
            this.onTerminate()
            return
        }
        if (data.symbol_lookup == null) {
            return
        }

        const results = data.symbol_lookup

        const formattedResults = results.results.map(result => ({
            file_path: `${projectManager.project.getProjectName()}/${result.file_path}`,
            line_number: result.line_number,
            excerpt: result.excerpt
        }))
        this.symbolLookupResults = {results: formattedResults, intent: results.intent}
        this.onTerminate()
    }
}