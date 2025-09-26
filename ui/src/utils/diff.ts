import {diffLines} from "diff"
import {Queue} from "./queue"

const DiffMatchPatch = require('diff-match-patch')

export type DiffLineSegment = { aIndex: number, bIndex: number, line: string }

export interface CodeBlock {
    type: string
    langs: string[]
    blocks: string[]
    sudoLine?: number
}

export interface Block {
    index: number
    lang: string
    lines: string[]
}

function diffWithMatches(oldLines: string[], newLines: string[], matches: number[][]) {
    const lines: DiffLineSegment[] = []

    let i = 0   // cursor in oldLines (equivalent to i in Python)
    let j = 0   // cursor in newLines (equivalent to j in Python)
    let m = 0   // cursor in matches (equivalent to m in Python)

    while (m < matches.length) {
        const [mi, mj] = matches[m]

        // case 1: Exact match - both indices align with current positions
        if (mi === i && mj === j) {
            // check if this is the sentinel match at the end
            if (m === matches.length - 1) {
                break
            }

            // check if the lines are actually identical
            if (oldLines[i] === newLines[j]) {
                // lines are identical, add as a match
                lines.push({line: oldLines[i], aIndex: i, bIndex: j})
            } else {
                // lines are different, treat as deletion + addition
                lines.push({line: oldLines[i], aIndex: i, bIndex: -1})
                lines.push({line: newLines[j], aIndex: -1, bIndex: j})
            }
            i++
            j++
            m++
        }
        // case 2: Insertion in newLines - match is at current oldLines position
        // but at a future newLines position
        else if (mi === i && mj > j) {
            // add lines from newLines until we reach the match position
            lines.push({line: newLines[j], aIndex: -1, bIndex: j})
            j++
        }
        // case 3: Deletion from oldLines - match is at a future oldLines position
        else if (mi > i) {
            // Add lines from oldLines until we reach the match position
            lines.push({line: oldLines[i], aIndex: i, bIndex: -1})
            i++
        }
        // this shouldn't happen with valid matches
        else {
            throw new Error(`Invalid match state: i=${i}, j=${j}, mi=${mi}, mj=${mj}`)
        }
    }

    return {lines}
}


function diffWithJsDiff(oldLines: string[], newLines: string[]) {
    // jsdiff works on *strings*.  Join arrays, keep each newline as a token.
    const diffParts = diffLines(
        oldLines.join("\n") + "\n",
        newLines.join("\n") + "\n"
        // { newlineIsToken: true }
    )

    const lines: DiffLineSegment[] = []

    // running indices for the original (a) and new (b) sides
    let aPtr = 0
    let bPtr = 0

    for (const part of diffParts) {
        // split the chunk back into individual lines
        const partLines = part.value.split("\n")

        // if the chunk ended with a newline we’ll have a trailing "", so
        // drop it – but only when there is at least one real line before it.
        if (partLines[partLines.length - 1] === "") {
            partLines.pop()
        }

        for (const line of partLines) {
            if (part.added) {
                lines.push({line, aIndex: -1, bIndex: bPtr++})
            } else if (part.removed) {
                lines.push({line, aIndex: aPtr++, bIndex: -1})
            } else {
                lines.push({line, aIndex: aPtr++, bIndex: bPtr++})
            }
        }
    }

    return {lines: lines}   //  ↩︎ same shape the rest of the code expects
}


export function getDiff(oldLines: string[], newLines: string[], matches: number[][]) {
    if (matches && matches.length) {
        console.log(`using diffWithMatches of size ${matches.length}`)
        return diffWithMatches(oldLines, newLines, matches)
    }

    console.log(`not using diffWithMatches of size ${matches.length}`)

    return diffWithJsDiff(oldLines, newLines)
}

export function getDiffBlocks(codeOne: Block, codeTwo: Block, diffMatches: number[][], ignoreWhitespace: boolean = false): CodeBlock[] {
    let res: CodeBlock[] = []
    let langs = [codeOne.lang, codeTwo.lang]

    let lineQueue = new Queue<CodeBlock>()
    for (let diffLine of getDiff(codeOne.lines, codeTwo.lines, diffMatches).lines) {
        if (diffLine.aIndex >= 0 && diffLine.bIndex === -1) {
            lineQueue.enqueue({type: 'diff', blocks: [diffLine.line, null], langs: langs})
            continue
        }

        if (diffLine.aIndex === -1 && diffLine.bIndex >= 0) {
            if (!lineQueue.isEmpty()) {
                let l = lineQueue.dequeue()
                l.blocks[1] = diffLine.line
                res.push(l)
            } else {
                res.push({type: 'diff', blocks: ['\n', diffLine.line], langs: langs, sudoLine: 0})
            }
            continue
        }

        if (diffLine.aIndex >= 0 && diffLine.bIndex >= 0) {
            while (!lineQueue.isEmpty()) {
                let l = lineQueue.dequeue()
                l.blocks[1] = '\n'
                l.sudoLine = 1
                res.push(l)
            }
            res.push({type: 'similar', blocks: [diffLine.line, diffLine.line], langs: langs})
        }
    }

    while (!lineQueue.isEmpty()) {
        let l = lineQueue.dequeue()
        l.blocks[1] = '\n'
        res.push(l)
    }

    if (!ignoreWhitespace) {
        return res
    }

    for (let block of res) {
        if (block.sudoLine != undefined) {
            continue
        }
        if (block.type != 'diff') {
            continue
        }

        const normalizedLine1 = block.blocks[0]?.replace(/\s+/g, ' ').trim() || ''
        const normalizedLine2 = block.blocks[1]?.replace(/\s+/g, ' ').trim() || ''

        if (normalizedLine1 === normalizedLine2) {
            block.type = 'similar'
        }
    }


    return res
}

function decodeHtmlEntities(str: string): string {
    if (!str) {
        return str
    }
    
    return str
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
}

// https://github.com/google/diff-match-patch
export function getLineDiff(line1: string, line2: string) {
    let resLine1: string[] = []
    let resLine2: string[] = []

    let dl = new DiffLine()

    let dmp = new DiffMatchPatch()

    const decodedLine1 = decodeHtmlEntities(line1)
    const decodedLine2 = decodeHtmlEntities(line2)

    let line1Cleaned = dl.getCleanedText(decodedLine1)
    let line2Cleaned = dl.getCleanedText(decodedLine2)

    const diffElems = dmp.diff_main(line1Cleaned, line2Cleaned)

    dmp.diff_cleanupSemantic(diffElems)

    for (let diffElem of diffElems) {
        if (diffElem[0] === 1) {
            resLine2.push(getElemToAdd(diffElem[1], 'addition', dl))
        } else if (diffElem[0] == -1) {
            resLine1.push(getElemToAdd(diffElem[1], 'subtraction', dl))
        } else {
            let elem = `${diffElem[1]}`

            resLine1.push(elem)
            resLine2.push(elem)
        }
    }

    return [dl.mapBackToOriginal(resLine1.join('')), dl.mapBackToOriginal(resLine2.join(''))]
}

function getElemToAdd(elem: string, cls: string, dl: DiffLine) {
    let res: string[] = []
    let hasTagInserted: boolean = false
    for (let i = 0; i < elem.length; i++) {
        let isReplacement = dl.replacements.has(elem[i])

        if (isReplacement && hasTagInserted) {
            res.push('</diff-span>')
            hasTagInserted = false
        }

        if (!isReplacement && !hasTagInserted) {
            res.push(`<diff-span class="${cls}">`)
            hasTagInserted = true
        }

        res.push(elem[i])
    }

    if (hasTagInserted) {
        res.push('</diff-span>')
    }

    return res.join('')
}

class DiffLine {
    private rareUnicodeChars: string[] = [
        "\u029F", "\u02A0", "\u02A1", "\u02A2", "\u02A3", "\u02A4", "\u02A5", "\u02A6",
        "\u02A7", "\u02A8", "\u02A9", "\u02AA", "\u02AB", "\u02AC", "\u02AD", "\u02AE",
        "\u02AF", "\u02B0", "\u02B1", "\u02B2", "\u02B3", "\u02B4", "\u02B5", "\u02B6",
        "\u02B7", "\u02B8", "\u02B9", "\u02BA", "\u02BB", "\u02BC", "\u02BD", "\u02BE",
        "\u02BF", "\u02C0", "\u02C1", "\u02C2", "\u02C3", "\u02C4", "\u02C5", "\u02C6",
        "\u02C7", "\u02C8", "\u02C9", "\u02CA", "\u02CB", "\u02CC", "\u02CD", "\u02CE",
        "\u02CF", "\u02D0", "\u02D1", "\u02D2", "\u02D3", "\u02D4", "\u02D5", "\u02D6",
        "\u02D7", "\u02D8", "\u02D9", "\u02DA", "\u02DB", "\u02DC", "\u02DD", "\u02DE",
        "\u02DF", "\u02E0", "\u02E1", "\u02E2", "\u02E3", "\u02E4", "\u02E5", "\u02E6",
        "\u02E7", "\u02E8", "\u02E9", "\u02EA", "\u02EB", "\u02EC", "\u02ED", "\u02EE",
        "\u02EF", "\u02F0", "\u02F1", "\u02F2", "\u02F3", "\u02F4", "\u02F5", "\u02F6",
        "\u02F7", "\u02F8", "\u02F9", "\u02FA", "\u02FB", "\u02FC", "\u02FD", "\u02FE",
        "\u02FF"
    ];
    private readonly tagReplacements: { [key: string]: string }
    public readonly replacements: Set<string>

    constructor() {
        this.tagReplacements = {}
        this.replacements = new Set<string>()
    }

    public getCleanedText(inputString: string) {
        const tagRegex = /<[^>]+>/g;

        return inputString.replace(tagRegex, (match) => {
            if (!this.tagReplacements[match]) {
                this.tagReplacements[match] = this.rareUnicodeChars.shift() || ""
            }
            this.replacements.add(this.tagReplacements[match])
            return this.tagReplacements[match]
        })
    }

    public mapBackToOriginal(replacedString: string): string {
        let originalString = replacedString
        for (const [tag, replacement] of Object.entries(this.tagReplacements)) {
            originalString = originalString.replace(new RegExp(replacement, 'g'), tag)
        }
        return originalString
    }
}

class DiffSpan extends HTMLElement {
    constructor() {
        super()
    }
}

customElements.define("diff-span", DiffSpan)