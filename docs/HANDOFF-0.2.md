# GoGo 0.2 — updated handoff

Date: 26 September 2026. Project: `/Users/Patron/Desktop/BuildFest26`. Website and Android source have been edited in this folder. Changes are left uncommitted for review. No remote push or Vercel deployment was performed in this update.

## What changed

- Replaced the old combined interface with a cleaner journey planner and larger building/POV/explore views. Removed decorative cue icons, emojis, repeated demo warnings, and verbose spoken descriptions. Essential scope information remains under About this model.
- Access dropdown: Wheelchair; Blind / low vision; Deaf / hard of hearing; Limited mobility; No specific preference. Avoid stairs is independently adjustable. Wheelchair, blind and limited-mobility profiles default to avoiding stairs; deaf defaults to visual guidance with speech off. Profiles are preferences, not diagnoses or assumptions about every user's abilities.
- Added source floor/place selection and explicit source confirmation. Destination selection is floor-first, with room/name filtering.
- Catalog: **128 named places**, of which **125 have modeled approaches**. This includes the named spaces traced from supplied floor plans, two entrances and elevator lobbies. Rooms 2580, 2610 and B2537 remain selectable but explicitly have no mapped route. This is **not a complete official inventory of all rooms in the building**; unlabeled offices and verified door coordinates are not available in the supplied plans.
- Added rooms visible on upper-floor reference images, and separated basement B2572A/B.
- A catalog generator creates room-approach paths over free space in the approximate model, starting from each floor's elevator lobby. Paths avoid modeled room interiors and atrium holes. These are modeled approaches, **not surveyed door locations or physically verified accessible routes**. The original small graph remains for entrance/lift/stair connections.
- Speech now gives short actions such as “Turn left,” “Continue straight,” and floor-change instructions. Only blind/low-vision mode adds selected landmark details. It never speaks geometry disclaimers. No fabricated “three steps” walking distance is generated: walking stride and map scale have not been calibrated.
- Added device location, altitude, vertical accuracy, barometer-relative height and rotation-vector heading to Android.
- Android now uses a **local WebView 3D UI with a native Java sensor/TTS bridge**. This intentionally replaces the earlier native-only form to deliver the requested live 3D view. It does not load the Vercel site or depend on network assets.
- Visual changes include full-height walls in POV, room labels nearby, lighter materials, improved scene lighting/tone mapping, removal of the ground grid, and a responsive layout. It remains a stylized reference model, not a photorealistic scanned interior.

## GPS and floor accuracy: exact behavior

Real sensor readings are implemented. **Accurate room/floor positioning is not solved by this update.** Android reports uncertainty; ordinary indoor GPS can be unavailable or many meters off. The existing floor plans have no surveyed georeference, measured scale, floor elevations, or installed indoor-positioning system. Never claim this prototype knows an exact room from GPS alone.

The user first selects/confirms a source. They can tap Use device location, permit precise foreground location, then stand at that source and face the next route direction before calibration. Hold the phone flat and point its top toward that direction for the heading alignment. This anchors relative GPS displacement to the approximate model; it does not survey the building.

Calibration requires a non-mock fix with reported horizontal accuracy **at most 3 m**, age **under 10 seconds**, and a usable heading sensor (Android accuracy status medium/high). Readings outside these conditions do not move the model. Even a passing fix is an estimate, not a guaranteed error bound; GPS accuracy is statistical and indoor multipath can be misleading.

After calibration, latitude/longitude displacement is converted to local east/north meters and rotated into the manually aligned model. Movement outside the current modeled corridor or beyond 60 m from the anchor is rejected. Anchors expire after two minutes; then the user must reconfirm/recalibrate. Current accuracy and source mode stay visible. Rotation-vector heading drives the POV direction while reliable.

GPS proximity advances a same-floor cue only within 1.5 model units of the next waypoint, with reported accuracy at most 2 m. These thresholds are prototype heuristics, not validated navigation performance. **Next cue** remains available independently of GPS. A manual Next cue deliberately disables the prior tracking anchor so a later fix cannot unexpectedly snap the user back.

Altitude is displayed with vertical accuracy when Android provides it. GNSS altitude is not converted to a floor number: its datum and building floor elevations are not established.

Barometric pressure gives relative height from a reset baseline. A **4.5 m assumed floor spacing** generates a possible-floor suggestion, never an automatic floor switch. The user must confirm and choose the actual starting place. Weather, pressure changes and unknown real floor spacing can make this suggestion wrong. Phones without a barometer show that it is unavailable. No step-count-based displacement is used, since stride is unknown and it would be inappropriate for wheelchair motion.

Tracking is foreground-only. Leaving the app stops sensor/location subscriptions and speech; returning requires tapping Use device location again. Permission denial, approximate-only permission, disabled providers, stale fixes, missing sensors or poor heading leave manual controls usable. No background-location permission is requested. The app stores/transmits no location history and has no analytics/backend. OS location/TTS services have their own behavior.

## Source files and maintenance

### Website
- `building-demo/index.html`, `style.css`: new shared responsive UI.
- `building-demo/app.js`: source/destination controls, concise cues, preview/manual/live state and sensor bridge callbacks.
- `building-demo/positioning.js`: pure freshness, relative-coordinate and floor-suggestion functions.
- `building-demo/routing.js`: shared graph routing and cue rules, imports expanded catalog graph.
- `building-demo/catalog-data.js`: generated catalog and room-approach graph. Do not edit directly.
- `building-demo/building.js`: original floor polygons plus extra traced rooms.
- `building-demo/viewer.js`: Three.js model and camera controls.

### Android
- `traveler-app/app/src/main/java/dev/gogo/traveler/MainActivity.java`: permission handling, LocationManager, barometer, rotation vector, TextToSpeech, lifecycle and local WebView.
- `traveler-app/app/src/main/assets/web/`: checked-in copy of the website runtime and vendor files, served only under `https://appassets.androidplatform.net/web/` through local request interception.
- The bridge exposes startLocation, resetAltitude, speak and stopSpeech only to the bundled page. WebView file/content access and mixed content are disabled; external navigations/requests are blocked. No INTERNET permission is requested. No live remote pages should ever be loaded with this bridge attached.
- Manifest: precise/coarse foreground location permissions; optional barometer declaration.
- Version code **2**, name **0.2-sensors**, package `dev.gogo.traveler`, minimum Android 8/API26; target/compile API35.

Regenerate after geometry changes:

```sh
node scripts/build-catalog.mjs
node scripts/test-routes.mjs
node scripts/sync-android-web.mjs
cd traveler-app
./gradlew assembleDebug
```

Run sync after **any shared UI/viewer/routing change** before rebuilding Android. The older `sync-android-map.mjs`/`assets/building.json` belong to the original native-form prototype and are not used by the new WebView app.

Local website:

```sh
python3 -m http.server 8000 --directory building-demo
```

Vercel settings are unchanged: root `building-demo`, framework Other, empty build command, output `.`. Browser geolocation requires HTTPS or localhost. Native barometer/rotation-vector bridging is Android-only; the normal website offers browser GPS readouts plus manual/keyboard/preview navigation and does not claim room alignment without heading calibration.

## APK and validation

APK: `releases/GoGo-Traveler-0.2.apk`. Compiled with JDK17 and official Android SDK35 tools; DEX generation and APK signature verification passed. Uses the same development signing key as the earlier delivered APK, allowing an upgrade over that specific build. Another independently built debug APK may have a different key and require uninstalling first. The key is not in this repository. This is a test APK, not a Play release.

Verified here:
- **1,920 route cases**: 128 catalog entries × 5 profile policies × 3 elevator scenarios.
- **125 reverse source routes** back to the entrance.
- Weak, stale, zero-accuracy and mock GPS fixes are rejected by the positioning helper.
- Relative origin projection and barometric floor suggestion functions.
- Navigation speech does not contain the removed disclaimer text.
- Browser room search for Floor7/7675, deaf-mode speech-off default, manual Next cue, and first-person rendering.
- Android Java compilation, packaging and V2/V3 signature verification.

**Not verified:** actual device/emulator WebView performance, runtime permission dialogs, sensor availability/orientation/accuracy, real indoor route following, all room door approaches, lifecycle on a physical phone, TalkBack/large-text behavior. The Android build was assembled using SDK tools directly; the conventional Gradle pipeline is provided but was not run in this update. Do not call it production navigation or claim tested GPS accuracy.

## Device test checklist

1. Install APK; confirm the 3D view renders offline with an updated Android System WebView.
2. Deny location; confirm source selection, Next cue and repeat still work.
3. Allow precise location; check coordinates and reported horizontal/vertical accuracy against Android's readings.
4. At a known source, face the next corridor direction, calibrate, and walk a short supervised route. Check movement orientation, out-of-corridor rejection and stale-fix handling.
5. Move between known floors with a barometer-equipped phone. Compare relative height and require explicit floor confirmation. Do not use elevator outage switches as actual building status.
6. Test a phone without a barometer, weak GPS, approximate-only permission, location services off, missing TTS language, screen rotation and background/resume.
7. Test wheelchair, blind/low-vision and deaf preferences with intended users; verify both visual and spoken cues. Keep independent assistance available.

## Recommended commits

Website:
`feat(web): add floor-based room search, source selection and cleaner accessible POV navigation`

Android:
`feat(android): add sensor-assisted 3D navigation with manual position and floor fallbacks`

Combined:
`feat: add room catalog and sensor-assisted accessible navigation across web and Android`

No commits were created in this update. Review the working tree and use real commit timing. APK and `.idsig` outputs are ignored by Git; distribute the APK as a release asset rather than source.

## Evidence and next requirements

Android APIs: https://developer.android.com/reference/android/location/Location ; https://developer.android.com/reference/android/hardware/SensorManager ; https://developer.android.com/develop/sensors-and-location/sensors/sensors_environment . Reported location accuracy is not a promise of actual indoor error; pressure-derived height is relative, not an automatic floor identifier.

Next serious milestone: obtain an authoritative room inventory, measured door/corridor graph, map scale and georeferenced anchors, plus actual floor elevations. Evaluate indoor localization (e.g. surveyed visual/QR anchors and an appropriate positioning system) with blind and mobility-impaired users before real-world guidance. Do not hide uncertainty to make the interface seem more accurate.
