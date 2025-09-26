import {promises as fs} from "fs"
import path from "path"

function clientRel(absPath: string, root: string, rootName: string): string {
    const innerRel = path.relative(root, absPath)
    return path.join(rootName, innerRel)
}

export async function isDirectory(filePath: string): Promise<boolean> {
    try {
        const stat = await fs.stat(filePath)
        return stat.isDirectory()
    } catch (error) {
        return false
    }
}

export async function walk(dir: string, acc: string[] = [], root: string, rootName: string, ignoreHidden = true): Promise<string[]> {
    const entries = await fs.readdir(dir, {withFileTypes: true})

    for (const e of entries) {
        if (e.isSymbolicLink()) {
            continue
        }

        const absPath = path.join(dir, e.name)
        const rel = clientRel(absPath, root, rootName)

        if (ignoreHidden && e.isDirectory() && e.name.startsWith('.')) {
            continue
        }
        if (rel.includes('__pycache__')) {
            continue
        }
        if (e.name === '.workspace.yaml') {
            continue
        }

        if (e.isDirectory()) {
            const children = await fs.readdir(absPath)
            if (children.length === 0) {
                acc.push(rel)
            }
            await walk(absPath, acc, root, rootName, ignoreHidden)
        } else {
            acc.push(rel)
        }
    }

    return acc
}