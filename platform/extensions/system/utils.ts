import {EditorState, ExtensionData} from "../../../ui/src/models/extension"
import {fileHandler} from "../../system/file_handler"
import path from "path"
import {isDirectory, walk} from "../../helpers/files"
import {ApiProvider} from "../../../ui/src/models/extension"

function getLocalPath(pathStr: string): string {
    return pathStr.split('/').slice(1).join('/')
}

function normalizeApiProviders(apiProviders: ApiProvider[]): Record<string, ApiProvider> {
    const providersDict: Record<string, ApiProvider> = {}

    if (apiProviders.length === 0) {
        return providersDict
    }

    const hasExplicitDefault = apiProviders.some(provider => provider.default === true)

    const normalizedProviders = hasExplicitDefault
        ? apiProviders.map(provider => ({
            ...provider,
            default: provider.default === true
        }))
        : apiProviders.map((provider, index) => ({
            ...provider,
            default: index === 0
        }))

    for (const provider of normalizedProviders) {
        providersDict[provider.provider] = provider
    }

    return providersDict
}

export async function prepareEditorState(extensionData: ExtensionData, apiProviders: ApiProvider[], extensionSettings: Record<string, any>): Promise<EditorState> {
    let prompt = extensionData.prompt

    const messages = extensionData.messages || []
    const contextPaths = extensionData.context_paths || []
    const symbol = extensionData.symbol
    const editFilePath = extensionData.edit_file_path || null
    const patchText = extensionData.patch_text || null
    const currentFilePath = extensionData.current_file_path
    const currentFileContent = extensionData.current_file_content
    const cursor = extensionData.cursor
    const selection = extensionData.selection
    const clipBoard = extensionData.clip_board
    const openFilePaths = extensionData.open_file_paths || []
    const uiAction = extensionData.ui_action || null
    const terminals = extensionData.terminal_names || []
    const currentTerminal = extensionData.active_terminal_name || null
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

    if (messages.length > 0) {
        prompt = messages.pop().content
    }

    const normalizedApiProviders = normalizeApiProviders(apiProviders)

    return {
        request_id: requestId,

        repo,
        repo_path: fileHandler.getRoot(),

        current_file: currentFilePath ? getLocalPath(currentFilePath) : null,
        current_file_content: currentFileContent,
        opened_files: openedFiles,
        context_files: contextFiles,
        code_apply_change: {
            patch_text: patchText,
            target_file_path: editFilePath ? getLocalPath(editFilePath) : null
        },

        cursor: (cursor.row != null && cursor.column != null) ? {
            row: cursor.row,
            column: cursor.column,
            symbol: symbol
        } : null,

        selection: selection,
        clip_board: clipBoard,

        prompt: prompt,
        chat_history: messages,

        current_terminal: currentTerminal,
        terminals: terminals,

        api_keys: normalizedApiProviders,
        settings: extensionSettings,

        ui_action: uiAction,
    }
}