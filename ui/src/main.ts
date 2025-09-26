import {ROUTER} from './app'
import {EditorViewHandler} from "./views/editor_view"
import {PageNotFoundHandler} from "./views/page_not_found_view"
import {ProjectSelectorViewHandler} from './views/project_selector_view'


ROUTER.route(/^(.*)$/g, [() => {
    ROUTER.navigate('/404')
}])

ROUTER.route('', [async () => {
    window.electronAPI.cachedProjectGetPath().then(async dir => {
        if (dir != null) {
            await window.electronAPI.cachedProjectSetUpFromCache()
            ROUTER.navigate(`/editor`)
            return
        } else {
            ROUTER.navigate('/select', {replace: true})
        }
    })
}])

new EditorViewHandler()
new PageNotFoundHandler()
new ProjectSelectorViewHandler()


if (window.location.protocol === 'file:' && window.location.pathname !== "/") {
    const hash = window.location.hash

    history.replaceState(null, '', "/")
    if (hash) {
        window.location.hash = hash
    }
}

if (
    document.readyState === 'complete' ||
    document.readyState === 'interactive'
) {
    ROUTER.start(null, false)
} else {
    document.addEventListener('DOMContentLoaded', () => {
        ROUTER.start(null, false)
    })
}

// To make sure that :active is triggered in safari
// Ref: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html
document.addEventListener("touchstart", () => {
}, true)