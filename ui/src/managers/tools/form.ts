import {WeyaElementFunction} from '../../../../lib/weya/weya'

export interface FormOptions {
    title: string
    formContent: string
    onButtonClick: (state: { [name: string]: any }) => Promise<void>
}

const formContent = `<form id="form">
  <input type="text" name="text1" value="foo" />
  <input type="text" name="text2" value="bar" />
  <input type="text" name="text3" value="baz" />
  <input type="checkbox" name="check" checked />
  <button name="intent" value="save">Save</button>
  <button name="intent" value="saveAsCopy">Save As Copy</button>
</form>`


export class Form {
    private elem: HTMLElement
    private formElem: HTMLFormElement
    private readonly title: string
    private readonly formContent: string
    private readonly onButtonClick: (state: { [name: string]: any }) => Promise<void>

    constructor(opt: FormOptions) {
        this.title = opt.title
        this.formContent = opt.formContent
        this.onButtonClick = opt.onButtonClick
    }

    private handleButtonClick = async (event: Event) => {
        event.preventDefault()

        const button = event.target as HTMLButtonElement

        const formData = new FormData(this.formElem, button)
        const state: { [name: string]: any } = {}

        for (const [key, value] of formData) {
            state[key] = value
        }

        this.onButtonClick(state).then()
    }

    public render($: WeyaElementFunction): HTMLElement {
        this.elem = $('div', '.custom-tool', $ => {
            $('h3', '.title', this.title)
            this.formElem = $('form')
            this.formElem.innerHTML = this.formContent

            const buttons = this.formElem.querySelectorAll('button')
            buttons.forEach(button => {
                button.addEventListener('click', this.handleButtonClick)
            })
        })

        return this.elem
    }
}