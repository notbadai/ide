import {marked} from 'marked'

marked.use({
    async: false,
    pedantic: false,
    gfm: true,
})

export function getMarkDownParsed(content: string): string {
    return marked.parse(content)
}