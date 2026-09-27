# GoGo project handoff

## Current deliverables

- `building-demo/`: one-page browser demo with the planner on the left and interactive multi-floor 3D building view on the right.
- `traveler-app/`: Android WebView application with the mobile 2D interface and native bridges for speech, Ollama and text-to-speech.
- `releases/GoGo-Traveler-0.7.apk`: signed Android 8+ prototype, package `dev.gogo.traveler`, version code 8.
- Five building datasets: Morgridge Hall, Memorial Union, College Library, Discovery and Chazen. All supplied floors appear in both interfaces.

## Voice behavior

`MainActivity.java` owns microphone permission, `SpeechRecognizer`, foreground “Hey GoGo” detection, Android TTS and the native Ollama HTTP request. `traveler-app/app/src/main/assets/web/app.js` handles the assistant UI and validates model suggestions against the active route catalog. An LLM response cannot create a route node or navigate to an unmapped destination.

Unknown details are stored as `gogo-missing-data` in WebView local storage. The uncluttered voice panel hides infrastructure settings; the emulator Ollama URL and model are build-time constants in `app.js`.

## Verification completed

- 3,165 routes across five buildings, 208 reverse sources, floor coverage, sensor freshness and cue checks.
- Java compiled against Android API 35.
- APK is ZIP-aligned and signed with APK signature schemes v2 and v3.
- Packaged `index.html`, `app.js` and `style.css` exactly match source.
- Manifest contains `INTERNET` and `RECORD_AUDIO`; min SDK 26, target SDK 35.

Physical microphone, wake recognition and Ollama-on-phone connectivity still require testing on an Android device. Building geometry remains prototype data and is not validated for real-world navigation.

## Useful commands

```sh
python -m http.server 8000 --directory building-demo
node scripts/test-routes.mjs
node scripts/test-integration.mjs
node scripts/test-positioning-2d.mjs
node scripts/test-amenities.mjs
```

Read `docs/VOICE_ASSISTANT.md` for Ollama setup. The Vercel deployment should use `building-demo` as its root/output directory; the APK remains a separate downloadable artifact.
