import {extensionManager} from "../managers/extensions/manager"

export class BaseExtension {
    protected uuid: string // this use to communicate with extensionManager
    protected isStopped = false
    private waitIntervalId: NodeJS.Timeout | null = null // Add this line

    constructor() {
    }

    protected onReceive(data: any): void {
    }

    protected onTerminate(): void {
    }

    protected waitUntilStopped(CHECK_INTERVAL_MS = 180): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.waitIntervalId = setInterval(() => {
                if (this.isStopped) {
                    clearInterval(this.waitIntervalId!)
                    this.waitIntervalId = null
                    return resolve()
                }
            }, CHECK_INTERVAL_MS)
        })
    }

    public destroy(): void {
        extensionManager.unregister(this.uuid)
    }
}