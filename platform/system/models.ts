import {Summary} from "./document";
import {WorkspaceData} from "./workspace_config"
import {Tool} from "./extension_config"
import {ApiProvider} from "../../ui/src/models/extension"

export interface Project {
    project_name: string
    git_branch: string
    files: Summary[]
    extensions: Extensions
    workspace?: WorkspaceData
}

export interface DiffSettings {
    min_collapse_lines: number
    min_auto_collapse_lines: number
    context_lines: number
    ignore_whitespace: boolean
}

export interface Extensions {
    chat: string[]
    autocomplete: string | null
    diff: DiffSettings
    tools?: Tool[]
    error?: string,
    isLocal: boolean,
    apiProviders: ApiProvider[],
}