import {Weya as $, WeyaElementFunction} from '../../../../lib/weya/weya'
import {BaseComponent} from '../../components/base'
import {ToolSearch, SearchableObject} from './search'
import {Loader} from '../../components/loader'
import {projectManager} from '../project/manager'
import {clearChildElements} from '../../utils/document'
import {Form} from "./form"
import {ToolExtension} from "./tool"

interface ToolConfig {
    shortcut: string
    shortcutLister: () => void
    tool: ToolExtension
    extension: string
}

class ToolsManager extends BaseComponent {
    private elem: HTMLDivElement
    private toolElem: HTMLDivElement
    private readonly toolSearch: ToolSearch
    private loader: Loader

    private tools: SearchableObject[]
    private toolExtensions: Map<string, ToolConfig> = new Map()

    constructor() {
        super()

        this.tools = projectManager.project?.extensions?.tools || []
        this.toolSearch = new ToolSearch({
            objects: this.tools,
            onSuggestionSelected: async (obj: SearchableObject) => {
                const tool = this.toolExtensions.get(obj.name)
                tool.tool.run().then()
            }
        })
        this.loader = new Loader('line')
        projectManager.setOnFileSaveCallback(this.updateTools.bind(this))
    }

    public async render($: WeyaElementFunction): Promise<HTMLDivElement> {
        this.elem = $('div', '.tools-manager', $ => {
            $('h6', 'Tools')

            $('div', '.toolbar', $ => {
                this.toolSearch.render($)
            })
            $('div', '.tool-content', $ => {
                this.toolElem = $('div', '.custom-tool-wrapper')
                $('div', '.loader-container', $ => {
                    this.loader.render($)
                    this.loader.hide(true)
                })
            })
        })

        return this.elem
    }

    public updateTools() {
        this.tools = projectManager.project?.extensions?.tools || []
        this.toolSearch.updateObjects(this.tools)
    }

    public renderCustomTool(form: Form): void {
        clearChildElements(this.toolElem)
        $(this.toolElem, $ => {
            form.render($)
        })
    }

    public onTerminate(): void {
        this.loader.hide(true)
        this.toolSearch.setEnabled(true)
    }

    public onRun(clearCustomTool: boolean = false): void {
        this.loader.hide(false)
        this.toolSearch.setEnabled(false)

        if (this.toolElem != null && clearCustomTool) {
            clearChildElements(this.toolElem)
        }
    }

    public registerToolExtensions(): void {
        const toolExtensions = projectManager.project.extensions.tools
        if (!toolExtensions) {
            this.removeToolExtensions()
            return
        }

        const currentExtensionNames = new Set(toolExtensions.map(tool => tool.name))

        // remove extensions that are no longer in the config
        this.toolExtensions.forEach((config, name) => {
            if (!currentExtensionNames.has(name)) {
                if (config.shortcutLister) {
                    config.shortcutLister()
                }
                this.toolExtensions.delete(name)
            }
        })

        for (const tool of toolExtensions) {
            const existingConfig = this.toolExtensions.get(tool.name)

            if (existingConfig != null &&
                ((tool.shortcut != null && existingConfig.shortcut !== tool.shortcut) ||
                    tool.extension !== existingConfig.extension)) {
                if (existingConfig.shortcutLister != null) {
                    existingConfig.shortcutLister()
                }
                this.toolExtensions.delete(tool.name)
            }

            if (!this.toolExtensions.has(tool.name)) {
                const toolExtension = new ToolExtension({
                    name: tool.name,
                    extension: tool.extension
                })

                let shortcutLister = null
                if (tool.shortcut != null) {
                    shortcutLister = this.registerShortcut(tool.shortcut, async () => {
                        await toolExtension.run()
                    })
                }

                this.toolExtensions.set(tool.name, {
                    shortcut: tool.shortcut,
                    shortcutLister,
                    tool: toolExtension,
                    extension: tool.extension
                })
            }
        }
    }

    public removeToolExtensions(): void {
        this.toolExtensions.forEach((config: ToolConfig, name) => {
            if (config.shortcutLister != null) {
                config.shortcutLister()
            }
        })
        this.toolExtensions.clear()
    }

    private registerShortcut(shortcut: string, callback: () => Promise<void>): () => void {
        const parts = shortcut.toLowerCase().split('+').map(part => part.trim())
        const mainKey = parts[parts.length - 1]
        const modifiers = parts.slice(0, -1)

        const shortcutListener = async (event: KeyboardEvent) => {
            // check if all required modifiers are pressed
            const requiredModifiers = {
                ctrl: modifiers.includes('ctrl'),
                shift: modifiers.includes('shift'),
                alt: modifiers.includes('alt'),
                meta: modifiers.includes('meta') || modifiers.includes('cmd')
            }

            // check if the pressed modifiers match the required ones
            if (event.ctrlKey !== requiredModifiers.ctrl ||
                event.shiftKey !== requiredModifiers.shift ||
                event.altKey !== requiredModifiers.alt ||
                event.metaKey !== requiredModifiers.meta) {
                return
            }

            // check if the main key matches
            if (event.key.toLowerCase() === mainKey ||
                event.code.toLowerCase() === mainKey ||
                (mainKey.startsWith('f') && event.key.toLowerCase() === mainKey)) {
                event.preventDefault()
                event.stopPropagation()
                await callback()
            }
        }

        window.addEventListener('keydown', shortcutListener)

        // return a cleanup function
        return () => window.removeEventListener('keydown', shortcutListener)
    }
}

export const toolsManager = new ToolsManager()