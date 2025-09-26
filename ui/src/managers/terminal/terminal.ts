import {WeyaElementFunction} from '../../../../lib/weya/weya'
import {Terminal} from '@xterm/xterm'
import {FitAddon} from '@xterm/addon-fit'
import {BaseComponent} from "../../components/base"

export class TerminalPanel extends BaseComponent {
    private elem!: HTMLDivElement
    private termContainer!: HTMLDivElement

    private readonly term: Terminal
    private readonly fitAddon: FitAddon

    private resizeTimeout?: NodeJS.Timeout
    private resizeAnimationFrame?: number
    private resizeObserver?: ResizeObserver

    private linesBeforeRest: string[]
    private readonly terminalId: string

    constructor(terminalId: string) {
        super()

        this.terminalId = terminalId

        this.term = new Terminal({
            convertEol: true,
            cursorBlink: true,
            scrollOnUserInput: true,
            theme: {
                background: '#1b242a',
                foreground: '#f5f6fa'
            },
            fontSize: 12,
            fontFamily: 'Consolas, Menlo, "Courier New", monospace'
        })

        this.fitAddon = new FitAddon()
        this.term.loadAddon(this.fitAddon)

        this.term.onData(data => {
            window.electronAPI.terminalSend?.(this.terminalId, data)
        })

        this.term.onResize(size =>
            window.electronAPI.terminalResize?.(this.terminalId, size.cols, size.rows)
        )
        this.linesBeforeRest = []
    }

    private debouncedRefit = () => {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout)
        }

        if (this.resizeAnimationFrame) {
            cancelAnimationFrame(this.resizeAnimationFrame)
        }

        this.resizeTimeout = setTimeout(() => {
            this.resizeAnimationFrame = requestAnimationFrame(() => {
                this.fitAddon.fit()
                window.electronAPI.terminalResize?.(this.terminalId, this.term.cols, this.term.rows)
            })
        }, 16) // ~60fps
    }

    public async render($: WeyaElementFunction) {
        this.elem = $('div', '.terminal-panel', $ => {
            $('div', '.terminal-container', $ => {
                this.termContainer = $('div', '.terminal-view')
            })
        })

        this.term.open(this.termContainer)
        this.fitAddon.fit()

        const refit = () => {
            this.fitAddon.fit()
            window.electronAPI.terminalResize?.(this.terminalId, this.term.cols, this.term.rows)
        }

        window.addEventListener('resize', this.debouncedRefit)
        this.resizeObserver = new ResizeObserver(this.debouncedRefit)
        this.resizeObserver.observe(this.elem)

        // listen for output from this specific terminal
        window.electronAPI.onTerminalOutput?.((data: { terminalId: string, data: string }) => {
            if (data.terminalId !== this.terminalId) {
                return
            }
            this.term.write(data.data)
        })

        return this.elem
    }

    public getElement(): HTMLDivElement {
        return this.elem
    }

    public resetTerminal() {
        this.linesBeforeRest = this.getSnapshot()
        this.term.clear()
    }

    public focus() {
        this.term.focus()
    }

    public destroy() {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout)
        }
        if (this.resizeAnimationFrame) {
            cancelAnimationFrame(this.resizeAnimationFrame)
        }

        window.removeEventListener('resize', this.debouncedRefit)
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect()
        }

        this.term.dispose()
        window.electronAPI.terminalDestroy(this.terminalId).then()
    }

    public getSnapshot(maxLines = 1000): string [] {
        const buf = this.term.buffer.active
        const total = buf.length
        const start = Math.max(0, total - maxLines)

        const out: string[] = []
        for (let i = start; i < total; i++) {
            const line = buf.getLine(i)?.translateToString(/* trim = */ true) ?? ''
            out.push(line)
        }
        return out
    }

    public getLinesBeforeReset(): string [] {
        return this.linesBeforeRest
    }
}