export interface Component {
    type: string
    placeholder?: string
    value?: string
    name?: string
    onClick?: () => void
    disabled?: boolean
}

export interface ToolInterface {
    title: string
    rows: Component[][]
}