import {WeyaElementFunction, Weya as $} from "../../../../../lib/weya/weya"
import {ApplyResponse} from "../../../models/extension"
import {clearChildElements} from "../../../utils/document"
import {projectManager} from "../../../managers/project/manager"
import {banner} from "../../../components/banner"
import {tabsManager} from "../../../managers/tabs/manager"
import {DiffView} from "../../../components/diff_view"
import {FileCreator} from "../../../components/file_creator"
import {WidgetLoader} from "./loader"

export interface ApplyAllWidgetOptions {
    onNext: () => void
}

export class ApplyAllWidget {
    private elem: HTMLDivElement
    private contentELem: HTMLDivElement

    private readonly onNext: () => void

    constructor(opt: ApplyAllWidgetOptions) {
        this.onNext = opt.onNext
    }

    private onNextClick() {
        this.onNext()
    }

    private arePathsEquivalent(p1: string, p2: string): boolean {
        const normalize = (p: string) =>
            p.trim()
                .replace(/\\/g, '/')
                .replace(/^(\.\/|\/)+/, '')
                .replace(/\/+/g, '/');

        const s1 = normalize(p1).split('/')
        const s2 = normalize(p2).split('/')

        const min = Math.min(s1.length, s2.length)
        for (let i = 1; i <= min; i++) {
            if (s1[s1.length - i] !== s2[s2.length - i]) {
                return false
            }
        }

        return true
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.apply-all-widget', $ => {
            this.contentELem = $('div', '.content')
        })
    }

    public async apply(data: ApplyResponse): Promise<void> {
        const editor = projectManager.codeEditor
        const replaceWith = data.patch.join("")

        if (editor && (data.file_path == null || this.arePathsEquivalent(data.file_path, editor.file.path))) {
            clearChildElements(this.contentELem)
            $(this.contentELem, $ => {
                const diffView = new DiffView({
                    proposedCode: replaceWith,
                    originalCode: editor.content,
                    language: data.language,
                    filePath: data.file_path,
                    onReplaceSelection: async (proposedCode: string) => {
                        editor.patchCode(0, editor.content.length, proposedCode, data.cursor_row, data.cursor_column)
                        await this.waitForEditorReady()
                        this.onNextClick()
                        data.onApply?.()
                    },
                    onRejectSelection: () => {
                        this.onNextClick()
                    },
                    diffMatches: data.matches
                })
                diffView.render($)
            })
            return
        }

        const file = projectManager.project.getFile(data.file_path)
        if (file == null) {
            banner.error(`File not found: ${data.file_path}, Kindly create the file if it does not exist.`)
            return
        }

        let shouldOpen = false
        if (!tabsManager.isFileOpenInTab(file.path)) {
            shouldOpen = true
        }
        if (file.isEmpty()) {
            await projectManager.onFileRead(file.path)
        }

        clearChildElements(this.contentELem)
        $(this.contentELem, $ => {
            const diffView = new DiffView({
                proposedCode: replaceWith,
                originalCode: file.content,
                language: data.language,
                filePath: data.file_path,
                onReplaceSelection: async (proposedCode: string) => {
                    file.dirty = proposedCode
                    projectManager.onFileSave(file, proposedCode).then()
                    if (shouldOpen) {
                        tabsManager.addTab(file)
                    } else {
                        tabsManager.deleteEditorCache(file.path)
                    }

                    await this.waitForEditorReady()
                    this.onNextClick()
                    data.onApply?.()
                },
                onRejectSelection: () => {
                    if (shouldOpen) {
                        file.close()
                    }
                    this.onNextClick()
                },
                diffMatches: data.matches
            })
            diffView.render($)
        })
    }

    private async waitForEditorReady(): Promise<void> {
        const currentEditor = projectManager.codeEditor
        if (currentEditor) {
            // poll until the editor is ready
            while (!currentEditor.isEditorReady) {
                await new Promise(resolve => setTimeout(resolve, 50))
            }
        }
    }

    public async createFile(filePath: string, content: string, onApply?: () => void): Promise<void> {
        clearChildElements(this.contentELem)
        $(this.contentELem, $ => {
            const fileCreator = new FileCreator({
                defaultPath: filePath,
                onCreateClick: async (filePath: string) => {
                    projectManager.onFileOrFolderCreate(
                        filePath,
                        true,
                        content,
                        async () => {
                            projectManager.reRenderFiles()
                            const file = projectManager.project.getFile(filePath)
                            tabsManager.addTab(file)

                            await this.waitForEditorReady()
                            this.onNextClick()
                            onApply?.()
                        })
                },
                onCancelClick: () => {
                    this.onNextClick()
                }
            })
            fileCreator.render($)
        })
    }

    public showLoader(filePath: string): void {
        clearChildElements(this.contentELem)
        $(this.contentELem, $ => {
            const loader = new WidgetLoader({filePath: filePath})
            loader.render($)
        })
    }
}
