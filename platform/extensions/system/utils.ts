import {EditorState, ExtensionData} from "../../../ui/src/models/extension"
import {fileHandler} from "../../system/file_handler"
import path from "path"
import {isDirectory, walk} from "../../helpers/files"
import {ApiProvider} from "../../../ui/src/models/extension"

function getLocalPath(pathStr: string): string {
    return pathStr.split('/').slice(1).join('/')
}

export async function prepareEditorState(extensionData: ExtensionData, apiProviders: ApiProvider[]): Promise<EditorState> {
    let prompt = extensionData.prompt

    const messages = extensionData.messages || []
    const contextPaths = extensionData.context_paths || []
    const symbol = extensionData.symbol
    const editFilePath = extensionData.edit_file_path
    const currentFilePath = extensionData.current_file_path
    const currentFileContent = extensionData.current_file_content
    const cursor = extensionData.cursor
    const selection = extensionData.selection
    const clipBoard = extensionData.clip_board
    const terminalSnapshot = extensionData.terminal_snapshot || []
    const terminalBeforeRest = extensionData.terminal_before_reset || []
    const openFilePaths = extensionData.open_file_paths || []
    const toolAction = extensionData.tool_action || null
    const toolState = extensionData.tool_state || null
    const terminalNames = extensionData.terminal_names || []
    const activeTerminalName = extensionData.active_terminal_name || null
    const requestId = extensionData.requestId || null


    const repo: string[] = []
    const documents = fileHandler.getDocs()
    for (const [docPath, doc] of documents) {
        const localPath = getLocalPath(docPath)

        repo.push(localPath)
    }

    let openedFiles: string[] = []
    for (const openFilePath of openFilePaths) {
        if (openFilePath === currentFilePath) {
            continue
        }
        const localPath = getLocalPath(openFilePath)
        openedFiles.push(localPath)
    }

    const root = fileHandler.getRoot()
    const projectName = fileHandler.getProjectName()

    const contextFiles: { [key: string]: string[] } = {}
    for (const contextPath of contextPaths) {
        const localContextPath = getLocalPath(contextPath)
        const fullContextPath = path.join(root, localContextPath)

        const filePaths = []
        if (await isDirectory(fullContextPath)) {
            const directoryFilePaths = await walk(fullContextPath, [], root, projectName)
            for (const filePath of directoryFilePaths) {
                const fileRelativePath = getLocalPath(filePath)
                filePaths.push(fileRelativePath)
            }
        } else {
            filePaths.push(localContextPath)
        }

        contextFiles[localContextPath] = filePaths
    }

    let currentFile = null
    if (currentFilePath != null) {
        currentFile = getLocalPath(currentFilePath)
    }
    let editFile = null
    if (editFilePath != null) {
        editFile = getLocalPath(editFilePath)
    }
    if (messages.length > 0) {
        prompt = messages.pop().content
    }

    return {
        request_id: requestId,

        repo,
        repo_path: fileHandler.getRoot(),

        edit_file: editFile,
        current_file: currentFile,
        current_file_content: currentFileContent,
        opened_files: openedFiles,
        context_files: contextFiles,

        cursor_row: cursor.line,
        cursor_column: cursor.column,
        selection: selection,
        clip_board: clipBoard,

        symbol: symbol,

        prompt: prompt,
        chat_history: messages,

        terminal_snapshot: terminalSnapshot,
        terminal_before_reset: terminalBeforeRest,
        active_terminal_name: activeTerminalName,
        terminal_names: terminalNames,

        api_providers: apiProviders,

        tool_action: toolAction,
        tool_state: toolState
    }
}