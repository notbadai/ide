import {CodeBlock} from "./diff"

export interface DiffViewBlockOptions {
    type: string
    index: number
    lang: string
    blocks: string[]
    sudoLine: number
}

export class DiffViewBlock {
    public index: number
    public type: string
    public lang: string
    public blocks: string []
    public sudoLine: number

    constructor(opt: DiffViewBlockOptions) {
        this.type = opt.type
        this.index = opt.index
        this.lang = opt.lang
        this.blocks = opt.blocks
        this.sudoLine = opt.sudoLine
    }

    public revertLine() {
        const originalLine = this.blocks[0]
        this.type = 'similar'
        this.sudoLine = undefined
        this.blocks = [originalLine, originalLine]
    }
}


export class DiffBlockCollection {
    public blocks: DiffViewBlock[]

    constructor(blocks: CodeBlock[]) {
        this.blocks = []
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i]
            this.blocks.push(new DiffViewBlock({
                type: block.type,
                index: i,
                lang: block.langs[0],
                blocks: block.blocks,
                sudoLine: block.sudoLine
            }))
        }
    }

    public getProposedCode(): string {
        const lines: string[] = []
        for (const block of this.blocks) {
            if (block.sudoLine === 1) {
                continue
            }
            lines.push(block.blocks[1])
        }
        return lines.join('\n')
    }

    public revertLine(blockIndex: number) {
        const block = this.blocks[blockIndex]
        if (block.sudoLine === 0) {
            this.blocks.splice(blockIndex, 1)
            this.reindexAll()
        } else {
            block.revertLine()
        }
    }

    private reindexAll() {
        this.blocks.forEach((block, index) => {
            block.index = index
        })
    }
}