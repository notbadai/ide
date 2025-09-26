import {BaseExtension} from "./base_extension"
import {extensionManager} from "../managers/extensions/manager"
import {ExtensionResponse} from "../models/extension"
import {generateUUID} from "../utils/uuid"

export interface VoiceData {
    requestId?: string
    audio_blob: ArrayBuffer
}

class VoiceExtension extends BaseExtension {
    private pendingRequests: Map<string, { resolve: (data: any) => void, reject: (error: Error) => void }>

    constructor() {
        super()
        this.uuid = extensionManager.register({
            type: "voice",
            name: "voice",
            onTerminate: this.onTerminate.bind(this),
            onReceive: this.onReceive.bind(this)
        })
        this.pendingRequests = new Map()
    }

    protected onTerminate(): void {
    }

    public fetch = async (data: VoiceData): Promise<any> => {
        const uuid = generateUUID()
        data.requestId = uuid

        return new Promise(async (resolve, reject) => {
            this.pendingRequests.set(uuid, {resolve, reject})

            const timeoutId = setTimeout(() => {
                if (this.pendingRequests.has(uuid)) {
                    this.pendingRequests.delete(uuid)
                    reject(new Error(`Voice request timeout ${uuid}`))
                }
            }, 60000) // 60 seconds timeout

            try {
                await extensionManager.run(this.uuid, data, false)
            } catch (error) {
                clearTimeout(timeoutId)
                this.pendingRequests.delete(uuid)
                reject(error)
            }
        })
    }

    public async onReceive(data: ExtensionResponse): Promise<void> {
        const uuid = data.requestId

        if (!this.pendingRequests.has(uuid)) {
            return
        }

        const {resolve, reject} = this.pendingRequests.get(uuid)!
        this.pendingRequests.delete(uuid)

        if (data.audio_transcription != null) {
            resolve({
                success: true,
                text: data.audio_transcription.text,
            })
        } else {
            resolve({success: false})
        }
    }
}

export const voiceExtension = new VoiceExtension()