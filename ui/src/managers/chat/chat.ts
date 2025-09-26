import {Weya as $, WeyaElementFunction} from '../../../../lib/weya/weya'
import {BasicButton} from "../../components/buttons"
import {Input} from "../../components/input"
import {Message} from "../../components/message"
import {extensionManager} from "../extensions/manager"
import {BaseComponent} from "../../components/base"
import {projectManager} from "../project/manager"
import {Dropdown} from "../../components/dropdown"
import {clearChildElements} from "../../utils/document"
import {ExtensionResponse} from "../../models/extension"
import {Context} from './context'
import {popup} from '../../components/popup'


export class Chat extends BaseComponent {
    private elem: HTMLDivElement

    private messageThreadElem: HTMLDivElement
    private userInputElem: HTMLDivElement
    private dropdownButtonElem: HTMLSpanElement
    private dropdownButtonTextElem: HTMLSpanElement

    private sendButton: BasicButton
    private TerminateButton: BasicButton
    private clearChatButton: BasicButton
    private contextButton: BasicButton
    private input: Input
    private dropdown: Dropdown
    private readonly context: Context

    private currentExtension: string

    private messages: Message[]
    private isMessageThreadScrolledBottom: boolean
    private websocketDataQueue: ExtensionResponse[]
    private isResponseRendering: boolean

    private readonly uuid: string
    private renderTimer: number | null

    constructor() {
        super()

        this.isMessageThreadScrolledBottom = true
        this.isResponseRendering = false
        this.websocketDataQueue = []
        this.messages = []

        this.sendButton = new BasicButton({
            icon: '.fas.fa-arrow-alt-circle-up.fa-2x.icon',
            onButtonClick: this.onSend
        })
        this.TerminateButton = new BasicButton({
            icon: '.fas.fa-stop.fa-2x.icon',
            onButtonClick: this.onTerminate.bind(this)
        })
        this.clearChatButton = new BasicButton({
            text: 'Clear',
            onButtonClick: this.onClearChat.bind(this),
            isSmallButton: true,
        })
        this.contextButton = new BasicButton({
            text: 'Context',
            icon: '.fas.fa-plus',
            isSmallButton: true,
            onButtonClick: this.onContextClick.bind(this)
        })

        this.input = new Input({
            placeholder: 'Ask anything...',
            onInput: this.onInput.bind(this),
            onKeyDown: this.onKeyDown.bind(this)
        })
        this.context = new Context({
            onSelectionChange: (count: number) => {
                if (count > 0) {
                    this.contextButton.setText(`Context (${count})`)
                } else {
                    this.contextButton.setText('Context')
                }
            }
        })

        this.currentExtension = null
        projectManager.setOnFileSaveCallback(this.renderDropdown.bind(this))

        this.uuid = extensionManager.register({
            type: "chat",
            name: 'chat',
            onReceive: this.onReceive.bind(this)
        })
        this.renderTimer = null
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.chat', $ => {
            this.messageThreadElem = $('div', '.messages')
            $('div', '.buttons', $ => {
                $('div', '.buttons-left', $ => {
                    this.contextButton.render($)
                })
                $('div', '.buttons-right', $ => {
                    this.dropdownButtonElem = $('span', '.drop-down-btn')
                    this.clearChatButton.render($)
                })
            })
            this.userInputElem = $('div', '.user-inputs')
        })

        this.messageThreadElem.addEventListener('scroll', (e) => {
            const scrollableHeight = this.messageThreadElem.scrollHeight - this.messageThreadElem.clientHeight
            this.isMessageThreadScrolledBottom = Math.abs(scrollableHeight - this.messageThreadElem.scrollTop) <= 1
        })

        this.renderUserInput()
        this.renderDropdown()

        return this.elem
    }

    public renderExtensions() {
        this.renderDropdown()
    }

    private onContextClick(): void {
        popup.renderContent(this.context)
    }

    private renderDropdown(): void {
        if (this.dropdownButtonElem == null) {
            return
        }
        if (projectManager.project == null) {
            return
        }
        clearChildElements(this.dropdownButtonElem)

        const extensions = projectManager.project.extensions.chat

        if (extensions.length === 0) {
            return
        }

        let options = []
        for (const extension of extensions) {
            options.push({
                text: extension, onClick: () => {
                    this.currentExtension = extension
                    this.dropdownButtonTextElem.textContent = this.currentExtension
                }
            })
        }

        if (this.currentExtension == null) {
            this.currentExtension = extensions[0]
        }

        this.dropdown = new Dropdown({options: options})

        $(this.dropdownButtonElem, $ => {
            this.dropdownButtonTextElem = $('span', `${this.currentExtension}`)
            $('i', '.fas.fa-chevron-down')
            this.dropdown.render($)
        })

        this.dropdownButtonElem.onclick = () => {
            this.dropdown.display(true)
        }

        document.addEventListener('click', (e: MouseEvent) => {
            if (!this.dropdownButtonElem?.contains(e.target as Node)) {
                this.dropdown.display(false)
            }
        })
    }

    private renderUserInput() {
        $(this.userInputElem, $ => {
            $('div', '.inputs', $ => {
                $('div', '.input-container', $ => {
                    this.input.render($)
                })
                this.sendButton.render($)
                this.sendButton.disabled = true
                this.TerminateButton.render($)
                this.TerminateButton.displayNone(true)
            })
        })
    }

    private onSend = async () => {
        let inputText = this.input.value

        if (this.messages.length > 0) {
            this.getLastUserMessage()?.displayEditButtons(false)
        }
        this.addNewMessage(inputText, 'user')

        let messages = []
        for (const message of this.messages) {
            messages.push(message.toData())
        }

        this.websocketDataQueue = []

        let sendData = {
            messages: messages,
            extension: this.currentExtension,
            context_paths: this.context.getSelectedPaths(),
        }

        this.input.resetTextArea()
        this.renderMessageLoading(true)

        let message = this.addNewMessage('', 'assistant')
        message.hideMessageLoading(false)

        this.scrollMessageThread(true)
        this.sendButton.disabled = true

        await extensionManager.run(this.uuid, sendData)
    }

    private onTerminate = async () => {
        await extensionManager.terminate(this.uuid)
    }

    private onClearChat() {
        this.messages = []
        while (this.messageThreadElem.hasChildNodes()) {
            this.messageThreadElem.firstChild.remove()
        }
    }

    private onInput = (e) => {
        this.sendButton.disabled = this.input.value === ''
    }

    private onKeyDown = async (e) => {
        let lastMessage = this.getLastMessage()

        if (e.key === 'Enter' && e.shiftKey) {
            this.input.resizeTextArea(true)
            return
        }

        if (e.key === 'Enter' && lastMessage != null && lastMessage.isMessageLoading) {
            this.input.resizeTextArea(true)
            return
        }

        if (e.key === 'Enter' && this.input.value !== '') {
            e.preventDefault()
            await this.onSend()
            return
        }

        if (e.key === "Backspace" || e.key === "Delete") {
            this.input.resizeTextArea()
            return
        }

        if (!this.input.isMaxHeight) {
            this.input.resizeTextArea()
        }
    }

    private addNewMessage(initText: string, role: string): Message {
        let isUser = role === 'user'

        let message = new Message({
            initText: initText,
            role: role,
            onSubmitClick: isUser ? this.onEditedSubmit : null,
        })
        this.messages.push(message)
        this.messageThreadElem.appendChild(message.render($))

        return message
    }

    private onEditedSubmit = async () => {
        this.removeLastMessage()

        let messages = []
        for (const message of this.messages) {
            messages.push(message.toData())
        }

        this.websocketDataQueue = []

        let sendData = {
            messages: messages,
            extension: this.currentExtension,
            context_paths: this.context.getSelectedPaths(),
        }

        this.renderMessageLoading(true)

        let message = this.addNewMessage('', 'assistant')
        message.hideMessageLoading(false)

        this.scrollMessageThread(true)
        this.sendButton.disabled = true

        await extensionManager.run(this.uuid, sendData)
    }

    private renderMessageLoading(isLoading: boolean) {
        this.sendButton.displayNone(isLoading)
        this.TerminateButton.displayNone(!isLoading)
        this.clearChatButton.disabled = isLoading
    }

    private scrollMessageThread(isForced: boolean = false) {
        if (!isForced && !this.isMessageThreadScrolledBottom) {
            return
        }
        this.messageThreadElem.scrollTop = this.messageThreadElem.scrollHeight
        this.isMessageThreadScrolledBottom = true
    }

    private removeLastMessage() {
        let message = this.messages.pop()
        message.remove()
    }

    private getLastMessage(): Message {
        return this.messages[this.messages.length - 1]
    }

    private getLastUserMessage(): Message {
        for (let i = this.messages.length - 1; i >= 0; --i) {
            if (this.messages[i].role === 'user') {
                return this.messages[i]
            }
        }
    }

    private renderResponse = async () => {
        this.isResponseRendering = true

        const message = this.getLastMessage()
        if (message == null) {
            this.websocketDataQueue = []
            this.isResponseRendering = false
            return
        }

        let aggregatedChunk = ''
        let isStopped = false
        while (this.websocketDataQueue.length > 0) {
            const data = this.websocketDataQueue.shift()

            aggregatedChunk += data.chat?.chunk ?? ''
            isStopped = data.is_stopped
        }

        if (aggregatedChunk !== '') {
            message.update(aggregatedChunk)
        }

        if (isStopped) {
            message.hideMessageLoading(isStopped)
            this.renderMessageLoading(message.isMessageLoading)
        }
        this.scrollMessageThread()

        await new Promise(resolve => requestAnimationFrame(resolve))

        this.isResponseRendering = false

        // schedule another render if more data arrived
        if (this.websocketDataQueue.length > 0) {
            this.renderResponse().then()
        }
    }

    private scheduleRender() {
        if (this.renderTimer !== null) {
            return
        }

        this.renderTimer = window.requestAnimationFrame(() => {
            this.renderTimer = null
            this.renderResponse().then()
        })
    }


    public onReceive(data: ExtensionResponse) {
        this.websocketDataQueue.push(data)

        if (!this.isResponseRendering) {
            this.renderResponse().then()
        } else {
            this.scheduleRender()
        }
    }

    public destroy(): void {
        const message = this.getLastMessage()
        if (message?.isMessageLoading) {
            this.onTerminate().then()
        }
        extensionManager.unregister(this.uuid)
    }

    public getElement(): HTMLDivElement {
        return this.elem
    }

    public startExternalMessage() {
        const lastUserMessage = this.getLastUserMessage()
        if (lastUserMessage != null) {
            lastUserMessage.displayEditButtons(false)
        }

        this.websocketDataQueue = []

        this.renderMessageLoading(true)

        let message = this.addNewMessage('', 'assistant')
        message.hideMessageLoading(false)

        this.scrollMessageThread(true)
        this.sendButton.disabled = true
    }

    public onExternalReceive(data: ExtensionResponse) {
        this.websocketDataQueue.push(data)
        if (!this.isResponseRendering) {
            this.renderResponse().then()
        }
    }

    public endExternalMessage() {
        const message = this.getLastMessage()
        message.hideMessageLoading(true)
        this.renderMessageLoading(message.isMessageLoading)
        this.scrollMessageThread()
    }
    
    public getUUID(): string {
        return this.uuid
    }

    public setInputText(text: string): void {
        this.input.value = text
        this.input.resizeTextArea(!this.isVisible())
        this.sendButton.disabled = this.input.value === ''
    }

    public focus(){
        this.input.focus()
    }

    public isVisible(): boolean {
        if (!this.elem) {
            return false
        }

        if (!document.contains(this.elem)) {
            return false
        }

        const rect = this.elem.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) {
            return false
        }

        const style = window.getComputedStyle(this.elem)
        return !(style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0');
    }
}