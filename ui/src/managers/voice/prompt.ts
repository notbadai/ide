import {projectManager} from "../project/manager"
import {syntaxTree} from "@codemirror/language";
import {highlightTree, type Tag, tags as t} from "@lezer/highlight"
import {CodeEditor} from "../../editor/editor"

export function getIdentifiersInCurrentFile(): string[] {
    const currentFile = projectManager.codeEditor?.file
    const codeEditor = projectManager.codeEditor

    if (!currentFile || !codeEditor) {
        return []
    }

    const {keywords, identifiers} = extractKeywordsAndIdentifiers(codeEditor)
    return identifiers.map(id => id.replace(/_/g, '-'))
}

export function extractKeywordsAndIdentifiers(codeEditor: CodeEditor): {
    keywords: string[]
    identifiers: string[]
} {
    if (!codeEditor.getEditorView) {
        return null
    }

    const editorView = codeEditor.getEditorView()
    const state = editorView.state

    const tree = syntaxTree(state)
    const keywords = new Set<string>()
    const identifiers = new Set<string>()

    const highlighter = {
        style(tags: readonly Tag[]) {
            if (
                tags.includes(t.keyword) ||
                tags.includes(t.controlKeyword) ||
                tags.includes(t.definitionKeyword) ||
                tags.includes(t.modifier) ||
                tags.includes(t.operatorKeyword)
            ) return "kw"

            if (
                tags.includes(t.variableName) ||
                tags.includes(t.propertyName) ||
                tags.includes(t.function(t.variableName)) ||
                tags.includes(t.className) ||
                tags.includes(t.typeName)
            ) return "id"

            return null
        }
    };

    highlightTree(tree, highlighter, (from, to, cls) => {
        const text = state.doc.sliceString(from, to).trim()
        if (!text) {
            return
        }
        if (cls === "kw") {
            keywords.add(text)
        }
        if (cls === "id") {
            identifiers.add(text)
        }
    })

    return {
        keywords: Array.from(keywords),
        identifiers: Array.from(identifiers),
    }
}

export function convertToIdentifiers(text: string, identifiers: string[]): string {
    const voiceToCodeMap = new Map<string, string>()
    identifiers.forEach(identifier => {
        const voiceFriendly = identifier.replace(/-/g, '_')
        voiceToCodeMap.set(voiceFriendly, identifier)
    })

    let result = text
    // Fix: Use different parameter names to avoid clash
    voiceToCodeMap.forEach((voiceIdentifier, codeIdentifier) => {
        // use word boundaries to avoid partial replacements
        const regex = new RegExp(`\\b${voiceIdentifier.replace(/[-]/g, '\\-')}\\b`, 'gi')
        result = result.replace(regex, codeIdentifier)
    })

    return result
}