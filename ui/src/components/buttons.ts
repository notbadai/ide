import {WeyaElement, WeyaElementFunction} from "../../../lib/weya/weya"


interface BasicButtonOptions {
    onButtonClick?: (event?: Event) => void
    text?: string
    ephemeralTextOnClick?: string
    icon?: string
    Disabled?: boolean
    onHoverEffect?: boolean
    background?: boolean
    isSmallButton?: boolean
}

export class BasicButton {
    private readonly text: string
    private readonly ephemeralText: string
    private readonly icon: string
    private readonly onButtonClick: (event?: Event) => void
    private readonly onHoverEffect: boolean
    private readonly background: boolean
    private readonly isSmallButton: boolean
    private isDisabled: boolean

    private elem: WeyaElement
    private iconElem: HTMLElement
    private textElem: HTMLSpanElement

    constructor(opt: BasicButtonOptions) {
        this.onButtonClick = opt.onButtonClick
        this.text = opt.text
        this.ephemeralText = opt.ephemeralTextOnClick
        this.icon = opt.icon
        this.onHoverEffect = opt.onHoverEffect
        this.background = opt.background
        this.isSmallButton = opt.isSmallButton
    }

    private onClick = (e: Event) => {
        if (this.ephemeralText) {
            this.textElem.textContent = this.ephemeralText
            setTimeout(() => {
                this.textElem.textContent = this.text
            }, 1000)
        }
        e.preventDefault()
        e.stopPropagation()
        this.onButtonClick(e)
    }

    public render($: WeyaElementFunction) {
        let onHover = this.onHoverEffect ? '.on-hover' : ''
        let background = this.background ? '.background' : ''
        let buttonType = this.isSmallButton ? '.small' : '.normal'
        this.elem = $('a', `.nav-link.button${onHover}${background}${buttonType}`,
            {on: {click: this.onClick}}, $ => {
                if (this.icon) {
                    this.iconElem = $('i', `${this.icon}${this.text ? '.icon-margin' : ''}`)
                }

                if (this.text) {
                    this.textElem = $('span', this.text)
                }
            })
    }

    public set disabled(isDisabled: boolean) {
        this.isDisabled = isDisabled
        if (this.elem) {
            if (this.isDisabled) {
                this.elem.classList.add('disabled')
                return
            }
            this.elem.classList.remove('disabled')
        }
    }

    public hide = (isHidden: boolean) => {
        if (this.elem == null) {
            return
        }
        if (isHidden) {
            this.elem.style.visibility = 'hidden'
        } else {
            this.elem.style.visibility = 'visible'
        }
    }

    public displayNone = (isHidden: boolean) => {
        if (this.elem == null) {
            return
        }
        if (isHidden) {
            this.elem.style.display = 'none'
        } else {
            this.elem.style.display = 'block'
        }
    }

    public setText = (newText: string) => {
        if (this.textElem) {
            this.textElem.textContent = newText
        }
    }

    public set width(value: number) {
        this.elem.style.width = `${value}px`
    }
}