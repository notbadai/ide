export function isPositionVisible(pos: number): boolean {
    try {
        // get the coordinates of the position
        const coords = this.editorView.coordsAtPos(pos)
        if (!coords) return false

        // get the editor's visible area
        const editorRect = this.editorView.dom.getBoundingClientRect()
        const scrollElement = this.editorView.scrollDOM

        // check if the position is within the visible scroll area
        return coords.top >= editorRect.top &&
            coords.bottom <= editorRect.bottom &&
            coords.top >= scrollElement.scrollTop &&
            coords.bottom <= scrollElement.scrollTop + scrollElement.clientHeight
    } catch {
        // if coordsAtPos fails, the position is likely not visible
        return false
    }
}