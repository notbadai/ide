import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'js-yaml'


export class ExtensionConfigError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ExtensionConfigError'
    }
}

export interface Tool {
    name: string
    extension: string
    description?: string
    shortcut?: string
}

export interface ExtensionConfigData {
    chat?: string[]
    apply?: string
    symbol_lookup?: string
    python_path?: string
    autocomplete?: string
    diff?: {
        min_collapse_lines?: number    // min_lines_for_collapsible_section
        min_auto_collapse_lines?: number // min_lines_for_auto_collapse
        context_lines?: number          // context_lines
        ignore_whitespace?: boolean     // whether to ignore whitespace differences
    }
    tools?: Tool[]
    port?: number
}

const VALID_CONFIG_KEYS = new Set([
    'chat', 'apply', 'symbol_lookup', 'python_path', 'autocomplete', 'diff', 'tools', 'port'
])

const VALID_DIFF_KEYS = new Set([
    'min_collapse_lines', 'min_auto_collapse_lines', 'context_lines', 'ignore_whitespace'
])

export class ExtensionConfig {
    private config: ExtensionConfigData
    private readonly configPath: string

    constructor(configPath: string) {
        this.configPath = configPath
    }

    async load(): Promise<void> {
        this.config = await this._loadConfig()
    }

    private async _loadConfig(): Promise<ExtensionConfigData> {
        try {
            await fs.access(this.configPath)
        } catch {
            throw new ExtensionConfigError(`config.yaml file not found: ${this.configPath}`)
        }

        try {
            const configContent = await fs.readFile(this.configPath, 'utf8')
            const config = yaml.load(configContent) as ExtensionConfigData

            if (!config || typeof config !== 'object') {
                throw new ExtensionConfigError("config.yaml file must contain a YAML dictionary")
            }

            this._validateConfig(config)
            return config
        } catch (error) {
            if (error instanceof ExtensionConfigError) {
                throw error
            }
            if (error instanceof yaml.YAMLException) {
                throw new ExtensionConfigError(`invalid YAML in config.yaml file: ${error.message}`)
            }
            throw new ExtensionConfigError(`failed to read config.yaml file: ${error.message}`)
        }
    }

    private _validateConfig(config: ExtensionConfigData): void {
        // Check for unknown top-level keys
        const configKeys = Object.keys(config)

        for (const key of configKeys) {
            if (!VALID_CONFIG_KEYS.has(key)) {
                throw new ExtensionConfigError(`config.yaml: unknown parameter '${key}'`)
            }
        }

        // check chat extensions
        if (config.chat !== undefined) {
            if (!Array.isArray(config.chat)) {
                throw new ExtensionConfigError("config.yaml: 'chat' must be a list of extension names")
            }
            for (const ext of config.chat) {
                if (typeof ext !== 'string') {
                    throw new ExtensionConfigError("config.yaml: all chat extensions must be strings")
                }
            }
        }

        // check single extensions
        for (const extType of ['apply', 'symbol_lookup', 'python_path', 'autocomplete'] as const) {
            if (config[extType] !== undefined) {
                if (typeof config[extType] !== 'string') {
                    throw new ExtensionConfigError(`config.yaml: '${extType}' must be a string`)
                }
            }
        }

        if (config.tools !== undefined) {
            if (!Array.isArray(config.tools)) {
                throw new ExtensionConfigError("config.yaml: 'tools' must be an array")
            }

            const toolNames = new Set<string>()
            const toolShortcuts = new Set<string>()

            for (const [index, tool] of config.tools.entries()) {
                if (typeof tool !== 'object' || tool === null) {
                    throw new ExtensionConfigError(`config.yaml: tool at index ${index} must be an object`)
                }

                if (typeof tool.name !== 'string' || tool.name.trim() === '') {
                    throw new ExtensionConfigError(`config.yaml: tool at index ${index} must have a non-empty 'name' string`)
                }

                if (toolNames.has(tool.name)) {
                    throw new ExtensionConfigError(`config.yaml: duplicate tool name '${tool.name}' at index ${index}`)
                }
                toolNames.add(tool.name)

                if (typeof tool.extension !== 'string' || tool.extension.trim() === '') {
                    throw new ExtensionConfigError(`config.yaml: tool at index ${index} must have a non-empty 'extension' string`)
                }

                if (tool.description !== undefined && typeof tool.description !== 'string') {
                    throw new ExtensionConfigError(`config.yaml: tool at index ${index} 'description' must be a string if provided`)
                }

                if (tool.shortcut !== undefined) {
                    if (typeof tool.shortcut !== 'string' || tool.shortcut.trim() === '') {
                        throw new ExtensionConfigError(`config.yaml: tool at index ${index} 'shortcut' must be a non-empty string if provided`)
                    }

                    if (toolShortcuts.has(tool.shortcut)) {
                        throw new ExtensionConfigError(`config.yaml: duplicate tool shortcut '${tool.shortcut}' at index ${index}`)
                    }
                    toolShortcuts.add(tool.shortcut)

                    // basic validation for key combination format
                    if (!this._isValidKeyCombo(tool.shortcut)) {
                        throw new ExtensionConfigError(`config.yaml: invalid key combination format for tool at index ${index}: '${tool.shortcut}'`)
                    }
                }

                if (tool.pinned !== undefined && typeof tool.pinned !== 'boolean') {
                    throw new ExtensionConfigError(`config.yaml: tool at index ${index} 'pinned' must be a boolean if provided`)
                }

                // check for unknown properties in tool object
                const validToolKeys = new Set(['name', 'extension', 'description', 'shortcut'])
                for (const key of Object.keys(tool)) {
                    if (!validToolKeys.has(key)) {
                        throw new ExtensionConfigError(`config.yaml: unknown property '${key}' in tool at index ${index}`)
                    }
                }
            }
        }

        // check port
        if (config.port !== undefined) {
            if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
                throw new ExtensionConfigError("config.yaml: 'port' must be an integer between 1 and 65535")
            }
        }

        // check diff settings
        if (config.diff !== undefined) {
            if (typeof config.diff !== 'object' || config.diff === null) {
                throw new ExtensionConfigError("config.yaml: 'diff' must be an object")
            }

            const diffView = config.diff

            // Check for unknown diff keys
            const diffKeys = Object.keys(diffView)

            for (const key of diffKeys) {
                if (!VALID_DIFF_KEYS.has(key)) {
                    throw new ExtensionConfigError(`config.yaml: unknown parameter 'diff.${key}'`)
                }
            }

            if (diffView.min_collapse_lines !== undefined) {
                if (!Number.isInteger(diffView.min_collapse_lines) || diffView.min_collapse_lines < 1) {
                    throw new ExtensionConfigError("config.yaml: 'diff.min_collapse_lines' must be a positive integer")
                }
            }

            if (diffView.min_auto_collapse_lines !== undefined) {
                if (!Number.isInteger(diffView.min_auto_collapse_lines) || diffView.min_auto_collapse_lines < 1) {
                    throw new ExtensionConfigError("config.yaml: 'diff.min_auto_collapse_lines' must be a positive integer")
                }
            }

            if (diffView.context_lines !== undefined) {
                if (!Number.isInteger(diffView.context_lines) || diffView.context_lines < 0) {
                    throw new ExtensionConfigError("config.yaml: 'diff.context_lines' must be a non-negative integer")
                }
            }

            if (diffView.ignore_whitespace !== undefined) {
                if (typeof diffView.ignore_whitespace !== 'boolean') {
                    throw new ExtensionConfigError("config.yaml: 'diff.ignore_whitespace' must be a boolean")
                }
            }
        }
    }

    private _isValidKeyCombo(keyCombo: string): boolean {
        // Basic validation for key combinations
        // Supports formats like: "ctrl+a", "shift+f1", "alt+ctrl+s", "f12", "escape", etc.
        const validModifiers = ['ctrl', 'shift', 'alt', 'meta', 'cmd']
        const validKeys = [
            // Function keys
            'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
            // Special keys
            'escape', 'tab', 'space', 'enter', 'backspace', 'delete', 'insert', 'home', 'end',
            'pageup', 'pagedown', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
            // Letters and numbers (single character)
            ...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''),
            // Symbols
            '-', '=', '[', ']', '\\', ';', "'", '`', ',', '.', '/'
        ]

        const parts = keyCombo.toLowerCase().split('+').map(part => part.trim())

        if (parts.length === 0) {
            return false
        }

        // Last part should be the main key
        const mainKey = parts[parts.length - 1]
        if (!validKeys.includes(mainKey)) {
            return false
        }

        // All other parts should be modifiers
        const modifiers = parts.slice(0, -1)
        for (const modifier of modifiers) {
            if (!validModifiers.includes(modifier)) {
                return false
            }
        }

        return true
    }

    public getChatExtensions(): string[] {
        return this.config.chat || []
    }

    public getApplyExtension(): string | null {
        return this.config.apply || null
    }

    public getSymbolLookupExtension(): string | null {
        return this.config.symbol_lookup || null
    }

    public getAutocompleteExtension(): string | null {
        return this.config.autocomplete || null
    }

    public getVoiceExtension(): string | null {
        return this.config.voice || null
    }

    public getPythonPath(): string | null {
        return this.config.python_path || null
    }

    public getDiffSettings() {
        return {
            min_collapse_lines: this.config.diff?.min_collapse_lines,
            min_auto_collapse_lines: this.config.diff?.min_auto_collapse_lines,
            context_lines: this.config.diff?.context_lines,
            ignore_whitespace: this.config.diff?.ignore_whitespace
        }
    }

    public getPort(): number {
        return this.config.port
    }

    public getTools(): Tool[] {
        return this.config.tools || []
    }
}

export async function loadExtensionConfig(extensionsDir: string): Promise<ExtensionConfig | null> {
    const configPath = path.join(extensionsDir, 'config.yaml')

    const config = new ExtensionConfig(configPath)
    await config.load()
    return config
}