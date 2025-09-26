import * as path from "path"
import {File} from "../models/file"
import {WeyaElementFunction} from "../../../lib/weya/weya"

export function stripTopDirectory(p: string): string {
    const parts = p.split(path.posix.sep).filter(Boolean)

    if (parts.length <= 1) {
        return ""
    }

    // remove only the first directory, keep the rest
    const pathWithoutTop = parts.slice(1).join(path.posix.sep)

    // remove the filename (last part) to get just the directory path
    const pathParts = pathWithoutTop.split(path.posix.sep)
    if (pathParts.length <= 1) {
        return ""
    }

    return pathParts.slice(0, -1).join(path.posix.sep)
}

export function matchFile(file: File, query: string): {
    score: number,
    fileNameMatches: number[],
    pathMatches: number[]
} | null {
    const fileName = file.fileName.toLowerCase()
    const fullPath = file.path.toLowerCase()
    const pathWithoutTop = stripTopDirectory(file.path).toLowerCase()

    let score = 0
    let fileNameMatches: number[] = []
    let pathMatches: number[] = []

    // check for exact filename match first (highest priority)
    if (fileName === query) {
        score += 1000
        fileNameMatches = getAllMatches(fileName, query)
    }
    // check if filename starts with query (high priority)
    else if (fileName.startsWith(query)) {
        score += 800
        fileNameMatches = getAllMatches(fileName, query)
    }
    // check for fuzzy match in filename (medium-high priority)
    else {
        const fuzzyMatchItem = fuzzyMatch(fileName, query)
        if (fuzzyMatchItem.matched) {
            score += 400 + fuzzyMatchItem.score
            fileNameMatches = fuzzyMatchItem.matches
        }
    }

    // check for matches in path (lower priority)
    const pathFuzzyMatch = fuzzyMatch(pathWithoutTop, query)
    if (pathFuzzyMatch.matched) {
        score += 200 + pathFuzzyMatch.score
        pathMatches = pathFuzzyMatch.matches
    }

    // check for matches in full path
    const fullPathFuzzyMatch = fuzzyMatch(fullPath, query)
    if (fullPathFuzzyMatch.matched) {
        score += 100 + fullPathFuzzyMatch.score
        // don't override pathMatches if we already have them
        if (pathMatches.length === 0) {
            pathMatches = fullPathFuzzyMatch.matches
        }
    }

    if (score > 0) {
        return {score, fileNameMatches, pathMatches}
    }

    return null
}

export function fuzzyMatch(text: string, query: string): { matched: boolean, score: number, matches: number[] } {
    const matches: number[] = []
    let textIndex = 0
    let queryIndex = 0
    let score = 0

    while (textIndex < text.length && queryIndex < query.length) {
        if (text[textIndex] === query[queryIndex]) {
            matches.push(textIndex)
            queryIndex++

            // consecutive matches get higher score
            if (matches.length > 1 && matches[matches.length - 1] === matches[matches.length - 2] + 1) {
                score += 5
            } else {
                score += 1
            }
        }
        textIndex++
    }

    const matched = queryIndex === query.length

    if (matched) {
        // bonus for matches at word boundaries
        matches.forEach(index => {
            if (index === 0 || text[index - 1] === '/' || text[index - 1] === '_' || text[index - 1] === '-') {
                score += 10
            }
        })
    }

    return {matched, score, matches}
}

export function getAllMatches(text: string, query: string): number[] {
    const matches: number[] = []
    let startIndex = 0

    while (startIndex < text.length) {
        const index = text.indexOf(query, startIndex)
        if (index === -1) break

        for (let i = 0; i < query.length; i++) {
            matches.push(index + i)
        }

        startIndex = index + 1
    }

    return matches
}

export function renderHighlightedText($: WeyaElementFunction, text: string, matches: number[]): void {
    if (matches.length === 0) {
        $('span', text)
        return
    }

    let lastIndex = 0
    const matchSet = new Set(matches)

    for (let i = 0; i < text.length; i++) {
        if (matchSet.has(i)) {
            // add any text before this match
            if (i > lastIndex) {
                const elem = $('span')
                elem.textContent = text.substring(lastIndex, i)
            }

            // find the end of consecutive matches
            let endIndex = i
            while (endIndex < text.length && matchSet.has(endIndex)) {
                endIndex++
            }

            // add highlighted text
            const elem = $('span', '.highlight')
            elem.textContent = text.substring(i, endIndex)

            i = endIndex - 1 // -1 because loop will increment
            lastIndex = endIndex
        }
    }

    // add any remaining text
    if (lastIndex < text.length) {
        const elem = $('span')
        elem.textContent = text.substring(lastIndex)
    }
}