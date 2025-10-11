import {WeyaElementFunction} from "../../../../lib/weya/weya"
import {resizableSplitView} from "../../components/resizable_split_view"
import {ActivityState} from "../../models/project"

export const PROJECT = 'project'
export const CHAT = 'chat'
export const EXTENSIONS = 'extensions'
export const TOOLS = 'tools'
export const TERMINAL_PANEL = 'terminal panel'
export const INSPECTOR_PANEL = 'inspector panel'

export interface ActivityBarOptions {
    components: {
        [key: string]: any
    }
}

type Activity =
    typeof PROJECT |
    typeof CHAT |
    typeof EXTENSIONS |
    typeof TOOLS |
    typeof TERMINAL_PANEL |
    typeof INSPECTOR_PANEL

class ActivityBarManager {
    private elem: HTMLElement

    private topButtonElems: HTMLButtonElement[]
    private bottomButtonElems: HTMLButtonElement[]

    private explorerElem: HTMLButtonElement
    private chatElem: HTMLButtonElement
    private extensionsElem: HTMLButtonElement
    private toolsElem: HTMLButtonElement
    private inspectorElem: HTMLButtonElement
    private terminalElem: HTMLButtonElement

    private notificationBadges: Map<string, HTMLSpanElement> = new Map()
    private errorBadges: Map<string, HTMLSpanElement> = new Map()
    private progressBars: Map<string, HTMLDivElement> = new Map()

    private components: Map<string, any> = new Map()

    private currentTopActivity: string
    private currentBottomActivity: string

    constructor() {
        this.currentTopActivity = PROJECT
        this.currentBottomActivity = TERMINAL_PANEL
    }

    public init(opt: ActivityBarOptions) {
        Object.entries(opt.components).forEach(([key, component]) => {
            this.components.set(key, component)
        })
    }

    private getComponent(activity: string): any {
        return this.components.get(activity)
    }

    private removeTopSelected() {
        for (const buttonElem of this.topButtonElems) {
            if (buttonElem.classList.contains('selected')) {
                buttonElem.classList.remove('selected')
            }
        }
    }

    private removeBottomSelected() {
        for (const buttonElem of this.bottomButtonElems) {
            if (buttonElem.classList.contains('selected')) {
                buttonElem.classList.remove('selected')
            }
        }
    }

    private createNotificationBadge($: WeyaElementFunction, activity: string): HTMLSpanElement {
        const badge = $('span', '.notification-badge.hide')
        this.notificationBadges.set(activity, badge)
        return badge
    }

    private createErrorBadge($: WeyaElementFunction, activity: string): HTMLSpanElement {
        const badge = $('span', '.error-badge.hide')
        this.errorBadges.set(activity, badge)
        return badge
    }

    private createProgressBar($: WeyaElementFunction, activity: string): HTMLDivElement {
        const progressContainer = $('div', '.progress-bar-container.hide', $ => {
            $('div', '.progress-bar-fill')
        })
        this.progressBars.set(activity, progressContainer)
        return progressContainer
    }

    public render($: WeyaElementFunction) {
        this.elem = $('nav', '.activity-bar', $ => {
            $('div', '.activity-bar-top', $ => {
                this.explorerElem = $('button', '.activity-btn', {title: 'Explorer'}, $ => {
                    $('i', '.far.fa-copy')
                    this.createNotificationBadge($, PROJECT)
                    this.createErrorBadge($, PROJECT)
                    this.createProgressBar($, PROJECT)
                })
                this.chatElem = $('button', '.activity-btn', {title: 'Chat'}, $ => {
                    $('i', '.far.fa-comment-alt')
                    this.createNotificationBadge($, CHAT)
                    this.createErrorBadge($, CHAT)
                    this.createProgressBar($, CHAT)
                })
                this.toolsElem = $('button', '.activity-btn', {title: 'Tools'}, $ => {
                    $('i', '.fas.fa-tools')
                    this.createNotificationBadge($, TOOLS)
                    this.createErrorBadge($, TOOLS)
                    this.createProgressBar($, TOOLS)
                })
                this.extensionsElem = $('button', '.activity-btn', {title: 'Extensions'}, $ => {
                    $('i', '.fas.fa-puzzle-piece')
                    this.createNotificationBadge($, EXTENSIONS)
                    this.createErrorBadge($, EXTENSIONS)
                    this.createProgressBar($, EXTENSIONS)
                })
            })

            $('div', '.activity-bar-bottom', $ => {
                this.inspectorElem = $('button', '.activity-btn', {title: 'Inspector'}, $ => {
                    $('i', '.fas.fa-wrench')
                    this.createNotificationBadge($, INSPECTOR_PANEL)
                    this.createErrorBadge($, INSPECTOR_PANEL)
                    this.createProgressBar($, INSPECTOR_PANEL)
                })
                this.terminalElem = $('button', '.activity-btn', {title: 'Terminal'}, $ => {
                    $('i', '.fas.fa-terminal')
                    this.createNotificationBadge($, TERMINAL_PANEL)
                    this.createErrorBadge($, TERMINAL_PANEL)
                    this.createProgressBar($, TERMINAL_PANEL)
                })
            })

            this.topButtonElems = [this.explorerElem, this.chatElem, this.extensionsElem, this.toolsElem]
            this.bottomButtonElems = [this.inspectorElem, this.terminalElem]

            this.selectTopActivity(this.currentTopActivity)
            this.selectBottomActivity(this.currentBottomActivity)
        })

        this.explorerElem.onclick = () => {
            this.selectTopActivity(PROJECT, true)
        }

        this.chatElem.onclick = () => {
            this.selectTopActivity(CHAT, true)
        }

        this.extensionsElem.onclick = () => {
            this.selectTopActivity(EXTENSIONS, true)
        }

        this.toolsElem.onclick = () => {
            this.selectTopActivity(TOOLS, true)
        }

        this.inspectorElem.onclick = () => {
            this.selectBottomActivity(INSPECTOR_PANEL, true)
        }

        this.terminalElem.onclick = () => {
            this.selectBottomActivity(TERMINAL_PANEL, true)
        }

        return this.elem
    }

    public showNotifications(activity: string, count: number): void {
        const badge = this.notificationBadges.get(activity)

        if (count <= 0) {
            badge.classList.add('hide')
            return
        }

        badge.textContent = count > 99 ? '99+' : count.toString()
        badge.classList.remove('hide')
    }

    public clearNotifications(activity: string): void {
        const badge = this.notificationBadges.get(activity)
        badge.classList.add('hide')
        badge.textContent = ''
    }

    public showErrors(activity: string, count: number): void {
        const badge = this.errorBadges.get(activity)

        if (count <= 0) {
            badge.classList.add('hide')
            return
        }

        badge.textContent = count > 99 ? '99+' : count.toString()
        badge.classList.remove('hide')
    }

    public clearErrors(activity: string): void {
        const badge = this.errorBadges.get(activity)
        badge.classList.add('hide')
        badge.textContent = ''
    }

    public showProgress(activity: string, percentage: number): void {
        const progressContainer = this.progressBars.get(activity)
        const progressFill = progressContainer.querySelector('.progress-bar-fill') as HTMLDivElement

        // clamp percentage between 0 and 100
        const clampedPercentage = Math.max(0, Math.min(100, percentage))

        progressContainer.classList.remove('hide')
        progressFill.style.width = `${clampedPercentage}%`
    }

    public clearProgress(activity: string): void {
        const progressContainer = this.progressBars.get(activity)
        const progressFill = progressContainer.querySelector('.progress-bar-fill') as HTMLDivElement

        progressFill.style.width = '0%'
        progressContainer.classList.add('hide')
    }

    public selectTopActivity(activity: string, isClicked: boolean = false) {
        this.removeTopSelected()

        if (activity === PROJECT) {
            this.explorerElem.classList.add('selected')
        }
        if (activity === CHAT) {
            this.chatElem.classList.add('selected')
        }
        if (activity === EXTENSIONS) {
            this.extensionsElem.classList.add('selected')
        }
        if (activity === TOOLS) {
            this.toolsElem.classList.add('selected')
        }

        if (isClicked) {
            this.onTopActivityBarClick(activity)
        }
    }

    public selectBottomActivity(activity: string, isClicked: boolean = false) {
        this.removeBottomSelected()

        if (activity === INSPECTOR_PANEL) {
            this.inspectorElem.classList.add('selected')
        }

        if (activity === TERMINAL_PANEL) {
            this.terminalElem.classList.add('selected')
        }

        if (isClicked) {
            this.onBottomActivityBarClick(activity).then()
        }
    }

    private updateConfig() {
        window.electronAPI.updateWorkspaceConfig({
            activityState: {
                topActivity: this.currentTopActivity,
                bottomActivity: this.currentBottomActivity
            }
        }).then()
    }

    private onTopActivityBarClick(activity: string, toggle: boolean = true): void {
        if (toggle && activity == this.currentTopActivity) {
            resizableSplitView.toggleCloseLeftElem()
            return
        }

        this.currentTopActivity = activity

        const component = this.getComponent(activity)
        resizableSplitView.leftRender(component)
        component.onActive().then()

        this.updateConfig()
    }

    private async onBottomActivityBarClick(activity: string, toggle: boolean = true): Promise<void> {
        if (toggle && activity === this.currentBottomActivity) {
            resizableSplitView.toggleCloseBottomElem()
            return
        }

        this.currentBottomActivity = activity

        const component = this.getComponent(activity)
        if (activity === TERMINAL_PANEL) {
            await resizableSplitView.bottomRender(component, 'Terminal')
        } else if (activity === INSPECTOR_PANEL) {
            await resizableSplitView.bottomRender(component, 'Inspector')
        }

        this.updateConfig()
    }

    public async restoreActivity(activityState: ActivityState): Promise<void> {
        if (activityState == null) {
            return
        }

        if (this.currentTopActivity !== activityState.topActivity) {
            this.selectTopActivity(activityState.topActivity)
            this.onTopActivityBarClick(activityState.topActivity, false)
        }
        if (this.currentBottomActivity !== activityState.bottomActivity) {
            this.selectBottomActivity(activityState.bottomActivity)
            await this.onBottomActivityBarClick(activityState.bottomActivity, false)
        }
    }

    public openTopTab(activity: Activity) {
        this.selectTopActivity(activity)
        this.onTopActivityBarClick(activity, false)
    }

    public openBottomTab(activity: Activity) {
        this.selectBottomActivity(activity)
        this.onBottomActivityBarClick(activity, false).then()
    }
}

export const activityBarManager = new ActivityBarManager()