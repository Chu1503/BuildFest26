# GoGo voice assistant setup

## What works without Ollama

The Android app handles mapped navigation commands directly: room requests, next step, repeat, current location, building selection and access-profile changes. Tap the microphone to begin listening immediately. The same circle animates while listening; no transcript or assistant panel is displayed. While the app is open, saying **Hey GoGo** plays an acknowledgment tone and starts the same voice flow.

Android asks for microphone permission the first time. The wake option only runs while the GoGo activity is in the foreground. It is a hackathon wake-phrase demo built on Android speech recognition, not an operating-system hotword service.

## Connect Ollama

1. Install and start Ollama on the computer.
2. Download the configured model:

   ```sh
   ollama pull llama3.2:3b
   ```

3. Open Ollama, or start its server from Terminal with `ollama serve`.
4. The browser preview initially connects to `http://127.0.0.1:11434`. The phone initially connects to this Mac at `http://192.168.1.110:11434`.
5. For a physical phone, put the phone and computer on the same trusted Wi-Fi network. On macOS run:

   ```sh
   launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
   ```

   Restart Ollama and find the Mac address with `ipconfig getifaddr en0`. If the address changes, open **Settings** in GoGo and save `http://YOUR_MAC_IP:11434`. Rebuilding is not required. Allow Ollama through the firewall if macOS asks.

6. Ask an open-ended question. The app posts the question and current building context to Ollama’s `/api/chat` endpoint with JSON output enabled.

Only use the network-exposed server on a trusted local network. The current hackathon build does not add authentication or TLS to Ollama.

## Missing building data

If the room catalog cannot support a request, GoGo stores the query, missing detail, building and time on the device without adding another menu to the voice surface. It does not automatically change the route graph.

## Architecture

- Android `SpeechRecognizer`: microphone transcription and foreground wake-phrase loop.
- Existing GoGo route engine: validates buildings, rooms, floors and directions.
- Native Android HTTP client: calls Ollama; WebView mixed-content rules do not apply to this request.
- Android text-to-speech: reads short assistant responses and navigation cues.
- `localStorage`: saves missing-data requests.
