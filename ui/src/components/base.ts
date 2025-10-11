import {WeyaElementFunction} from "../../../lib/weya/weya"

export abstract class BaseComponent {
    abstract render($: WeyaElementFunction): Promise<HTMLElement>

    public setActionPanelElem(actionPanelElem: HTMLDivElement) {
    }

    public renderActionPanel() {
    }

    public async onActive() {
    }
}