import {WeyaElementFunction} from "../../../../lib/weya/weya"
import {BasicButton} from "../../components/buttons"
import {StatusIndicator} from "../../components/status_indicator"
import {CheckBox} from "../../components/check_box"
import {ApiKey} from "../../models/extension"

export interface ExtensionSettingsStatus {
    isInitialized: boolean
    remoteUrl?: string
    lastUpdate?: Date
    currentBranch?: string
}

export enum ApiProvider {
    OPENROUTER = 'openrouter',
    DEEPINFRA = 'deepinfra'
}

const PROVIDER_AUTH_URLS: Record<ApiProvider, string> = {
    [ApiProvider.OPENROUTER]: 'https://openrouter.ai/api/v1/auth/key',
    [ApiProvider.DEEPINFRA]: 'https://api.deepinfra.com/v1/openai/models'
}

export class ExtensionSettings {
    private repositoryStatus: ExtensionSettingsStatus | null = null
    private progressContainerElem: HTMLDivElement | null = null
    private apiKeys: ApiKey[] = []

    private openRouterInputElem: HTMLInputElement | null = null
    private readonly openRouterCheckbox: CheckBox | null = null
    private openRouterStatusIndicator: StatusIndicator | null = null

    private deepInfraInputElem: HTMLInputElement | null = null
    private readonly deepInfraCheckbox: CheckBox | null = null
    private deepInfraStatusIndicator: StatusIndicator | null = null

    private repositoryStatusIndicator: StatusIndicator | null = null

    private pythonPath: string | null = null
    private pythonPathInputElem: HTMLInputElement | null = null
    private pythonPathStatusIndicator: StatusIndicator | null = null

    private keysVisible: boolean = false
    private toggleKeysButton: BasicButton

    constructor() {
        this.openRouterCheckbox = new CheckBox({
            label: 'Set as default',
            onClick: () => this.onDefaultCheckboxChanged(ApiProvider.OPENROUTER),
        })

        this.deepInfraCheckbox = new CheckBox({
            label: 'Set as default',
            onClick: () => this.onDefaultCheckboxChanged(ApiProvider.DEEPINFRA)
        })

        this.toggleKeysButton = new BasicButton({
            text: this.keysVisible ? 'Hide Keys' : 'Show Keys',
            onButtonClick: () => this.handleToggleKeysVisibility(),
            background: false,
        })
    }

    public async loadStatus(): Promise<void> {
        await this.getStatus()
        await this.loadApiKeyStatus()
        await this.loadPythonPathStatus()
    }

    public async renderManagementPanel($: WeyaElementFunction, onUpdate: () => void): Promise<HTMLDivElement> {
        await this.loadStatus()

        return $('div', '.extension-settings', $ => {
            $('div', '.settings-section', $ => {
                $('div', '.section-header', $ => {
                    $('h4', $ => {
                        $('span', 'Python Path')
                    })
                    this.pythonPathStatusIndicator = new StatusIndicator({
                        type: this.pythonPath ? 'success' : 'warning',
                        text: this.pythonPath ? 'Python path configured' : 'No Python path configured',
                        inline: true
                    })
                    this.pythonPathStatusIndicator.render($)
                })
                $('div', '.section-description', 'Path to the Python executable used to run extensions.')

                $('div', '.section-content', $ => {
                    this.pythonPathInputElem = $('input', '.settings-input', {
                        type: 'text',
                        placeholder: 'Enter Python executable path (e.g., /usr/bin/python3 or python)...',
                        value: this.pythonPath || ''
                    }) as HTMLInputElement
                })

                $('div', '.section-actions', $ => {
                    const savePythonButton = new BasicButton({
                        text: 'Save',
                        onButtonClick: () => this.handleSavePythonPath(),
                        background: true,
                    })
                    savePythonButton.render($)

                    const deletePythonButton = new BasicButton({
                        text: 'Delete',
                        onButtonClick: () => this.handleDeletePythonPath(),
                        background: false,
                    })
                    deletePythonButton.render($)
                })
            })

            $('div', '.settings-section', $ => {
                $('div', '.section-header', $ => {
                    $('h4', $ => {
                        $('span', 'API Keys')
                    })
                })
                $('div', '.section-description', 'API keys for AI model providers. Required for extensions that use language models.')

                $('div', '.section-content', $ => {
                    $('div', '.api-providers', $ => {
                        const openRouterKey = this.getApiKeyByProvider(ApiProvider.OPENROUTER)
                        $('div', '.api-provider-item', $ => {
                            $('div', '.provider-header', $ => {
                                $('h5', 'OpenRouter')
                                this.openRouterStatusIndicator = new StatusIndicator({
                                    type: openRouterKey ? 'success' : 'warning',
                                    text: openRouterKey ? 'API key configured' : 'No API key',
                                    inline: true
                                })
                                this.openRouterStatusIndicator.render($)
                            })

                            $('div', '.provider-controls', $ => {
                                this.openRouterInputElem = $('input', '.settings-input', {
                                    type: this.keysVisible ? 'text' : 'password',
                                    placeholder: 'Enter OpenRouter API key...',
                                    value: openRouterKey?.key || ''
                                }) as HTMLInputElement

                                $('div', '.provider-options', $ => {
                                    this.openRouterCheckbox.render($)
                                })
                            })
                        })

                        const deepInfraKey = this.getApiKeyByProvider(ApiProvider.DEEPINFRA)
                        $('div', '.api-provider-item', $ => {
                            $('div', '.provider-header', $ => {
                                $('h5', 'DeepInfra')
                                this.deepInfraStatusIndicator = new StatusIndicator({
                                    type: deepInfraKey ? 'success' : 'warning',
                                    text: deepInfraKey ? 'API key configured' : 'No API key',
                                    inline: true
                                })
                                this.deepInfraStatusIndicator.render($)
                            })

                            $('div', '.provider-controls', $ => {
                                this.deepInfraInputElem = $('input', '.settings-input', {
                                    type: this.keysVisible ? 'text' : 'password',
                                    placeholder: 'Enter DeepInfra API key...',
                                    value: deepInfraKey?.key || ''
                                }) as HTMLInputElement

                                $('div', '.provider-options', $ => {
                                    this.deepInfraCheckbox.render($)
                                })
                            })
                        })
                    })
                })

                $('div', '.section-actions', $ => {
                    const saveApiKeysButton = new BasicButton({
                        text: 'Save',
                        onButtonClick: () => this.handleSaveAllApiKeys(),
                        background: true,
                    })
                    saveApiKeysButton.render($)
                    this.toggleKeysButton.render($)
                })
            })

            $('div', '.settings-section', $ => {
                $('div', '.section-header', $ => {
                    $('h4', $ => {
                        $('span', 'Extensions Repository')
                    })
                    if (this.repositoryStatus?.isInitialized) {
                        this.repositoryStatusIndicator = new StatusIndicator({
                            type: 'success',
                            text: 'Repository downloaded',
                            inline: true
                        })
                        this.repositoryStatusIndicator.render($)
                    } else {
                        this.repositoryStatusIndicator = new StatusIndicator({
                            type: 'warning',
                            text: 'Repository not found',
                            inline: true
                        })
                        this.repositoryStatusIndicator.render($)
                    }
                })
                $('div', '.section-description', 'Collection of AI-powered extensions including chat assistants, autocompletion, and code apply etc. Downloaded from the official NotBad AI extensions repository.')

                if (this.repositoryStatus?.isInitialized && this.repositoryStatus.lastUpdate) {
                    $('div', '.section-content', $ => {
                        $('div', '.status-detail', $ => {
                            $('span', '.label', 'Last Updated: ')
                            $('span', '.value', this.repositoryStatus.lastUpdate.toLocaleString())
                        })
                    })
                }

                $('div', '.section-actions', $ => {
                    if (!this.repositoryStatus?.isInitialized) {
                        const downloadButton = new BasicButton({
                            text: 'Download Extensions',
                            onButtonClick: () => {
                                this.handleDownload().then(() => onUpdate())
                            },
                            background: true,
                        })
                        downloadButton.render($)
                    } else {
                        const updateButton = new BasicButton({
                            text: 'Update',
                            onButtonClick: () => {
                                this.handleUpdate().then(() => onUpdate())
                            },
                            background: true,
                        })
                        updateButton.render($)

                        const reDownloadButton = new BasicButton({
                            text: 'Re-download',
                            onButtonClick: () => {
                                this.handleDownload().then(() => onUpdate())
                            },
                            background: false,
                        })
                        reDownloadButton.render($)
                    }
                })
            })

            // progress Section (hidden by default)
            this.progressContainerElem = $('div', '.progress-bar-container.hide', $ => {
                $('div', '.progress-bar', $ => {
                    $('div', '.progress-fill')
                })
                $('div', '.progress-percentage', '0%')
                $('div', '.progress-message', '')
            })
            this.updateCheckBoxes()
        })
    }

    private getApiKeyByProvider(provider: ApiProvider): ApiKey | null {
        return this.apiKeys.find(key => key.provider === provider) || null
    }

    private onDefaultCheckboxChanged(provider: ApiProvider): void {
        if (provider === ApiProvider.OPENROUTER) {
            this.deepInfraCheckbox.checked = false
            this.openRouterCheckbox.checked = true
        }
        if (provider === ApiProvider.DEEPINFRA) {
            this.openRouterCheckbox.checked = false
            this.deepInfraCheckbox.checked = true
        }
    }

    private updateCheckBoxes(): void {
        const deepInfraKey = this.getApiKeyByProvider(ApiProvider.DEEPINFRA)
        const openRouterKey = this.getApiKeyByProvider(ApiProvider.OPENROUTER)

        if (deepInfraKey?.is_default) {
            this.deepInfraCheckbox.checked = true
            return
        }
        if (openRouterKey?.is_default) {
            this.openRouterCheckbox.checked = true
            return
        }

        this.openRouterCheckbox.checked = true
    }

    private handleToggleKeysVisibility(): void {
        this.keysVisible = !this.keysVisible

        const text = this.keysVisible ? 'Hide Keys' : 'Show Keys'
        this.toggleKeysButton.setText(text)

        // Update input types
        if (this.openRouterInputElem) {
            this.openRouterInputElem.type = this.keysVisible ? 'text' : 'password'
        }
        if (this.deepInfraInputElem) {
            this.deepInfraInputElem.type = this.keysVisible ? 'text' : 'password'
        }
    }

    private async loadApiKeyStatus(): Promise<void> {
        try {
            this.apiKeys = await window.electronAPI.apiKeysGet() || []
        } catch (error) {
            this.apiKeys = []
        }
    }

    private async validateApiKey(key: string, provider: ApiProvider): Promise<boolean> {
        try {
            const response = await fetch(`${PROVIDER_AUTH_URLS[provider]}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'X-Title': 'NotBad AI IDE'
                }
            })

            return response.ok
        } catch (error) {
            return false
        }
    }

    private async handleSaveAllApiKeys(): Promise<void> {
        const openRouterKey = this.openRouterInputElem?.value.trim()
        const deepInfraKey = this.deepInfraInputElem?.value.trim()

        // check if at least one key is provided
        if (!openRouterKey && !deepInfraKey) {
            alert('Please enter at least one API key')
            return
        }

        try {
            // validate provided keys
            if (openRouterKey) {
                const isValid = await this.validateApiKey(openRouterKey, ApiProvider.OPENROUTER)
                if (!isValid) {
                    alert('Invalid OpenRouter API key. Please check your key and try again.')
                    return
                }
            }

            if (deepInfraKey) {
                const isValid = await this.validateApiKey(deepInfraKey, ApiProvider.DEEPINFRA)
                if (!isValid) {
                    alert('Invalid DeepInfra API key. Please check your key and try again.')
                    return
                }
            }

            if (openRouterKey && !deepInfraKey) {
                this.openRouterCheckbox.checked = true
                this.deepInfraCheckbox.checked = false
            }
            if (deepInfraKey && !openRouterKey) {
                this.openRouterCheckbox.checked = false
                this.deepInfraCheckbox.checked = true
            }

            this.apiKeys = []
            if (openRouterKey) {
                this.apiKeys.push({
                    key: openRouterKey,
                    provider: ApiProvider.OPENROUTER,
                    is_default: this.openRouterCheckbox.checked
                })
            }

            if (deepInfraKey) {
                this.apiKeys.push({
                    key: deepInfraKey,
                    provider: ApiProvider.DEEPINFRA,
                    is_default: this.deepInfraCheckbox.checked
                })
            }

            await window.electronAPI.apiKeysSave(this.apiKeys)

            this.updateApiKeyStatus()
        } catch (error) {
            alert('Failed to save API keys')
        }
    }

    private updateApiKeyStatus(): void {
        const openRouterKey = this.getApiKeyByProvider(ApiProvider.OPENROUTER)
        const deepInfraKey = this.getApiKeyByProvider(ApiProvider.DEEPINFRA)

        if (openRouterKey) {
            this.openRouterStatusIndicator.updateStatus('API key configured', 'success')
        } else {
            this.openRouterStatusIndicator.updateStatus('No API key', 'warning')
        }

        if (deepInfraKey) {
            this.deepInfraStatusIndicator.updateStatus('API key configured', 'success')
        } else {
            this.deepInfraStatusIndicator.updateStatus('No API key', 'warning')
        }
    }

    private async loadPythonPathStatus(): Promise<void> {
        try {
            this.pythonPath = await window.electronAPI.pythonPathGet()
        } catch (error) {
            this.pythonPath = null
        }
    }

    private updatePythonPathStatus(): void {
        if (this.pythonPathStatusIndicator) {
            if (this.pythonPath) {
                this.pythonPathStatusIndicator.updateStatus('Python path configured', 'success')
            } else {
                this.pythonPathStatusIndicator.updateStatus('No Python path configured', 'warning')
            }
        }

        // update the input field to show the current path
        if (this.pythonPathInputElem) {
            this.pythonPathInputElem.value = this.pythonPath || ''
        }
    }

    private async handleSavePythonPath(): Promise<void> {
        const path = this.pythonPathInputElem?.value.trim()
        if (!path) {
            alert('Please enter a Python path')
            return
        }

        try {
            await window.electronAPI.pythonPathSave(path)
            this.pythonPath = path
            this.updatePythonPathStatus()
        } catch (error) {
            alert('Failed to save Python path')
        }
    }

    private async handleDeletePythonPath(): Promise<void> {
        if (!this.pythonPath) {
            alert('No Python path to delete')
            return
        }

        if (!confirm('Are you sure you want to delete the Python path?')) {
            return
        }

        try {
            const deleted = await window.electronAPI.pythonPathDelete()
            if (deleted) {
                this.pythonPath = null
                this.updatePythonPathStatus()
            } else {
                alert('Python path not found')
            }
        } catch (error) {
            alert('Failed to delete Python path')
        }
    }

    private async handleDownload(): Promise<void> {
        this.showProgress('Starting download...')

        window.electronAPI.onExtensionRepoProgress((progress) => {
            this.updateProgress(progress.percentage, progress.message)
        })

        try {
            await window.electronAPI.extensionRepoDownload()
            this.hideProgress()
            await this.getStatus()
        } catch (error) {
            this.hideProgress()
        }
    }

    private async getStatus() {
        this.repositoryStatus = await window.electronAPI.extensionRepoGetStatus()
    }

    private async handleUpdate(): Promise<void> {
        this.showProgress('Checking for updates...')

        window.electronAPI.onExtensionRepoProgress((progress) => {
            this.updateProgress(progress.percentage, progress.message)
        })

        try {
            await window.electronAPI.extensionRepoUpdate()
            this.hideProgress()
            await this.getStatus()
        } catch (error) {
            this.hideProgress()
        }
    }

    private showProgress(message: string): void {
        if (this.progressContainerElem) {
            this.progressContainerElem.classList.remove('hide')
            const messageElem = this.progressContainerElem.querySelector('.progress-message') as HTMLElement
            if (messageElem) {
                messageElem.textContent = message
            }
        }
    }

    private updateProgress(percentage: number, message: string): void {
        if (this.progressContainerElem) {
            const fillElem = this.progressContainerElem.querySelector('.progress-fill') as HTMLElement
            const percentageElem = this.progressContainerElem.querySelector('.progress-percentage') as HTMLElement
            const messageElem = this.progressContainerElem.querySelector('.progress-message') as HTMLElement

            if (fillElem) {
                fillElem.style.width = `${percentage}%`
            }
            if (percentageElem) {
                percentageElem.textContent = `${percentage}%`
            }
            if (messageElem) {
                messageElem.textContent = message
            }
        }
    }

    private hideProgress(): void {
        if (this.progressContainerElem) {
            this.progressContainerElem.classList.add('hide')
        }
    }
}

export const extensionSettings = new ExtensionSettings()