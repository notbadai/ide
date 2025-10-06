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
            const changedRanges: { from: number, to: number }[] = []

            tr.changes.iterChanges((fromA: number, toA: number) => {
                const start = tr.startState.doc.lineAt(fromA).number
                const end = tr.startState.doc.lineAt(Math.max(fromA, toA - 1)).number
                for (let ln = start; ln <= end; ln++) {
                    changedLines.add(ln)
                }
                changedRanges.push({from: fromA, to: toA})
            })

            if (changedLines.size) {
                const builder = new RangeSetBuilder<Decoration>()
                value.between(0, tr.state.doc.length, (from, to, deco) => {
                    // check if this decoration intersects with any changed range
                    const intersects = changedRanges.some(range =>
                        !(to <= range.from || from >= range.to)
                    )
                    if (!intersects) {
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

    // find the error that contains this position
    const err = info.find(e => {
        const lineNo = view.state.doc.lineAt(pos).number

        // check if position is within the line range
        if (e.row_to != null) {
            if (lineNo < e.row_from || lineNo > e.row_to) {
                return false
            }
            // if on the exact line and column info exists, check column range
            if (lineNo === e.row_from && e.column_from != null) {
                const lineObj = view.state.doc.line(lineNo)
                const col = pos - lineObj.from + 1
                if (col < e.column_from) return false
            }
            if (lineNo === e.row_to && e.column_to != null) {
                const lineObj = view.state.doc.line(lineNo)
                const col = pos - lineObj.from + 1
                if (col > e.column_to) return false
            }
            return true
        } else {
            // single line case
            return lineNo === e.row_from
        }
    })

    if (!err) {
        return null
    }

    // calculate the precise range for the tooltip
    const fromLine = view.state.doc.line(err.row_from)
    const toLine = err.row_to != null ? view.state.doc.line(err.row_to) : fromLine

    const fromPos = err.column_from != null
        ? fromLine.from + err.column_from - 1
        : fromLine.from
    const toPos = err.column_to != null
        ? toLine.from + err.column_to - 1
        : toLine.to

    return {
        pos: fromPos,
        end: toPos,
        create() {
            const dom = document.createElement('div')
            dom.textContent = err.description
            dom.className = 'cm-error-tooltip'
            return {dom}
        }
    }
})
