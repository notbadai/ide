import {WeyaElementFunction} from '../../../../lib/weya/weya'
import {BasicButton} from '../../components/buttons'
import {Input} from '../../components/input'
import {UIState} from './components'

export interface CustomToolInterfaceOptions {
    toolInterface: UIState
    onButtonClick: (action: string, state?: { [name: string]: ComponentState }) => Promise<void>
}

interface Component {
    type: string
    name: string
    component: Input | BasicButton
}

interface InputComponentState {
    tool_type: 'input'
    name: string
    value: string
    disabled: boolean
}

interface ButtonComponentState {
    tool_type: 'button'
    name: string
    disabled: boolean
}

export type ComponentState = InputComponentState | ButtonComponentState

export class CustomToolInterface {
    private elem: HTMLElement
    private readonly toolInterface: UIState
    private readonly onButtonClick: (action: string, state: { [name: string]: ComponentState }) => Promise<void>
    private readonly components: Component[]

    constructor(opt: CustomToolInterfaceOptions) {
        this.toolInterface = opt.toolInterface
        this.onButtonClick = opt.onButtonClick

        this.components = []
    }

    public render($: WeyaElementFunction): HTMLElement {
        this.elem = $('div', '.custom-tool', $ => {
            $('h3', '.title', this.toolInterface.title)
            for (const row of this.toolInterface.rows) {
                $('div', '.row', $ => {
                    for (const component of row) {
                        if (component.type === 'button') {
                            const button = new BasicButton({
                                text: component.name,
                                onButtonClick: () => this.onButtonClick(component.name, this.getState()),
                                background: true,
                            })
                            button.render($)
                            button.disabled = component.disabled || false
                            this.components.push({name: component.name, type: 'button', component: button})
                        } else if (component.type === 'input') {
                            $('div', '.input-wrapper', $ => {
                                const input = new Input({
                                    placeholder: component.placeholder,
                                    inputValue: component.value,
                                    nRows: 1
                                })
                                input.render($)
                                input.resizeTextArea()
                                this.components.push({name: component.name, type: 'input', component: input})
                            })
                        }
                    }
                })
            }
        })

        return this.elem
    }

    public getState(): { [name: string]: ComponentState } {
        const state: { [name: string]: ComponentState } = {}

        for (const component of this.components) {
            if (component.type === 'input') {
                const input = component.component as Input
                state[component.name] = {
                    tool_type: 'input',
                    name: component.name,
                    value: input.value,
                    disabled: input.disabled,
                }
            } else if (component.type === 'button') {
                const button = component.component as BasicButton
                state[component.name] = {
                    tool_type: 'button',
                    name: component.name,
                    disabled: button.disabled
                }
            }
        }

        return state
    }

    public setButtonsEnabled(enabled: boolean): void {
        for (const component of this.components) {
            if (component.type === 'button') {
                const button = component.component as BasicButton
                button.disabled = !enabled
            }
        }
    }
}