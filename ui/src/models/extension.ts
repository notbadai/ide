import {UIState} from '../managers/tools/components'
import {ComponentState} from '../managers/tools/custom_tool_interface'

export type ExtensionType =
    'chat'
    | 'autocomplete'
    | 'apply'
    | 'symbolLookup'
    | 'terminate'
    | 'tool'

export interface Prediction {
    label: string
    text: string
}

export interface Message {
    role: string
    content: string
}

export interface InspectResult {
    file_path: string
    row_from: number
    row_to?: number
    column_from?: number
    column_to?: number
    description?: string
}

export type ApiProvider = {
    key: string
    provider: string
    default?: boolean
}

export interface Cursor {
    symbol?: string
    row: number
    column: number
}

export interface CodeApplyChange {
    target_file_path: string
    patch_text: string
}

export interface UIAction {
    action: string
    state: { [name: string]: ComponentState }
}

export interface EditorState {
    request_id?: string

    repo: string[]
    repo_path: string

    current_file?: string
    current_file_content?: string
    opened_files: string[]
    context_files?: { [key: string]: string[] }
    code_apply_change?: CodeApplyChange

    cursor?: Cursor
    selection?: string
    clip_board?: string
    prompt?: string
    chat_history?: Message[]

    current_terminal: string
    terminals: string[]

    api_keys?: Record<string, ApiProvider>
    settings?: { [key: string]: string[] }

    ui_action?: UIAction
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
    patch_text?: string
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

    ui_action?: UIAction
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
    results: InspectResult[]
}

export interface ChatResponse {
    chunk?: string
    push_chat?: boolean
    start_chat?: boolean
    terminate_chat?: boolean
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
    autocomplete?: AutoCompleteResponse
    highlight?: InspectResponse
    chat?: ChatResponse
    audio_transcription?: AudioTranscription
    state?: UIState
}