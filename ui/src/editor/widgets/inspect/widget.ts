import {tabsManager} from "../../../managers/tabs/manager"
import {inspectPanel} from "../../../components/inspect_panel"
import {InspectResult} from "../../../models/extension"

class InspectWidget {
    constructor() {
    }

    public showResults(filePath: string, inspectResults: InspectResult[]) {
        const sortedResults = inspectResults.slice().sort((a, b) => a.row_from - b.row_from)

        const codeEditor = tabsManager.getCodeEditor(filePath)
        if (codeEditor == null) {
            return
        }

        codeEditor.showInspectResult(sortedResults)
        inspectPanel.update(sortedResults)
    }
}

export const inspectWidget = new InspectWidget()