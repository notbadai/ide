import {BaseExtension} from "./base_extension"
import {projectManager} from "../managers/project/manager"
import {ExtensionResponse} from "../models/extension"
import {extensionManager} from "../managers/extensions/manager"
import {popup} from "../components/popup"
import {ApplyAllWidget} from "../editor/widgets/apply_all/widget"
import {CodeBlock} from "../components/code_block"


class ApplyAllExtension extends BaseExtension {
    private onCompleteCallback: () => void

    private editFileLanguage: string
    private editFilePath: string
    private onApply?: () => void
    private readonly widget: ApplyAllWidget

    private startIndex: number
    private currentIndex: number
    private codeBlocks: CodeBlock[]

    constructor() {
        super()
        this.uuid = extensionManager.register({
            type: "apply",
            name: "apply",
            onTerminate: this.onTerminate.bind(this),
            onReceive: this.onReceive.bind(this)
        })
        this.widget = new ApplyAllWidget({onNext: this.onNext.bind(this)})
        this.codeBlocks = []
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

    public async apply(index: number, codeBlocks?: CodeBlock[]): Promise<void> {
        this.onTerminate()

        if (codeBlocks != null) {
            this.startIndex = index
            this.codeBlocks = codeBlocks
        }
        this.currentIndex = index

        const currentCodeBlock = this.codeBlocks[this.currentIndex]

        this.editFilePath = this.getCorrectPath(currentCodeBlock.filePath)
        this.editFileLanguage = currentCodeBlock.filePath
        this.onApply = () => {
            currentCodeBlock.setApplied()
        }
        this.onCompleteCallback = () => {
            currentCodeBlock.loading(false)
        }

        const file = projectManager.project.getFile(this.editFilePath)
        if (file == null) {
            this.renderWidget()
            await this.widget.createFile(this.editFilePath, currentCodeBlock.content, this.onApply)
            this.onTerminate()
            return
        }

        let sendData = {
            edit_file_path: this.editFilePath == null ? '' : this.editFilePath,
            prompt: currentCodeBlock.content,
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

        this.renderWidget()
        this.widget.apply(applyData).then()
        this.onTerminate()
    }

    private renderWidget() {
        if (popup.isRendered()) {
            return
        }
        popup.renderContent(this.widget)
    }

    private async onNext() {
        const nextIndex = (this.currentIndex + 1) % this.codeBlocks.length
        
        // stop when we've completed the full cycle back to startIndex
        if (nextIndex === this.startIndex) {
            popup.onClose()
            return
        }
        
        const nextCodeBlock = this.codeBlocks[nextIndex]
        this.widget.showLoader(nextCodeBlock.filePath)
        await this.apply(nextIndex)
    }
}

export const applyAllExtension = new ApplyAllExtension()