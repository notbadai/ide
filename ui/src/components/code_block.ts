import {Message, MessageBlock} from "./message"
import {WeyaElementFunction} from "../../../lib/weya/weya"
import {BasicButton} from "./buttons"
import {getHighlightedCode, addLineNumbers} from "../utils/highlightjs"
import {popup} from "./popup"
import {applyAllExtension} from "../extensions/apply_all"
import {applyExtension} from "../extensions/apply"
import {Dropdown} from "./dropdown"
import {terminalManager} from "../managers/terminal/manager"
import {activityBarManager, TERMINAL_PANEL} from "../managers/activity_bar/manager"


interface CodeBlockOptions {
    block: MessageBlock,
    onCopyToClipBoard: (index: number) => void
    index: number
    message: Message
}

export class CodeBlock {
    private buttonRowElem: HTMLDivElement
    private appliedBadgeElem: HTMLSpanElement

    private readonly block: MessageBlock
    private readonly lang: string
    private readonly onCopyToClipBoard: (index: number) => void
    private readonly message: Message
    private readonly index: number

    private applyButton: BasicButton
    private applyAllButton: BasicButton
    private runInTerminalButton: BasicButton
    private moreButton: BasicButton
    private dropDown: Dropdown

    constructor(opt: CodeBlockOptions) {
        this.block = opt.block
        this.lang = this.block.lang.toLowerCase()

        this.onCopyToClipBoard = opt.onCopyToClipBoard
        this.message = opt.message
        this.index = opt.index

        this.applyButton = new BasicButton({text: 'Apply', onButtonClick: this.onApply.bind(this)})
        this.applyAllButton = new BasicButton({text: 'Apply All', onButtonClick: this.onApplyAll.bind(this)})
        this.runInTerminalButton = new BasicButton({text: 'Run in Terminal', onButtonClick: this.runInTerminal.bind(this)})
        this.dropDown = new Dropdown({
            options: [
                {text: 'View', onClick: this.onView.bind(this)},
                {
                    text: 'Copy', onClick: () => {
                        this.onCopyToClipBoard(this.block.index)
                    }
                },
            ]
        })
        this.moreButton = new BasicButton({
            onButtonClick: (e: Event) => {
                this.onMoreButtonClick(e)
            },
            icon: ".fas.fa-ellipsis-v"
        })
    }

    private onView() {
        const codeViewContent = {
            render: ($: WeyaElementFunction) => {
                $('div', '.code-popup-container', $ => {
                    if (this.block.path) {
                        $('div', '.code-block-header', $ => {
                            $('div', '.file-info', $ => {
                                $('i', '.fas.fa-file')
                                $('span', '.file-path', this.block.path)
                            })
                        })
                    }
                    $('div', '.code-block.code-block-content', $ => {
                        $('pre', $ => {
                            let elem = $('code', '.hljs')
                            let res = getHighlightedCode(this.block.content, this.lang === '' ? 'python' : this.lang)
                            elem.innerHTML = res.html
                            addLineNumbers(elem)
                        })
                    })
                })
            }
        }
        popup.renderContent(codeViewContent)
    }

    private onApply() {
        applyExtension.apply(
            this.block.path,
            this.block.lang,
            this.block.content,
            () => {
                this.loading(false)
            },
            () => {
                this.setApplied()
            }
        ).then()
        this.loading(true)
    }

    private onApplyAll() {
        applyAllExtension.apply(
            this.index,
            this.message.getCodeBlocks()
        ).then()
        this.loading(true)
    }

    private runInTerminal() {
        activityBarManager.openBottomTab(TERMINAL_PANEL)
        const activateTerminal = terminalManager.activateTerminal.terminal
        activateTerminal.runCommand(this.content.trim())
    }

    private onMoreButtonClick(e) {
        this.dropDown.rePosition(e)
        this.dropDown.display(true)
    }

    public setApplied() {
        if (this.appliedBadgeElem) {
            this.appliedBadgeElem.classList.remove('hide')
        }
    }

    public loading(loading: boolean) {
        this.loadingAnimation(loading)
        this.applyButton.disabled = loading
    }

    public get language(): string {
        return this.block.lang
    }

    public get filePath(): string {
        return this.block.path
    }

    public get content(): string {
        return this.block.content
    }

    private isShellLanguage(): boolean {
        const shellLanguages = ['bash', 'sh', 'shell', 'zsh', 'fish', 'powershell', 'cmd', 'console', 'terminal']
        return shellLanguages.includes(this.lang.toLowerCase())
    }

    private loadingAnimation(loading: boolean) {
        if (loading && this.buttonRowElem.classList.contains('loading')) {
            return
        }
        if (!loading && !this.buttonRowElem.classList.contains('loading')) {
            return
        }

        if (loading) {
            this.buttonRowElem.classList.add('loading')
        } else {
            this.buttonRowElem.classList.remove('loading')
        }
    }

    public render($: WeyaElementFunction) {
        $('div', '.block', $ => {
            $('div', '.code-block', $ => {
                this.buttonRowElem = $('div', '.button-row', $ => {
                    $('span', '.lang', `${this.lang}`)
                    if (this.block.path != null) {
                        $('span', '.path', this.block.path)
                    }
                    this.appliedBadgeElem = $('span', '.applied-badge.hide', $ => {
                        $('i', '.fas.fa-check')
                        $('span', 'Applied')
                    })
                    $('div', '.buttons', $ => {
                        if (this.isShellLanguage()) {
                            this.runInTerminalButton.render($)
                        } else if (this.block.path != null) {
                            this.applyButton.render($)
                            this.applyAllButton.render($)
                            this.applyButton.disabled = true
                            this.applyAllButton.disabled = true
                        }
                        this.moreButton.render($)
                        this.moreButton.disabled = true
                    })
                })
                let preElem = $('pre', '.scrollable-code', $ => {
                    let elem = $('code', '.hljs')
                    let res = getHighlightedCode(this.block.content, this.lang === '' ? 'python' : this.lang)
                    elem.innerHTML = res.html
                    this.block.lang = res.lang

                    addLineNumbers(elem)
                })

                requestAnimationFrame(() => {
                    preElem.scrollTop = preElem.scrollHeight
                })
            })
        })
        document.body.appendChild(this.dropDown.render($))
        document.addEventListener("click", () => this.dropDown.display(false))
    }

    public TerminateLoading() {
        this.applyButton.disabled = false
        this.applyAllButton.disabled = false
        this.moreButton.disabled = false
    }
}