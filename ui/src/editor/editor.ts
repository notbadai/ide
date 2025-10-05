import {Weya as $, WeyaElementFunction} from "../../../lib/weya/weya"

import {basicSetup} from 'codemirror'
import {Decoration, EditorView, KeyBinding, keymap, ViewUpdate} from '@codemirror/view'
import {EditorSelection, EditorState, Extension, Line, RangeSetBuilder, StateCommand} from '@codemirror/state'
import {indentWithTab} from "@codemirror/commands"
import {indentationMarkers} from '@replit/codemirror-indentation-markers'
import {vscodeKeymap} from "@replit/codemirror-vscode-keymap"
import {indentUnit} from "@codemirror/language"
import {vscodeDark} from '@uiw/codemirror-theme-vscode'
import {highlightSelectionMatches, openSearchPanel, search, searchKeymap} from "@codemirror/search"
import {javascript} from '@codemirror/lang-javascript' // JS / TS
import {json} from '@codemirror/lang-json' // JSON
import {markdown} from '@codemirror/lang-markdown' // Markdown
import {yaml} from '@codemirror/lang-yaml' // YAML
import {html} from '@codemirror/lang-html' // HTML
import {css} from '@codemirror/lang-css' // CSS
import {python} from '@codemirror/lang-python' // Python
import {sql} from '@codemirror/lang-sql' // SQL
import {projectManager} from "../managers/project/manager"
import {clearChildElements} from "../utils/document"
import {EditorPersistentState, File} from "../models/file"
import {BaseComponent} from "../components/base"
import {DataLoader} from "../components/loader"
import {statusBar} from "../components/status_bar"
import {banner} from "../components/banner"
import {autocompletion, CompletionContext} from "@codemirror/autocomplete"
import {AutocompleteWidget} from "./widgets/autocomplete/widget"
import {
    inspectField,
    inspectInfoField,
    inspectTooltip,
    inspectUnderline,
    setInspect,
    setInspectInfo,
} from "./widgets/inspect/utils"
import {AutoSaveManager} from '../utils/autosave_manager'
import {popup} from "../components/popup"
import {DiffView} from "../components/diff_view"
import {SymbolLookupExtension} from "../extensions/symbol_lookup"
import {inspectPanel} from "../components/inspect_panel"
import {InlineCompletionWidget} from './widgets/inline_completion/widget'
import {ghostTextField} from './widgets/inline_completion/ghost_text_decorator'
import {ApplyResponse, InspectResult} from "../models/extension"

const disableCmCompletion = autocompletion({
    override: [() => null],   // always return null → no hints → no UI
    activateOnTyping: false,
    defaultKeymap: false      // stops Ctrl-Space from invoking it
})

interface EditorOptions {
    file: File
    initLineNumber: number
}

// copied from https://github.com/codemirror/commands/commit/6a9d01656023fbbb771e3bcac27c44d13282b142
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

export class CodeEditor extends BaseComponent {
    private elem: HTMLDivElement
    private pathElem: HTMLDivElement
    private editorElem: HTMLDivElement

    private editorView: EditorView
    private loader: DataLoader
    private autocompleteWidget: AutocompleteWidget
    private autoSaveManager: AutoSaveManager
    private inlineCompletionWidget: InlineCompletionWidget

    private readonly symbolLookupExtension: SymbolLookupExtension

    public readonly file: File
    public isEditorReady: boolean
    private readonly initLineNumber: number
    private language: string

    private readonly autocompleteNavKeys: KeyBinding[]
    private readonly inlineCompletionKeys: KeyBinding[]

    private readonly boundKeyDown: (e: KeyboardEvent) => void

    private justAcceptedInlineCompletion: boolean = false

    constructor(opt: EditorOptions) {
        super()

        this.file = opt.file
        this.initLineNumber = opt.initLineNumber

        this.symbolLookupExtension = new SymbolLookupExtension()

        this.loader = new DataLoader(async (force) => {
            if (!this.file.isEmptyPath) {
                await projectManager.onFileRead(this.file.path)
            }
        })

        this.autocompleteWidget = new AutocompleteWidget({file: this.file})

        this.autocompleteNavKeys = [
            {
                key: "ArrowDown",
                run: () => {
                    if (this.autocompleteWidget.isVisible()) {
                        this.autocompleteWidget.move(+1)
                        return true
                    }
                    return false                // ⇢ let default cursor-down handle it
                },
                preventDefault: true,
            },
            {
                key: "ArrowUp",
                run: () => {
                    if (this.autocompleteWidget.isVisible()) {
                        this.autocompleteWidget.move(-1)
                        return true
                    }
                    return false
                },
                preventDefault: true,
            },
            {
                key: "Enter",
                run: (view) => {
                    if (this.autocompleteWidget.isSelected) {
                        this.autocompleteWidget.applyCurrent()
                        return true
                    } else {
                        this.autocompleteWidget.hide(true)
                        return insertNewlineKeepIndent(view)
                    }
                },
                preventDefault: true,
            },
            {
                key: "Escape",
                run: () => {
                    if (this.autocompleteWidget.isVisible()) {
                        this.autocompleteWidget.hide(true)
                        return true
                    }
                    return false
                },
                preventDefault: true,
            }
        ]

        this.inlineCompletionKeys = [
            {
                key: "Tab",
                run: () => {
                    if (this.inlineCompletionWidget?.hasCompletion()) {
                        this.inlineCompletionWidget.acceptCompletion()
                        this.autocompleteWidget.forceStop()
                        this.justAcceptedInlineCompletion = true
                        return true
                    }
                    return false
                },
                preventDefault: true,
            },
            {
                key: "Escape",
                run: () => {
                    if (this.inlineCompletionWidget?.hasCompletion()) {
                        this.inlineCompletionWidget.dismissCompletion()
                        return true
                    }
                    return false
                },
                preventDefault: true,
            },
        ]

        this.autoSaveManager = new AutoSaveManager({
            onSave: async () => {
                statusBar.updateMessage("Saving (autosave)...")
                await this.autoSave()
                statusBar.updateMessage('')
            }
        })
        this.language = ''
        this.isEditorReady = false

        this.boundKeyDown = this.onKeyDown.bind(this)
    }

    private async autoSave() {
        if (this.file.isEmptyPath || !this.isEditorReady) {
            return
        }
        await projectManager.onFileSave(this.file, this.content)
    }

    private languageFromPath(path: string): Extension {
        const ext = (path.split('.').pop() ?? '').toLowerCase()

        switch (ext) {
            case 'py':
                this.language = 'python'
                return python()
            case 'js':
                this.language = 'javascript'
                return javascript()
            case 'jsx':
                this.language = 'javascript'
                return javascript({jsx: true})
            case 'ts':
                this.language = 'javascript'
                return javascript({typescript: true})
            case 'tsx':
                this.language = 'javascript'
                return javascript({typescript: true, jsx: true})
            case 'json':
                this.language = 'json'
                return json()
            case 'md':
            case 'markdown':
                this.language = 'markdown'
                return markdown()
            case 'yml':
            case 'yaml':
                this.language = 'yaml'
                return yaml()
            case 'html':
            case 'htm':
                this.language = 'html'
                return html()
            case 'css':
            case 'scss':
                this.language = 'css'
                return css()
            case 'sql':
                this.language = 'sql'
                return sql()
            default:
                return [] // plain-text fallback
        }
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.editor', $ => {
            this.loader.render($)
            this.autocompleteWidget.render($)
            this.pathElem = $('div', '.path')
            this.editorElem = $('div', '.editor-view')
        })

        await this.loader.load()

        this.renderPath()
        this.renderEditor()
        if (this.initLineNumber != null) {
            this.JumpToLine(this.initLineNumber)
        }

        this.elem.addEventListener('keydown', this.boundKeyDown)
        this.isEditorReady = true
        this.focus()

        return this.elem
    }

    private onClosePopup() {
        popup.onClose()
        this.editorView.focus()
    }

    public renderPath() {
        if (this.file.isEmptyPath) {
            return
        }
        clearChildElements(this.pathElem)
        $(this.pathElem, $ => {
            let split = this.file.path.split('/')
            for (let i = 0; i < split.length; i++) {
                $('span', '.part', $ => {
                    $('span', '.part-content', $ => {
                        if (i == split.length - 1) {
                            $('i', '.far.fa-file')
                        } else {
                            $('i', '.fas.fa-folder')
                        }
                        const spanElem = $('span', '.part-text')
                        spanElem.textContent = split[i]
                    })

                    // add separator after each part except the last one
                    if (i < split.length - 1) {
                        $('span', '.separator', '/')
                    }
                })
            }
        })
    }

    private setPointer(on: boolean) {
        this.editorView.dom.style.cursor = on ? 'pointer' : ''
    }

    private renderEditor() {
        const cursorWatcher = EditorView.updateListener.of((v: ViewUpdate) => {
            if (v.selectionSet && !v.docChanged) {
                this.autocompleteWidget.cursorWatcher()
            }
        })

        const changeWatcher = EditorView.updateListener.of(update => {
            if (update.selectionSet || update.docChanged) {
                this.autocompleteWidget.changeWatcher()
            }
            // skip cursor moves, selections, etc.
            if (update.docChanged) {
                this.file.dirty = this.content
                this.autoSaveManager.notifyChange()
            }
        })

        const viewportWatcher = EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.viewportChanged) {
                if (!update.docChanged) {
                    this.autocompleteWidget.hide(true)
                }
            }
        })

        const extensions = [
            disableCmCompletion,
            keymap.of([
                ...this.inlineCompletionKeys,
                indentWithTab,
                ...this.autocompleteNavKeys,
                ...searchKeymap,
            ]),
            keymap.of(vscodeKeymap),
            basicSetup,
            indentationMarkers({
                highlightActiveBlock: true,
                markerType: "codeOnly",
                thickness: 0.25,
            }),
            highlightSelectionMatches(),
            EditorView.lineWrapping,
            search({top: true}),
            EditorView.theme({"&": {fontSize: "10.5pt"}}),
            this.languageFromPath(this.file.path),
            vscodeDark,
            indentUnit.of("    "),
            inspectField,
            inspectInfoField,
            inspectTooltip,
            cursorWatcher,
            changeWatcher,
            viewportWatcher,
            ghostTextField
        ]

        let cachedState = this.file.getState()
        let editorState = EditorState.create({
            doc: this.file.content,
            selection: {anchor: cachedState?.viewCursor ?? 0},
            extensions: extensions,
        })

        this.editorView = new EditorView({
            parent: this.editorElem,
            state: editorState,
        })

        this.editorView.requestMeasure({
            read: () => null,
            write: view => {
                if (cachedState != null) {
                    this.editorView.scrollDOM.scrollTop = cachedState.viewScrollTop
                }
            }
        })

        this.editorView.dom.addEventListener('keyup', async (e) => {
            // skip autocomplete if we just accepted an inline completion
            if (this.justAcceptedInlineCompletion) {
                this.justAcceptedInlineCompletion = false
                return
            }

            const pos = this.editorView.state.selection.main.head
            const ctx = new CompletionContext(this.editorView.state, pos, /*explicit=*/true)

            const head = this.editorView.state.selection.main.head
            const coords = this.editorView.coordsAtPos(head)

            if (coords) {
                await this.autocompleteWidget.show(ctx, {
                    left: coords.left,
                    top: coords.top,
                    bottom: coords.bottom
                })
            }
        })

        this.editorView.dom.addEventListener('click', async (e) => {
            if (!(e.ctrlKey || e.metaKey)) {
                return
            }

            const pos = this.editorView.posAtCoords({x: e.clientX, y: e.clientY})
            if (pos == null) {
                return
            }

            const word = this.editorView.state.wordAt(pos)
            if (!word) {
                return
            }

            this.autocompleteWidget.forceStop()

            const symbol = this.editorView.state.doc.sliceString(word.from, word.to)
            const cursorLine = this.editorView.state.doc.lineAt(pos).number   // 1-based
            await this.onSymbolLookUp(symbol, cursorLine)
        })

        this.editorView.dom.addEventListener('keydown', e => {
            if (e.metaKey || e.ctrlKey) {
                this.setPointer(true)
            }

            this.autocompleteWidget.triggerAutoCompletion = e
        })

        this.editorView.dom.addEventListener('keyup', e => {
            if (!e.metaKey && !e.ctrlKey) {
                this.setPointer(false)
            }
        })

        this.editorView.scrollDOM.addEventListener('scroll', () => {
            this.autocompleteWidget.hide(true)
        })

        this.editorView.dom.addEventListener('mouseleave', () => this.setPointer(false))

        // initialize inline completion manager after editorView is created
        this.inlineCompletionWidget = new InlineCompletionWidget(this.editorView)
    }

    public showInspectResult(results: InspectResult[]) {
        if (!results?.length) {
            this.editorView.dispatch({effects: setInspect.of(Decoration.none)})
            inspectPanel.update([])
            return
        }

        const builder = new RangeSetBuilder<Decoration>()

        for (const e of results) {
            const line = this.editorView.state.doc.line(e.row_from)
            builder.add(line.from, line.to, inspectUnderline)
        }

        this.editorView.dispatch({
            effects: [
                setInspect.of(builder.finish()),
                setInspectInfo.of(results)
            ]
        })
    }

    private async onSymbolLookUp(symbol: string, cursorLine: number) {
        await this.symbolLookupExtension.onSymbolLookup(symbol, cursorLine)
    }

    public JumpToLine(lineNumber: number) {
        if (lineNumber && lineNumber > this.editorView.state.doc.lines) {
            banner.error(`Symbol Lookup Error: invalid line number ${lineNumber} received`)
            return
        }
        const line = this.editorView.state.doc.line(lineNumber)
        this.editorView.dispatch({
            selection: {anchor: line.from},
            effects: EditorView.scrollIntoView(line.from, {
                y: 'start',
                yMargin: this.editorView.defaultLineHeight * 3
            })
        })
    }

    public restoreScrollTop(scrollTop: number): void {
        if (!this.isEditorReady) {
            return
        }

        this.editorView.requestMeasure({
            read: () => null,
            write: () => {
                this.editorView.scrollDOM.scrollTop = scrollTop
            }
        })
    }

    public get editorState(): EditorPersistentState {
        if (!this.isEditorReady) {
            return null
        }

        return {
            viewCursor: this.editorView.state.selection.main.head,
            viewScrollTop: this.editorView.scrollDOM.scrollTop,
        }
    }

    public get content(): string {
        return this.editorView.state.doc.toString()
    }

    public saveFile() {
        this.autoSaveManager.reset() // rest autosave timer for every save
        this.onFileSave().then()
    }

    private async onFileSave(): Promise<void> {
        if (this.file.isEmptyPath || !this.isEditorReady) {
            return
        }

        if (this.file.dirty) {
            await projectManager.onFileSave(this.file, this.content)
        }
    }

    private async onKeyDown(e: KeyboardEvent) {
        if (e.metaKey && e.key === 's') {
            e.preventDefault()
            this.autocompleteWidget.forceStop()
            this.autoSaveManager.reset()
            await this.onFileSave()
            statusBar.success(`${this.file.path} saved on disk`)
        }
    }

    public getCursorPosition() {
        const pos = this.editorView.state.selection.main.head
        const line = this.editorView.state.doc.lineAt(pos)

        return {
            row: line.number,              // 1-based
            column: pos - line.from + 1     // 1-based
        }
    }

    public getSelectedText(): string {
        const selection = this.editorView.state.selection.main
        if (selection.empty) {
            return ''
        }
        return this.editorView.state.doc.sliceString(selection.from, selection.to)
    }

    public patchCode(from: number, to: number, text: string, cursorRow?: number, cursorColumn?: number) {
        const {state, dispatch} = this.editorView

        dispatch({
            changes: {from: from, to: to, insert: text},
            userEvent: 'input.replace'
        })

        if (cursorRow != null && cursorColumn != null) {
            this.setCursorPosition(cursorRow, cursorColumn)
        } else {
            const endPosition = from + text.length
            this.editorView.dispatch({
                selection: EditorSelection.cursor(endPosition)
            })
        }
    }

    public async onPatchCode(text: string, data: ApplyResponse) {
        const doc = this.editorView.state.doc

        if (data.start == null) {
            data.start = 0
        }
        if (data.end == null) {
            data.end = this.editorView.state.doc.length
        }

        popup.renderContent(new DiffView({
            proposedCode: text,
            originalCode: doc.sliceString(data.start, data.end),
            language: this.language,
            filePath: this.file.path,
            onReplaceSelection: (proposedCode: string) => {
                this.patchCode(data.start, data.end, proposedCode, data.cursor_row, data.cursor_column)
                this.onClosePopup()
                data.onApply?.()
            },
            onRejectSelection: () => {
                this.onClosePopup()
            },
            diffMatches: data.matches,
        }))
    }

    public async getClipboardText(): Promise<string> {
        if (navigator.clipboard?.readText) {
            try {
                return await navigator.clipboard.readText()
            } catch {
                throw new Error('Failed to read clipboard text')
            }
        }
        return ''
    }

    public getCurrentLine(): Line {
        const head = this.editorView.state.selection.main.head
        return this.editorView.state.doc.lineAt(head)
    }

    public getCurrentScrollTop(): number {
        return this.editorView.scrollDOM.scrollTop
    }

    public getEditorView(): EditorView {
        return this.editorView
    }

    public getElement(): HTMLDivElement {
        return this.elem
    }

    public destroy() {
        this.autocompleteWidget?.destroy()
        this.autoSaveManager?.reset()
        this.autocompleteWidget = null
        this.autoSaveManager = null

        this.symbolLookupExtension.destroy()

        this.elem?.removeEventListener('keydown', this.boundKeyDown)
        this.editorView?.destroy()
        this.elem?.remove()

        this.isEditorReady = false
    }

    public openSearchPanel(): void {
        if (!this.isEditorReady) {
            return
        }

        this.editorView.focus()
        openSearchPanel(this.editorView)
    }

    public focus(): void {
        this.editorView.focus()
    }

    public applyInlineCompletion(text: string, row?: number, column?: number): void {
        if (!this.inlineCompletionWidget) {
            return
        }
        if (!this.isEditorReady) {
            return
        }

        const completionFrom = this.getDocumentPosition(row, column) ?? this.editorView.state.selection.main.head
        this.inlineCompletionWidget.triggerCompletion(text, completionFrom)
    }

    public getDocumentPosition(row?: number, column?: number): number {
        if (row != null && column != null) {
            try {
                const lineObj = this.editorView.state.doc.line(row)
                const columnOffset = Math.min(Math.max(0, column - 1), lineObj.length)
                return lineObj.from + columnOffset
            } catch {
                // fallback to current cursor position if line is invalid
                return null
            }
        }
        return null
    }

    public setCursorPosition(row: number, column: number, scrollIntoView: boolean = true): void {
        if (!this.isEditorReady) {
            return
        }

        const documentPosition = this.getDocumentPosition(row, column)
        if (documentPosition === null) {
            return
        }

        const effects = scrollIntoView
            ? [EditorView.scrollIntoView(documentPosition, {
                y: 'center',
                yMargin: this.editorView.defaultLineHeight * 2
            })]
            : []

        this.editorView.dispatch({
            selection: EditorSelection.cursor(documentPosition),
            effects: effects
        })
    }
}