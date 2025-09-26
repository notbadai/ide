import {EditorView} from '@codemirror/view'
import {setGhostText} from './ghost_text_decorator'
import {isPositionVisible} from "../../../utils/editor"

export class InlineCompletionWidget {
    private currentCompletion: string | null = null

    constructor(private editorView: EditorView) {
    }

    public triggerCompletion(text: string, from?: number) {
        const pos = this.editorView.state.selection.main.head
        const completionFrom = from ?? pos

        this.currentCompletion = text

        // check if the position is actually visible on screen
        const isInViewport = isPositionVisible(completionFrom)

        if (!isInViewport) {
            // scroll to the position first, then show ghost text
            this.editorView.dispatch({
                effects: [
                    EditorView.scrollIntoView(completionFrom, {
                        y: 'center',
                        yMargin: this.editorView.defaultLineHeight * 2
                    }),
                    setGhostText.of({
                        text: text,
                        from: completionFrom
                    })
                ]
            })
        } else {
            // position is already visible, just show ghost text
            this.editorView.dispatch({
                effects: setGhostText.of({
                    text: text,
                    from: completionFrom
                })
            })
        }

        this.editorView.focus()
    }

    public acceptCompletion() {
        if (this.currentCompletion == null) {
            return
        }

        const pos = this.editorView.state.selection.main.head
        const completionLength = this.currentCompletion.length

        this.editorView.dispatch({
            changes: {
                from: pos,
                to: pos,
                insert: this.currentCompletion
            },
            selection: {anchor: pos + completionLength}, // move cursor to end of completion
            effects: setGhostText.of({text: '', from: 0})
        })
        this.currentCompletion = null
    }

    public dismissCompletion() {
        this.editorView.dispatch({
            effects: setGhostText.of({text: '', from: 0})
        })
        this.currentCompletion = null
    }

    public hasCompletion(): boolean {
        return this.currentCompletion !== null
    }
}