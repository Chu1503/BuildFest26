# GoGo project handoff

## Current deliverables

- `building-demo/`: one-page browser demo with the planner on the left and interactive multi-floor 3D building view on the right.
- `traveler-app/`: Android WebView application with the mobile 2D interface and native bridges for speech, Ollama and text-to-speech.
- `releases/GoGo-Traveler-0.9.apk`: signed Android 8+ prototype, package `dev.gogo.traveler`, version code 13.
- Five building datasets: Morgridge Hall, Memorial Union, College Library, Discovery and Chazen. All supplied floors appear in both interfaces.

## Voice behavior

`MainActivity.java` owns microphone permission, `SpeechRecognizer`, foreground “Hey GoGo” detection, Android TTS, spoken prompt-then-listen turns and the native Ollama HTTP request. `traveler-app/app/src/main/assets/web/app.js` owns the voice state, current-location context and validation against the active route catalog. An LLM response cannot create a route node or navigate to an unmapped destination.

The visible voice interaction is one microphone circle. It animates while listening; no transcript, text response or assistant modal is rendered. Tapping the active microphone cancels recognition. Successful destination requests start the map immediately. “Next,” “repeat,” and “next direction” operate on the active route and speak the resulting cue.

The context sent to Ollama includes the selected building, current floor/place, selected destination floor/place, access profile, navigation state, current cue, all floors and mapped destinations. Deterministic matching handles known rooms and route controls first. Missing or ambiguous destinations trigger a spoken follow-up and native TTS resumes command recognition when the question finishes.

Unknown map details are stored automatically as `gogo-missing-data`. The Ollama model is a build-time constant; the server URL is editable from the top-right Settings panel and persists as `gogo-ollama-url` in local storage.

## Verification completed

- 3,165 routes across five buildings, 208 reverse sources, floor coverage, sensor freshness and cue checks.
- Java compiled against Android API 35.
- APK is ZIP-aligned and signed with APK signature schemes v2 and v3.
- Packaged `index.html`, `app.js` and `style.css` exactly match source.
- Manifest contains `INTERNET` and `RECORD_AUDIO`; min SDK 26, target SDK 35.

Physical microphone and wake recognition still require final testing on an Android device. The current Mac endpoint is `http://192.168.1.110:11434`; use Settings after a Wi-Fi/IP change. Building geometry remains prototype data and is not validated for real-world navigation.

## Useful commands

```sh
python -m http.server 8000 --directory building-demo
node scripts/test-routes.mjs
node scripts/test-integration.mjs
node scripts/test-positioning-2d.mjs
node scripts/test-amenities.mjs
```

Read `docs/VOICE_ASSISTANT.md` for Ollama setup. The Vercel deployment should use `building-demo` as its root/output directory; the APK remains a separate downloadable artifact.
