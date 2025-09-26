import {WeyaElementFunction, Weya as $} from "../../../lib/weya/weya"
import {getHighlightedCode} from "../utils/highlightjs"
import {getDiffBlocks, getLineDiff} from "../utils/diff"
import {BasicButton} from "./buttons"
import {projectManager} from "../managers/project/manager"
import {DiffBlockCollection, DiffViewBlock} from "../utils/diff_view_block"
import {clearChildElements} from "../utils/document"

const MIN_COLLAPSE_LINES = 3
const MIN_AUTO_COLLAPSE_LINES = 5
const CONTEXT_LINES = 2
const IGNORE_WHITESPACE = false

interface CollapsedSection {
    startIndex: number
    endIndex: number
    lineCount: number
    isExpanded: boolean
}

export interface DiffViewOptions {
    proposedCode: string
    originalCode: string
    language: string
    filePath?: string
    onReplaceSelection: (text: string) => void
    onRejectSelection: () => void
    diffMatches: number[][]
}


export class DiffView {
    private elem: HTMLDivElement
    private diffContainerElem: HTMLDivElement
    private blockContainerElem: HTMLDivElement
    private collapsedElements: Map<number, HTMLDivElement> = new Map()

    private diffBlockCollection: DiffBlockCollection
    private collapsedSections: CollapsedSection[] = []

    private readonly applyButton: BasicButton
    private readonly rejectButton: BasicButton
    private readonly onReplaceSelection: (text: string) => void
    private readonly onRejectSelection: () => void
    private readonly diffMatches: number[][]
    private readonly filePath?: string

    private readonly minCollapseLines: number
    private readonly minAutoCollapseLines: number
    private readonly contextLines: number
    private readonly ignoreWhitespace: boolean

    constructor(opt: DiffViewOptions) {
        this.onReplaceSelection = opt.onReplaceSelection
        this.onRejectSelection = opt.onRejectSelection
        this.diffMatches = opt.diffMatches
        this.filePath = opt.filePath

        this.ignoreWhitespace = projectManager.project?.extensions?.diff?.ignore_whitespace ?? IGNORE_WHITESPACE
        this.minCollapseLines = projectManager.project?.extensions?.diff?.min_collapse_lines ?? MIN_COLLAPSE_LINES
        this.minAutoCollapseLines = projectManager.project?.extensions?.diff?.min_auto_collapse_lines ?? MIN_AUTO_COLLAPSE_LINES
        this.contextLines = projectManager.project?.extensions?.diff?.context_lines ?? CONTEXT_LINES

        let originalBlock = {index: 1, lang: opt.language, lines: opt.originalCode.split("\n")}
        let proposedBlock = {index: 0, lang: opt.language, lines: opt.proposedCode.split("\n")}

        const codeBlocks = getDiffBlocks(originalBlock, proposedBlock, this.diffMatches, this.ignoreWhitespace)
        this.diffBlockCollection = new DiffBlockCollection(codeBlocks)

        this.applyButton = new BasicButton({text: "Apply", background: true, onButtonClick: this.onApply.bind(this)})
        this.rejectButton = new BasicButton({
            text: "Reject",
            background: false,
            onButtonClick: this.onReject.bind(this)
        })
    }

    private identifyCollapsibleSections() {
        let currentSimilarStart = -1
        let similarCount = 0

        this.diffBlockCollection.blocks.forEach((block: DiffViewBlock, index: number) => {
            if (block.type === 'similar' && block.sudoLine !== 1) {
                if (currentSimilarStart === -1) {
                    currentSimilarStart = index
                }
                similarCount++
            } else {
                if (similarCount >= this.minCollapseLines) {
                    // calculate context-aware boundaries
                    const sectionStart = currentSimilarStart
                    const sectionEnd = currentSimilarStart + similarCount - 1

                    // find the actual collapsible range, excluding context lines
                    const adjustedStart = this.getAdjustedSectionStart(sectionStart)
                    const adjustedEnd = this.getAdjustedSectionEnd(sectionEnd)

                    // only create collapsible section if there's enough content after context exclusion
                    if (adjustedEnd - adjustedStart + 1 >= this.minCollapseLines) {
                        this.collapsedSections.push({
                            startIndex: adjustedStart,
                            endIndex: adjustedEnd,
                            lineCount: adjustedEnd - adjustedStart + 1,
                            isExpanded: (adjustedEnd - adjustedStart + 1) < this.minAutoCollapseLines
                        })
                    }
                }
                currentSimilarStart = -1
                similarCount = 0
            }
        })

        // handle case where file ends with similar lines
        if (similarCount >= this.minCollapseLines) {
            const sectionStart = currentSimilarStart
            const sectionEnd = currentSimilarStart + similarCount - 1

            const adjustedStart = this.getAdjustedSectionStart(sectionStart)
            const adjustedEnd = this.getAdjustedSectionEnd(sectionEnd)

            if (adjustedEnd - adjustedStart + 1 >= this.minCollapseLines) {
                this.collapsedSections.push({
                    startIndex: adjustedStart,
                    endIndex: adjustedEnd,
                    lineCount: adjustedEnd - adjustedStart + 1,
                    isExpanded: (adjustedEnd - adjustedStart + 1) < this.minAutoCollapseLines
                })
            }
        }
    }

    private getAdjustedSectionStart(originalStart: number): number {
        // look backwards for diff lines within context distance
        for (let i = Math.max(0, originalStart - this.contextLines); i < originalStart; i++) {
            if (this.diffBlockCollection.blocks[i]?.type === 'diff') {
                // found a diff line nearby, preserve context after it
                return Math.min(originalStart + this.contextLines, this.diffBlockCollection.blocks.length - 1)
            }
        }
        return originalStart
    }

    private getAdjustedSectionEnd(originalEnd: number): number {
        // look forwards for diff lines within context distance
        for (let i = originalEnd + 1; i <= Math.min(this.diffBlockCollection.blocks.length - 1, originalEnd + this.contextLines); i++) {
            if (this.diffBlockCollection.blocks[i]?.type === 'diff') {
                // found a diff line nearby, preserve context before it
                return Math.max(originalEnd - this.contextLines, 0)
            }
        }
        return originalEnd
    }

    private isBlockCollapsed(index: number): CollapsedSection | null {
        for (const section of this.collapsedSections) {
            if (index >= section.startIndex && index <= section.endIndex) {
                return section
            }
        }
        return null
    }

    private toggleSection(section: CollapsedSection) {
        section.isExpanded = !section.isExpanded
        this.updateCollapsedSectionVisibility(section)
    }

    private updateAllCounters() {
        // track separate counters for left (line0) and right (line1) sides
        let leftLineCount = 0
        let rightLineCount = 0

        for (let i = 0; i < this.diffBlockCollection.blocks.length; i++) {
            const blockElement = this.blockContainerElem.querySelector(`[data-block-index="${i}"]`) as HTMLElement
            if (!blockElement) {
                continue
            }

            const isVisible = blockElement.style.display !== 'none'
            const diffBlock = this.diffBlockCollection.blocks[i]

            // only increment counters for non-sudo lines
            if (diffBlock.sudoLine !== 0) {
                // right side is not a sudo line, increment right counter
                leftLineCount++
            }
            if (diffBlock.sudoLine !== 1) {
                // left side is not a sudo line, increment left counter
                rightLineCount++
            }

            if (isVisible) {
                // set counter-reset with separate values for left and right
                blockElement.style.counterReset = `line0 ${leftLineCount - 1} line1 ${rightLineCount - 1}`
            }
        }
    }

    private updateCollapsedSectionVisibility(section: CollapsedSection) {
        for (let i = section.startIndex; i <= section.endIndex; i++) {
            const blockElement = this.blockContainerElem.querySelector(`[data-block-index="${i}"]`) as HTMLElement
            if (blockElement) {
                if (section.isExpanded) {
                    blockElement.style.display = 'table'
                    // clear any manual counter reset
                    blockElement.style.counterReset = ''
                } else {
                    blockElement.style.display = 'none'
                }
            }
        }

        // update all counters after visibility change
        this.updateAllCounters()

        const collapseElement = this.collapsedElements.get(section.startIndex)
        if (collapseElement) {
            const button = collapseElement.querySelector('button')
            const icon = collapseElement.querySelector('i')
            if (button && icon) {
                button.textContent = section.isExpanded
                    ? `Hide ${section.lineCount} unchanged lines`
                    : `Show ${section.lineCount} unchanged lines`
                button.appendChild(icon)
                icon.className = section.isExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'
            }
        }
    }

    private renderBlocks() {
        clearChildElements(this.diffContainerElem)

        // clear existing state
        this.collapsedElements.clear()
        this.collapsedSections = []

        $(this.diffContainerElem, $ => {
            $('div', '.blocks', $ => {
                let currLineNo = 0
                this.identifyCollapsibleSections()

                this.blockContainerElem = $('div', '.code-block', $ => {
                    let index = 0
                    let lastCollapsedSection: CollapsedSection | null = null

                    for (let diffBlock of this.diffBlockCollection.blocks) {
                        let codeClass = '.hljs'
                        if (index === 0) {
                            codeClass += '.top'
                        } else if (index === this.diffBlockCollection.blocks.length - 1) {
                            codeClass += '.bottom'
                        }

                        const collapsedSection = this.isBlockCollapsed(index)

                        // add collapse/expand button at the start of a collapsed section
                        if (collapsedSection && collapsedSection !== lastCollapsedSection) {
                            const collapseElem = $('div', '.collapsed-section-toggle', $ => {
                                const button = $('button', '.expand-collapse-btn', $ => {
                                    $('span', collapsedSection.isExpanded
                                        ? `Hide ${collapsedSection.lineCount} unchanged lines`
                                        : `Show ${collapsedSection.lineCount} unchanged lines`)
                                    $('i', collapsedSection.isExpanded
                                        ? '.fas.fa-chevron-up'
                                        : '.fas.fa-chevron-down')
                                })
                                button.addEventListener('click', () => this.toggleSection(collapsedSection))
                            })
                            this.collapsedElements.set(collapsedSection.startIndex, collapseElem)
                            lastCollapsedSection = collapsedSection
                        }

                        const blockElement = $('div', `.code-lines.hljs.${diffBlock.type}`, $ => {
                            let highlightedCode1 = getHighlightedCode(diffBlock.blocks[0], diffBlock.lang).html
                            let highlightedCode2 = getHighlightedCode(diffBlock.blocks[1], diffBlock.lang).html

                            let lines = []
                            if (diffBlock.type == 'diff') {
                                lines = getLineDiff(highlightedCode1, highlightedCode2)
                            } else {
                                lines = [highlightedCode1, highlightedCode2]
                            }

                            for (let i = 0; i < lines.length; i++) {
                                let lineClass = diffBlock.sudoLine == i ? '.sudo-line' : `.line-${i}`
                                $('div', `.code-line${lineClass}-bg`, $ => {
                                    $('code', `${codeClass}`, $ => {
                                        let elem = $('span', lineClass)
                                        elem.innerHTML = lines[i]
                                    })

                                    if (diffBlock.type === 'diff' && i === 0) {
                                        const replaceButton = $('button', '.diff-replace-btn', $ => {
                                            $('i', '.fas.fa-arrow-right')
                                        })
                                        replaceButton.onclick = () => {
                                            this.onReplaceLineClick(diffBlock.index)
                                        }
                                    }
                                })
                            }
                        })

                        // set data attribute for scrolling
                        blockElement.setAttribute('data-block-index', index.toString())

                        // hide collapsed blocks initially
                        if (collapsedSection && !collapsedSection.isExpanded) {
                            blockElement.style.display = 'none'
                        }

                        index++
                    }
                })
            })
        })

        // after all blocks are rendered, fix the initial counter values
        this.updateAllCounters()
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.diff-view', $ => {
            if (this.filePath != null) {
                $('div', '.code-block-header', $ => {
                    $('div', '.file-info', $ => {
                        $('i', '.fas.fa-file')
                        $('span', '.file-path', this.filePath)
                    })
                })
            }

            this.diffContainerElem = $('div', '.diff-content')
            $('div', '.buttons', $ => {
                this.applyButton.render($)
                this.rejectButton.render($)
            })
        })

        this.renderBlocks()

        return this.elem
    }

    private onReplaceLineClick(index: number) {
        // save current view state before re-rendering
        const currentScrollTop = this.blockContainerElem.scrollTop
        const currentCollapsedStates = this.collapsedSections.map(section => ({
            ...section,
            isExpanded: section.isExpanded
        }))

        // apply the line reversion
        this.diffBlockCollection.revertLine(index)

        // re-render the blocks with the updated diff
        this.renderBlocks()

        // restore the view state after re-rendering
        this.restoreViewState(currentScrollTop, currentCollapsedStates)
    }

    private restoreViewState(scrollTop: number, collapsedStates: CollapsedSection[]) {
        // restore collapsed section states
        this.collapsedSections.forEach((section, i) => {
            if (collapsedStates[i]) {
                section.isExpanded = collapsedStates[i].isExpanded
                this.updateCollapsedSectionVisibility(section)
            }
        })

        // restore scroll position
        requestAnimationFrame(() => {
            this.blockContainerElem.scrollTop = scrollTop
        })
    }

    private onReject() {
        this.onRejectSelection()
    }

    private onApply() {
        this.onReplaceSelection(this.diffBlockCollection.getProposedCode())
    }

    public remove() {
        this.elem.remove()
    }
}