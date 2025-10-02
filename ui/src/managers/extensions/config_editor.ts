import {WeyaElementFunction} from "../../../../lib/weya/weya"

import {basicSetup} from 'codemirror'
import {EditorView, keymap} from '@codemirror/view'
import {EditorSelection, EditorState, StateCommand} from '@codemirror/state'
import {indentWithTab} from "@codemirror/commands"
import {autocompletion} from "@codemirror/autocomplete"
import {indentationMarkers} from '@replit/codemirror-indentation-markers'
import {vscodeKeymap} from "@replit/codemirror-vscode-keymap"
import {indentUnit} from "@codemirror/language"
import {vscodeDark} from '@uiw/codemirror-theme-vscode'
import {yaml} from '@codemirror/lang-yaml'
import {DataLoader} from "../../components/loader"

const disableCmCompletion = autocompletion({
    override: [() => null],
    activateOnTyping: false,
    defaultKeymap: false
})

export const insertNewlineKeepIndent: StateCommand = ({state, dispatch}) => {
    dispatch(state.update(state.changeByRange(range => {
        let indent = /^\s*/.exec(state.doc.lineAt(range.from).text)![0]
        return {
            changes: {from: range.from, to: range.to, insert: state.lineBreak + indent},
            range: EditorSelection.cursor(range.from + indent.length + 1)
        }
    }), {scrollIntoView: true, userEvent: "input"}))
    return true
}

class ConfigEditor {
    private elem: HTMLDivElement
    private editorElem: HTMLDivElement

    private loader: DataLoader

    private editorView: EditorView
    private readonly content: string

    constructor() {
        this.loader = new DataLoader(async (force) => {

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