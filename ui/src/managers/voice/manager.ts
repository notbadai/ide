import {banner} from "../../components/banner"
import {chatManager} from "../chat/manager"
import {convertToIdentifiers, getIdentifiersInCurrentFile} from "./prompt"
import {activityBarManager, CHAT} from "../activity_bar/manager"
import {TRANSCRIPTION_API_ENDPOINT} from "../../env"


class VoiceManager {
    private mediaRecorder: MediaRecorder
    private stream: MediaStream
    private isProcessing: boolean
    private capsLockListener: ((event: KeyboardEvent) => void) | null
    private onAudioProcessed: (text: string) => void
    private bufferedChunks: Blob[] = []
    private sequenceNumber: number = 0
    private nextSequenceNumber: number = 1

    constructor() {
        this.mediaRecorder = null
        this.stream = null
        this.capsLockListener = null
        this.onAudioProcessed = null
        this.bufferedChunks = []
        this.sequenceNumber = 0
        this.nextSequenceNumber = 0
    }

    public setOnAudioProcessed(callback: (text: string) => void) {
        this.onAudioProcessed = callback
    }

    private hasVoiceSetup(): boolean {
        return TRANSCRIPTION_API_ENDPOINT !== ""
    }

    public init() {
        this.capsLockListener = (event: KeyboardEvent) => {
            if (event.code !== 'CapsLock') {
                return
            }

            if (!this.hasVoiceSetup()) {
                banner.error('Voice transcription unavailable: Please configure TRANSCRIPTION_API_ENDPOINT in env.ts to enable voice input')
                return
            }

            const capsLockOn = event.getModifierState('CapsLock')

            if (capsLockOn && !this.isProcessing) {
                chatManager.startRecording()
                this.startRecording().then()
                activityBarManager.openTopTab(CHAT)
            } else if (!capsLockOn) {
                chatManager.stopRecording()
                this.stopRecording()
            }
        }

        document.addEventListener('keydown', this.capsLockListener)
        document.addEventListener('keyup', this.capsLockListener)
    }

    private async startRecording(): Promise<void> {
        // stop any existing recording first
        this.stopRecording()

        this.bufferedChunks = []

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 16000,
                channelCount: 1
            }
        })

        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data == null) {
                return
            }
            if (event.data.size <= 0) {
                return
            }
            this.bufferedChunks.push(event.data)

            const requestSequence = this.nextSequenceNumber++
            const identifiers = getIdentifiersInCurrentFile()
            const prompt = identifiers.join(', ')
            let text = await this.sendAudioToServer(this.bufferedChunks, prompt)
            text = convertToIdentifiers(text, identifiers)

            if (!text) {
                return
            }
            if (this.onAudioProcessed == null) {
                return
            }
            if (requestSequence < this.sequenceNumber) {
                return
            }

            this.onAudioProcessed(text)
            this.sequenceNumber = requestSequence
        };

        this.mediaRecorder.onstop = () => {
            this.bufferedChunks = []
        };

        this.mediaRecorder.onerror = (event) => {
            banner.error(`MediaRecorder error: ${event.error?.message || 'Unknown error'}`)
        };

        // use a shorter interval for more frequent streaming opportunities
        this.mediaRecorder.start(1000)
    }

    private stopRecording() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop()
            this.mediaRecorder = null
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop())
            this.stream = null
        }
    }

    public destroy() {
        if (this.capsLockListener) {
            document.removeEventListener('keydown', this.capsLockListener)
            document.removeEventListener('keyup', this.capsLockListener)
            this.capsLockListener = null
        }
        this.stopRecording()
    }

    private async sendAudioToServer(audioChunks: Blob[], prompt: string): Promise<string> {
        if (audioChunks.length === 0) {
            return ''
        }

        // validate audio blob before sending
        const audioBlob = new Blob(audioChunks, {type: 'audio/webm'})
        if (audioBlob.size < 1000) {
            console.warn('Audio blob too small, skipping transcription')
            return ''
        }

        this.isProcessing = true
        let transcriptionText = ''
        try {
            // create form data for OpenAI API
            const formData = new FormData()
            formData.append('file', audioBlob, 'recording.webm')
            formData.append('model', 'Systran/faster-whisper-large-v2')
            formData.append('language', 'en')
            formData.append('prompt', prompt)

            // send directly to OpenAI-compatible API
            const requestStart = Date.now()
            const response = await fetch(TRANSCRIPTION_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer xxxx'
                },
                body: formData
            })
            const requestTime = Date.now() - requestStart
            console.log(`Audio transcription request completed in ${requestTime}ms`)

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            // handle streaming response
            const reader = response.body?.getReader()
            if (!reader) {
                throw new Error('No response body')
            }

            const decoder = new TextDecoder()
            while (true) {
                const {done, value} = await reader.read()
                if (done) {
                    break
                }

                const chunk = decoder.decode(value, {stream: true})
                // parse streaming JSON chunks
                const lines = chunk.split('\n').filter(line => line.trim())
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line)
                        if (data.text) {
                            transcriptionText += data.text
                        }
                    } catch (e) {
                        continue
                    }
                }
            }
        } catch (error) {
            banner.error(`Audio processing failed: ${error.message}`)
        }
        this.isProcessing = false

        return transcriptionText
    }
}

export const voiceManager = new VoiceManager()