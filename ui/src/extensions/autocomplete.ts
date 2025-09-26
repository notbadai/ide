import {BaseExtension} from "./base_extension"
import {extensionManager} from "../managers/extensions/manager"
import {ExtensionResponse} from "../models/extension"
import {generateUUID} from "../utils/uuid"
import {Cursor} from "../models/extension"


export interface AutoCompleteData {
    requestId?: string
    current_file_path: string
    current_file_content: string
    cursor: Cursor
}

class AutocompleteExtension extends BaseExtension {
    private pendingRequests: Map<string, { resolve: (data: any) => void, reject: (error: Error) => void }>

    constructor() {
        super()
        this.uuid = extensionManager.register({
            type: "autocomplete",
            name: "autocomplete",
            onTerminate: this.onTerminate.bind(this),
            onReceive: this.onReceive.bind(this)
        })
        this.pendingRequests = new Map()
    }


    protected onTerminate(): void {
    }

    public fetch = async (data: AutoCompleteData): Promise<any> => {
        const uuid = generateUUID()
        data.requestId = uuid

        return new Promise(async (resolve, reject) => {
            this.pendingRequests.set(uuid, {resolve, reject})

            const timeoutId = setTimeout(() => {
                if (this.pendingRequests.has(uuid)) {
                    this.pendingRequests.delete(uuid)
                    // console.log('timeoutId', uuid)
                    reject(new Error(`Autocomplete request timeout ${uuid}`))
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
        // console.log(data, this.pendingRequests.has(uuid))

        if (!this.pendingRequests.has(uuid)) {
            return
        }

        const {resolve, reject} = this.pendingRequests.get(uuid)!
        this.pendingRequests.delete(uuid)

        if (data.autocomplete != null) {
            resolve({
                success: true,
                suggestions: data.autocomplete.suggestions,
                time_elapsed: data.autocomplete.time_elapsed,
            })
        } else {
            resolve({success: false})
        }
    }
}

export const autocompleteExtension = new AutocompleteExtension()