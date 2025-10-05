import {Decoration, DecorationSet, EditorView, hoverTooltip} from "@codemirror/view"
import {RangeSetBuilder, StateEffect, StateField} from "@codemirror/state"
import {InspectResult} from "../../../models/extension"


export const inspectUnderline = Decoration.mark({class: 'cm-error-underline'})

export const setInspect = StateEffect.define<DecorationSet>()

export const inspectField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none
    },
    update(value, tr) {
        value = value.map(tr.changes)

        if (tr.docChanged) {
            const changedLines = new Set<number>()
            tr.changes.iterChanges((fromA: number, toA: number) => {
                const start = tr.startState.doc.lineAt(fromA).number
                const end = tr.startState.doc.lineAt(Math.max(fromA, toA - 1)).number
                for (let ln = start; ln <= end; ln++) {
                    changedLines.add(ln)
                }
            })

            if (changedLines.size) {
                const builder = new RangeSetBuilder<Decoration>()
                value.between(0, tr.state.doc.length, (from, to, deco) => {
                    const ln = tr.state.doc.lineAt(from).number
                    if (!changedLines.has(ln)) {// keep marks on untouched lines
                        builder.add(from, to, deco)
                    }
                })
                value = builder.finish()
            }
        }

        for (const ef of tr.effects) {
            if (ef.is(setInspect)) {
                return ef.value
            }
        }
        return value
    },
    provide: f => EditorView.decorations.from(f)
})

export const setInspectInfo = StateEffect.define<readonly InspectResult[]>()

export const inspectInfoField = StateField.define<readonly InspectResult[]>({
    create() {
        return []
    },
    update(value, tr) {
        /* drop only entries whose lines were touched */
        if (tr.docChanged) {
            const changedLines = new Set<number>()
            tr.changes.iterChanges((fromA, toA) => {
                const start = tr.startState.doc.lineAt(fromA).number
                const end = tr.startState.doc.lineAt(Math.max(fromA, toA - 1)).number
                for (let ln = start; ln <= end; ln++) {
                    changedLines.add(ln)
                }
            })
            value = value.filter(e => !changedLines.has(e.row_from))
        }

        /* replace with new list from the server, if any */
        for (const ef of tr.effects) {
            if (ef.is(setInspectInfo)) {
                return ef.value
            }
        }
        return value
    }
})

export const inspectTooltip = hoverTooltip((view, pos) => {
    const info: readonly InspectResult[] = view.state.field(inspectInfoField)
    if (!info.length) {
        return null
    }
    const lineNo = view.state.doc.lineAt(pos).number
    const err = info.find(e => e.row_from === lineNo)
    if (!err) {
        return null
    }
    const line = view.state.doc.line(lineNo)

    return {
        pos: line.from,
        end: line.to,
        create() {
            const dom = document.createElement('div')
            dom.textContent = err.description
            dom.className = 'cm-error-tooltip'
            return {dom}
        }
    }
})

