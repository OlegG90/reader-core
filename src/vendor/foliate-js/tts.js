// Book Reader: text-to-speech is out of scope, so the upstream tts.js is not vendored.
export class TTS {
    constructor() {
        throw new Error('Text-to-speech is not supported')
    }
}
