import {ROUTER, SCREEN} from '../app'
import {Weya as $, WeyaElement} from '../../../lib/weya/weya'
import {banner} from "../components/banner"

import {ScreenView} from '../screen_view'
import {BasicButton} from "../components/buttons"

export class ProjectSelectView extends ScreenView {
    private actualWidth: number

    private elem: HTMLDivElement

    private openDirButton: BasicButton

    constructor() {
        super()

        this.openDirButton = new BasicButton({
            text: 'Open Directory',
            onButtonClick: () => this.openDialog(),
            icon: '.fas.fa-folder-open',
            background: true
        })
    }

    async render(): Promise<WeyaElement> {
        this.elem = $('div', '.page.project-select', $ => {
            $('div', '.container', $ => {
                $('div', '.icon-container', $ => {
                    $('i', '.fas.fa-folder-open')
                })

                $('h2', 'Select Your Project Directory')
                $('p', '.subtitle', 'Choose a directory to start coding with AI assistance')

                $('div', '.selector', $ => {
                    this.openDirButton.render($)
                })
            })
        })

        return this.elem
    }

    private async openDialog() {
        try {
            const dir: string | null = await window.electronAPI.openDirectory()
            if (!dir) {
                return
            }
            ROUTER.navigate(`/editor`)
        } catch (e) {
            banner.error(e.message ?? String(e))
        }
    }

    get requiresAuth(): boolean {
        return false
    }

    onResize(width: number) {
        super.onResize(width)
        this.actualWidth = Math.min(800, width)
    }

    destroy() {

    }

    onClose() {
    }

    canUpdate() {
        return false
    }

    onVisibilityChange() {
    }
}

export class ProjectSelectorViewHandler {
    constructor() {
        ROUTER.route('select', [ProjectSelectorViewHandler.handleProjectSelector])
    }

    static handleProjectSelector = () => {
        SCREEN.setView(new ProjectSelectView()).then()
    }
}