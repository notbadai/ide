import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'js-yaml'
import {fileHandler} from "./file_handler"

export class WorkspaceConfigError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WorkspaceConfigError'
    }
}

export interface TabState {
    path: string
    isActive: boolean
}

export interface PaneLayoutState {
    leftPanePercent: number
    bottomPanePercent: number
    leftPaneHidden: boolean
    bottomPaneCollapsed: boolean
}

export interface ActivityState {
    topActivity: string
    bottomActivity: string
}

export interface WorkspaceData {
    openTabs?: TabState[]
    paneLayoutState?: PaneLayoutState
    activityState?: ActivityState
}

class WorkspaceConfig {
    private config: WorkspaceData
    private configPath: string

    constructor() {

    }

    private async load(): Promise<void> {
        this.config = await this._loadConfig()
    }

    public async init() {
        this.configPath = path.join(fileHandler.getRoot(), '.workspace.yaml')
        await this.load()
    }

    private async _loadConfig(): Promise<WorkspaceData> {
        const defaultConfig = this._getDefaultConfig()

        try {
            await fs.access(this.configPath)
        } catch {
            return defaultConfig
        }

        try {
            const configContent = await fs.readFile(this.configPath, 'utf8')
            const loadedConfig = yaml.load(configContent) as WorkspaceData

            if (!loadedConfig || typeof loadedConfig !== 'object') {
                throw new WorkspaceConfigError("Workspace file must contain a YAML dictionary")
            }

            return this._mergeWithDefaults(defaultConfig, loadedConfig)
        } catch (error) {
            if (error instanceof WorkspaceConfigError) {
                throw error
            }
            if (error instanceof yaml.YAMLException) {
                throw new WorkspaceConfigError(`Invalid YAML in workspace file: ${error.message}`)
            }
            throw new WorkspaceConfigError(`Failed to read workspace file: ${error.message}`)
        }
    }

    private _getDefaultConfig(): WorkspaceData {
        return {
            openTabs: [],
            paneLayoutState: {
                leftPanePercent: 0.2,
                bottomPanePercent: 0.3,
                bottomPaneCollapsed: false,
                leftPaneHidden: false,
            },
            activityState: {
                topActivity: 'project',
                bottomActivity: 'problem panel'
            }
        }
    }

    public getConfig(): WorkspaceData {
        return {
            openTabs: this.config.openTabs ? [...this.config.openTabs] : [],
            paneLayoutState: this.config.paneLayoutState ? {...this.config.paneLayoutState} : null,
            activityState: this.config.activityState ? {...this.config.activityState} : null
        }
    }

    public async save(): Promise<void> {
        try {
            const yamlContent = yaml.dump(this.config, {
                indent: 2,
                lineWidth: -1,
                noRefs: true
            })

            await fs.writeFile(this.configPath, yamlContent, 'utf8')
        } catch (error) {
            throw new WorkspaceConfigError(`Failed to save workspace file: ${error.message}`)
        }
    }

    public update(updates: Partial<WorkspaceData>): void {
        if (updates.paneLayoutState != null) {
            this.config.paneLayoutState = {
                ...this.config.paneLayoutState,
                ...updates.paneLayoutState
            }
        }

        if (updates.activityState != null) {
            this.config.activityState = {
                ...this.config.activityState,
                ...updates.activityState
            }
        }

        if (updates.openTabs != null) {
            this.config.openTabs = updates.openTabs
        }
    }

    private _mergeWithDefaults(defaultConfig: WorkspaceData, loadedConfig: WorkspaceData): WorkspaceData {
        return {
            openTabs: loadedConfig.openTabs || defaultConfig.openTabs,
            paneLayoutState: loadedConfig.paneLayoutState ?
                {...defaultConfig.paneLayoutState, ...loadedConfig.paneLayoutState} :
                defaultConfig.paneLayoutState,
            activityState: loadedConfig.activityState ?
                {...defaultConfig.activityState, ...loadedConfig.activityState} :
                defaultConfig.activityState
        }
    }
}

export const workspaceConfig = new WorkspaceConfig()