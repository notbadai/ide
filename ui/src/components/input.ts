import {WeyaElementFunction} from "../../../lib/weya/weya"

interface InputOptions {
    placeholder?: string
    onInput?: (e) => {}
    onKeyDown?: (e) => {}
    onKeyUp?: (e) => {}
    onKeyPress?: (e) => {}
    inputValue?: string
    nRows?: number
}

const MAX_INPUT_HEIGHT = 200

export class Input {
    private readonly _placeholder: string
    private readonly inputValue: string
    private readonly nRows: number

    private readonly onInput: (e) => {}
    private readonly onKeyDown: (e) => {}
    private readonly onKeyUp: (e) => {}
    private readonly onKeyPress: (e) => {}

    private inputElem: HTMLTextAreaElement

    constructor(opt: InputOptions) {
        this._placeholder = opt.placeholder
        this.inputValue = opt.inputValue
        this.nRows = opt.nRows

        this.onInput = opt.onInput
        this.onKeyDown = opt.onKeyDown
        this.onKeyUp = opt.onKeyUp
        this.onKeyPress = opt.onKeyPress
    }

    public render($: WeyaElementFunction) {
        this.inputElem = $('textarea', '.scroll.text-area.input-text-area', {
                placeholder: this._placeholder,
                rows: this.nRows == null ? 1 : this.nRows,
                on: {
                    input: (e) => {
                        if (this.onInput != null) {
                            this.onInput(e)
                        }
                    },
                    keydown: (e) => {
                        if (this.onKeyDown != null) {
                            this.onKeyDown(e)
                        }
                    },
                    keyup: (e) => {
                        if (this.onKeyUp != null) {
                            this.onKeyUp(e)
                        }
                    },
                    keypress: (e) => {
                        if (this.onKeyPress != null) {
                            this.onKeyPress(e)
                        }
                    }
                },
            }
        )
        this.inputElem.addEventListener('paste', (e) => {
            setTimeout(this.onPaste.bind(this), 30)
        });

        if (this.inputValue) {
            this.inputElem.value = this.inputValue
        }

        this.inputElem.focus()
    }

    private onPaste() {
        if (!this.isMaxHeight) {
            this.resizeTextArea()
        }
    }

    public resizeTextArea(keepMaxHeight: boolean = false) {
        this.inputElem.style.height = 'auto'
        let height = this.inputElem.value !== '' && keepMaxHeight ? MAX_INPUT_HEIGHT : this.inputElem.scrollHeight
        this.inputElem.style.height = `${height}px`
    }

    public resetTextArea() {
        this.inputElem.value = ''
        this.inputElem.focus()
        this.inputElem.style.height = ''
    }

    get isMaxHeight() {
        return this.inputElem.clientHeight == MAX_INPUT_HEIGHT
    }

    get value(): string {
        return this.inputElem.value
    }

    get scrollHeight(): number {
        return this.inputElem.scrollHeight
    }

    get height(): number {
        return this.inputElem.clientHeight
    }

    set value(value: string) {
        this.inputElem.value = value
    }

    set height(value: number) {
        this.inputElem.style.height = `${value}px`
    }
    
    set placeholder(placeholder: string) {
        this.inputElem.placeholder = placeholder
    }

    public hide(hide: boolean) {
        if (hide) {
            this.inputElem.style.visibility = 'hidden'
        } else {
            this.inputElem.style.visibility = 'visible'
        }
    }

    public display(display: boolean) {
        if (display) {
            this.inputElem.style.display = 'inline-block'
        } else {
            this.inputElem.style.display = 'none'
        }
    }

    public focus() {
        this.inputElem.focus()
    }

    public remove() {
        this.inputElem.remove()
    }

    public get disabled(): boolean {
        return this.inputElem.disabled
    }
}