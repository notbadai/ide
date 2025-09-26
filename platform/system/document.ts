export interface Data {
    path: string
    version: number
    is_empty_dir: boolean
    content: string | null
}

export interface Summary {
    path: string
    version: number
    is_empty_dir: boolean
    is_uncommitted: boolean
}

export class Document {
    public path: string
    public isEmptyDir: boolean
    public version: number

    constructor(path: string, isEmptyDir: boolean) {
        this.path = path
        this.isEmptyDir = isEmptyDir

        this.version = Math.floor(Math.random() * 1000)
    }

    public toData(content: string | null): Data {
        return {
            path: this.path,
            is_empty_dir: this.isEmptyDir,
            version: this.version,
            content: content
        }
    }

    public toSummary(): Summary {
        return {
            path: this.path,
            is_empty_dir: this.isEmptyDir,
            version: this.version,
            is_uncommitted: false,
        }
    }
}