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


class ConfigEditor {
    private elem: HTMLDivElement
    private editorElem: HTMLDivElement

    private loader: DataLoader

    private editorView: EditorView
    private content: string

    constructor() {
        this.loader = new DataLoader(async (force) => {
            this.content = await window.electronAPI.loadExtensionConfigContent()
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


    public get settings(): string {
        return this.editorView.state.doc.toString()
    }

    public focus(): void {
        this.editorView.focus()
    }
}

export const configEditor = new ConfigEditor()