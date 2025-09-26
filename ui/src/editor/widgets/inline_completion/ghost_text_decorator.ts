import {Decoration, DecorationSet, EditorView, WidgetType} from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'

export const setGhostText = StateEffect.define<{text: string, from: number}>()

export const ghostTextField = StateField.define<DecorationSet>({
    create() { return Decoration.none },
    update(decorations, tr) {
        decorations = decorations.map(tr.changes)
        for (let effect of tr.effects) {
            if (effect.is(setGhostText)) {
                // create gray text decoration
                const ghostDecoration = Decoration.widget({
                    widget: new GhostTextWidget(effect.value.text),
                    side: 1
                }).range(effect.value.from)
                decorations = Decoration.set([ghostDecoration])
            }
        }
        return decorations
    },
    provide: f => EditorView.decorations.from(f)
})

class GhostTextWidget extends WidgetType {
    constructor(private text: string) { super() }
    
    toDOM() {
        const span = document.createElement('span')
        span.className = 'cm-ghost-text'
        span.textContent = this.text
        return span
    }
}