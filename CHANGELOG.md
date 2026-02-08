# Changelog

## v0.5.0 - Level Goals And Stage Flow

- Converted level progression from pure time-based scaling to explicit stage goals.
- Added per-level objectives (target score + target reward count + countdown timer).
- Added automatic stage clear transition with bonus score and immediate next-level target refresh.
- Added new fail condition for timer expiration, with dedicated HUD/status/event messaging.
- Updated HUD to show Level/Time and per-level reward progress (current/target).
- Extended render_game_to_text to include level goal values, current progress, and time left for deterministic validation.
- Added danger tone style for ticker alerts.

## v0.4.0 - Highway Realism Overhaul

- Reworked the core scene from neon runner style to a realistic highway setting.
- Replaced the player shape with a curved car model (body, roof, windows, mirrors, wheels, lights).
- Replaced obstacle set with road-appropriate hazards (barrier, cone cluster, traffic car).
- Added richer environment elements: asphalt texture, lane dashes, shoulders, road markers, street lights, skyline and mountains.
- Kept gameplay loop (start/pause/score/difficulty/mobile controls) while removing unused jump behavior.
- Updated docs and smoke checks for the new game title and controls.

## v0.3.1 - Start Button Fix

- Replaced module-based Three.js loading with classic script loading (`three.min.js` + deferred main script).
- Removed dependency on ES module import chain, improving compatibility when opening locally.
- Added explicit in-page error message if Three.js fails to load.

## v0.3.0 - Mobile And Release Polish

- Added persistent best-score display (localStorage).
- Added visibility auto-pause behavior to avoid hidden-tab unfair deaths.
- Tuned camera for small screens and kept touch controls visible on coarse pointers.
- Removed legacy airplane-related modules and scripts to keep project focused.
- Added serve and smoke scripts for repeatable local run checks.

## v0.2.0 - Core Gameplay Loop

- Added procedural obstacle spawning on three lanes.
- Added collision detection and Game Over flow.
- Added obstacle pass bonus and continuous score growth.
- Bound difficulty growth to world speed and spawn interval.
- Added deterministic reset path so each restart begins cleanly.

## v0.1.0 - Baseline Scene

- Replaced previous page with a new single-page Three.js game shell.
- Added HUD and status panel with Start/Pause controls.
- Added responsive mobile touch buttons and swipe input hooks.
- Implemented baseline 3D scene, player model, render loop, score and difficulty display.
- Kept game playable skeleton with lane movement and jump.
