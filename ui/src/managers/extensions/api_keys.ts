import {WeyaElementFunction} from "../../../../lib/weya/weya"
import {Input} from "../../components/input"
import {CheckBox} from "../../components/check_box"
import {BasicButton} from "../../components/buttons"
import {popup} from "../../components/popup"
import {projectManager} from "../project/manager"

enum ApiProviderName {
    OPENROUTER = 'openrouter',
    DEEPINFRA = 'deepinfra'
}

class ApiKeys {
    private elem: HTMLDivElement
    private openrouterInput: Input
    private deepinfraInput: Input
    private openrouterCheckbox: CheckBox
    private deepinfraCheckbox: CheckBox
    private saveButton: BasicButton

    constructor() {

    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.api-keys-container', $ => {
            $('h6', 'Set Up Your API Provider Keys')

            $('div', '.api-keys-description', $ => {
                $('p', 'Add at least one provider with your API key. You can configure one or both providers:')
                $('p', '.api-keys-note', $ => {
                    $('i', '.fas.fa-info-circle')
                    $('span', 'OpenRouter API key is required for the code apply feature.')
                })
            })

            $('div', '.api-key-section', $ => {
                $('label', 'OpenRouter')
                this.openrouterInput = new Input({
                    placeholder: 'Enter OpenRouter API key',
                    inputValue: '',
                    onKeyDown: this.updateSaveButtonState.bind(this),
                })
                this.openrouterInput.render($)

                this.openrouterCheckbox = new CheckBox({
                    label: 'Set as default',
                    onClick: () => {
                        if (this.openrouterCheckbox.checked) {
                            this.deepinfraCheckbox.checked = false
                        }
                    }
                })
                this.openrouterCheckbox.render($)
                this.openrouterCheckbox.checked = true
            })

            $('div', '.api-key-section', $ => {
                $('label', 'DeepInfra')
                this.deepinfraInput = new Input({
                    placeholder: 'Enter DeepInfra API key',
                    inputValue: '',
                    onKeyDown: this.updateSaveButtonState.bind(this),
                })
                this.deepinfraInput.render($)

                this.deepinfraCheckbox = new CheckBox({
                    label: 'Set as default',
                    onClick: () => {
                        if (this.deepinfraCheckbox.checked) {
                            this.openrouterCheckbox.checked = false
                        }
                    }
                })
                this.deepinfraCheckbox.render($)
            })

            $('div', '.button-container', $ => {
                this.saveButton = new BasicButton({
                    text: 'Save',
                    icon: '.fas.fa-save',
                    background: true,
                    onButtonClick: this.handleSave.bind(this)
                })
                this.saveButton.render($)
                this.saveButton.disabled = true
            })

            $('div', '.api-keys-description', $ => {
                $('p', '.api-keys-note', $ => {
                    $('i', '.fas.fa-lightbulb')
                    $('span', 'You can add or update your API keys later through Extensions → Management')
                })
            })
        })

        return this.elem
    }

    public renderPopup() {
        const extensions = projectManager.project?.extensions
        if (extensions != null && extensions.isLocal) {
            return
        }
        const apiProviders = extensions?.apiProviders || []
        for (const apiProvider of apiProviders) {
            if (apiProvider.key) {
                return
            }
        }
        popup.renderContent(this, true)
    }

    private updateSaveButtonState(e) {
        const openrouterKey = this.openrouterInput.value.trim()
        const deepinfraKey = this.deepinfraInput.value.trim()

        console.log(openrouterKey, deepinfraKey)

        const hasAtLeastOneKey = openrouterKey.length > 0 || deepinfraKey.length > 0
        this.saveButton.disabled = !hasAtLeastOneKey
    }

    private async handleSave() {
        this.saveButton.disabled = true

        const data = []

        const openrouterKey = this.openrouterInput.value.trim()
        if (openrouterKey.length > 0) {
            data.push({
                provider: ApiProviderName.OPENROUTER,
                key: openrouterKey,
                default: this.openrouterCheckbox.checked
            })
        }

        const deepinfraKey = this.deepinfraInput.value.trim()
        if (deepinfraKey.length > 0) {
            data.push({
                provider: ApiProviderName.DEEPINFRA,
                key: deepinfraKey,
                default: this.deepinfraCheckbox.checked
            })
        }

        await window.electronAPI.updateApiProviders(data)
        popup.onClose()
    }
}

export const apiKeys = new ApiKeys()