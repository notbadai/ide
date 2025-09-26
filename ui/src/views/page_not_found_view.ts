import {ROUTER, SCREEN} from '../app'
import {Weya as $, WeyaElement} from '../../../lib/weya/weya'
import {setTitle} from '../utils/document'
import {ScreenView} from '../screen_view'

export class PageNotFoundView extends ScreenView {
    private elem: HTMLDivElement

    private readonly message: string
    private readonly status: number

    constructor(message?: string, status?: number) {
        super()
        this.message = message ?? 'We can\'t find the page.'
        this.status = status ?? 404
    }

    get requiresAuth(): boolean {
        return false
    }

    public async render(): Promise<WeyaElement> {
        setTitle({section: `${this.status}`})
        this.elem = $('div', '.page-not-found', $ => {
            $('div', '.container', $ => {
                $('h1', `${this.status}`)
                $('p', 'Oops! The page you are looking for does not exist.')
                $('p', '.subtext', this.message)
                $('a', '.home', {href: `/`}, $ => {
                    $('i', '.fas.fa-home.icon', '')
                    $('span', 'Home')
                })
            })
        })

        return Promise.resolve(this.elem)
    }

    destroy() {
    }

    canUpdate(...args: any[]): boolean {
        return false
    }
}

export class PageNotFoundHandler {
    constructor() {
        ROUTER.route('404', [PageNotFoundHandler.handleError])
    }

    static handleError = (message?: string, status?: number) => {
        SCREEN.setView(new PageNotFoundView(message, status))
    }
}
