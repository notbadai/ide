import {ChildProcess} from 'child_process'
import {StreamChannel} from '../streaming/channel'
import {ExtensionConfig} from '../../system/extension_config'
import {EditorState, ExtensionData} from "../../../ui/src/models/extension"
import {ApiProvider} from "../../../ui/src/models/extension"
import {prepareEditorState} from "./utils"
import {fileHandler} from "../../system/file_handler"

export interface BaseExtensionOptions {
    channel: StreamChannel
}

export abstract class BaseExtension {
    protected channel: StreamChannel
    protected config?: ExtensionConfig

    protected proc: ChildProcess | null = null

    protected apiProviders: ApiProvider[] | null = null
    protected pythonPath: string | null = null
    protected extensionDirPath: string | null = null

    protected constructor(opt: BaseExtensionOptions) {
        this.channel = opt.channel
    }

    protected abstract getExtensionInfo(extensionData: ExtensionData): string

    protected abstract run(name: string, data: EditorState): Promise<void>

    protected async prepareEditorState(extensionData: ExtensionData): Promise<EditorState> {
        return prepareEditorState(extensionData, this.apiProviders)
    }

    protected async runAndStream(name: string, extensionData: ExtensionData): Promise<void> {
        const editorState = await this.prepareEditorState(extensionData)
        this.channel.enqueueEditorState(editorState)

        await this.run(name, editorState)
    }

    public async execute(extensionData: ExtensionData): Promise<void> {
        console.log(`Executing autocomplete process`)

        try {
            this.extensionDirPath = fileHandler.localExtensionsDirPath

            this.config = await fileHandler.getExtensionConfig()
            this.apiProviders = this.config.getApiProviders()
            this.pythonPath = this.config.getPythonPath()

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
}