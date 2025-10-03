const AUTO_SAVE_DELAY = 2_000

export interface AutoSaveOptions {
    onSave: () => Promise<void>
    autoSaveDelayMs?: number
}


export class AutoSaveManager {
    private timer: number

    private readonly onSave: () => Promise<void>
    private readonly autoSaveDelayMs: number

    constructor(opt: AutoSaveOptions) {
        this.onSave = opt.onSave
        this.autoSaveDelayMs = opt.autoSaveDelayMs == null ? AUTO_SAVE_DELAY : opt.autoSaveDelayMs
    }

    // call on every doc change
    public notifyChange() {
        if (this.timer) {
            clearTimeout(this.timer)
        }
        this.timer = window.setTimeout(async () => {
            await this.onSave()
            this.timer = undefined
        }, this.autoSaveDelayMs)
    }

    // call after manual save
    public reset() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = undefined
        }
    }
}