import {ChildProcess} from 'child_process'
import {StreamChannel} from '../streaming/channel'
import {ExtensionConfig, loadExtensionConfig} from './extension_config'
import {EditorState, ExtensionData} from "../../../ui/src/models/extension"
import {fileHandler} from '../../system/file_handler'
import {globalSettings} from "../../system/global_settings"
import {ApiKey} from "../../../ui/src/models/extension"
import {prepareEditorState} from "./utils"

export interface BaseExtensionOptions {
    channel: StreamChannel
}

export abstract class BaseExtension {
    protected channel: StreamChannel
    protected config?: ExtensionConfig

    protected proc: ChildProcess | null = null

    protected apiKeys: ApiKey[] | null = null
    protected pythonPath: string | null = null
    protected extensionDirPath: string | null = null

    protected constructor(opt: BaseExtensionOptions) {
        this.channel = opt.channel
    }

    protected abstract getExtensionInfo(extensionData: ExtensionData): string

    protected abstract run(name: string, data: EditorState): Promise<void>

    protected async prepareEditorState(extensionData: ExtensionData): Promise<EditorState> {
        return prepareEditorState(extensionData, this.apiKeys)
    }

    protected async runAndStream(name: string, extensionData: ExtensionData): Promise<void> {
        const data = await this.prepareEditorState(extensionData)
        data.meta_data = {request_id: extensionData.requestId}

        await this.run(name, data)
    }

    public async execute(extensionData: ExtensionData): Promise<void> {
        console.log(`Executing autocomplete process`)

        try {
            this.apiKeys = await globalSettings.getApiKeys()

            if (this.apiKeys == null) {
                this.apiKeys = []
            }

            this.config = await this.getExtensionConfig()

            this.pythonPath = this.config.getPythonPath()
            if (this.pythonPath == null) {
                this.pythonPath = await globalSettings.getPythonPath()
            }

            const extension = this.getExtensionInfo(extensionData)

            if (extension == null) {
                throw new Error('Invalid or missing extension')
            }

            await this.runAndStream(extension, extensionData)
        } catch (error) {
            console.error('Error running extension:', error)
            const message = error instanceof Error ? error.message : String(error)
            await this.channel.sendResponse({is_stopped: true, error: {message: message}}, extensionData.requestId)
            this.channel.terminate()
        }
    }

    protected async getExtensionConfig(): Promise<ExtensionConfig> {
        this.extensionDirPath = await fileHandler.getExtensionDirPath()
        return await loadExtensionConfig(this.extensionDirPath)
    }
}