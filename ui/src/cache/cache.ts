import {Project, ProjectChanges} from "../models/project"
import {FileOperationData} from '../models/file_operation'

export interface ProjectUpdateResult {
    changes: ProjectChanges
    project: Project
}

class BroadcastPromise<T> {
    // Registers a bunch of promises and broadcast to all of them
    private isLoading: boolean
    private resolvers: any[]
    private rejectors: any[]

    constructor() {
        this.isLoading = false
        this.resolvers = []
        this.rejectors = []
    }

    create(load: () => Promise<T>): Promise<T> {
        let promise = new Promise<T>((resolve, reject) => {
            this.add(resolve, reject)
        })

        if (!this.isLoading) {
            this.isLoading = true
            // load again only if not currently loading;
            // otherwise resolve/reject will be called when the current loading completes.
            load().then((res: T) => {
                this.resolve(res)
            }).catch((err) => {
                this.reject(err)
            })
        }

        return promise
    }

    private add(resolve: (value: T) => void, reject: (err: any) => void) {
        this.resolvers.push(resolve)
        this.rejectors.push(reject)
    }

    private resolve(value: T) {
        this.isLoading = false
        let resolvers = this.resolvers
        this.resolvers = []
        this.rejectors = []

        for (let r of resolvers) {
            r(value)
        }
    }

    private reject(err: any) {
        this.isLoading = false
        let rejectors = this.rejectors
        this.resolvers = []
        this.rejectors = []

        for (let r of rejectors) {
            r(err)
        }
    }
}

export abstract class CacheObject<T> {
    public lastUpdated: number
    protected data!: T
    protected broadcastPromise = new BroadcastPromise<T>()
    protected lastUsed: number

    constructor() {
        this.lastUsed = 0
        this.lastUpdated = 0
    }

    abstract load(...args: any[]): Promise<T>

    async get(isRefresh = false, ...args: any[]): Promise<T> {
        if (this.data == null) {
            this.data = await this.load()
            this.lastUpdated = (new Date()).getTime()
        }

        this.lastUsed = new Date().getTime()

        return this.data
    }

    set(data: T) {
        this.data = data
        this.lastUpdated = (new Date()).getTime()
    }
}


export class ProjectCache extends CacheObject<Project> {
    constructor() {
        super()
    }

    async load(): Promise<Project> {
        return this.broadcastPromise.create(async () => {
            const res = await window.electronAPI.fsGetProject()
            return new Project(res)
        })
    }

    async getCachedProject(): Promise<ProjectUpdateResult> {
        // update the project
        const res = await window.electronAPI.fsGetCachedProject()
        const projectChanges = await this.data.update(res)

        this.lastUpdated = (new Date()).getTime()
        this.lastUsed = (new Date()).getTime()

        return {changes: projectChanges, project: this.data}
    }

    async fileOperation(data: FileOperationData): Promise<any> {
        return await window.electronAPI.fileOperation(data)
    }
}

class Cache {
    private project: ProjectCache | null

    constructor() {
    }

    getProject() {
        if (this.project == null) {
            this.project = new ProjectCache()
        }

        return this.project
    }
}

let CACHE = new Cache()

export default CACHE