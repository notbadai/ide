export function setTitle(opt: { section?: string, item?: string }) {

    if (opt.section != null && opt.item != null) {
        document.title = `${opt.section} - ${opt.item}`
    } else if (opt.section != null || opt.item != null) {
        document.title = `${opt.section || opt.item}`
    } else {
        document.title = 'AI IDE - NotBadAI'
    }
}

export function clearChildElements(elem: HTMLElement) {
    // Comparison: https://www.measurethat.net/Benchmarks/Show/13770/0/innerhtml-vs-innertext-vs-removechild-vs-remove#latest_results_block
    while (elem.firstChild) {
        elem.firstChild.remove()
    }
}

export function getPageHeight() {
    let body = document.body
    let html = document.documentElement

    return Math.max(body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight)
}

export function getPageWidth() {
    return Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
}

export function getPath() {
    return window.location.pathname
}