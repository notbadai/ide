import {Weya as $, WeyaElementFunction} from "../../../lib/weya/weya"
import {BaseComponent} from "./base"
import {InspectResult} from "../models/extension"
import {clearChildElements} from "../utils/document"
import {projectManager} from "../managers/project/manager"
import {InspectResults} from "./inspect_results"


class InspectPanel extends BaseComponent {
    private elem: HTMLDivElement
    private inspectorListElem: HTMLDivElement
    private results: InspectResult[]

    constructor() {
        super()

        this.results = []
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.inspector-panel', $ => {
            this.inspectorListElem = $('div', '.inspector-list')
        })

        this.update(this.results)

        return this.elem
    }

    public update(results: InspectResult[]) {
        this.results = results

        if (this.inspectorListElem == null) {
            return
        }
        clearChildElements(this.inspectorListElem)
        $(this.inspectorListElem, $ => {
            const insectResults = new InspectResults({
                results: this.results,
                emptyMessage: 'No Results Found',
                onItemClick: (result: InspectResult) => {
                    projectManager.jumpToEditorLine({
                        lineNumber: result.row_from,
                        filePath: result.file_path
                    })
                },
            })
            insectResults.render($)
        })
    }
}

export const inspectPanel = new InspectPanel()
    