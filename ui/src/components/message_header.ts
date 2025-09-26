import {WeyaElementFunction} from "../../../lib/weya/weya"

export class MessageHeader {
    private readonly role: string

    private elem: HTMLDivElement

    constructor(role: string) {
        this.role = role
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.message-header', $ => {
            if (this.role == 'user') {
                $('i', '.fas.fa-user.icon.user', '')
                $('span', '.role', 'You')
            } else {
                $('i', '.fas.fa-robot.icon.assistant', '')
                $('span', '.role', 'Assistant')
            }
        })
    }
}