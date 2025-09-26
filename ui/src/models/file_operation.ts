export interface FileOperationData {
    operation: string
    file_path?: string
    is_file?: boolean
    old_path?: string
    new_folder_name?: string
    affected_paths?: {oldRel: string, newRel: string}[]
    version?: number
    new_file_name?: string
    content?: string
}

