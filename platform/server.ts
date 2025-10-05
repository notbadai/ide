import * as http from 'http'
import express, {Request, Response, NextFunction} from 'express'
import {ExtensionResponse} from "../ui/src/models/extension"
import {streamService} from "./extensions/streaming/service"
import {terminalManager} from "./terminal/terminal_manager"


export interface HttpServerOptions {
    port: number
    host: string
}

class HttpServer {
    private server: http.Server | null = null
    private app: express.Application

    private port: number
    private host: string

    constructor() {
        this.app = express()
        this.setupMiddleware()
        this.setupRoutes()
    }

    public init(options: HttpServerOptions) {
        this.port = options.port
        this.host = options.host
    }

    private setupMiddleware() {
        this.app.use(express.json())
        this.app.use(express.urlencoded({extended: true}))

        // CORS for local development
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            res.header('Access-Control-Allow-Origin', '*')
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
            if (req.method === 'OPTIONS') {
                res.sendStatus(200)
            } else {
                next()
            }
        })
    }

    private setupRoutes() {
        this.app.post('/api/extension/response/:uuid', async (req: Request, res: Response) => {
            try {
                const requestData = req.body

                const response = this.toResponse(requestData)
                const channel = streamService.getChannel(req.params.uuid)
                await channel.sendResponse(response, requestData.request_id)

                res.status(200).json({success: true})
            } catch (error) {
                console.error('Error processing extension request:', error)
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        })

        this.app.get('/api/terminal/:name', async (req: Request, res: Response) => {
            try {
                const terminalName = req.params.name
                const terminalData = await terminalManager.getTerminalData(terminalName)

                res.status(200).json({
                    success: true,
                    data: terminalData
                })
            } catch (error) {
                console.error('Error getting terminal data:', error)
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        })

        this.app.get('/api/extension/data/:uuid', async (req: Request, res: Response) => {
            try {
                const channel = streamService.getChannel(req.params.uuid)
                res.status(200).json({
                    success: true,
                    data: channel.dequeueEditorState()
                })
            } catch (error) {
                console.error('Error getting terminal data:', error)
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        })

        // catch all route
        this.app.use('*', (req: Request, res: Response) => {
            res.status(404).json({error: 'Endpoint not found'})
        })
    }

    public async start(): Promise<void> {
        if (this.server) {
            console.log(`HTTP server already running on ${this.host}:${this.port}`)
            return
        }

        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, this.host, () => {
                console.log(`HTTP server started on http://${this.host}:${this.port}`)
                resolve()
            })

            this.server.on('error', (error: any) => {
                console.error('HTTP server error:', error)
                reject(error)
            })
        })
    }

    public async stop(): Promise<void> {
        if (!this.server) {
            return
        }

        return new Promise((resolve) => {
            this.server!.close(() => {
                console.log(`HTTP server port ${this.port} stopped`)
                this.server = null
                resolve()
            })
        })
    }

    public isRunning(): boolean {
        return this.server !== null
    }

    public async restart(host: string, port: number): Promise<void> {
        const targetPort = port || this.port
        const targetHost = host || this.host

        if (this.isRunning() && targetPort === this.port && targetHost === this.host) {
            console.log(`HTTP server already running on ${this.host}:${this.port}`)
            return
        }

        if (this.isRunning()) {
            console.log(`Stopping HTTP server to change from ${this.host}:${this.port} to ${targetHost}:${targetPort}`)
            await this.stop()
        }

        this.port = targetPort
        this.host = targetHost

        await this.start()
        streamService.onRestart()
    }

    private toResponse(data: any): Partial<ExtensionResponse> {
        if (data.method === 'log') {
            return {is_stopped: false, log: {message: data.content}}
        } else if (data.method === 'error') {
            return {is_stopped: true, error: {message: data.content}}
        } else if (data.method === 'notify') {
            return {is_stopped: false, notification: {message: data.content, title: data.title}}
        } else if (data.method === 'update_progress') {
            return {is_stopped: false, progress: {message: data.content, progress: data.progress}}
        } else if (data.method === 'highlight') {
            return {is_stopped: false, highlight: {results: data.results}}
        } else if (data.method === 'start_chat') {
            return {is_stopped: false, chat: {start_chat: true}}
        } else if (data.method === 'end_chat') {
            return {is_stopped: false, chat: {terminate_chat: true}}
        } else if (data.method === 'chat') {
            return {is_stopped: false, chat: {push_chat: true, chunk: data.content}}
        } else if (data.method === 'inline_completion') {
            return {
                is_stopped: false,
                inline_completion: {
                    inline_completion: data.content,
                    cursor_row: data.cursor_row,
                    cursor_column: data.cursor_column
                }
            }
        } else if (data.method === 'update_file') {
            return {
                is_stopped: false,
                apply: {
                    matches: data.matches,
                    patch: data.patch,
                    cursor_column: data.cursor_column,
                    cursor_row: data.cursor_row
                }
            }
        } else if (data.method === 'autocomplete') {
            return {is_stopped: false, autocomplete: {suggestions: data.suggestions, time_elapsed: data.time_elapsed}}
        } else if (data.method === 'ui_action') {
            return {is_stopped: false, state: data.state}
        } else {
            throw new Error(`invalid ExtensionAPI method: ${data.method}`)
        }
    }

    public getServerConfig(): { host: string, port: number; } {
        return {
            host: this.host,
            port: this.port,
        }
    }
}

export const httpServer = new HttpServer()