import {WeyaElementFunction} from "../../../../lib/weya/weya"

import {basicSetup} from 'codemirror'
import {EditorView, keymap} from '@codemirror/view'
import {EditorState} from '@codemirror/state'
import {indentWithTab} from "@codemirror/commands"
import {indentationMarkers} from '@replit/codemirror-indentation-markers'
import {vscodeKeymap} from "@replit/codemirror-vscode-keymap"
import {indentUnit} from "@codemirror/language"
import {vscodeDark} from '@uiw/codemirror-theme-vscode'
import {yaml} from '@codemirror/lang-yaml'
import {DataLoader} from "../../components/loader"
import {AutoSaveManager} from "../../utils/autosave_manager"
import {projectManager} from "../project/manager"


class ConfigEditor {
    private elem: HTMLDivElement
    private editorElem: HTMLDivElement

    private loader: DataLoader
    private autoSaveManager: AutoSaveManager

    private editorView: EditorView
    private content: string

    constructor() {
        this.loader = new DataLoader(async (force) => {
            this.content = await window.electronAPI.loadExtensionConfigContent()
        })
        this.autoSaveManager = new AutoSaveManager({
            onSave: async () => {
                projectManager.project.extensions = await window.electronAPI.saveExtensionConfig(this.configContent)
                for (const onFileSave of projectManager.getOnFileSaveCallbacks()) {
                    onFileSave()
                }
            },
            autoSaveDelayMs: 1_000
        })
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.editor', $ => {
            this.loader.render($)
            this.editorElem = $('div', '.editor-view')
        })

        await this.loader.load()

        this.renderEditor()

        this.focus()

        return this.elem
    }


    private renderEditor() {
        const changeWatcher = EditorView.updateListener.of(update => {
            if (update.docChanged) {
                this.autoSaveManager.notifyChange()
            }
        })

        const extensions = [
            // disableCmCompletion,
            keymap.of([
                indentWithTab,
            ]),
            keymap.of(vscodeKeymap),
            basicSetup,
            indentationMarkers({
                highlightActiveBlock: true,
                markerType: "codeOnly",
                thickness: 0.25,
            }),
            EditorView.lineWrapping,
            EditorView.theme({"&": {fontSize: "10.5pt"}}),
            yaml(),
            vscodeDark,
            indentUnit.of("    "),
            changeWatcher,
        ]

        let editorState = EditorState.create({
            doc: this.content,
            selection: {anchor: 0},
            extensions: extensions,
        })

        this.editorView = new EditorView({
            parent: this.editorElem,
            state: editorState,
        })
    }


    public get configContent(): string {
        return this.editorView.state.doc.toString()
    }

    public focus(): void {
        this.editorView.focus()
    }
}

export const configEditor = new ConfigEditor()