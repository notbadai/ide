export function getCorrectPath(path: string, projectName: string): string {
    if (path == null) {
        return path
    }

    if (path.trim() === '') {
        return ''
    }

    const sanitized = path.replace(/^\/+/, '')
    return `${projectName}/${sanitized}`
}