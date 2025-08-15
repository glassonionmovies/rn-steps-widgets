# Project Context Snapshot — rn-steps-widgets

_Last updated: 2025-08-15_

## Stack & Build
- React Native with **Expo (bare)**, Hermes enabled.
- iOS build works in **Release** with embedded JS bundle.
- Local network dev works; Release builds don’t need Metro.
- Navigation: **@react-navigation/native** + **@react-navigation/native-stack**.
- UI helpers: `expo-linear-gradient` for headers/buttons.
- Charts: custom lightweight components (`LineChart`, `DonutChart`) — upgrading to interactive charts is planned.
- Health: **Apple HealthKit** steps (last 7 days) via `WidgetTwoHealth` (permissions + queries working).

## Notable Config
- `app.json`: iOS Health usage strings present; Local Network description + bonjour services added earlier during debugging.
- Shadows warning resolved by giving cards a solid `backgroundColor` and using platform-specific elevation.

## Current Screens & Flow
- **HomeScreen**
  - Gradient header (“FitTracker”)
  - Health steps widget (**WidgetTwoHealth**) – 7-day steps from Apple Health
  - Stats grid: Workouts, Duration, Streak, Avg/Week
  - CTAs:
    - **Start New Workout** → navigates to **TrackWorkout**
    - **View Progress** → navigates to **Progress**
  - Recent Workouts (UI only)

- **ProgressScreen**
  - “Weekly Progress” → `LineChart`
  - Spacer
  - “Muscle Group Distribution” → `DonutChart`
  - Back handled by stack headerBackButtonMenu (via `headerShown: true`)

- **TrackWorkoutScreen**
  - Basic scaffold with:
    - Exercise picker (simple)
    - Sets list (weight, reps, computed 1RM)
    - Add set / Remove set
    - Save (placeholder)
  - Next: refine UX, timers, rest countdown, persistence.

## Key Components
- `components/ui/Card` – solid bg, rounded corners, safe shadows.
- `components/GradientButton` – pressable with `expo-linear-gradient`.
- `components/StatCard`
- `components/WidgetTwoHealth` – HealthKit integration (7-day steps).
- `components/LineChart`, `components/DonutChart` – simple, non-interactive visuals.

## Navigation
- `navigation/RootNavigator.js`
  - Stack routes: `Home`, `Progress` (header shown), `TrackWorkout` (header shown)
  - Back navigation works via stack header.

## Known Good Commands
- Dev (with Metro): `npx expo start`
- iOS native build (Release bundles JS): build/run from Xcode workspace
- Git:
  - `git add . && git commit -m "context update"`  
  - `git push`

## Resolved Issues (for future reference)
- “No script URL provided” / local network: fixed via running Metro or embedding bundle in Release + iOS local network permissions during dev.
- React version mismatch: pinned to matching `react`/renderer.
- SVG duplicate registrations: removed duplicate svg libs.
- Shadow warnings: fixed by setting solid `backgroundColor`.
- Missing screens/components: added stubs or corrected imports.

## Next Focus (ONLY TrackWorkoutScreen)
- Polished exercise selector (searchable list; favorites).
- Set rows: weight (kg/lb toggle), reps, **auto 1RM** (Epley), editable notes.
- Add/Remove/Reorder sets; swipe to delete.
- **Timer/Rest countdown** per set with auto-start.
- **Save Workout**:
  - local persistence (AsyncStorage) now; later: on-device db (e.g., WatermelonDB/SQLite).
  - structure: date, exercise, sets [{weight, reps, 1RM, rest}], notes.
- “Finish workout” summary sheet → calories (est), volume (sum weight*reps), PR badges.
- Optional haptics on timer end.
