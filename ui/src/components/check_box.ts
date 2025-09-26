import {WeyaElementFunction} from "../../../lib/weya/weya"

interface CheckBoxOptions {
    onClick: () => void,
    label: string
}

export class CheckBox {
    private elem: HTMLDivElement
    private checkBoxElem: HTMLInputElement
    private checkBoxContainerElem: HTMLDivElement
    private readonly onCheckBoxClicked: () => void
    private readonly label: string
    private readonly uniqueId: string

    constructor(opt: CheckBoxOptions) {
        this.onCheckBoxClicked = opt.onClick
        this.label = opt.label
        this.uniqueId = `checkbox_${Math.random().toString(36).substr(2, 9)}`
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.check-box', $ => {
            this.checkBoxContainerElem = $('div', '.checkbox-wrapper', $ => {
                $('span', '.label', this.label)
                $('div', '.checkbox-container', $ => {
                    this.checkBoxElem = $('input', {
                        type: "checkbox",
                        id: this.uniqueId,
                        on: {click: this.onChecked.bind(this)}
                    })
                    $('label', {for: this.uniqueId})
                })
            })
        })
    }

    private onChecked() {
        this.onCheckBoxClicked()
    }

    public hide(hide: boolean) {
        if (hide) {
            this.checkBoxContainerElem.style.visibility = 'hidden'
        } else {
            this.checkBoxContainerElem.style.visibility = 'visible'
        }
    }

    public get checked(): boolean {
        return this.checkBoxElem.checked
    }

    public set checked(checked: boolean) {
        this.checkBoxElem.checked = checked
    }
}