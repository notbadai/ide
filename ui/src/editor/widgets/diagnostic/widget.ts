import {DiagnosticOutput} from "./utils"
import {tabsManager} from "../../../managers/tabs/manager"
import {inspectPanel} from "../../../components/inspect_panel"

class DiagnosticWidget {
    constructor() {
    }

    public showDiagnostics(filePath: string, diagnostics: DiagnosticOutput[]) {
        const sortedDiagnostics = diagnostics.slice().sort((a, b) => a.start_line - b.start_line)

        const codeEditor = tabsManager.getCodeEditor(filePath)
        if (codeEditor == null) {
            return
        }

        // transform DiagnosticOutput to CodeResult format for problem panel
        const results = sortedDiagnostics.map(diagnostic => ({
            file_path: codeEditor.file.path,
            line_number: diagnostic.start_line,
            description: diagnostic.description
        }))

        codeEditor.showDiagnostics(sortedDiagnostics)
        inspectPanel.update(results)
    }
}

export const diagnosticWidget = new DiagnosticWidget()