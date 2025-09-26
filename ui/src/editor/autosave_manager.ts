const AUTO_SAVE_DELAY = 2_000

export interface AutoSaveOptions {
    onSave: () => Promise<void>
}


export class AutoSaveManager {
    private timer: number
    
    private readonly onSave: () => Promise<void>
    
    constructor(opt: AutoSaveOptions) {
        this.onSave = opt.onSave
    }
    
    // call on every doc change
    public notifyChange(){
        if (this.timer) {
            clearTimeout(this.timer)
        }
        this.timer = window.setTimeout( async () => {
            await this.onSave()
            this.timer = undefined
        }, AUTO_SAVE_DELAY)
    }
    
    // call after manual save
    public reset() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = undefined
        }
    }
}