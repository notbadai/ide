import {WeyaElement} from '../../lib/weya/weya'

abstract class ScreenView {

    get requiresAuth() {
        return true
    }

    abstract canUpdate(...args: any[]): boolean

    abstract render(): Promise<WeyaElement>

    onResize(width: number) {
    }

    destroy() {
    }

    onRefresh() {
    }

    onVisibilityChange() {
    }

    onClose(){

    }

    onUpdate(...args: any[]) {
    }

}

export {ScreenView}