import {WeyaElement, WeyaElementFunction} from "../../../lib/weya/weya"
import {BasicButton} from "./buttons"

interface FileCreatorOptions {
    defaultPath: string
    onCreateClick?: (filePath: string) => void
    onCancelClick?: () => void
}

export class FileCreator {
    private readonly defaultPath: string
    private readonly onCreateClick: (filePath: string) => void
    private readonly onCancelClick: () => void

    private elem: WeyaElement
    private inputElem: HTMLInputElement
    private createButton: BasicButton
    private cancelButton: BasicButton

    constructor(opt: FileCreatorOptions) {
        this.defaultPath = opt.defaultPath
        this.onCreateClick = opt.onCreateClick
        this.onCancelClick = opt.onCancelClick

        this.createButton = new BasicButton({onButtonClick: this.onCreate, text: 'Create', background: true})
        this.cancelButton = new BasicButton({onButtonClick: this.onCancel, text: 'Cancel', onHoverEffect: true})
    }

    private onCreate = () => {
        const filePath = this.inputElem.value.trim()
        if (!filePath) {
            return
        }

        if (this.onCreateClick) {
            this.onCreateClick(filePath)
        }
    }

    private onCancel = () => {
        if (this.onCancelClick) {
            this.onCancelClick()
        }
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.file-creator', $ => {
            $('div', '.file-creator-header', $ => {
                $('h4', 'Create New File')
            })

            $('div', '.file-creator-content', $ => {
                $('div', '.input-group', $ => {
                    $('label', 'Path:')
                    this.inputElem = $('input', '.file-path-input', {
                        type: 'text',
                        value: this.defaultPath,
                    })
                })
            })

            $('div', '.file-creator-actions', $ => {
                this.createButton.render($)
                this.cancelButton.render($)
            })
        })

        return this.elem
    }
}