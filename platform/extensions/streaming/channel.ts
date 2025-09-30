import {ExtensionResponse, ExtensionData} from "../../../ui/src/models/extension"

export type SendResponseCallback = (response: ExtensionResponse) => void | Promise<void>
export type OnCompleteCallback = (uuid: string) => void

export class StreamChannel {
    public readonly uuid: string
    public readonly extensionData: ExtensionData
    public isTerminated: boolean = false

    private readonly sendResponseCallback: SendResponseCallback
    private readonly onCompleteCallBack: OnCompleteCallback

    constructor(
        sendResponseCallback: SendResponseCallback,
        onCompleteCallBack: OnCompleteCallback,
        uuid: string,
        extensionData?: ExtensionData,
    ) {
        this.sendResponseCallback = sendResponseCallback
        this.onCompleteCallBack = onCompleteCallBack
        this.uuid = uuid
        this.extensionData = extensionData
    }

    public terminate(): void {
        this.isTerminated = true
        if (this.onCompleteCallBack) {
            this.onCompleteCallBack(this.uuid)
        }
    }

    public getData() {
        return this.extensionData
    }

    public async sendResponse(response: Partial<ExtensionResponse>, requestId?: string): Promise<void> {
        const completeResponse: ExtensionResponse = {
            uuid: this.uuid,
            is_stopped: response.is_stopped,
            requestId: requestId,

            // optional fields - only include if provided
            ...(response.log && {log: response.log}),
            ...(response.progress && {progress: response.progress}),
            ...(response.error && {error: response.error}),
            ...(response.notification && {notification: response.notification}),

            ...(response.apply && {apply: response.apply}),
            ...(response.inline_completion && {inline_completion: response.inline_completion}),
            ...(response.diagnostics && {diagnostics: response.diagnostics}),
            ...(response.autocomplete && {autocomplete: response.autocomplete}),
            ...(response.inspect && {inspect: response.inspect}),
            ...(response.chat && {chat: response.chat}),
            ...(response.symbol_lookup && {symbol_lookup: response.symbol_lookup}),
            ...(response.audio_transcription && {audio_transcription: response.audio_transcription}),
            ...(response.tool_interface && {tool_interface: response.tool_interface}),
        }
        await this.sendResponseCallback(completeResponse)
    }
}