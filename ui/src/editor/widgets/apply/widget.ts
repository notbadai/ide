import {banner} from "../../../components/banner"
import {projectManager} from '../../../managers/project/manager'
import {popup} from '../../../components/popup'
import {DiffView} from "../../../components/diff_view"
import {ApplyResponse} from "../../../models/extension"
import {tabsManager} from "../../../managers/tabs/manager"
import {FileCreator} from '../../../components/file_creator'

class ApplyWidget {
    public constructor() {
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

    public async apply(data: ApplyResponse): Promise<void> {
        const editor = projectManager.codeEditor
        const replaceWith = data.patch.join("")

        // [TODO] setting cursor position only works for the current tab only
        if (editor && (data.file_path == null || this.arePathsEquivalent(data.file_path, editor.file.path))) {
            editor.onPatchCode(replaceWith, data).then()
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
            // handles cases where file not in open tab and file is closed (when open tab) due to external sync
            await projectManager.onFileRead(file.path)
        }

        popup.renderContent(new DiffView({
            proposedCode: replaceWith,
            originalCode: file.content,
            language: data.language,
            filePath: data.file_path,
            onReplaceSelection: (proposedCode: string) => {
                file.dirty = proposedCode
                projectManager.onFileSave(file, proposedCode)
                if (shouldOpen) {
                    tabsManager.addTab(file)
                } else {
                    tabsManager.deleteEditorCache(file.path)
                }
                popup.onClose()
                data.onApply?.()
            },
            onRejectSelection: () => {
                if (shouldOpen) {
                    file.close()
                }
                popup.onClose()
            },
            diffMatches: data.matches
        }))
    }

    public async createFile(filePath: string, content: string, onApply?: () => void): Promise<void> {
        popup.renderContent(new FileCreator({
            defaultPath: filePath,
            onCreateClick: (filePath: string) => {
                projectManager.onFileOrFolderCreate(
                    filePath,
                    true,
                    content,
                    () => {
                        projectManager.reRenderFiles()
                        const file = projectManager.project.getFile(filePath)
                        tabsManager.addTab(file)
                        onApply?.()
                        popup.onClose()
                    })
            },
            onCancelClick: () => {
                popup.onClose()
            }
        }), true)
    }

}

export const applyWidget = new ApplyWidget()