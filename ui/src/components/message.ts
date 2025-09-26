import {Weya as $, WeyaElement, WeyaElementFunction} from "../../../lib/weya/weya"

import {clearChildElements} from '../utils/document'
import {BasicButton} from "./buttons"
import {MessageHeader} from "./message_header"
import {getMarkDownParsed} from "../utils/markdown"
import {Loader} from "./loader"
import {CodeBlock} from "./code_block"
import {Input} from "./input"
import {CollapseBlock} from "./collapse_block"


interface MessageOptions {
    initText?: string
    role: string
    onSubmitClick?: (newInput: string) => void
}

export interface MessageBlock {
    type: string
    content: string
    lang: string
    path?: string
    index: number
    isCompleted?: boolean
}

export class Message {
    public texts: string[]
    public role: string
    private readonly onSubmitClick?: (newInput: string) => void

    private elem: WeyaElement
    private textElem: HTMLDivElement
    private editButtonsElem: HTMLDivElement
    private inputContainerElem: HTMLDivElement

    private messageHeader: MessageHeader
    private readonly editMessageButton: BasicButton
    private submitButton: BasicButton
    private cancelButton: BasicButton
    private messageLoder: Loader
    private input: Input

    private codeBlocks: CodeBlock[]
    private currBlocks: MessageBlock[]
    public isMessageLoading: boolean

    constructor(opt: MessageOptions) {
        this.texts = []
        this.role = opt.role

        this.onSubmitClick = opt.onSubmitClick

        if (opt.initText !== '') {
            this.texts.push(opt.initText)
        }

        this.messageLoder = new Loader('line')
        this.editMessageButton = new BasicButton({
            icon: '.fas.fa-pen.icon',
            onHoverEffect: true,
            onButtonClick: this.onEditMessage.bind(this)
        })
        this.submitButton = new BasicButton({
            text: 'Update',
            background: true,
            onButtonClick: this.onSubmit.bind(this)
        })
        this.cancelButton = new BasicButton({
            text: 'Cancel',
            onButtonClick: this.onCancel.bind(this)
        })
        this.input = new Input({onKeyDown: this.onKeyDown})

        this.codeBlocks = []
        this.currBlocks = []
        this.isMessageLoading = false
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div.message', $ => {
            $('div', $ => {
                this.messageHeader = new MessageHeader(this.role)
                this.messageHeader.render($)

                this.textElem = $('div', `.text.${this.role}`)

                this.inputContainerElem = $('div', '.input-container', $ => {
                    this.input.render($)
                })
                this.displayInput(false)
            })
            if (this.role == 'assistant') {
                $('div', '.flex-row', $ => {
                    $('div', '.message-loader', $ => {
                        this.messageLoder.render($)
                    })
                    this.messageLoder.hide(true)
                })
            } else {
                this.update()
                this.editButtonsElem = $('div', '.edit-buttons', $ => {
                    this.editMessageButton.render($)

                    $('div', '.submit', $ => {
                        this.submitButton.render($)
                        this.cancelButton.render($)
                    })
                    this.submitButton.hide(true)
                    this.cancelButton.hide(true)
                })
            }
        })

        return this.elem
    }

    private parseTaggedSections(input: string, tagNames: string[]): { content: string; isTagSection: boolean }[] {
        if (input.trim() === '') {
            return []
        }

        // escape tag names for safe use in the regex
        const escaped = tagNames.map(tag => tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

        // capture opening/closing tag pairs for any provided tag name
        const pattern = new RegExp(`<\\s*(${escaped})\\s*>([\\s\\S]*?)<\\/\\s*\\1\\s*>`, 'g')

        const result: { content: string, isTagSection: boolean }[] = []
        let lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = pattern.exec(input)) !== null) {
            const before = input.slice(lastIndex, match.index).trim()
            if (before) {
                result.push({content: before, isTagSection: false})
            }

            const tagBlock = match[0].trim()
            result.push({content: tagBlock, isTagSection: true})

            lastIndex = pattern.lastIndex
        }

        const after = input.slice(lastIndex).trim()
        if (after) {
            result.push({content: after, isTagSection: false})
        }

        return result
    }


    public update(newTexts: string = '') {
        if (newTexts !== '') {
            this.texts.push(newTexts)
        }

        clearChildElements(this.textElem)
        $(this.textElem, $ => {
            this.currBlocks = this.getBlocks()
            this.codeBlocks = []

            for (const block of this.currBlocks) {
                if (block.type === 'collapse') {
                    const collapseBlock = new CollapseBlock({content: block.content, isExpanded: !block.isCompleted})
                    collapseBlock.render($)
                } else if (block.type === 'text') {
                    const sections = this.parseTaggedSections(block.content, ['metadata'])

                    let html = ''
                    for (const section of sections) {
                        if (section.isTagSection) {
                            html += section.content
                        } else {
                            html += getMarkDownParsed(section.content)
                        }
                    }
                    let elem = $('div', '.text-block.block')
                    elem.innerHTML = html
                } else {
                    let codeBlock = new CodeBlock({
                        block: block,
                        onCopyToClipBoard: this.onCopyToClipBoard.bind(this),
                        index: this.codeBlocks.length,
                        message: this,
                    })
                    codeBlock.render($)
                    this.codeBlocks.push(codeBlock)
                }
            }
        })
    }

    private onCopyToClipBoard(index: number) {
        navigator.clipboard.writeText(this.currBlocks[index].content).then()
    }

    public getCodeBlocks(): CodeBlock[] {
        return this.codeBlocks
    }

    public toData() {
        return {"role": this.role, "content": this.getText()}
    }

    private getText(removeTrailingNewLines: boolean = true): string {
        let res = this.texts.join('')

        if (removeTrailingNewLines) {
            return res.replace(/[\r\n]+$/, '')
        }

        return res
    }

    private extractCollapseBlock(input: string): {
        collapse: string | null;
        before: string;
        after: string;
        isCompleted: boolean
    } {
        const fullRegex = /<collapse>([\s\S]*?)<\/collapse>/
        const openTag = '<collapse>'

        const match = fullRegex.exec(input)
        if (match) {
            const before = input.slice(0, match.index)
            const collapse = match[1]
            const after = input.slice(match.index + match[0].length)
            return {collapse, before, after, isCompleted: true}
        }

        const openIdx = input.indexOf(openTag)
        if (openIdx !== -1) {
            const before = input.slice(0, openIdx)
            const collapse = input.slice(openIdx + openTag.length).replace(/^\s*/, '')
            return {collapse, before, after: '', isCompleted: false}
        }

        return {collapse: null, before: '', after: input, isCompleted: true}
    }

    private countConsecutiveBackticks(line: string): number {
        line = line.trim()
        const match = line.match(/^`+/)
        return match ? match[0].length : 0
    }

    private getBlocks() {
        let res: MessageBlock[] = []

        let processedText = this.extractCollapseBlock(this.getText())

        if (processedText.before.trim() != null) {
            res.push({
                type: 'text',
                content: processedText.before,
                lang: null,
                index: 0,
            })
        }

        if (processedText.collapse != null) {
            res.push({
                type: 'collapse',
                content: processedText.collapse,
                lang: null,
                index: res.length,
                isCompleted: processedText.isCompleted
            })
        }

        let lines = processedText.after.split('\n')

        let content = ''
        let index = res.length
        let startCodeBlock = false
        let numCodeBlockTicks = null
        let type = 'text'
        let lang = ''
        let path = null
        for (const line of lines) {
            const numBackticks = this.countConsecutiveBackticks(line)

            if (startCodeBlock && numBackticks === numCodeBlockTicks) {
                res.push({type: type, content: content, lang: lang, path: path, index: index})
                content = ''
                index++

                startCodeBlock = false
                numCodeBlockTicks = null
                type = 'text'
                lang = ''
            } else if (!startCodeBlock && numBackticks >= 3) {
                res.push({type: type, content: content, lang: lang, path: path, index: index})
                content = ''
                index++

                startCodeBlock = true
                numCodeBlockTicks = numBackticks
                type = 'code'

                const header = line.substring(numCodeBlockTicks).trim()

                const colonIdx = header.indexOf(':')
                if (colonIdx !== -1) {
                    lang = header.slice(0, colonIdx).trim()
                    path = header.slice(colonIdx + 1).trim()
                } else {
                    lang = header.trim()
                }
            } else {
                content = content !== '' ? content + '\n' + line : content + line
            }
        }

        if (content !== '') {
            res.push({type: type, content: content, lang: lang, path: path, index: index})
        }

        return res
    }

    public hideMessageLoading(hide: boolean) {
        this.messageLoder.hide(hide)
        this.isMessageLoading = !hide
        if (hide) {
            for (const codeBlock of this.codeBlocks) {
                codeBlock.TerminateLoading()
            }
        }
    }

    private onEditMessage() {
        this.displayText(false)

        this.input.value = this.getText()
        this.displayInput(true)
        this.input.resizeTextArea()
        this.input.focus()

        this.editMessageButton.hide(true)
        this.submitButton.hide(false)
        this.cancelButton.hide(false)
    }

    private onSubmit() {
        this.texts = [this.input.value]
        this.update()

        this.displayText(true)
        this.displayInput(false)

        this.submitButton.hide(true)
        this.editMessageButton.hide(false)
        this.cancelButton.hide(true)

        this.onSubmitClick(this.getText())
    }

    private onCancel() {
        this.displayText(true)
        this.displayInput(false)

        this.editMessageButton.hide(false)
        this.cancelButton.hide(true)
        this.submitButton.hide(true)
    }

    private displayText(display: boolean) {
        if (display) {
            this.textElem.style.display = 'block'
        } else {
            this.textElem.style.display = 'none'
        }
    }

    public displayEditButtons(display: boolean) {
        if (display) {
            this.editButtonsElem.style.display = 'flex'
        } else {
            this.editButtonsElem.style.display = 'none'
        }
        this.displayText(true)
        this.displayInput(false)
    }

    private displayInput(display: boolean) {
        if (display) {
            this.inputContainerElem.style.display = 'block'
        } else {
            this.inputContainerElem.style.display = 'none'
        }
    }

    private onKeyDown = async (e) => {
        if (e.key === 'Enter') {
            this.input.resizeTextArea(true)
            return
        }
        if (e.key === "Backspace" || e.key === "Delete") {
            this.input.resizeTextArea()
            return
        }

        if (!this.input.isMaxHeight) {
            this.input.resizeTextArea()
        }
    }

    public remove() {
        this.elem.remove()
    }
}
