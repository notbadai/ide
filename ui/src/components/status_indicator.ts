import {Weya as $, WeyaElementFunction} from "../../../lib/weya/weya"
import {clearChildElements} from "../utils/document"

export type StatusType = 'success' | 'warning' | 'error' | 'info'

export interface StatusIndicatorOptions {
    type: StatusType
    text: string
    icon?: string
    inline?: boolean
}

export class StatusIndicator {
    private elem: HTMLDivElement

    private type: StatusType
    private text: string
    private icon?: string
    private readonly inline?: boolean

    constructor(options: StatusIndicatorOptions) {
        this.type = options.type
        this.icon = options.icon
        this.inline = options.inline
        this.text = options.text
    }

    public render($: WeyaElementFunction): HTMLDivElement {
        this.elem = $('div', 'status')
        this.updateStatus()
        return this.elem
    }

    public updateStatus(text?: string, type?: StatusType, icon?: string): void {
        if (text != null) {
            this.text = text
        }

        if (icon != null) {
            this.icon = icon
        }
        if (type != null) {
            this.type = type
        }

        const cssClass = this.inline ? 'status-indicator-inline' : 'status-indicator-block'

        clearChildElements(this.elem)
        $(this.elem, $ => {
            $('div', `.status-indicator.${this.type}.${cssClass}`, $ => {
                if (this.icon) {
                    $('i', `.fas.fa-${this.icon}`)
                } else {
                    const defaultIcons = {
                        success: 'check-circle',
                        warning: 'exclamation-triangle',
                        error: 'exclamation-circle',
                        info: 'info-circle'
                    }
                    $('i', `.fas.fa-${defaultIcons[this.type]}`)
                }
                $('span', this.text)
            })
        })
    }
}