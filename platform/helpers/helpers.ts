import {promises as fs} from 'fs'
import * as path from 'path' 
import ignore from "ignore"


export async function filterGitIgnorePaths(root: string, relPaths: string[]): Promise<string[]> {
    const ignoreFile = path.join(root, ".gitignore")
    
    let gitignoreContent = ''
    try {
        gitignoreContent = await fs.readFile(ignoreFile, 'utf8')
    } catch {
        return relPaths
    }
    
    if (gitignoreContent.trim() === '') {
        return relPaths
    }
    
    const ig = ignore()
    ig.add(gitignoreContent)   
    
    const rootName = path.basename(root)
    
    let ret = []
    let count = 0
    for ( const p of relPaths) {
        let pForMatch = p
        
        if (p.startsWith(rootName + path.sep) || p.startsWith(rootName + '/')) {
            pForMatch = p.slice(rootName.length + 1)
        }

        pForMatch = pForMatch.split(path.sep).join('/')
    
        if (ig.ignores(pForMatch)){
            count += 1
            continue
        }      
        
        ret.push(p)
    }
    
    console.log(`Ignored ${count} paths`)

    return ret
}