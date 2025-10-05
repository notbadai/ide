import {ExtensionResponse, EditorState} from "../../../ui/src/models/extension"

export type SendResponseCallback = (response: ExtensionResponse) => void | Promise<void>
export type OnCompleteCallback = (uuid: string) => void

export class StreamChannel {
    public readonly uuid: string
    public editorStates: EditorState[]
    public isTerminated: boolean = false

    private readonly sendResponseCallback: SendResponseCallback
    private readonly onCompleteCallBack: OnCompleteCallback

    constructor(
        sendResponseCallback: SendResponseCallback,
        onCompleteCallBack: OnCompleteCallback,
        uuid: string,
    ) {
        this.sendResponseCallback = sendResponseCallback
        this.onCompleteCallBack = onCompleteCallBack
        this.uuid = uuid

        this.editorStates = []
    }

    public terminate(): void {
        this.isTerminated = true
        if (this.onCompleteCallBack) {
            this.onCompleteCallBack(this.uuid)
        }
    }

    public dequeueEditorState(): EditorState | undefined {
        return this.editorStates.shift()
    }

    public enqueueEditorState(state: EditorState): void {
        this.editorStates.push(state)
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
            ...(response.autocomplete && {autocomplete: response.autocomplete}),
            ...(response.highlight && {highlight: response.highlight}),
            ...(response.chat && {chat: response.chat}),
            ...(response.audio_transcription && {audio_transcription: response.audio_transcription}),
            ...(response.ui_form && {state: response.ui_form}),
        }
        await this.sendResponseCallback(completeResponse)
    }
}