import {Weya as $, WeyaElementFunction} from "../../../../lib/weya/weya"
import {BaseComponent} from "../../components/base"
import {clearChildElements} from "../../utils/document"
import {Chat} from "./chat"
import {voiceManager} from "../voice/manager"

interface ChatTab {
    id: string
    title: string
    chatInstance: Chat
}

const MAX_CHAT_TABS = 5

class ChatManager extends BaseComponent {
    private elem: HTMLElement
    private tabListElem: HTMLDivElement
    private contentElem: HTMLDivElement
    private addTabButtonElem: HTMLButtonElement
    private voiceElem: HTMLDivElement

    private tabs: ChatTab[]
    private activeTabId: string | null
    private nextTabNumber: number

    constructor() {
        super()
        this.tabs = []
        this.activeTabId = null
        this.nextTabNumber = 1
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.chat-manager', $ => {
            this.tabListElem = $('div', '.tab-list', $ => {
                this.addTabButtonElem = $('button', '.add-tab-btn', {
                    on: {
                        click: () => {
                            this.addNewChat()
                        }
                    }
                }, $ => {
                    $('i', '.fas.fa-plus')
                })
            })
            this.contentElem = $('div', '.tab-content')
            this.voiceElem = $('div', '.voice-hint')
        })

        if (this.tabs.length < 1) {
            await this.addNewChat('Chat')
        }
        this.renderVoiceHint()

        return this.elem
    }

    private renderVoiceHint() {
        clearChildElements(this.voiceElem)
        $(this.voiceElem, $ => {
            $('i', '.fas.fa-microphone')
            $('span', 'Press Caps Lock to use voice')
        })
    }

    public startRecording() {
        clearChildElements(this.voiceElem)
        $(this.voiceElem, $ => {
            $('span', '.listening', $ => {
                $('span', '.fas.fa-microphone')
                $('div', '.listening-waveform', $ => {
                    for (let i = 0; i < 5; i++) {
                        $('div', '.wave-bar')
                    }
                })
                $('span', '.status', 'Listening, press Caps Lock to stop')
            })
        })
    }

    public stopRecording() {
        this.renderVoiceHint()
    }

    // create initial chat if no tabs exist
    private async addNewChat(title: string = null, shouldActive: boolean = true): Promise<Chat> {
        // check if we've reached the maximum number of tabs
        if (this.tabs.length >= MAX_CHAT_TABS) {
            alert(`You can only create up to ${MAX_CHAT_TABS} chat tabs at once.`)
            return null
        }

        if (title == null) {
            title = `New Chat ${this.nextTabNumber}`
        }

        // create a new Chat instance for this tab
        const newChatInstance = new Chat()

        const newTab: ChatTab = {
            id: newChatInstance.getUUID(),
            title: title,
            chatInstance: newChatInstance
        }

        this.tabs.push(newTab)
        this.nextTabNumber++

        if (shouldActive) {
            this.activeTabId = newTab.id
        } else {
            const currentActiveId = this.activeTabId
            this.activeTabId = newTab.id
            await this.renderActiveContent()
            this.activeTabId = currentActiveId
        }

        this.renderTabs()
        await this.renderActiveContent()

        return newChatInstance
    }

    private removeTab(tabId: string): void {
        const tabIndex = this.tabs.findIndex(tab => tab.id === tabId)
        if (tabIndex === -1) {
            return
        }

        // don't allow removing the last tab
        if (this.tabs.length === 1) {
            return
        }

        // get the tab to remove and destroy its chat instance
        const tabToRemove = this.tabs[tabIndex]
        tabToRemove.chatInstance.destroy()

        // remove the tab
        this.tabs.splice(tabIndex, 1)

        // update active tab if needed
        if (this.activeTabId === tabId) {
            // select the previous tab, or the first one if we removed the first tab
            const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0
            this.activeTabId = this.tabs[newActiveIndex]?.id || null
        }

        this.renderTabs()
        this.renderActiveContent().then()
    }

    private selectTab(tabId: string): void {
        if (this.activeTabId === tabId) {
            return
        }

        this.activeTabId = tabId
        this.renderTabs()
        this.renderActiveContent().then()
    }

    private renderTabs(): void {
        // clear existing tabs (but keep the add button)
        const addButton = this.addTabButtonElem
        clearChildElements(this.tabListElem)
        this.tabListElem.appendChild(addButton)

        // render tabs
        this.tabs.forEach(tab => {
            const tabElem = $('div', `.tab${tab.id === this.activeTabId ? '.active' : ''}`, $ => {
                const titleElem = $('span', '.tab-title')
                titleElem.textContent = tab.title

                // only show close button if there's more than one tab
                if (this.tabs.length > 1) {
                    $('button', '.close', {
                        on: {
                            click: (e: MouseEvent) => {
                                e.stopPropagation()
                                this.removeTab(tab.id)
                            }
                        }
                    }, $ => {
                        $('i', '.fas.fa-times')
                    })
                }
            })

            tabElem.onclick = (e: MouseEvent) => {
                e.stopPropagation()
                this.selectTab(tab.id)
            }

            // insert before the add button
            this.tabListElem.insertBefore(tabElem, addButton)
        })
    }

    private async renderActiveContent(): Promise<void> {
        clearChildElements(this.contentElem)

        const activeTab = this.tabs.find(tab => tab.id === this.activeTabId)
        if (!activeTab) {
            return
        }

        // render the specific chat instance for this tab
        $(this.contentElem, async $ => {
            let chatElement = activeTab.chatInstance.getElement()
            if (chatElement == null) {
                chatElement = await activeTab.chatInstance.render($)
            }
            this.contentElem.appendChild(chatElement)
        })

        await new Promise(resolve => requestAnimationFrame(resolve))
        activeTab.chatInstance.focus()

        this.setupVoiceRecorderForActiveChat(activeTab)
    }

    private setupVoiceRecorderForActiveChat(activeTab: ChatTab): void {
        if (activeTab) {
            voiceManager.setOnAudioProcessed((text: string) => {
                activeTab.chatInstance.setInputText(text)
                activeTab.chatInstance.focus()
            })
        }
    }

    public renderExtensions() {
        // update all chat instances with new extensions
        this.tabs.forEach(tab => {
            tab.chatInstance.renderExtensions()
        })
    }

    public destroy(): void {
        // clean up all chat instances
        this.tabs.forEach(tab => {
            tab.chatInstance.destroy()
        })
        this.tabs = []
    }

    public async getOrStartExternalChat(chatId: string, title: string): Promise<Chat> {
        const tabIndex = this.tabs.findIndex(tab => tab.id === chatId)

        let chatInstance = null
        if (tabIndex === -1) {
            chatInstance = await this.addNewChat(title, false)
            chatInstance?.startExternalMessage()
        } else {
            chatInstance = this.tabs[tabIndex].chatInstance
        }

        return chatInstance
    }

    public getExternalChat(chatId: string): Chat {
        const tabIndex = this.tabs.findIndex(tab => tab.id === chatId)
        if (tabIndex === -1) {
            return null
        }

        return this.tabs[tabIndex].chatInstance
    }
}

export const chatManager = new ChatManager()