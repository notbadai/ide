import {WeyaElementFunction} from "../../../lib/weya/weya"

export interface DropDownOption {
    text: string
    icon?: string
    color?: string
    onClick: () => void
}

interface DropdownOptions {
    options: DropDownOption[]
}

export class Dropdown {
    private elem: HTMLDivElement
    private optionsElem: HTMLDivElement

    private readonly options: DropDownOption[]
    public selected: string

    constructor(opt: DropdownOptions) {
        this.options = opt.options
    }

    public render($: WeyaElementFunction, e: MouseEvent = null): HTMLDivElement {
        this.elem = $('div', '.dropdown', $ => {
            this.optionsElem = $('div', '.options', $ => {
                for (let index = 0; index < this.options.length; index++) {
                    let optionElem = $('div', '.option', {
                        on: {
                            click: (e: Event) => {
                                this.options[index].onClick()
                                this.onClick(e)
                                this.selected = this.options[index].text
                            }
                        }
                    }, $ => {
                        $('i', this.options[index].icon)
                        $('span', this.options[index].text)
                    })
                    optionElem.style.color = this.options[index].color
                }
            })
        })

        if (e != null) {
            this.rePosition(e)
        }

        return this.elem
    }

    public display(display: boolean) {
        if (display) {
            this.elem.style.display = 'block'
            this.adjustOptionsPosition()
        } else {
            this.elem.style.display = 'none'
        }
    }

    public rePosition(e: MouseEvent) {
        this.elem.style.left = `${e.pageX}px`
        this.elem.style.top = `${e.pageY}px`
    }

    private adjustOptionsPosition() {
        const rect = this.optionsElem.getBoundingClientRect()

        if (rect.bottom > window.innerHeight) {
            this.optionsElem.classList.add('bottom')
        }
        if (rect.top < 0) {
            this.optionsElem.classList.add('top')
        }
        if (rect.right > window.innerWidth) {
            this.optionsElem.classList.add('right')
        }
        if (rect.left < 0) {
            this.optionsElem.classList.add('left')
        }
    }

    private onClick(e: Event) {
        e.preventDefault()
        e.stopPropagation()

        this.display(false)
    }

    public remove() {
        this.elem.remove()
    }

    public bindOptions(binds: (() => void)[]) {
        let index = 0
        for (let bind of binds) {
            this.options[index].onClick = bind
            index++
        }
    }
}