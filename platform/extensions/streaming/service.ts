import {BrowserWindow} from 'electron'
import {StreamChannel} from './channel'
import {ChatExtension} from '../chat'
import {ApplyExtension} from '../apply'
import {SymbolLookupExtension} from '../symbol_lookup'
import {AutocompleteExtension} from '../autocomplete'
import {ToolsExtension} from '../tools'
import {ExtensionData, ExtensionResponse} from "../../../ui/src/models/extension"


class StreamService {
    private mainWindow: BrowserWindow | null

    private readonly activeChannels: Map<string, StreamChannel>

    private autocompleteExtension?: AutocompleteExtension

    constructor() {
        this.activeChannels = new Map()
    }

    public init(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow
    }

    public async onReceive(data: ExtensionData) {
        const type = data.type

        console.log(`StreamService method called: ${type}`)

        switch (type) {
            case 'chat':
                this.chatAssistant(data).then()
                break
            case 'apply':
                this.applyPatch(data).then()
                break
            case 'symbolLookup':
                this.symbolLookup(data).then()
                break
            case 'autocomplete':
                this.autocomplete(data).then()
                break
            case 'tool':
                this.runToolsExtension(data).then()
                break
            case 'terminate':
                if (this.activeChannels.has(data.uuid)) {
                    this.activeChannels.get(data.uuid).terminate()
                }
                break
            default:
                console.error(`Invalid type: ${type}`)
        }
    }

    public onSend(data: ExtensionResponse): void {
        this.mainWindow.webContents.send('stream:send', data)
    }

    private onCompleteChannel(uuid: string): void {
        if (this.activeChannels.has(uuid)) {
            this.activeChannels.delete(uuid)
        }
    }

    private async chatAssistant(data: ExtensionData): Promise<void> {
        const channel = new StreamChannel(
            (response) => this.onSend(response),
            (uuid) => this.onCompleteChannel(uuid),
            data.uuid,
            data.name,
        )

        this.activeChannels.set(channel.name, channel)
        const chatExtension = new ChatExtension({channel})
        await chatExtension.execute({...data})
    }

    private async applyPatch(data: ExtensionData): Promise<void> {
        const channel = new StreamChannel(
            (response) => this.onSend(response),
            (uuid) => this.onCompleteChannel(uuid),
            data.uuid,
            data.name,
        )
        this.activeChannels.set(channel.name, channel)
        const patchApplier = new ApplyExtension({channel})
        await patchApplier.execute({...data})
    }

    private async symbolLookup(data: ExtensionData): Promise<void> {
        const channel = new StreamChannel(
            (response) => this.onSend(response),
            (uuid) => this.onCompleteChannel(uuid),
            data.uuid,
            data.name,
        )
        this.activeChannels.set(channel.name, channel)
        const patchApplier = new SymbolLookupExtension({channel})
        await patchApplier.execute({...data})
    }

    private async autocomplete(data: ExtensionData): Promise<void> {
        if (!this.autocompleteExtension) {
            const channel = new StreamChannel(
                (response) => this.onSend(response),
                (uuid) => this.onCompleteChannel(uuid),
                data.uuid,
                data.name,
            )
            this.activeChannels.set(channel.name, channel)
            this.autocompleteExtension = new AutocompleteExtension({channel})
        }
        await this.autocompleteExtension.execute({...data})
    }

    private async runToolsExtension(data: ExtensionData): Promise<void> {
        const channel = new StreamChannel(
            (response) => this.onSend(response),
            (uuid) => this.onCompleteChannel(uuid),
            data.uuid,
            data.name,
        )
        this.activeChannels.set(channel.name, channel)
        const toolsExtension = new ToolsExtension({channel})
        await toolsExtension.execute({...data})
    }

    public cleanup(): void {
        // terminate all active channels
        for (const [uuid, channel] of this.activeChannels) {
            channel.terminate()
        }
        this.activeChannels.clear()

        // cleanup persistent processes
        if (this.autocompleteExtension) {
            this.autocompleteExtension.cleanup()
            this.autocompleteExtension = undefined
        }
    }

    public onRestart() {
        this.autocompleteExtension?.markPersistentProcessDirty()
    }

    public getChannel(name: string): StreamChannel {
        return this.activeChannels.get(name)
    }
}

export const streamService = new StreamService()