import {ToolInterface} from '../managers/tools/components'
import {ComponentState} from '../managers/tools/custom_tool_interface'

export type ExtensionType =
    'chat'
    | 'autocomplete'
    | 'apply'
    | 'keybind'
    | 'symbolLookup'
    | 'terminate'
    | 'voice'
    | 'tool'

export interface Prediction {
    label: string
    text: string
}

export interface Message {
    role: string
    content: string
}

export interface Cursor {
    line: number
    column: number
}

export interface InspectionResult {
    file_path?: string
    line_number: number
    description: string
}

export interface MetaData {
    uuid: string
    request_id?: string
    port: number
}

export type ApiKey = {
    key: string
    provider: string
    is_default: boolean
}

export interface EditorState {
    meta_data?: MetaData

    repo: string[]
    repo_path: string

    edit_file?: string
    current_file?: string
    current_file_content?: string
    opened_files: string[]
    context_files?: { [key: string]: string[] }

    cursor_row?: number
    cursor_column?: number
    selection?: string
    clip_board?: string

    symbol?: string

    prompt?: string
    chat_history?: Message[]

    terminal_snapshot?: string[]
    terminal_before_reset?: string[]
    active_terminal_name?: string
    terminal_names?: string[]

    api_keys?: ApiKey[]

    audio_blob_path?: string

    tool_action?: string
    tool_state?: { [name: string]: any }
}

export interface ExtensionData {
    uuid: string  // extension uuid
    type: string

    requestId?: string

    cursor?: Cursor
    selection?: string
    clip_board?: string
    current_file_content?: string
    current_file_path?: string
    edit_file_path?: string
    extension?: string

    resend?: { [key: string]: any }

    prompt?: string
    messages?: Message[]
    symbol?: string
    terminal_snapshot?: string[]
    terminal_before_reset?: string[]
    active_terminal_name?: string
    terminal_names?: string[]
    context_paths?: string[]
    open_file_paths?: string[]
    audio_blob?: ArrayBuffer

    tool_action?: string
    tool_state?: { [name: string]: ComponentState }
}

export interface LogResponse {
    message: string
}

export interface ErrorResponse {
    message: string
}

export interface ProgressResponse {
    message: string
    progress: number
}

export interface NotificationResponse {
    message: string
    title: string
}

export interface ApplyResponse {
    start?: number
    end?: number
    matches: number[][]
    patch: string[]
    cursor_row?: number
    cursor_column?: number
    file_path?: string
    language?: string
    onApply?: () => void
}

export interface DiagnosticResponse {
    results: InspectionResult[]
}

export interface AutoCompleteResponse {
    suggestions: Prediction[]
    time_elapsed: number
}

export interface InlineCompletionResponse {
    inline_completion: string
    cursor_row?: number
    cursor_column?: number
}

export interface InspectResponse {
    results: InspectionResult[]
}

export interface ChatResponse {
    chunk?: string
    push_chat?: boolean
    start_chat?: boolean
    terminate_chat?: boolean
}

export interface SymbolLookupResult {
    file_path: string
    excerpt: string
    line_number: number
}

export interface SymbolLookupResults {
    results: SymbolLookupResult[]
    intent: string
}

export interface AudioTranscription {
    text: string
}

export interface ExtensionResponse {
    uuid: string // extension uuid
    is_stopped: boolean
    requestId?: string
    log?: LogResponse
    progress?: ProgressResponse
    error?: ErrorResponse
    notification?: NotificationResponse
    apply?: ApplyResponse
    inline_completion?: InlineCompletionResponse
    diagnostics?: DiagnosticResponse
    autocomplete?: AutoCompleteResponse
    inspect?: InspectResponse
    symbol_lookup?: SymbolLookupResults
    chat?: ChatResponse
    audio_transcription?: AudioTranscription
    tool_interface?: ToolInterface
}