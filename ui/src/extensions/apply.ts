import {BaseExtension} from "./base_extension"
import {projectManager} from "../managers/project/manager"
import {ExtensionResponse} from "../models/extension"
import {extensionManager} from "../managers/extensions/manager"
import {applyWidget} from "../editor/widgets/apply/widget"


class ApplyExtension extends BaseExtension {
    private onCompleteCallback: () => void

    private editFileLanguage: string
    private editFilePath: string
    private onApply?: () => void

    constructor() {
        super()
        this.uuid = extensionManager.register({
            type: "apply",
            name: "apply",
            onTerminate: this.onTerminate.bind(this),
            onReceive: this.onReceive.bind(this)
        })
    }

    protected onTerminate(): void {
        this.onCompleteCallback?.()
        this.editFileLanguage = null
        this.editFilePath = null
        this.onApply = null
    }

    private getCorrectPath(path: string): string {
        if (path == null) {
            return path
        }

        if (path.trim() === '') {
            return ''
        }

        const sanitized = path.replace(/^\/+/, '')
        return `${projectManager.project.getProjectName()}/${sanitized}`
    }

    public async apply(filePath: string, lang: string, content: string, onComplete?: () => void, onApply?: () => void): Promise<void> {
        this.onTerminate()

        this.editFilePath = this.getCorrectPath(filePath)
        this.editFileLanguage = lang
        this.onApply = onApply
        this.onCompleteCallback = onComplete

        const file = projectManager.project.getFile(this.editFilePath)
        if (file == null) {
            await applyWidget.createFile(this.editFilePath, content, this.onApply)
            this.onTerminate()
            return
        }

        let sendData = {
            edit_file_path: this.editFilePath == null ? '' : this.editFilePath,
            prompt: content,
        }
        await extensionManager.run(this.uuid, sendData)
    }

    protected onReceive(data: ExtensionResponse): void {
        if (data.is_stopped) {
            this.onTerminate()
            return
        }
        const applyData = data.apply
        if (applyData == null) {
            return
        }
        applyData.file_path = this.editFilePath
        applyData.language = this.editFileLanguage
        applyData.onApply = this.onApply

        applyWidget.apply(applyData).then()
        this.onTerminate()
    }
}

export const applyExtension = new ApplyExtension()