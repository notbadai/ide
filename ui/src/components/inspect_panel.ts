import {Weya as $, WeyaElementFunction} from "../../../lib/weya/weya"
import {BaseComponent} from "./base"
import {CodeResults, CodeResult} from "./code_results"
import {clearChildElements} from "../utils/document"
import {projectManager} from "../managers/project/manager"


class InspectPanel extends BaseComponent {
    private elem: HTMLDivElement
    private inspectorListElem: HTMLDivElement
    private results: CodeResult[]

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

    public update(results: CodeResult[]) {
        this.results = results

        if (this.inspectorListElem == null) {
            return
        }
        clearChildElements(this.inspectorListElem)
        $(this.inspectorListElem, $ => {
            const codeResults = new CodeResults({
                results: this.results,
                emptyMessage: 'No Results Found',
                onItemClick: (result: CodeResult) => {
                    projectManager.jumpToEditorLine({
                        lineNumber: result.line_number,
                        filePath: result.file_path
                    })
                },
                onClose: () => {
                    // codeEditor.focus()
                }
            })
            codeResults.render($)
        })
    }
}

export const inspectPanel = new InspectPanel()
    