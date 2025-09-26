import * as path from 'path'
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git'


export class GitClient {
    private readonly projectPath: string
    
    constructor(projectPath: string) {
        this.projectPath = projectPath
    }
    
    private git(): SimpleGit {
        const options: Partial<SimpleGitOptions> = {
              baseDir: this.projectPath,
              binary: 'git',
              maxConcurrentProcesses: 4,
        }
        
        return simpleGit(options)
    }
    
    private async checkoutBranch(branch: string, forceCheckout?: boolean): Promise<void> {
        const git = this.git()
        
        const localBranches = await git.branchLocal()
        
        if (localBranches.all.includes(branch)) {
            await git.checkout(branch, forceCheckout ? ['-f'] : undefined)
        } else {
            await git.checkout(['-B', branch])
        }
    }
    
    public async isRepository(): Promise<boolean> {
        return this.git().checkIsRepo()
    }
    
    public async getUncommittedPaths(): Promise<string[]> {
        const git = this.git()
        
        const isRepo = await git.checkIsRepo()
        if (!isRepo) {
            return []
        }
        
        const repoName = path.basename(path.resolve(this.projectPath))
        const withRepoPrefix = (p: string) => path.join(repoName, p)
        
        const status = await git.status()
        
        const untracked = new Set(status.not_added.map(withRepoPrefix))
        
        const unstaged = new Set<string>([
            ...status.modified.map(withRepoPrefix),
            ...status.deleted.map(withRepoPrefix),
            ...status.created.map(withRepoPrefix),
            ...status.renamed.map(r => withRepoPrefix((r as any).to ?? r)),
        ])
        
        const stagedRaw = await git.diff(['--cached', '--name-only'])
        const staged = new Set(
            stagedRaw.split('\n').filter(Boolean).map(withRepoPrefix),
        )

        const everything = new Set<string>([
            ...untracked,
            ...unstaged,
            ...staged,
        ])

        return [...everything]
    }
    
    public async getCurrentBranch(): Promise<string> {
        const git = this.git()
        
        const isRepo = await git.checkIsRepo()
        if (!isRepo) {
            return null
        }
        
        const branchSummary = await git.branchLocal()
        
        return branchSummary.current
    }
    
    public async commitPush(commitMessage: string, branch: string = 'main', forceCheckout: boolean = false): Promise<void> {
        const git = this.git()

        await this.checkoutBranch(branch, forceCheckout)

        // Stage changes
        await git.add(['-A'])

        // Only commit if there is something to commit
        const isDirty = (await git.status()).isClean() === false
        if (isDirty) {
            const commit = await git.commit(commitMessage)
            const diffRaw = await git.raw(['diff-tree', '--no-commit-id', '--name-only', '-r', commit.commit])
            const changedFiles = diffRaw.split('\n').filter(Boolean)   
            
            console.info(`Committed ${commit.commit} | files: ${changedFiles.join(', ')}`)
        }

        // Push
        try {
            await git.push(['--set-upstream', 'origin', branch])
        } catch {
            // upstream is probably already configured
            await git.push("origin", branch)
        }
    }

    public async pull(branch: string): Promise<void> {
        const git = this.git()

        // Ensure we have remote information
        await git.fetch()

        const remoteRef = `origin/${branch}`
        const remotes = await git.branch(['-r'])
        if (!remotes.all.includes(remoteRef)) {
            throw new Error(`Remote branch “${branch}” does not exist`)
        }

        // Forced checkout / reset to remote tip
        const localBranches = await git.branchLocal()
        if (localBranches.all.includes(branch)) {
            await git.checkout(branch, ['-f'])           // discard local edits
        } else {
            await git.checkoutBranch(branch, remoteRef)  // create & track
        }

        await git.reset(['--hard', remoteRef])
        await git.clean('f', ['-d'])
    }
    
    public async createBranch(branch: string, startPoint: string = 'main'): Promise<void> {
        const git = this.git()
        
        await git.fetch()
        const remoteBranches = await git.branch(['-r'])
        const remoteRef = `origin/${branch}`
        if (remoteBranches.all.includes(remoteRef)) {
            throw new Error(`Branch “${branch}” already exists on origin`)
        }

        const baseRemote = `origin/${startPoint}`
        if (!remoteBranches.all.includes(baseRemote)) {
            throw new Error(`Start point “${startPoint}” not found on origin`)
        }

        await git.checkoutBranch(branch, baseRemote)
        await git.push(['--set-upstream', 'origin', branch])
    }
    
    public async checkout(branch: string): Promise<void> {
        const git = this.git()
        
        await git.fetch()
        const remoteRef = `origin/${branch}`
        const remoteBranches = await git.branch(['-r'])
        if (!remoteBranches.all.includes(remoteRef)) {
            throw new Error(`Remote branch “${branch}” does not exist`)
        }

        const localBranches = await git.branchLocal()
        if (localBranches.all.includes(branch)) {
            await git.checkout(branch, ['-f']) // discard local edits
        } else {
            await git.checkoutBranch(branch, remoteRef)
        }

        await git.reset(['--hard', remoteRef])
        await git.clean('f', ['-d'])
    }
}