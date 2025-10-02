import {ROUTER, SCREEN} from '../app'
import {Weya as $, WeyaElement} from '../../../lib/weya/weya'
import {banner} from "../components/banner"
import {statusBar} from "../components/status_bar"
import {ScreenView} from '../screen_view'
import {clearChildElements, setTitle} from "../utils/document"
import {resizableSplitView} from "../components/resizable_split_view"
import {projectManager} from "../managers/project/manager"
import {File} from "../models/file"
import {tabsManager} from "../managers/tabs/manager"
import {extensionPane} from "../managers/extensions/extension_pane"
import {fileWatcherManager} from "../managers/file_watcher/manager"
import {
    activityBarManager,
    PROJECT,
    TERMINAL_PANEL,
    INSPECTOR_PANEL,
    CHAT,
    EXTENSIONS,
    TOOLS,
} from "../managers/activity_bar/manager"
import {Search} from "../components/search"
import {chatManager} from "../managers/chat/manager"
import {terminalManager} from "../managers/terminal/manager"
import {inspectPanel} from "../components/inspect_panel"
import {popup} from "../components/popup"
import {voiceManager} from '../managers/voice/manager'
import {toolsManager} from "../managers/tools/manager"


export class EditorView extends ScreenView {
    private actualWidth: number

    private elem: HTMLDivElement

    private readonly search: Search

    private readonly windowErrorListener = (event: ErrorEvent) => this.processErr(event.error ?? event)
    private readonly windowRejectionListener = (event: PromiseRejectionEvent) => this.processErr(event.reason)
    private readonly keyboardListener = (event: KeyboardEvent) => this.handleKeyboard(event)

    constructor() {
        super()

        projectManager.init({
            onFileDeleteCallback: this.onFileDelete.bind(this),
            onFileRenameCallback: this.onFileRename.bind(this),
            onFileChangeClick: this.onFileChange.bind(this)
        })

        this.search = new Search({onSuggestionSelected: this.onFileChange.bind(this)})

        window.addEventListener('error', this.windowErrorListener)
        window.addEventListener('unhandledrejection', this.windowRejectionListener)
        window.addEventListener('keydown', this.keyboardListener)

        activityBarManager.init({
            components: {
                [PROJECT]: projectManager,
                [CHAT]: chatManager,
                [EXTENSIONS]: extensionPane,
                [TOOLS]: toolsManager,
                [TERMINAL_PANEL]: terminalManager,
                [INSPECTOR_PANEL]: inspectPanel,
            }
        })

        fileWatcherManager.init()
        projectManager.setOnFileSaveCallback(() => {
            toolsManager.registerToolExtensions()
        })
        voiceManager.init()
    }

    private onFileChange(file: File, initLineNumber?: number): void {
        tabsManager.addTab(file, initLineNumber)
    }

    private onFileDelete(paths: string[]) {
        tabsManager.deleteFiles(paths)
    }

    private onFileRename(oldPath: string, renamedFile: File) {
        tabsManager.fileRename(oldPath, renamedFile)
    }

    async _render() {
        clearChildElements(this.elem)

        $(this.elem, async $ => {
            activityBarManager.render($)
            $('div', '.tool-bar', $ => {
                this.search.render($)
                $('div', '.logo-container', $ => {
                    $('img', '.logo', {
                        src: 'https://notbad-public.s3.us-east-2.amazonaws.com/images/logo.large.dark.png',
                        alt: 'NotBad AI Logo'
                    })
                })
            })
            await popup.render($)

            await resizableSplitView.render($)

            // rendering chats, so we can push to chat
            resizableSplitView.leftRender(chatManager)
            resizableSplitView.leftRender(projectManager)
            resizableSplitView.middleRender(tabsManager)
            await resizableSplitView.bottomRender(terminalManager, 'Terminal')
        })

        projectManager.runOnProjectLoad(async () => {
            statusBar.updateGitBranch(projectManager.project.gitBranch)
            chatManager.renderExtensions()
            tabsManager.restoreTabsFromWorkspace()
            toolsManager.updateTools()
            await activityBarManager.restoreActivity(projectManager.project.workspace?.activityState)
            resizableSplitView.restorePaneLayout()
            toolsManager.registerToolExtensions()
        })
    }

    private processErr(err: unknown) {
        if (!err) {
            return
        }

        if (err instanceof Error) {
            if ((err as any)?.handled) {
                return
            }
            banner.error(`${err.message}\n\n${err.stack}`)
        } else {
            banner.error(`Unhandled rejection value: ${String(err)}`)
        }
    }

    private handleKeyboard(event: KeyboardEvent): void {
        // open search even if listener occurs outside editor
        if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
            if (projectManager.codeEditor?.isEditorReady) {
                event.preventDefault()
                event.stopPropagation()

                projectManager.codeEditor.openSearchPanel()
                return
            }
        }

        if ((event.metaKey || event.ctrlKey) && event.key === 'w') {
            const tabClosed = tabsManager.closeCurrentTab()
            if (tabClosed) {
                event.preventDefault()
                event.stopPropagation()
            }
        }
    }

    async render(): Promise<WeyaElement> {
        this.elem = $('div', '.page.editor-view')

        setTitle({section: 'IDE', item: 'NotBadAI'})

        this._render().then()

        return this.elem
    }

    get requiresAuth(): boolean {
        return false
    }

    onResize(width: number) {
        super.onResize(width)
        this.actualWidth = Math.min(800, width)
    }

    destroy() {
        window.removeEventListener('error', this.windowErrorListener)
        window.removeEventListener('unhandledrejection', this.windowRejectionListener)
        window.removeEventListener('keydown', this.keyboardListener)

        toolsManager.removeToolExtensions()
        terminalManager.destroy()

        extensionPane.destroy()
        voiceManager.destroy()
    }

    onClose() {
        if (projectManager.codeEditor != null) {
            projectManager.codeEditor.saveFile()
        }
    }

    canUpdate() {
        return false
    }

    onVisibilityChange() {
        // if (document.hidden) {
        //     if (this.tabsManager.currentEditor != null) {
        //         // saving the document
        //         this.codeEditor.saveFile()
        //     }
        // }
    }
}

export class EditorViewHandler {
    constructor() {
        ROUTER.route('editor', [EditorViewHandler.handleEditor])
    }

    static handleEditor = () => {
        SCREEN.setView(new EditorView()).then()
    }
}