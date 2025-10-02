import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'js-yaml'
import {ApiProvider} from "../../ui/src/models/extension"
import {settings} from "./settings"


export class ConfigError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ConfigError'
    }
}

export interface Tool {
    name: string
    extension: string
    description?: string
    shortcut?: string
}

export interface ConfigData {
    chat?: string[]
    apply?: string
    symbol_lookup?: string
    python_path: string
    autocomplete?: string
    diff?: {
        min_collapse_lines?: number    // min_lines_for_collapsible_section
        min_auto_collapse_lines?: number // min_lines_for_auto_collapse
        context_lines?: number          // context_lines
        ignore_whitespace?: boolean     // whether to ignore whitespace differences
    }
    tools?: Tool[]
    api_providers: ApiProvider[]
    port: number
    host: string
}

const VALID_CONFIG_KEYS = new Set([
    'chat', 'apply', 'symbol_lookup', 'python_path', 'autocomplete', 'diff', 'tools', 'api_providers', 'port', 'host'
])

const VALID_DIFF_KEYS = new Set([
    'min_collapse_lines', 'min_auto_collapse_lines', 'context_lines', 'ignore_whitespace'
])

export class ExtensionConfig {
    private config: ConfigData
    private readonly configPath: string

    constructor(configPath: string) {
        this.configPath = configPath
    }

    async load(): Promise<void> {
        this.config = await this._loadConfig()
    }

    private async _loadConfig(): Promise<ConfigData> {
        try {
            await fs.access(this.configPath)
        } catch {
            throw new ConfigError(`config.yaml file not found: ${this.configPath}`)
        }

        try {
            const configContent = await fs.readFile(this.configPath, 'utf8')
            const config = yaml.load(configContent) as ConfigData

            if (!config || typeof config !== 'object') {
                throw new ConfigError("config.yaml file must contain a YAML dictionary")
            }

            this.validateConfig(config)
            return config
        } catch (error) {
            if (error instanceof ConfigError) {
                throw error
            }
            if (error instanceof yaml.YAMLException) {
                throw new ConfigError(`invalid YAML in config.yaml file: ${error.message}`)
            }
            throw new ConfigError(`failed to read config.yaml file: ${error.message}`)
        }
    }

    public validateConfig(config: ConfigData): void {
        // check for unknown top-level keys
        const configKeys = Object.keys(config)

        for (const key of configKeys) {
            if (!VALID_CONFIG_KEYS.has(key)) {
                throw new ConfigError(`config.yaml: unknown parameter '${key}'`)
            }
        }

        // check required fields
        if (config.port === undefined) {
            throw new ConfigError("config.yaml: 'port' is required")
        }

        if (config.host === undefined) {
            throw new ConfigError("config.yaml: 'host' is required")
        }

        if (config.python_path === undefined) {
            throw new ConfigError("config.yaml: 'python_path' is required")
        }

        if (typeof config.python_path !== 'string' || config.python_path.trim() === '') {
            throw new ConfigError("config.yaml: 'python_path' must be a non-empty string")
        }

        if (config.api_providers === undefined) {
            throw new ConfigError("config.yaml: 'api_providers' is required")
        }

        // validate api_providers
        if (!Array.isArray(config.api_providers)) {
            throw new ConfigError("config.yaml: 'api_providers' must be an array")
        }

        if (config.api_providers.length === 0) {
            throw new ConfigError("config.yaml: 'api_providers' must contain at least one provider")
        }

        const providerNames = new Set<string>()

        for (const [index, apiProvider] of config.api_providers.entries()) {
            if (typeof apiProvider !== 'object' || apiProvider === null) {
                throw new ConfigError(`config.yaml: api_provider at index ${index} must be an object`)
            }

            if (typeof apiProvider.provider !== 'string' || apiProvider.provider.trim() === '') {
                throw new ConfigError(`config.yaml: api_provider at index ${index} must have a non-empty 'provider' string`)
            }

            if (providerNames.has(apiProvider.provider)) {
                throw new ConfigError(`config.yaml: duplicate api_provider '${apiProvider.provider}' at index ${index}`)
            }
            providerNames.add(apiProvider.provider)

            if (typeof apiProvider.key !== 'string' || apiProvider.key.trim() === '') {
                throw new ConfigError(`config.yaml: api_provider at index ${index} must have a non-empty 'api_key' string`)
            }

            // check for unknown properties in api_provider object
            const validApiProviderKeys = new Set(['provider', 'key', 'default'])
            for (const key of Object.keys(apiProvider)) {
                if (!validApiProviderKeys.has(key)) {
                    throw new ConfigError(`config.yaml: unknown property '${key}' in api_provider at index ${index}`)
                }
            }
        }

        // check chat extensions
        if (config.chat !== undefined) {
            if (!Array.isArray(config.chat)) {
                throw new ConfigError("config.yaml: 'chat' must be a list of extension names")
            }
            for (const ext of config.chat) {
                if (typeof ext !== 'string') {
                    throw new ConfigError("config.yaml: all chat extensions must be strings")
                }
            }
        }

        // check single extensions
        for (const extType of ['apply', 'symbol_lookup', 'autocomplete'] as const) {
            if (config[extType] !== undefined) {
                if (typeof config[extType] !== 'string') {
                    throw new ConfigError(`config.yaml: '${extType}' must be a string`)
                }
            }
        }

        if (config.tools !== undefined) {
            if (!Array.isArray(config.tools)) {
                throw new ConfigError("config.yaml: 'tools' must be an array")
            }

            const toolNames = new Set<string>()
            const toolShortcuts = new Set<string>()

            for (const [index, tool] of config.tools.entries()) {
                if (typeof tool !== 'object' || tool === null) {
                    throw new ConfigError(`config.yaml: tool at index ${index} must be an object`)
                }

                if (typeof tool.name !== 'string' || tool.name.trim() === '') {
                    throw new ConfigError(`config.yaml: tool at index ${index} must have a non-empty 'name' string`)
                }

                if (toolNames.has(tool.name)) {
                    throw new ConfigError(`config.yaml: duplicate tool name '${tool.name}' at index ${index}`)
                }
                toolNames.add(tool.name)

                if (typeof tool.extension !== 'string' || tool.extension.trim() === '') {
                    throw new ConfigError(`config.yaml: tool at index ${index} must have a non-empty 'extension' string`)
                }

                if (tool.description !== undefined && typeof tool.description !== 'string') {
                    throw new ConfigError(`config.yaml: tool at index ${index} 'description' must be a string if provided`)
                }

                if (tool.shortcut !== undefined) {
                    if (typeof tool.shortcut !== 'string' || tool.shortcut.trim() === '') {
                        throw new ConfigError(`config.yaml: tool at index ${index} 'shortcut' must be a non-empty string if provided`)
                    }

                    if (toolShortcuts.has(tool.shortcut)) {
                        throw new ConfigError(`config.yaml: duplicate tool shortcut '${tool.shortcut}' at index ${index}`)
                    }
                    toolShortcuts.add(tool.shortcut)

                    // basic validation for key combination format
                    if (!this._isValidKeyCombo(tool.shortcut)) {
                        throw new ConfigError(`config.yaml: invalid key combination format for tool at index ${index}: '${tool.shortcut}'`)
                    }
                }

                // check for unknown properties in tool object
                const validToolKeys = new Set(['name', 'extension', 'description', 'shortcut'])
                for (const key of Object.keys(tool)) {
                    if (!validToolKeys.has(key)) {
                        throw new ConfigError(`config.yaml: unknown property '${key}' in tool at index ${index}`)
                    }
                }
            }
        }

        // check port
        if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
            throw new ConfigError("config.yaml: 'port' must be an integer between 1 and 65535")
        }

        // check host
        if (typeof config.host !== 'string' || config.host.trim() === '') {
            throw new ConfigError("config.yaml: 'host' must be a non-empty string")
        }

        // check diff settings
        if (config.diff !== undefined) {
            if (typeof config.diff !== 'object' || config.diff === null) {
                throw new ConfigError("config.yaml: 'diff' must be an object")
            }

            const diffView = config.diff

            // Check for unknown diff keys
            const diffKeys = Object.keys(diffView)

            for (const key of diffKeys) {
                if (!VALID_DIFF_KEYS.has(key)) {
                    throw new ConfigError(`config.yaml: unknown parameter 'diff.${key}'`)
                }
            }

            if (diffView.min_collapse_lines !== undefined) {
                if (!Number.isInteger(diffView.min_collapse_lines) || diffView.min_collapse_lines < 1) {
                    throw new ConfigError("config.yaml: 'diff.min_collapse_lines' must be a positive integer")
                }
            }

            if (diffView.min_auto_collapse_lines !== undefined) {
                if (!Number.isInteger(diffView.min_auto_collapse_lines) || diffView.min_auto_collapse_lines < 1) {
                    throw new ConfigError("config.yaml: 'diff.min_auto_collapse_lines' must be a positive integer")
                }
            }

            if (diffView.context_lines !== undefined) {
                if (!Number.isInteger(diffView.context_lines) || diffView.context_lines < 0) {
                    throw new ConfigError("config.yaml: 'diff.context_lines' must be a non-negative integer")
                }
            }

            if (diffView.ignore_whitespace !== undefined) {
                if (typeof diffView.ignore_whitespace !== 'boolean') {
                    throw new ConfigError("config.yaml: 'diff.ignore_whitespace' must be a boolean")
                }
            }
        }
    }

    private _isValidKeyCombo(keyCombo: string): boolean {
        // supports formats like: "ctrl+a", "shift+f1", "alt+ctrl+s", "f12", "escape", etc.
        const validModifiers = ['ctrl', 'shift', 'alt', 'meta', 'cmd']
        const validKeys = [
            // function keys
            'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
            // special keys
            'escape', 'tab', 'space', 'enter', 'backspace', 'delete', 'insert', 'home', 'end',
            'pageup', 'pagedown', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
            // letters and numbers (single character)
            ...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''),
            // symbols
            '-', '=', '[', ']', '\\', ';', "'", '`', ',', '.', '/'
        ]

        const parts = keyCombo.toLowerCase().split('+').map(part => part.trim())

        if (parts.length === 0) {
            return false
        }

        // last part should be the main key
        const mainKey = parts[parts.length - 1]
        if (!validKeys.includes(mainKey)) {
            return false
        }

        // all other parts should be modifiers
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

    public getPythonPath(): string {
        return this.config.python_path
    }

    public getDiffSettings() {
        return {
            min_collapse_lines: this.config.diff?.min_collapse_lines,
            min_auto_collapse_lines: this.config.diff?.min_auto_collapse_lines,
            context_lines: this.config.diff?.context_lines,
            ignore_whitespace: this.config.diff?.ignore_whitespace
        }
    }

    public getServerConfig(): { host: string, port: number; } {
        return {
            host: this.config.host,
            port: this.config.port,
        }
    }

    public getTools(): Tool[] {
        return this.config.tools || []
    }

    public getApiProviders(): ApiProvider[] {
        return this.config.api_providers || []
    }
}

export async function loadExtensionConfig(): Promise<ExtensionConfig | null> {
    const configPath = path.join(settings.getBaseDirectory(), 'config.yaml')

    const config = new ExtensionConfig(configPath)
    await config.load()

    return config
}

export async function saveExtensionConfig(configContent: string): Promise<void> {
    const configPath = path.join(settings.getBaseDirectory(), 'config.yaml')

    // parse the YAML content
    let parsedConfig: ConfigData
    try {
        parsedConfig = yaml.load(configContent) as ConfigData

        if (!parsedConfig || typeof parsedConfig !== 'object') {
            throw new ConfigError("config.yaml file must contain a YAML dictionary")
        }

        const tempConfig = new ExtensionConfig(configPath)
        tempConfig.validateConfig(parsedConfig)
    } catch (error) {
        if (error instanceof ConfigError) {
            throw error
        }
        if (error instanceof yaml.YAMLException) {
            throw new ConfigError(`invalid YAML in config.yaml file: ${error.message}`)
        }
        throw new ConfigError(`failed to parse config.yaml content: ${error.message}`)
    }

    // if validation passes, write to file
    try {
        await fs.writeFile(configPath, configContent, 'utf8')
    } catch (error) {
        throw new ConfigError(`failed to write config.yaml file: ${error.message}`)
    }
}