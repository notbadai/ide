import {Weya as $, WeyaElementFunction} from '../../../lib/weya/weya'
import {clearChildElements} from '../utils/document'
import {BaseComponent} from './base'
import {projectManager} from "../managers/project/manager"

const MIN_BOTTOM = 80
const MIN_TOP = 80

class ResizableSplitView {
    private elem!: HTMLDivElement

    private leftElem!: HTMLDivElement
    private resizerElem!: HTMLDivElement
    private middleElem!: HTMLDivElement
    private topWrapperElem!: HTMLDivElement // wraps left+middle row
    private bottomResizerElem!: HTMLDivElement // horizontal splitter
    private bottomElem!: HTMLDivElement
    private bottomContentElem!: HTMLDivElement
    private bottomActionPanelElem: HTMLDivElement
    private bottomTitleElem: HTMLDivElement

    private xLeftPosition = 0
    private leftWidth = 0

    private yTopPosition = 0

    private leftMouseMoveBind!: (e: MouseEvent) => void
    private leftMouseUpBind!: (e: MouseEvent) => void

    private bottomMouseMoveBind!: (e: MouseEvent) => void
    private bottomMouseUpBind!: (e: MouseEvent) => void

    private leftPaneHidden = false
    private leftPanePercent = 0.2

    private bottomPanePercent = 0.3
    private bottomHeight = 0
    private bottomPaneCollapsed = false

    private leftPaneCache: WeakMap<BaseComponent, HTMLElement>
    private bottomPaneCache: WeakMap<BaseComponent, HTMLElement>

    constructor() {
        this.leftPaneCache = new WeakMap<BaseComponent, HTMLElement>()
        this.bottomPaneCache = new WeakMap<BaseComponent, HTMLElement>()
    }

    /** make the middle pane flex-fill the remaining space */
    private setMiddleFlex() {
        this.middleElem.style.removeProperty('width')
        this.middleElem.style.flex = '1'
    }

    private hideAllLeftChildren() {
        Array.from(this.leftElem.children)
            .forEach(c => (c as HTMLElement).style.display = 'none')
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.resizable-split-view', $ => {
            this.topWrapperElem = $('div', '.top-wrapper', $ => {
                this.leftElem = $('div', '.left-container')
                this.resizerElem = $('div', '.resizer')
                this.middleElem = $('div', '.middle-container')
            })

            /* horizontal splitter + bottom pane */
            this.bottomResizerElem = $('div', '.bottom-resizer')
            this.bottomElem = $('div', '.bottom-container', $ => {
                $('div', '.bottom-header', $ => {
                    this.bottomTitleElem = $('div', '.bottom-title')
                    this.bottomActionPanelElem = $('div', '.action-panel')
                    $('div', '.right-section', $ => {
                        $('button', '.bottom-close-btn', {
                            on: {click: this.collapseBottomPane.bind(this)}
                        }, $ => {
                            $('i', '.fas.fa-times')
                        })
                    })
                })
                this.bottomContentElem = $('div', '.bottom-content')
            })
        })

        const topPct = 100 - this.bottomPanePercent * 100
        const bottomPct = this.bottomPanePercent * 100
        this.topWrapperElem.style.flex = 'none'
        this.topWrapperElem.style.height = `${topPct}%`
        this.bottomElem.style.flex = 'none'
        this.bottomElem.style.height = `${bottomPct}%`

        /* ensure initial flex behaviour */
        this.setMiddleFlex()

        /* drag splitter */
        this.resizerElem.addEventListener('mousedown', this.leftMouseDownHandler)
        this.bottomResizerElem.addEventListener('mousedown', this.bottomMouseDownHandler)

        /* Ctrl/⌘ + B to hide/show */
        document.addEventListener('keydown', e => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault()
                this.toggleCloseLeftElem()
            }
        })
    }

    private bottomMouseDownHandler = (e: MouseEvent) => {
        if (this.bottomPaneCollapsed) {
            this.expandBottomPane()
        }

        /* store initial Y + current bottom height only */
        this.yTopPosition = e.clientY
        this.bottomHeight = this.bottomElem.getBoundingClientRect().height

        /* freeze bottom pane with a flex-basis, let the top flex naturally */
        this.bottomElem.style.flex = `0 0 ${this.bottomHeight}px`
        this.topWrapperElem.style.flex = '1 1 auto'

        // bind listeners
        this.bottomMouseMoveBind = this.bottomMouseMoveHandler.bind(this)
        this.bottomMouseUpBind = this.bottomMouseUpHandler.bind(this)
        window.addEventListener('mousemove', this.bottomMouseMoveBind)
        window.addEventListener('mouseup', this.bottomMouseUpBind)

        /* ux */
        this.setRowResizeCursor(true)
    }

    private bottomMouseMoveHandler = (e: MouseEvent) => {
        const dy = e.clientY - this.yTopPosition
        let newBottom = this.bottomHeight - dy

        const parentHeight = this.elem.getBoundingClientRect().height
        const MAX_BOTTOM = parentHeight - MIN_TOP

        if (newBottom < MIN_BOTTOM) {
            newBottom = MIN_BOTTOM
        } else if (newBottom > MAX_BOTTOM) {
            newBottom = MAX_BOTTOM
        }

        /* resize only the bottom pane – flexbox will resize the top one */
        this.bottomElem.style.flex = `0 0 ${newBottom}px`
    }

    private bottomMouseUpHandler = () => {
        /* convert the pixel split to % so it survives window resizes */
        const parentHeight = this.elem.getBoundingClientRect().height
        const newBottomPct = (this.bottomElem.getBoundingClientRect().height * 100) / parentHeight
        const newTopPct = 100 - newBottomPct
        this.bottomPanePercent = newBottomPct / 100

        /* restore percentage sizes */
        this.bottomElem.style.flex = 'none'
        this.bottomElem.style.height = `${newBottomPct}%`
        this.topWrapperElem.style.flex = 'none'
        this.topWrapperElem.style.height = `${newTopPct}%`

        /* unbind + restore cursor */
        window.removeEventListener('mousemove', this.bottomMouseMoveBind)
        window.removeEventListener('mouseup', this.bottomMouseUpBind)
        this.setRowResizeCursor(false)

        this.updateConfig()
    }

    /* ------------------------small helper ----------------------------- */
    private setRowResizeCursor(on: boolean) {
        const cur = on ? 'row-resize' : ''
        this.bottomResizerElem.style.cursor = cur
        this.elem.style.cursor = cur
    }

    /* -----------------------splitter handlers---------------------------*/
    private leftMouseDownHandler = (e: MouseEvent) => {
        this.xLeftPosition = e.clientX
        this.leftWidth = this.leftElem.getBoundingClientRect().width

        /* fix current left width; middle goes flex */
        const parentWidth = this.elem.getBoundingClientRect().width
        const leftPct = (this.leftWidth * 100) / parentWidth
        this.leftElem.style.width = `${leftPct}%`
        this.leftElem.style.flex = 'none'
        this.setMiddleFlex()

        this.leftMouseMoveBind = this.leftMouseMoveHandler.bind(this)
        this.leftMouseUpBind = this.mouseUpHandler.bind(this)

        window.addEventListener('mousemove', this.leftMouseMoveBind)
        window.addEventListener('mouseup', this.leftMouseUpBind)
    }

    private leftMouseMoveHandler = (e: MouseEvent) => {
        const dx = e.clientX - this.xLeftPosition
        const parentWidth = this.elem.getBoundingClientRect().width
        const newLeftPct = ((this.leftWidth + dx) * 100) / parentWidth

        this.leftElem.style.width = `${newLeftPct}%`
        this.leftElem.style.flex = 'none' // keep explicit while dragging

        this.resizerElem.style.cursor = 'col-resize'
        this.elem.style.cursor = 'col-resize'

        this.leftElem.style.userSelect = 'none'
        this.leftElem.style.pointerEvents = 'none'
        this.middleElem.style.userSelect = 'none'
        this.middleElem.style.pointerEvents = 'none'
    }

    private updateConfig() {
        window.electronAPI.updateWorkspaceConfig({
            paneLayoutState: {
                leftPanePercent: this.leftPanePercent,
                bottomPanePercent: this.bottomPanePercent,
                leftPaneHidden: this.leftPaneHidden,
                bottomPaneCollapsed: this.bottomPaneCollapsed
            }
        }).then()
    }

    private mouseUpHandler = () => {
        this.resizerElem.style.removeProperty('cursor')
        this.elem.style.removeProperty('cursor')
        this.leftElem.style.removeProperty('user-select')
        this.leftElem.style.removeProperty('pointer-events')
        this.middleElem.style.removeProperty('user-select')
        this.middleElem.style.removeProperty('pointer-events')

        window.removeEventListener('mousemove', this.leftMouseMoveBind)
        window.removeEventListener('mouseup', this.leftMouseUpBind)

        const parentWidth = this.elem.getBoundingClientRect().width
        this.leftPanePercent = this.leftElem.getBoundingClientRect().width / parentWidth

        this.updateConfig()
    }

    public middleRender(component: BaseComponent) {
        clearChildElements(this.middleElem)
        $(this.middleElem, $ => component.render($).then())

        /* reset to flex (no fixed width) */
        this.setMiddleFlex()
    }

    /* -----------------------bottom render ---------------------------*/
    public async bottomRender(component: BaseComponent, title?: string) {
        let element = this.bottomPaneCache.get(component)
        component.setActionPanelElem(this.bottomActionPanelElem)

        if (!element) {
            element = await component.render($)
            element.style.display = 'none'
            this.bottomContentElem.appendChild(element)
            this.bottomPaneCache.set(component, element)
        }

        this.hideAllBottomChildren()
        element.style.display = ''

        // set the title
        if (title) {
            this.bottomTitleElem.textContent = title
            this.bottomTitleElem.style.display = ''
        } else {
            this.bottomTitleElem.style.display = 'none'
        }

        // clear and render action buttons
        clearChildElements(this.bottomActionPanelElem)
        component.renderActionPanel()

        /* re-open if collapsed */
        if (this.bottomPaneCollapsed) {
            this.expandBottomPane()
        }
    }

    private hideAllBottomChildren() {
        Array.from(this.bottomContentElem.children)
            .forEach(c => (c as HTMLElement).style.display = 'none')
    }

    private freezeLeftWidth() {
        const px = this.leftElem.getBoundingClientRect().width

        this.leftElem.style.width = `${px}px`
        this.leftElem.style.flex = '0 0 auto'
    }

    /* ----------------------left render (activity panels)----------------------------*/
    public leftRender(component: BaseComponent) {
        let container = this.leftPaneCache.get(component)

        if (!container) {
            container = document.createElement('div')
            container.style.display = 'none'
            container.style.flex = '1 1 0'
            container.style.width = '100%'
            container.style.minHeight = '0'
            container.style.flexDirection = 'column'
            this.leftElem.appendChild(container)
            $(container, $ => component.render($).then())
            this.leftPaneCache.set(component, container)
        }

        this.hideAllLeftChildren()
        container.style.display = ''

        /* re-open if hidden */
        if (this.leftPaneHidden) {
            this.leftPaneHidden = false
            this.leftElem.style.display = ''
            this.setMiddleFlex()
        }

        this.freezeLeftWidth()
    }

    /* ------------------------restore pane layout from workspace config--------------------------*/
    public restorePaneLayout() {
        const paneLayoutState = projectManager.project.workspace?.paneLayoutState

        if (paneLayoutState == null) {
            return
        }

        // update percentage values first
        this.leftPanePercent = paneLayoutState.leftPanePercent ?? 0.2
        this.bottomPanePercent = paneLayoutState.bottomPanePercent ?? 0.3

        this.leftPaneHidden = paneLayoutState.leftPaneHidden
        this.bottomPaneCollapsed = paneLayoutState.bottomPaneCollapsed

        this.setLeftPaneVisibility(!paneLayoutState.leftPaneHidden)
        this.setBottomPaneVisibility(!paneLayoutState.bottomPaneCollapsed)
    }


    public toggleCloseLeftElem() {
        this.setLeftPaneVisibility(this.leftPaneHidden)
        this.leftPaneHidden = !this.leftPaneHidden
        this.updateConfig()
    }

    private setLeftPaneVisibility(hidden: boolean) {
        const parentWidth = this.elem.getBoundingClientRect().width

        if (hidden) {
            // currently hidden, so show it
            this.leftElem.style.display = ''
            this.leftElem.style.flex = 'none'
            this.leftElem.style.width = `${this.leftPanePercent * 100}%`
            this.setMiddleFlex()
        } else {
            // currently visible, so hide it
            this.leftPanePercent = this.leftElem.getBoundingClientRect().width / parentWidth
            this.leftElem.style.display = 'none'
            this.middleElem.style.width = '100%'     // middle takes all
            this.middleElem.style.flex = 'none'
        }
    }

    private setBottomPaneVisibility(collapsed: boolean) {
        const parentHeight = this.elem.getBoundingClientRect().height

        if (collapsed) {
            // currently collapsed, so show it
            this.bottomElem.style.display = ''
            this.bottomElem.style.flex = 'none'
            this.bottomElem.style.height = `${this.bottomPanePercent * 100}%`
            this.topWrapperElem.style.flex = 'none'
            this.topWrapperElem.style.height = `${(1 - this.bottomPanePercent) * 100}%`
        } else {
            // currently visible, so hide it
            this.bottomPanePercent = this.bottomElem.getBoundingClientRect().height / parentHeight
            this.bottomElem.style.display = 'none'
            this.topWrapperElem.style.flex = '1 1 auto'
            this.topWrapperElem.style.height = '100%'
        }
    }


    public toggleCloseBottomElem() {
        this.setBottomPaneVisibility(this.bottomPaneCollapsed)
        this.bottomPaneCollapsed = !this.bottomPaneCollapsed
        this.updateConfig()
    }

    private collapseBottomPane() {
        if (this.bottomPaneCollapsed) {
            return
        }
        this.bottomElem.style.display = 'none'
        this.topWrapperElem.style.flex = '1 1 auto'
        this.topWrapperElem.style.height = '100%'
        this.bottomPaneCollapsed = true

        this.updateConfig()
    }

    private expandBottomPane() {
        if (!this.bottomPaneCollapsed) {
            return
        }
        this.bottomElem.style.display = ''
        this.topWrapperElem.style.flex = 'none'
        const restorePct = this.bottomPanePercent * 100
        this.bottomElem.style.height = `${restorePct}%`
        this.topWrapperElem.style.height = `${100 - restorePct}%`
        this.bottomPaneCollapsed = false

        this.updateConfig()
    }
}

export const resizableSplitView = new ResizableSplitView()