import {Weya as $, WeyaElementFunction} from "../../../../lib/weya/weya"
import {BasicButton} from "../../components/buttons"
import {clearChildElements} from "../../utils/document"
import {projectManager} from "../project/manager"
import {BaseComponent} from "../../components/base"
import {activityBarManager, EXTENSIONS} from "../activity_bar/manager"
import {banner} from "../../components/banner"
import {configEditor} from "./config_editor"

export interface ExtensionLogEntry {
    id: string
    message: string
    timestamp: Date
    type: 'update' | 'error' | 'notification'
    extension?: string
    title?: string
}

export interface RunningExtension {
    id: string
    name: string
    description?: string
    startTime: Date
    onTerminate: () => void
    progress?: number
}

const MAX_LOGS = 100

const UPDATES_TASK = 'updates'
const EXTENSIONS_TASK = 'extension'
const ERROR_TASK = 'errors'
const NOTIFICATION_TASK = 'notifications'
const MANAGEMENT_TASK = 'management'

class ExtensionPane extends BaseComponent {
    private elem: HTMLDivElement
    private panelElem: HTMLDivElement
    private errorElem: HTMLDivElement
    private warningElem: HTMLDivElement
    private localExtensionsWarningElem: HTMLDivElement
    private tabsElem: HTMLDivElement

    private updateContainerElem: HTMLDivElement
    private errorContainerElem: HTMLDivElement
    private extensionContainerElem: HTMLDivElement
    private notificationContainerElem: HTMLDivElement

    private currentTask: string

    private updateElems: Map<string, HTMLDivElement> = new Map<string, HTMLDivElement>()
    private updatesData: Map<string, ExtensionLogEntry> = new Map<string, ExtensionLogEntry>()
    private errorElems: Map<string, HTMLDivElement> = new Map<string, HTMLDivElement>()
    private errorData: Map<string, ExtensionLogEntry> = new Map<string, ExtensionLogEntry>()
    private notificationElems: Map<string, HTMLDivElement> = new Map<string, HTMLDivElement>()
    private notificationData: Map<string, ExtensionLogEntry> = new Map<string, ExtensionLogEntry>()
    private runningExtensionElmes: Map<string, HTMLDivElement> = new Map<string, HTMLDivElement>()
    private runningExtensionsData: Map<string, RunningExtension> = new Map<string, RunningExtension>()

    private refreshInterval: NodeJS.Timeout | null = null

    constructor() {
        super()

        this.currentTask = NOTIFICATION_TASK
        this.startPeriodicRefresh()
        projectManager.setOnFileSaveCallback(() => {
            this.updateExtensionStatus()
        })
    }

    public addUpdate(message: string, extension?: string): void {
        const logEntry: ExtensionLogEntry = {
            id: this.generateId(),
            message: String(message || ''),
            timestamp: new Date(),
            type: 'update',
            extension
        }
        this.updatesData.set(logEntry.id, logEntry)
        this.addUpdateElem(logEntry)
        if (this.currentTask === UPDATES_TASK) {
            this.enforceLogLimit(UPDATES_TASK)
        }
    }

    public addError(message: string, extension?: string): void {
        const errorEntry: ExtensionLogEntry = {
            id: this.generateId(),
            message: String(message || ''),
            timestamp: new Date(),
            type: 'error',
            extension
        }
        this.errorData.set(errorEntry.id, errorEntry)
        this.addErrorElem(errorEntry)
        if (this.currentTask === ERROR_TASK) {
            this.enforceLogLimit(ERROR_TASK)
        }
        activityBarManager.showErrors(EXTENSIONS, this.errorData.size)
    }

    public addNotification(message: string, title?: string, extension?: string): void {
        const notificationEntry: ExtensionLogEntry = {
            id: this.generateId(),
            message: String(message || ''),
            timestamp: new Date(),
            type: 'notification',
            title,
            extension
        }
        this.notificationData.set(notificationEntry.id, notificationEntry)
        this.addNotificationElem(notificationEntry)
        if (this.currentTask === NOTIFICATION_TASK) {
            this.enforceLogLimit(NOTIFICATION_TASK)
        }
        activityBarManager.showNotifications(EXTENSIONS, this.notificationData.size)
    }

    public addRunningExtension(extension: RunningExtension): void {
        this.runningExtensionsData.set(extension.id, extension)
        this.addExtensionElem(extension)
        this.updateCurrentProgress()
    }

    private updateCurrentProgress() {
        let totalProgress: number = 0
        for (const extension of this.runningExtensionsData.values()) {
            if (extension.progress == null) {
                continue
            }
            totalProgress += extension.progress
        }
        if (totalProgress <= 0) {
            activityBarManager.clearProgress(EXTENSIONS)
        } else {
            const currentProgress = totalProgress / this.runningExtensionsData.size
            activityBarManager.showProgress(EXTENSIONS, currentProgress)
        }
    }

    public updateExtensionProgress(id: string, percentage: number): void {
        const clampedPercentage = Math.max(0, Math.min(100, percentage))

        const extension = this.runningExtensionsData.get(id)
        if (extension == null) {
            return
        }

        extension.progress = clampedPercentage

        if (this.currentTask === EXTENSIONS_TASK) {
            this.renderPanel()
        }

        this.updateCurrentProgress()
    }

    public removeRunningExtension(id: string): void {
        this.runningExtensionElmes.delete(id)
        this.runningExtensionsData.delete(id)

        if (this.currentTask === EXTENSIONS_TASK) {
            this.renderPanel()
        }

        this.updateCurrentProgress()
    }

    private clearUpdates(): void {
        this.updateElems.clear()
        this.updatesData.clear()

        if (this.currentTask === UPDATES_TASK) {
            this.renderPanel()
        }
    }

    private clearErrors(): void {
        this.errorElems.clear()
        this.errorData.clear()

        activityBarManager.clearErrors(EXTENSIONS)

        if (this.currentTask === ERROR_TASK) {
            this.renderPanel()
        }
    }

    private clearNotifications(): void {
        this.notificationElems.clear()
        this.notificationData.clear()

        activityBarManager.clearNotifications(EXTENSIONS)

        if (this.currentTask === NOTIFICATION_TASK) {
            this.renderPanel()
        }
    }

    private renderPanel(task: string = null): void {
        if (this.panelElem == null) {
            return
        }

        clearChildElements(this.panelElem)

        if (task != null) {
            this.currentTask = task
        }

        $(this.panelElem, $ => {
            if (this.currentTask === UPDATES_TASK) {
                this.renderUpdatesPanel($)
            }
            if (this.currentTask === ERROR_TASK) {
                this.renderErrorsPanel($)
            }
            if (this.currentTask === NOTIFICATION_TASK) {
                this.renderNotificationsPanel($)
            }
            if (this.currentTask === EXTENSIONS_TASK) {
                this.renderRunningPanel($)
            }
            if (this.currentTask === MANAGEMENT_TASK) {
                this.renderManagementPanel($)
            }
        })
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.extension-manager', $ => {
            $('h6', 'Extensions')

            // add error message for extension configuration issue
            this.errorElem = $('div', '.extension-error.hide', $ => {
                $('div', '.error-content', $ => {
                    $('i', '.fas.fa-exclamation-circle')
                    $('div', '.error-text', $ => {
                        $('div', '.error-title', 'Extension Configuration Error')
                        $('div', '.error-message', 'Extension configuration issue detected')
                    })
                })
            })

            // add warning message for local extensions in effect
            this.localExtensionsWarningElem = $('div', '.autocomplete-warning.hide', $ => {
                $('div', '.warning-content', $ => {
                    $('i', '.fas.fa-folder-open')
                    $('div', '.warning-text', $ => {
                        $('div', '.warning-title', 'Local Extension Configs Active')
                        $('div', '.warning-message', 'To make changes, edit extensions/config.yaml in your project directory.')
                    })
                })
            })

            // add warning message for missing autocomplete extension
            this.warningElem = $('div', '.autocomplete-warning.hide', $ => {
                $('div', '.warning-content', $ => {
                    $('i', '.fas.fa-exclamation-triangle')
                    $('div', '.warning-text', $ => {
                        $('div', '.warning-title', 'Autocomplete Extension Missing')
                        $('div', '.warning-message', 'Configure an autocomplete extension in config.yaml to enable code suggestions')
                    })
                })
            })

            this.tabsElem = $('div', '.extension-tabs', $ => {
                $('div', '.tab-list', $ => {
                    const tabs = [
                        {id: NOTIFICATION_TASK, label: 'Notifications'},
                        {id: EXTENSIONS_TASK, label: 'Running'},
                        {id: UPDATES_TASK, label: 'Updates'},
                        {id: ERROR_TASK, label: 'Errors'},
                        {id: MANAGEMENT_TASK, label: 'Management'},
                    ]

                    tabs.forEach(tab => {
                        const tabElem = $('button', `.tab${this.currentTask === tab.id ? '.active' : ''}`, tab.label)
                        tabElem.onclick = () => this.switchTab(tab.id)
                    })
                })
            })

            this.panelElem = $('div', '.panel')
            this.renderPanel(this.currentTask)
        })

        this.updateExtensionStatus()

        return this.elem
    }

    public openErrorsTab(): void {
        this.switchTab(ERROR_TASK)
    }

    private switchTab(taskId: string): void {
        this.currentTask = taskId
        this.renderPanel()
        this.updateTabStyles()
    }

    private updateTabStyles(): void {
        if (!this.tabsElem) {
            return
        }

        const tabs = this.tabsElem.querySelectorAll('.tab')
        const taskIds = [NOTIFICATION_TASK, EXTENSIONS_TASK, UPDATES_TASK, ERROR_TASK, MANAGEMENT_TASK]

        tabs.forEach((tab, index) => {
            if (taskIds[index] === this.currentTask) {
                tab.classList.add('active')
            } else {
                tab.classList.remove('active')
            }
        })
    }

    private updateExtensionStatus() {
        this.updateLocalExtensionsWarning()
        if (this.updateExtensionError()) {
            return
        }
        this.updateAutocompleteWarning()
    }

    private updateLocalExtensionsWarning(): void {
        if (!this.localExtensionsWarningElem) {
            return
        }

        const isLocal = projectManager.project?.extensions?.isLocal ?? false

        if (isLocal) {
            this.localExtensionsWarningElem.classList.remove('hide')
        } else {
            this.localExtensionsWarningElem.classList.add('hide')
        }
    }

    private updateAutocompleteWarning(): void {
        if (!this.warningElem) {
            return
        }

        const hasAutocomplete = projectManager.project?.extensions?.autocomplete != null

        if (hasAutocomplete) {
            this.warningElem.classList.add('hide')
        } else {
            this.warningElem.classList.remove('hide')
        }
    }

    public updateExtensionError(): boolean {
        if (!this.errorElem) {
            return false
        }
        const extensionError = projectManager.project?.extensions?.error
        if (extensionError) {
            const messageElem = this.errorElem.querySelector('.error-message') as HTMLDivElement
            messageElem.textContent = extensionError
            this.errorElem.classList.remove('hide')
            this.addError(extensionError)
            banner.error(extensionError)
            return true
        } else {
            this.errorElem.classList.add('hide')
            return false
        }
    }

    private addUpdateElem(entry: ExtensionLogEntry): void {
        if (this.updateContainerElem == null) {
            return
        }
        const elem = this.renderLogEntry(entry)
        if (this.currentTask === UPDATES_TASK && this.updateElems.size === 0) {
            this.renderPanel()
        } else {
            this.updateContainerElem.prepend(elem)
        }
        this.updateElems.set(entry.id, elem)
    }

    private addErrorElem(entry: ExtensionLogEntry): void {
        if (this.errorContainerElem == null) {
            return
        }
        const elem = this.renderLogEntry(entry)
        if (this.currentTask === ERROR_TASK && this.errorElems.size === 0) {
            this.renderPanel()
        } else {
            this.errorContainerElem.prepend(elem)
        }
        this.errorElems.set(entry.id, elem)
    }

    private addNotificationElem(entry: ExtensionLogEntry): void {
        if (this.notificationContainerElem == null) {
            return
        }
        const elem = this.renderNotificationEntry(entry)
        if (this.currentTask === NOTIFICATION_TASK && this.notificationElems.size === 0) {
            this.renderPanel()
        } else {
            this.notificationContainerElem.prepend(elem)
        }
        this.notificationElems.set(entry.id, elem)
    }

    private addExtensionElem(extension: RunningExtension) {
        if (this.extensionContainerElem == null) {
            return
        }
        const elem = this.renderRunningExtension(extension)
        if (this.currentTask === EXTENSIONS_TASK && this.runningExtensionElmes.size === 0) {
            this.renderPanel()
        } else {
            this.extensionContainerElem.prepend(elem)
        }
        this.runningExtensionElmes.set(extension.id, elem)
    }

    private renderUpdatesPanel($: WeyaElementFunction): void {
        $('div', '.logs-panel', $ => {
            $('div', '.logs-header', $ => {
                $('div', '.logs-title', $ => {
                    $('span', 'Extension Updates')
                })

                const clearButton = new BasicButton({
                    text: 'Clear',
                    onButtonClick: this.clearUpdates.bind(this),
                    background: false,
                })
                clearButton.render($)
            })

            this.updateContainerElem = $('div', '.logs-container')
            if (this.updatesData.size === 0) {
                const elem = $('div', '.empty-logs', $ => {
                    $('i', '.fas.fa-clipboard-list')
                    $('span', 'No logs available')
                })
                this.updateContainerElem.append(elem)
            } else {
                const sortedLogs = Array.from(this.updatesData.values()).sort((a, b) =>
                    b.timestamp.getTime() - a.timestamp.getTime()
                )
                sortedLogs.forEach(logEntry => {
                    const elem = this.renderLogEntry(logEntry)
                    this.updateContainerElem.appendChild(elem)
                })
            }
        })
    }

    private renderErrorsPanel($: WeyaElementFunction): void {
        $('div', '.logs-panel', $ => {
            $('div', '.logs-header', $ => {
                $('div', '.logs-title', $ => {
                    $('span', 'Extension Errors')
                })

                const clearButton = new BasicButton({
                    text: 'Clear',
                    onButtonClick: this.clearErrors.bind(this),
                    background: false,
                })
                clearButton.render($)
            })

            this.errorContainerElem = $('div', '.logs-container')
            if (this.errorData.size === 0) {
                const elem = $('div', '.empty-logs', $ => {
                    $('i', '.fas.fa-clipboard-list')
                    $('span', 'No Errors available')
                })
                this.errorContainerElem.append(elem)
            } else {
                const sortedLogs = Array.from(this.errorData.values()).sort((a, b) =>
                    b.timestamp.getTime() - a.timestamp.getTime()
                )
                sortedLogs.forEach(logEntry => {
                    const elem = this.renderLogEntry(logEntry)
                    this.errorContainerElem.appendChild(elem)
                })
            }
        })
    }

    private renderNotificationsPanel($: WeyaElementFunction): void {
        $('div', '.logs-panel', $ => {
            $('div', '.logs-header', $ => {
                $('div', '.logs-title', $ => {
                    $('span', 'Notifications')
                })

                const clearButton = new BasicButton({
                    text: 'Clear',
                    onButtonClick: this.clearNotifications.bind(this),
                    background: false,
                })
                clearButton.render($)
            })

            this.notificationContainerElem = $('div', '.logs-container')
            if (this.notificationData.size === 0) {
                const elem = $('div', '.empty-logs', $ => {
                    $('i', '.fas.fa-bell')
                    $('span', 'No notifications available')
                })
                this.notificationContainerElem.append(elem)
            } else {
                const sortedLogs = Array.from(this.notificationData.values()).sort((a, b) =>
                    b.timestamp.getTime() - a.timestamp.getTime()
                )
                sortedLogs.forEach(logEntry => {
                    const elem = this.renderNotificationEntry(logEntry)
                    this.notificationContainerElem.appendChild(elem)
                })
            }
        })
    }

    private renderLogEntry(logEntry: ExtensionLogEntry): HTMLDivElement {
        return $('div', `.log-entry.${logEntry.type}`, $ => {
            $('div', '.log-header', $ => {
                $('div', '.log-info', $ => {
                    $('i', logEntry.type === 'error' ? '.fas.fa-exclamation-circle' : '.fas.fa-info-circle')
                    $('span', '.log-type', logEntry.type.toUpperCase())
                    if (logEntry.extension) {
                        $('span', '.extension-name', logEntry.extension)
                    }
                })
                $('div', '.log-timestamp', this.formatTimestamp(logEntry.timestamp))
            })

            $('div', '.log-message', $ => {
                const lines = logEntry.message.split('\n')
                const shouldCollapse = lines.length > 3 || logEntry.message.length > 200

                if (shouldCollapse) {
                    const previewLines = lines.slice(0, 3)
                    const preview = previewLines.join('\n')
                    const hasMoreLines = lines.length > 3

                    const previewElem = $('div', '.message-preview', $ => {
                        $('pre', '.test', preview + (hasMoreLines ? '\n...' : ''))
                    })

                    const fullElem = $('div', '.message-full.hide', $ => {
                        $('pre', '.test', logEntry.message)
                    })

                    $('div', '.message-actions', $ => {
                        const expandButton = $('button', '.expand-btn', $ => {
                            $('i', '.fas.fa-chevron-down')
                            $('span', 'Show more')
                        })

                        const collapseButton = $('button', '.collapse-btn.hide', $ => {
                            $('i', '.fas.fa-chevron-up')
                            $('span', 'Show less')
                        })

                        expandButton.onclick = () => {
                            previewElem.classList.add('hide')
                            fullElem.classList.remove('hide')
                            expandButton.classList.add('hide')
                            collapseButton.classList.remove('hide')
                        }

                        collapseButton.onclick = () => {
                            previewElem.classList.remove('hide')
                            fullElem.classList.add('hide')
                            expandButton.classList.remove('hide')
                            collapseButton.classList.add('hide')
                        }
                    })
                } else {
                    $('pre', '.test', logEntry.message)
                }
            })
        })
    }

    private renderManagementPanel($: WeyaElementFunction): void {
        configEditor.render($).then()
    }

    private renderRunningPanel($: WeyaElementFunction): void {
        $('div', '.running-panel', $ => {
            $('div', '.running-header', $ => {
                $('div', '.running-title', $ => {
                    $('span', 'Running Extensions')
                })
                $('div', '.running-count', `${this.runningExtensionsData.size} active`)
            })

            this.extensionContainerElem = $('div', '.running-container')
            if (this.runningExtensionsData.size === 0) {
                const elem = $('div', '.empty-running', $ => {
                    $('i', '.fas.fa-power-off')
                    $('span', 'No running extensions')
                })
                this.extensionContainerElem.append(elem)
            } else {
                const sortedExtensions = Array.from(this.runningExtensionsData.values()).sort((a, b) =>
                    b.startTime.getTime() - a.startTime.getTime()
                )

                sortedExtensions.forEach(extension => {
                    const elem = this.renderRunningExtension(extension)
                    this.extensionContainerElem.appendChild(elem)
                })
            }
        })
    }

    private renderRunningExtension(extension: RunningExtension): HTMLDivElement {
        return $('div', '.running-extension', $ => {
            $('div', '.extension-info', $ => {
                $('div', '.extension-details', $ => {
                    $('div', '.extension-name', extension.name)
                    if (extension.description) {
                        $('div', '.extension-description', extension.description)
                    }
                    $('div', '.extension-runtime', `Running for ${this.formatDuration(extension.startTime)}`)

                    const progressContainer = $('div', '.extension-progress-container.hide', $ => {
                        $('div', '.extension-progress-fill')
                    })

                    const progressFill = progressContainer.querySelector('.extension-progress-fill') as HTMLDivElement

                    let progress = 1
                    if (extension.progress != null && extension.progress > 0) {
                        progress = extension.progress
                    }

                    progressContainer.classList.remove('hide')
                    progressFill.style.width = `${progress}%`
                })

                $('div', '.extension-actions', $ => {
                    const terminateButton = new BasicButton({
                        text: 'Terminate',
                        onButtonClick: () => {
                            extension.onTerminate()
                            this.removeRunningExtension(extension.id)
                        },
                        background: true,
                    })
                    terminateButton.render($)
                })
            })
        })
    }

    private renderNotificationEntry(logEntry: ExtensionLogEntry): HTMLDivElement {
        return $('div', '.notification-entry', $ => {
            $('div', '.notification-header', $ => {
                $('div', '.notification-icon', $ => {
                    $('i', '.fas.fa-bell')
                })

                $('div', '.notification-content', $ => {
                    if (logEntry.title) {
                        $('div', '.notification-title', logEntry.title)
                    }
                    if (logEntry.extension) {
                        $('div', '.notification-extension', logEntry.extension)
                    }
                })

                $('div', '.notification-timestamp', this.formatTimestamp(logEntry.timestamp))
            })

            $('div', '.notification-message', $ => {
                const lines = logEntry.message.split('\n')
                const shouldCollapse = lines.length > 2 || logEntry.message.length > 150

                if (shouldCollapse) {
                    const previewLines = lines.slice(0, 2)
                    const preview = previewLines.join('\n')
                    const hasMoreLines = lines.length > 2

                    const previewElem = $('div', '.message-preview', $ => {
                        $('div', '.notification-text', preview + (hasMoreLines ? '...' : ''))
                    })

                    const fullElem = $('div', '.message-full.hide', $ => {
                        $('div', '.notification-text', logEntry.message)
                    })

                    $('div', '.message-actions', $ => {
                        const expandButton = $('button', '.expand-btn', $ => {
                            $('i', '.fas.fa-chevron-down')
                            $('span', 'Show more')
                        })

                        const collapseButton = $('button', '.collapse-btn.hide', $ => {
                            $('i', '.fas.fa-chevron-up')
                            $('span', 'Show less')
                        })

                        expandButton.onclick = () => {
                            previewElem.classList.add('hide')
                            fullElem.classList.remove('hide')
                            expandButton.classList.add('hide')
                            collapseButton.classList.remove('hide')
                        }

                        collapseButton.onclick = () => {
                            previewElem.classList.remove('hide')
                            fullElem.classList.add('hide')
                            expandButton.classList.remove('hide')
                            collapseButton.classList.add('hide')
                        }
                    })
                } else {
                    $('div', '.notification-text', logEntry.message)
                }
            })
        })
    }

    private formatTimestamp(date: Date): string {
        return date.toLocaleTimeString()
    }

    private formatDuration(startTime: Date): string {
        const now = new Date()
        const diffMs = now.getTime() - startTime.getTime()
        const diffMinutes = Math.floor(diffMs / 60000)
        const diffSeconds = Math.floor((diffMs % 60000) / 1000)

        if (diffMinutes > 0) {
            return `${diffMinutes}m ${diffSeconds}s`
        }
        return `${diffSeconds}s`
    }

    private startPeriodicRefresh(): void {
        this.refreshInterval = setInterval(() => {
            if (this.currentTask === EXTENSIONS_TASK && this.panelElem && this.runningExtensionsData.size > 0) {
                this.renderPanel(EXTENSIONS_TASK)
            }
        }, 3000)
    }

    private stopPeriodicRefresh(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
            this.refreshInterval = null
        }
    }

    public destroy(): void {
        this.stopPeriodicRefresh()
    }

    private enforceLogLimit(task: string): void {
        let data: Map<string, ExtensionLogEntry> = null
        let elems: Map<string, HTMLDivElement> = null
        if (task === UPDATES_TASK) {
            data = this.updatesData
            elems = this.updateElems
        } else if (task === ERROR_TASK) {
            data = this.errorData
            elems = this.errorElems
        } else if (task === NOTIFICATION_TASK) {
            data = this.notificationData
            elems = this.notificationElems
        } else {
            throw new Error('invalid task')
        }

        if (data.size <= MAX_LOGS) {
            return
        }

        const sortedLogs = Array.from(data.values()).sort((a, b) =>
            a.timestamp.getTime() - b.timestamp.getTime()
        )

        const logsToRemove = data.size - MAX_LOGS

        for (let i = 0; i < logsToRemove; i++) {
            const logToRemove = sortedLogs[i]

            const logElem = elems.get(logToRemove.id)
            if (logElem && logElem.parentNode) {
                logElem.parentNode.removeChild(logElem)
            }

            elems.delete(logToRemove.id)
            data.delete(logToRemove.id)
        }
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2)
    }
}

export const extensionPane = new ExtensionPane()