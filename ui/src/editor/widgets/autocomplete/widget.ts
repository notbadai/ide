import {WeyaElementFunction} from "../../../../../lib/weya/weya"
import {CompletionContext} from "@codemirror/autocomplete"
import {clearChildElements} from "../../../utils/document"
import {File} from "../../../models/file"
import {projectManager} from "../../../managers/project/manager"
import {statusBar} from "../../../components/status_bar"
import {Line} from "@codemirror/state"
import {autocompleteExtension} from "../../../extensions/autocomplete"
import {Prediction} from "../../../models/extension"

const PASSIVE_KEYS = new Set([
    'Escape',
    'PageUp', 'PageDown', 'Home', 'End'
])
const EDITING_KEYS = new Set(['Backspace', 'Delete'])
const MODIFIER_KEYS = new Set(['Shift', 'Meta', 'Control', 'Alt'])
const POPUP_MARGIN = 6

export interface AutocompleteOptions {
    file: File
}

export interface AutoCompleteStatus {
    hide: boolean
    trigger: boolean
    justApplied: boolean
}

export class AutocompleteWidget {
    private elem: HTMLDivElement

    private items: HTMLDivElement[]
    private choices: Prediction[]
    private selected: number

    private readonly file: File

    private currentLine: Line
    private currentLinePrefix: string
    private predictions: Prediction[]
    private currentAnchor: { left: number, top: number, bottom: number } | null
    private readonly autoCompleteStatus: AutoCompleteStatus
    private isCtrlSpace: boolean
    private numActiveRequests: number

    private debounceTimer: number | null
    private readonly debounceMs: number
    private pendingResolve: ((value: Prediction[]) => void) | null

    public readonly uuid: string

    constructor(opt: AutocompleteOptions) {
        this.file = opt.file

        this.items = []
        this.choices = []
        this.selected = 0

        this.currentLine = null
        this.currentLinePrefix = ''
        this.currentAnchor = null
        this.predictions = []
        this.isCtrlSpace = false
        this.numActiveRequests = 0

        this.autoCompleteStatus = {trigger: false, hide: true, justApplied: false}

        this.debounceMs = 150
        this.debounceTimer = null
        this.pendingResolve = null
    }

    private clearPredictions() {
        this.predictions = []
    }

    private async doFetch(context: CompletionContext): Promise<Prediction[]> {
        // check if autocomplete extension is configured
        if (!projectManager.project?.extensions?.autocomplete) {
            return []
        }

        const word = context.matchBefore(/\w*/)
        if (!word || (word.from === word.to && !context.explicit)) {
            return []
        }

        const line = context.state.doc.lineAt(context.pos)
        const column = context.pos - line.from + 1
        const linePrefix = context.state.doc.sliceString(line.from, context.pos).trimStart()
        const content = context.state.doc.toString()

        const fetchStartTime = new Date().getTime()

        statusBar.updateMessage(`Fetching completions line no: ${line.number}, prefix: ${linePrefix}`)

        let response
        try {
            this.numActiveRequests++
            statusBar.updateActiveRequests(this.numActiveRequests)
            response = await autocompleteExtension.fetch({
                current_file_path: this.file.path,
                current_file_content: content,
                cursor: {row: line.number, column: column}
            })
            if (!response.success) {
                return []
            }
        } catch (e) {
            return []
        } finally {
            statusBar.updateMessage(``)
            this.numActiveRequests--
            statusBar.updateActiveRequests(this.numActiveRequests)
        }

        const fetchTime = new Date().getTime() - fetchStartTime

        console.log('currLinePrefix', this.currentLinePrefix)
        console.log(`line no: ${line.number} line prefix: ${linePrefix} fetchTime:${fetchTime}`)

        return response.suggestions
    }

    private getCompletions = async (context: CompletionContext): Promise<Prediction[]> => {
        /* if a fetch is already scheduled, cancel it and resolve the
           previous promise immediately with an empty list. */
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer)
            this.debounceTimer = null

            if (this.pendingResolve) {           // resolve the *old* request
                this.pendingResolve([])
            }
        }

        /* return a fresh promise for the current request, scheduling the
           real network call after `debounceMs` of inactivity. */
        return new Promise<Prediction[]>(resolve => {
            this.pendingResolve = resolve        // remember resolver for potential cancellation

            this.debounceTimer = window.setTimeout(async () => {
                this.debounceTimer = null
                this.pendingResolve = null       // this one is being settled now
                try {
                    const preds = await this.doFetch(context)
                    resolve(preds)
                } catch {
                    resolve([])                  // network error → no suggestions
                }
            }, this.debounceMs)
        })
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.autocomplete-popup')
        this.hide(true)
    }

    public renderWindow(predictions: Prediction[]): void {
        clearChildElements(this.elem)

        if (predictions.length === 0) {
            statusBar.updateMessage("No autocomplete suggestions available")
            this.hide(true)
            return
        }

        this.hide(false)

        this.elem.style.visibility = "hidden"
        this.elem.style.left = '-9999px'
        this.elem.style.top = '-9999px'

        this.choices = []
        this.items = predictions.map((choice: Prediction, i: number) => {
            const item = document.createElement('div')

            item.className = 'item' + (i === this.selected ? ' selected' : '')
            item.textContent = choice.label
            item.onclick = () => this.apply(choice)

            this.elem.appendChild(item)
            this.choices.push(choice)

            return item
        })

        const popupH = this.elem.offsetHeight
        const popupW = this.elem.offsetWidth

        const editorBox = projectManager.codeEditor.getEditorView().dom.getBoundingClientRect()

        // decide whether to drop *below* or *above* the caret
        const roomBelow = editorBox.bottom - this.currentAnchor.bottom
        const shouldFlip = roomBelow < popupH + POPUP_MARGIN

        const finalTop = shouldFlip ? this.currentAnchor.top - popupH - POPUP_MARGIN : this.currentAnchor.bottom + POPUP_MARGIN

        // clamp if the popup would poke out of the viewport
        const minTop = POPUP_MARGIN
        const maxTop = window.innerHeight - popupH - POPUP_MARGIN

        const minLeft = 4
        const roomRight = editorBox.right - (this.currentAnchor.left + popupW)
        const finalLeft = roomRight < 0 ? editorBox.right - popupW : this.currentAnchor.left

        this.elem.style.top = `${Math.max(minTop, Math.min(maxTop, finalTop))}px`
        this.elem.style.left = `${Math.max(minLeft, finalLeft)}px`

        this.elem.style.visibility = 'visible'

        projectManager.codeEditor.getEditorView().focus()
    }

    private getDuplicatedPredictions(predictions: Prediction[]): Prediction[] {
        const currentLineText = this.currentLine.text.trim()
        const currentLinePrefix = this.currentLinePrefix.trim()

        let res = []
        const predictionsSet = new Set<string>()
        const allPredictions = [...this.predictions, ...predictions]
        for (const prediction of allPredictions) {
            prediction.text = prediction.text.trim()

            if (predictionsSet.has(prediction.text)) {
                continue
            }
            if (prediction.text.trim() === currentLineText) {
                continue
            }
            if (!prediction.text.startsWith(currentLinePrefix)) {
                continue
            }
            if (prediction.label.trim() == '') {
                continue
            }

            res.push(prediction)
            predictionsSet.add(prediction.text)
        }

        return res
    }

    public async show(context: CompletionContext, anchor: { left: number, top: number, bottom: number }) {
        if (!this.autoCompleteStatus.trigger) {
            this.hide(this.autoCompleteStatus.hide)
            return
        }

        const scrollTopWhenTriggered = projectManager.codeEditor.getCurrentScrollTop()
        const lineNumberWhenTriggered = projectManager.codeEditor.getCurrentLine().number

        this.currentAnchor = anchor

        const line = context.state.doc.lineAt(context.pos)
        this.currentLinePrefix = context.state.doc.sliceString(line.from, context.pos).trimStart()
        if (this.currentLine && (this.currentLine.number != line.number)) {
            this.clearPredictions()
        }
        this.currentLine = line

        const cachedPredictions = this.getDuplicatedPredictions([])
        this.renderWindow(cachedPredictions)

        const predictions: Prediction[] = await this.getCompletions(context)

        // added this since when change the tabs/closing tabs old autocomplete window keep hitting,
        if (this.file.path != projectManager.codeEditor.file.path) {
            return
        }

        if (scrollTopWhenTriggered != projectManager.codeEditor.getCurrentScrollTop()) {
            this.hide(true)
            return
        }
        if (lineNumberWhenTriggered != projectManager.codeEditor.getCurrentLine().number) {
            this.hide(true)
            return
        }
        if (this.autoCompleteStatus.hide) {
            this.hide(this.autoCompleteStatus.hide)
            return
        }

        this.predictions = this.getDuplicatedPredictions(predictions)

        this.renderWindow(this.predictions)
    }

    private apply(choice: Prediction) {
        const line = projectManager.codeEditor.getCurrentLine()
        const indent = line.text.match(/^\s*/)?.[0] ?? ""
        const from = line.from + indent.length, to = line.to // ← replace WHOLE line

        const insertText = choice.text
        const cursorPos = from + insertText.length          // caret right after the inserted text

        projectManager.codeEditor.getEditorView().dispatch({
            changes: {from, to, insert: insertText},
            selection: {anchor: cursorPos}
        })

        this.hide(true)
        projectManager.codeEditor.getEditorView().focus()
        this.selected = -1
        this.setAutocompleteStatus({justApplied: true})
    }

    public applyCurrent() {
        if (this.selected < 0) {
            return
        }
        const choice: Prediction | undefined = (this.choices[this.selected] as any)
        if (choice) {
            this.apply(choice)
        }
    }

    public isVisible(): boolean {
        return !this.elem.hidden
    }

    public move(diff: number) {
        if (!this.items.length) {
            return
        }
        if (this.selected < 0) {
            this.selected = 0
        } else {
            this.items[this.selected].classList.remove('selected')
            this.selected = (this.selected + diff + this.items.length) % this.items.length
        }
        this.items[this.selected].classList.add('selected')
    }

    public hide = (hide: boolean) => {
        this.elem.hidden = hide
    }

    public cursorWatcher() {
        if (this.currentLine == null) {
            return
        }

        if (this.currentLine.number != projectManager.codeEditor.getCurrentLine().number) {
            this.setAutocompleteStatus({hide: true})
            this.hide(true)
            this.selected = -1
        }
    }

    public changeWatcher() {
        this.selected = -1
    }

    public forceStop() {
        this.setAutocompleteStatus({hide: true, trigger: false})
    }

    public destroy() {
        this.forceStop()
    }

    public get isSelected(): boolean {
        return this.selected >= 0
    }

    private setAutocompleteStatus(patch: Partial<AutoCompleteStatus>) {
        Object.assign(this.autoCompleteStatus, patch)
    }

    public set triggerAutoCompletion(e: KeyboardEvent) {
        this.isCtrlSpace = false

        // don't trigger autocomplete on Ctrl+Tab (tab switching)
        if (e.ctrlKey && e.key === 'Tab') {
            this.setAutocompleteStatus({hide: true, trigger: false})
            return
        }

        if (MODIFIER_KEYS.has(e.key)) {
            this.setAutocompleteStatus({trigger: false})
            return
        }
        const isEnter = e.key === 'Enter'
        if (isEnter && this.autoCompleteStatus.justApplied) {
            this.setAutocompleteStatus({hide: true, trigger: false, justApplied: false})
            return
        }
        this.setAutocompleteStatus({justApplied: false})

        if (!projectManager.codeEditor.getEditorView().hasFocus) {
            this.setAutocompleteStatus({hide: true, trigger: false})
            return
        }
        if (PASSIVE_KEYS.has(e.key)) {
            this.setAutocompleteStatus({hide: true, trigger: false})
            return
        }
        if (EDITING_KEYS.has(e.key)) {
            const isWindowVisible = this.isVisible()
            this.setAutocompleteStatus({hide: !isWindowVisible, trigger: isWindowVisible})
            return
        }
        const isArrowUpDownKey = e.key === 'ArrowDown' || e.key === 'ArrowUp'
        if (isArrowUpDownKey && !this.isVisible()) {
            this.setAutocompleteStatus({hide: true, trigger: false})
            return
        }
        if (isArrowUpDownKey) {
            this.setAutocompleteStatus({hide: false, trigger: false})
            return
        }
        const isArrowSideKey = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
        if (isArrowSideKey) {
            this.setAutocompleteStatus({trigger: this.isVisible()})
            return
        }

        const isPrintableChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
        const isSpace = e.key === ' ' || e.code === 'Space'
        this.isCtrlSpace = e.ctrlKey && e.code === 'Space'
        const isTab = e.key === 'Tab' || e.code === 'Tab'
        const shouldTrigger = isPrintableChar || isSpace || isEnter || this.isCtrlSpace || isTab

        this.setAutocompleteStatus({trigger: shouldTrigger, hide: !shouldTrigger})
    }
}