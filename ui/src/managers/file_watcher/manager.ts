import {tabsManager} from "../tabs/manager"
import {projectManager} from "../project/manager"
import CACHE, {ProjectCache} from "../../cache/cache"
import {statusBar} from "../../components/status_bar"

class FileWatcherManager {
    private projectHandleCache: ProjectCache

    public constructor() {

    }

    public init() {
        this.projectHandleCache = CACHE.getProject()
        window.electronAPI.onFileWatcherChanges(() => {
            // console.log('File watcher changes detected, updating...')
            this.update().then()
        })
    }

    public async update() {
        const res = await this.projectHandleCache.getCachedProject()
        const project = res.project

        projectManager.reRenderFiles(project)
        tabsManager.syncWithProject(res.changes)
        statusBar.updateGitBranch(project.gitBranch)
        projectManager.runOnFileSaveCallbacks()
    }
}

export const fileWatcherManager = new FileWatcherManager()