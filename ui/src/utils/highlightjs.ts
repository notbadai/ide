import {Weya as $} from '../../../lib/weya/weya'
import hljs from 'highlight.js'
import {clearChildElements} from "./document"

interface HighLightedCode {
    lang: string
    html: string
}

export function getHighlightedCode(code: string, lang: string): HighLightedCode {
    if (code === '') {
        return {lang: lang, html: '\n'}
    }
    if (hljs.getLanguage(lang)) {
        let res = hljs.highlight(code, {language: lang})
        return {lang: res.language, html: res.value}
    } else {
        let res = hljs.highlightAuto(code)
        return {lang: res.language, html: res.value}
    }
}

export function addLineNumbers(code: HTMLElement) {
    let lines = code.innerHTML.split("\n")

    clearChildElements(code)

    for (let i = 0; i < lines.length; i++) {
        let span = $('span', '.line')
        span.innerHTML = lines[i]
        code.appendChild(span)
        code.appendChild(document.createTextNode("\n"))
    }
}

// https://stackoverflow.com/questions/67954877/how-to-set-numbers-to-pre-with-js-css
// https://github.com/highlightjs/highlight.js/issues/480