# GoGo smart voice handoff

## Current experience

- Uses the solid black, white, and yellow visual system with no gradients.
- Keeps the simplified indoor planner and navigation interface on phone and desktop.
- Shows one microphone button at rest. During a voice session it changes to a cross and reveals a floating seven-bar waveform to its left. The waveform animates only while speech recognition is actively listening.
- Keeps room selection, routing, Next step, Repeat, the wake phrase, text-to-speech, and Ollama server settings working.

## Voice intelligence changes

- Added ranked matching against actual mapped buildings, rooms, and places.
- Accepts short building names such as “Morgridge,” “Union,” “Discovery,” and “Chazen.”
- Tolerates omitted generic words, reordered words, and small speech-to-text spelling errors such as “Morgrige.”
- Selects a clear mapped match when most of the request is present. It asks one focused follow-up when a required field is absent or the match is genuinely ambiguous.
- Still validates every resolved value against the local catalog and route graph, so the language model cannot create nonexistent rooms, floors, or routes.
- Upgraded the configured free local model from `llama3.2:3b` to `qwen3:4b`.

## Local model setup

Install Ollama and download the configured model:

```powershell
ollama pull qwen3:4b
```

Start Ollama, then set the computer's reachable Ollama URL from the Settings icon in the app when testing on a phone. The phone and computer must be on the same trusted network.

## Verification

- Voice parser checks pass, including `morgridge`, `Morgridge Hall`, `morgrige`, `the union`, `chazen`, and `discovery`.
- 3,165 route cases across all five buildings pass.
- Amenity, integration, positioning, floor-model, syntax, and diff checks pass.
- Android debug build completes successfully with API 35 tools.
- APK package: `dev.gogo.traveler`
- Version code: `17`
- Version name: `0.13-smart-voice`
- Minimum Android: API 26
- APK Signature Scheme v2 verification and ZIP alignment pass.

## Suggested commit

```text
feat(voice): add fuzzy navigation matching and listening waveform
```

Suggested commands:

```powershell
git add HANDOFF.md docs/VOICE_ASSISTANT.md scripts/test-voice.mjs scripts/build-apk.py traveler-app
git commit -m "feat(voice): add fuzzy navigation matching and listening waveform"
git push origin master
```
