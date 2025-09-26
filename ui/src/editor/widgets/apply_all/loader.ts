import {WeyaElementFunction} from "../../../../../lib/weya/weya"
import {Loader} from "../../../components/loader"

export interface WidgetLoaderOptions {
    filePath?: string
}

export class WidgetLoader {
    private elem: HTMLDivElement
    private filePathElem: HTMLElement
    private loader: Loader

    private readonly filePath?: string

    constructor(opt: WidgetLoaderOptions = {}) {
        this.filePath = opt.filePath
        this.loader = new Loader('line')
    }

    public render($: WeyaElementFunction) {
        this.elem = $('div', '.widget-loader', $ => {
            if (this.filePath != null) {
                $('div', '.code-block-header', $ => {
                    $('div', '.file-info', $ => {
                        $('i', '.fas.fa-file')
                        this.filePathElem = $('span', '.file-path', this.filePath)
                    })
                })
            }

            $('div', '.loader-content', $ => {
                this.loader.render($)
            })
        })

        return this.elem
    }
}