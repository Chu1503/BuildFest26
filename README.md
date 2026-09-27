# GoGo

**Accessibility-first navigation.**

GoGo is a routing platform that does what Google Maps and Apple Maps don't. It keeps working after you walk through the front door. One accessibility graph covers the sidewalk outside, the hallway inside, and the evacuation route if the building becomes the hazard.

Built at Badger BuildFest 2026.

---

## Why this exists

We started from a torn knee that couldn't manage a staircase. The disability was temporary but it was long enough to realize that for thousands of people, it never ends. The intention with GoGo is to build something bigger than ourselves.

Accessibility is one of those problems that's been hard to solve for decades.  We're Badgers building for Badgers, applying emerging tech and innovation to a historically stubborn problem.

## The problem

Google Maps gets a wheelchair user to a building. It has no idea whether they can get inside it.

- **1 in 4** U.S. adults about 70 million people, live with a disability that affects a major life activity ([CDC, BRFSS 2022](https://www.cdc.gov/ncbddd/disabilityandhealth/index.html))
- **21%+** of U.S. undergraduates report a disability ([NCES, 2023](https://nces.ed.gov/))
- **~1 in 10** UW–Madison students are registered with the McBurney Center up 250% in a decade
- Every mainstream map app's routing data ends at the building's front door. What's inside, which entrance, which elevator, which floor, which room, which way out in a fire is a black box.

## What GoGo does

| Capability | What it means |
|---|---|
| **Indoor routing** | Every building is an accessibility graph: entrances, elevators, ramps, rooms |
| **Live obstacle detection** | A vision model flags a blocked ramp or barrier and reroutes before you reach it |
| **Emergency Mode** | The same graph becomes an evacuation map fire, tornado, and earthquake each have different rules, and GoGo knows which one applies |
| **Personal profiles** | Wheelchair, low vision, limited stamina or an ICD-code-seeded starting profile shape every route, not just a single "accessible" toggle |

---

## Acknowledgments

Built for Badger BuildFest 2026. Thanks to the McBurney Center, UW–Madison Campus Facilities, and the mentors who pushed this from a hackathon idea toward something that should actually exist.

## Run the current prototype

```sh
python -m http.server 8000 --directory building-demo
```

Open http://localhost:8000. No dependency installation is needed. Leaflet and renderer assets are bundled. Street tiles require internet.

Choose a building, accessibility profile, starting place and destination in the left panel. The right panel stays open with the interactive 3D building, route preview, POV and keyboard Explore modes. Choose Campus · Library Mall as the start for the outdoor map, then Enter building.

The current demo integrates Morgridge Hall, Memorial Union, College Library, Discovery and Chazen. Bathroom destinations route to nearby mapped approaches, not verified bathroom doors. Emergency exit/assistance displays information, not a validated evacuation route. The capabilities above describe the project vision: live obstacle detection and emergency navigation are not production features of this build. Obstacle simulation remains covered by routing tests.

Floor traces and outdoor routes are approximate demo data; some elevator links are inferred, Chazen's supplied plan is from 2021, and Discovery is conceptual. The prototype is not validated for real-world navigation.

## Android

[Download GoGo 0.13.1 APK](building-demo/downloads/GoGo.apk) for Android 8 or later. Package: `dev.gogo.traveler`, version code 18. This development build includes every available floor for all five demo buildings, the centered listening waveform and cross control, spoken starting-location confirmation, floor-aware destination follow-ups, foreground “Hey GoGo,” voice-controlled next steps and local Ollama interpretation over the current Wi-Fi network.

```sh
node scripts/sync-android-web.mjs
python scripts/build-apk.py --tools /path/to/android-tools --keystore /path/to/demo.keystore --output releases/GoGo-v0.13.1.apk
```

The manual builder expects JDK 17, Android platform 35 and build tools 35.0.0 under the supplied tools path. The standard Gradle Android project is in `traveler-app`. APK signing, alignment, integrity and asset parity passed. Phone installation, microphone recognition and native Back gestures still need physical-device verification.

Voice commands such as “take me to room 3610,” “next step,” “repeat,” and “where am I” run through the app’s mapped route data. Ollama receives only open-ended requests and the active building context; its proposed destination is checked against the catalog before navigation starts. Missing room or accessibility details become saved data requests. See [Voice assistant setup](docs/VOICE_ASSISTANT.md).

## Checks

```sh
node scripts/test-routes.mjs
node scripts/test-integration.mjs
node scripts/test-positioning-2d.mjs
node scripts/test-amenities.mjs
```

Checks cover original and imported room routes, step-free bathroom/exit approaches, outdoor routes, and every available floor across all five buildings. The website and Android app keep separate interfaces while sharing the same building and routing data.
