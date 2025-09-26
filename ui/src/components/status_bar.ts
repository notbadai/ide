import {Weya as $} from '../../../lib/weya/weya'

class StatusBar {
    private elem: HTMLDivElement

    private languageElem: HTMLSpanElement
    private messageElem: HTMLSpanElement
    private gitBranchElem: HTMLSpanElement
    private requestsElem: HTMLSpanElement

    constructor() {
    }

    public render() {
        this.elem = $('div', '.status-bar', $ => {
            $('div', '.status-section.left', $ => {
                $('span', '.status-item.git-branch', $ => {
                    $('span', '.fas.fa-code-branch')
                    this.gitBranchElem = $('span', '.name')
                })
                this.requestsElem = $('span', '.status-item.requests', '')
                this.messageElem = $('span', '.status', '')
            })

            $('div', '.status-section.right', $ => {
                this.languageElem = $('span', '.status-item.language', '')
            })
        })

        return this.elem
    }

    public updateMessage(message: string) {
        if (this.messageElem == null) {
            return
        }
        this.messageElem.textContent = message
    }

    public updateFileName(fileName: string, language: string) {
        if (fileName.trim().length === 0) {
            return
        }
        this.languageElem.textContent = language
    }

    public updateGitBranch(branch: string) {
        this.gitBranchElem.textContent = branch
    }

    private setTimeoutStatus(className: string) {
        this.elem.classList.add(className)

        setTimeout(() => {
            this.elem.classList.remove(className)
            this.messageElem.textContent = ''
        }, 1500)
    }

    public success(message: string) {
        if (this.messageElem == null) {
            return
        }
        this.messageElem.textContent = message
        this.setTimeoutStatus('success')
    }

    public startLoading(message: string) {
        if (this.messageElem == null) {
            return
        }
        this.messageElem.textContent = message
        this.elem.classList.add('loading')
    }

    public stopLoading(message: string = '') {
        if (this.messageElem == null) {
            return
        }
        this.messageElem.textContent = message
        this.elem.classList.remove('loading')
    }

    public updateActiveRequests(count: number) {
        this.requestsElem.textContent = `${count} autocompletion request${count === 1 ? '' : 's'}`
    }
}

export const statusBar = new StatusBar()