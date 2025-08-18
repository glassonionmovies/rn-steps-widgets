# FitTracker — Session Context Export (No Code)
**Date:** August 17, 2025 • **Purpose:** Use this document to rehydrate a fresh dev session. It captures scope, UX flows, data shapes, dependencies, and decisions — without any source code.

---

## 1) High-Level Product Map
**Bottom tabs (5):**
- **Wellness** (formerly Home): daily check‑in, insights, basic activity.
- **Progress**: KPI cards, trend charts, volume split donut, deep links to insights, recent workouts.
- **Train**: start/continue a workout; fast data entry UX.
- **Goals**: templates/planning (placeholder for now).
- **Setup**: equipment availability/preferences (influences recommendations).

**Stacks inside tabs:**
- **Progress stack**
  - ProgressScreen (dashboard)
  - MuscleInsightsScreen (per‑group deep dive; param: `group`)
  - ExerciseProgressionScreen (per‑exercise trends; params: `exerciseId`, `exerciseName`, `muscleGroup`)
- **Train stack**
  - TrackWorkoutScreen (new or edit; optional param: `workoutId`)

**Routes helper (optional but used in places):**
- goMuscleInsights(navigation, { group })
- goExerciseProgression(navigation, { exerciseId, exerciseName, muscleGroup })
- goTrackWorkout(navigation, params?)

> If helper is absent, components fall back to `navigation.navigate(...)` using nested targets (parent route + `screen`, `params`).

---

## 2) Reusable Insight Widgets (components/insights)
_All are presentational with minimal fetching; reused across screens._

### VolumeReportCard
- **Props:** `title`, `group (string|null)`, `days (number)`, `color (hex)`
- **Displays:** Weekly volume bars across computed weeks based on `days`. Y‑axis rounds to nearest 1k with “k” suffix.
- **Empty state:** “No {group} workouts in the selected window.” (omit group label if null)
- **Meta (header, right):** “{Group or All} • {days} days”.

### ConsistencyHeatmapCard
- **Props:** `title`, `byDay (Map|object keyed by start-of-day timestamp)`, `color`, `group (string|null)`, `days`, `hint (string|fn)`
- **Displays:** GitHub‑style heatmap for last `days`, color‑scaled by daily volume for the selected group.
- **Header:** Left color dot + title; right meta “{Group} • {days} days”.
- **Hint line:** e.g., “Darker = more {group} volume that day”.

### TopExercisesWidget
- **Props:** `group (string)`, `rangeDays (number)`, `maxItems (number)`, `title (string)`
- **Displays:** Top exercises by total volume for that group within `rangeDays`, including **sessions count** and **best set**.
- **Header meta:** “{Group} • {rangeDays} days”.
- **Tap:** Navigates to ExerciseProgressionScreen (uses helper if available; else nested navigate to Progress stack).

### RepAIAnalysisWidget
- **Props:** `group`, `acwr (number|null)`, `prs (number)`, `totalVolume (number)`, `rangeDays (number)`
- **Displays:** Short, actionable insights (readiness / load balance / PRs). Currently **independent of `days`** by design.

---

## 3) Major Screens — Behavior & Layout

### Wellness (formerly Home)
- **Daily Check‑In (top):** Two sliders (Energy: low→high; Sleep quality: poor→best).
  - **Save for Today** stores timestamped entry and collapses into compact line: “Today: Energy ⚡️x/10 | Sleep 🌙y/10”.
- **Rep.AI Insights & Recommendations:** Bite‑size, actionable cards:
  - Readiness (uses check‑in)
  - Weekly performance (last 7 days of workouts)
  - Context tip (time/day; weather/location reserved for future)
- **This Week’s Activity:** Compact rollups (Workouts, Duration, Streak).
- **Steps (Last 7 Days):** Chart from local cache; empty state if all zeros.

### Progress (dashboard)
- **KPIs (top row):** Total Volume (bounded period), Workouts (count), New PRs (vs prior period).
- **Trend charts (stacked vertically):**
  - **Volume Report:** weekly bars (VolumeReportCard).
  - **Activity Report:** steps as a single connected line (no area shading; “k” suffix; compact height).
- **Volume Split by Muscle Group:** Donut + interactive legend.
  - **Subtitle:** “Tap a segment for detailed insights.”
  - **Tap:** Navigates to MuscleInsightsScreen with selected `group`.
- **Recent Workouts:** Read‑only summaries (last 10). Tap opens TrackWorkout (edit mode).

### MuscleInsightsScreen (per‑group deep dive)
- **Collapsible selector header:**
  - **Group chips:** Chest, Back, Shoulders, Arms, Legs, Abs.
  - **Days selector:** 30 / 60 / 90 / 120 (chips; slider experiments rolled back).
  - When collapsed: header gradient shows **group emoji + title + ACWR**; tap reopens.
- **KPIs:** Total Volume (bounded to selected `days`), Workouts, New PRs (vs prior period).
- **Sections (in order):**
  1) Volume Report — group filtered (VolumeReportCard with `group`, `days`)
  2) Rep.AI Analysis (RepAIAnalysisWidget)
  3) Workout Consistency (ConsistencyHeatmapCard with `group`, `days`)
  4) Top Exercises (TopExercisesWidget with `group`, `rangeDays = days`)

### ExerciseProgressionScreen (per exercise)
- **Primary chart:** e1RM (default) with toggles: Max Weight, Session Volume (per exercise).
- **PRs section:** Best e1RM, heaviest single, most volume, most reps.
- **Rep.AI (exercise‑specific):** Plateau detection + accessory suggestions.

### TrackWorkoutScreen (fast logging)
- **Exercise blocks:** Header (emoji/icon + name; plate calculator icon only if **type = Barbell**).
- **Sets (row):** Weight & Reps steppers (±; long‑press accelerates), Set Type toggle (Working / Warm‑up / Drop / Failure; tag hidden when “Working”).
- **Notes / Hardness bubble:** Tap to pick hardness icon only; picker closes immediately on selection.
- **Prev / 1RM inline:** compact “Pr:” and current e1RM.
- **Complete → compact row:** Weight, Reps, 1RM, Δ1RM vs previous, Hardness icon; tap to re‑expand.
- **Auto‑append rule:** When last set becomes valid/complete, append a new empty trailing set; trigger RestTimer.
- **RestTimer:** Prominent countdown card replaces older small controls.
- **WorkoutSessionSummary (bottom):**
  - In **Train**: shows title + **Finish & Save**.
  - In **Recent Workouts**: read‑only compact; hide finish button; omit title for compactness.

---

## 4) Data Model & Store

### Workout object (shape; illustrative, not code)
- id
- startedAt
- finishedAt? (optional)
- units: "lb" | "kg"
- blocks: array of:
  - id
  - exercise:
    - id
    - name
    - icon
    - muscleGroup: "Chest" | "Back" | "Shoulders" | "Arms" | "Legs" | "Abs"
    - type: "Barbell" | "Dumbbell" | "Bodyweight"
  - sets: array of:
    - id
    - weight
    - reps
    - completedAt? (optional)
    - type? (optional): "working" | "warmup" | "dropset" | "failure"
    - note? (optional)
    - hardness? (optional): "easy" | "mod" | "hard"

### Store helpers (used throughout)
- getAllWorkouts()
- getWorkoutById(id)
- saveWorkout(workout)
- getPrevSetsForExercise(exerciseId, startedAt, currentWorkoutId)
- computeSummary(workout) → { exercises, totalSets, totalVolume, durationMin }

### AI / metrics helpers
- **e1RM** formula (Epley): `weight × (1 + reps / 30)`
- **ACWR:** 7‑day **acute** volume ÷ 28‑day **chronic weekly average**.

### Steps / health data (local cache)
- Keys in AsyncStorage: `"WidgetTwoHealth:steps7"` or `"health:steps7"`
- Value shape: JSON array of 7 integers (oldest → newest)
- Consumers: Activity Report line chart and Wellness widget; show empty state if all zeros.

---

## 5) Theming, Assets, and Layout
- `theme.js` exports: `palette`, `spacing`, `layout`.
  - Use `palette.text`, `palette.sub`, `palette.bg` consistently.
- **Muscle group accent colors:**
  - Chest `#ef4444`
  - Back `#3b82f6`
  - Shoulders `#f59e0b`
  - Arms `#a855f7`
  - Legs `#22c55e`
  - Abs `#10b981`
- **Assets (tabs/icons):**
  - assets/tabs/wellness_tab.png
  - assets/tabs/progress_tab.png
  - assets/tabs/train_tab.png
  - assets/tabs/goals_tab.png
  - assets/tabs/setup_tab.png
  - App icon was referenced earlier: assets/AppIcon.png

---

## 6) Libraries (and notes)
- **Navigation:** `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`
- **Storage:** `@react-native-async-storage/async-storage`
- **UI control:** `@react-native-community/slider` (for iOS/Android sliders)
- **Visuals:** `expo-linear-gradient`
- **IDs:** `react-native-get-random-values` + `uuid` (set/workout IDs)

**Important note:** If you see **“no component found for RNCSlider”**, ensure the slider package is installed and linked (re-run pods for iOS if needed).

---

## 7) Interaction Details & Edge Cases

### Charts
- Axes round to nearest 1k; suffix “k”.
- Activity Report is a **single connected line** (no area fill, no multiple series).
- Empty states are explicit (do not render a flat line that looks like data).

### Muscle Insights selectors
- Collapsible header with group chips and day chips (30/60/90/120).
- When collapsed, show **emoji + title + ACWR** in gradient header.
- Pass `group` and `days` to **VolumeReportCard** and **ConsistencyHeatmapCard**.
- **RepAIAnalysisWidget** intentionally **ignores `days`** currently.

### SetRow compact mode
- Completing a row collapses it to a one‑liner summary (Weight, Reps, 1RM, Δ1RM, Hardness icon).
- Tapping the compact item re‑expands for edits.
- Hardness picker closes immediately after selection.

### Plate calculator
- Only present for **Barbell** exercises.
- Modal supports bar weight selection + plate pairs; writing total back into Weight stepper.

---

## 8) Known Pitfalls You Solved (keep in mind)
- **Nested navigation warnings:** Prefer route helpers or `navigate(parent, { screen, params })` when targeting nested stacks.
- **Case‑only renames on macOS:** Use `git mv -f` (e.g., `RepAi` → `RepAI`).
- **“Last 90 days” stuck label:** Ensure widgets accept `days` (not `rangeDays`) and propagate consistently from callers.
- **Activity line not connecting:** Ensure a single clean numeric array with no `null`/`undefined`; no ad‑hoc “today” overlay unless handled carefully.

---

## 9) Quick Re‑Assembly Checklist (no code)
1. **Navigation:** Create root navigator with 5 bottom tabs.
2. **Stacks:** Add Progress stack (ProgressScreen, MuscleInsightsScreen, ExerciseProgressionScreen) and Train stack (TrackWorkoutScreen).
3. **Widgets:** Bring in insights widgets: VolumeReportCard, ConsistencyHeatmapCard, TopExercisesWidget, RepAIAnalysisWidget.
4. **Workout flow components:** SetRow (steppers, hardness bubble, compact mode), RestTimer, WorkoutSessionSummary (read‑only variant supported), ExercisePickerModal, RecentWorkoutsPanel, (optional) PlateCalculatorModal.
5. **Theme & atoms:** Card, GradientButton, etc.; wire `palette`, `spacing`.
6. **Store:** workoutStore with CRUD helpers; health steps utilities if used.
7. **Wellness:** Implement Daily Check‑In (2 sliders) with AsyncStorage persistence (energy, sleep, timestamp).
8. **Wiring:** 
   - On **Muscle Insights**: pass `group` & `days` to all relevant widgets.
   - On **Progress**: wire donut taps to goMuscleInsights with `group` param.
9. **QA smoke test:** See section 11 below.

---

## 10) Future TODOs (already aligned)
- Goals/Templates build‑out.
- Setup: equipment configuration (barbell, dumbbells, machines, bands, etc.) to filter recommendations/programs.
- Rep.AI: combine check‑in + steps + ACWR into a single readiness score.
- Optional: weather/location‑aware hydration prompts.
- Exercise Progression: e1RM trend smoothing + PR badges.

---

## 11) QA Smoke Test Script (manual, ~5–10 min)
- Launch app → verify bottom tabs render and icons display.
- Wellness:
  - Move both sliders and **Save for Today** → confirm compact “Today” line.
  - Verify Rep.AI cards render and This Week’s Activity KPIs populate.
  - Steps (7‑day) chart reads from cache; shows empty state if cache is zeros.
- Progress:
  - KPIs render with values bounded to current period.
  - Volume report shows rounded “k” tick labels.
  - Activity line is connected; no shading.
  - Donut legend/segments are tappable → navigates to **MuscleInsights** with correct `group`.
  - Recent Workouts list shows last 10; tapping opens **TrackWorkout** in edit mode.
- MuscleInsights:
  - Selector chips (group + 30/60/90/120) update widgets.
  - Collapsed header shows emoji + title + ACWR.
  - Heatmap and Top Exercises reflect `days` and `group` filters.
- ExerciseProgression:
  - Default e1RM visible; toggles switch metrics.
  - PR badges show bests; Rep.AI offers accessory suggestions.
- Train:
  - Add a Barbell exercise → plate calculator icon visible.
  - Complete a set → row collapses to summary; auto‑append creates a new empty row; RestTimer starts.
  - Hardness bubble picker closes immediately after selection.
  - Finish & Save produces a persisted workout; Recent Workouts reflects it.

---

## 12) Glossary
- **e1RM:** Estimated 1‑rep max; Epley formula: `weight × (1 + reps / 30)`.
- **ACWR:** Acute‑Chronic Workload Ratio: 7‑day acute volume ÷ 28‑day chronic weekly average.

---

## 13) Version / Provenance
- **This export:** August 17, 2025. Mirrors decisions and behaviors from the prior session. No source code is included.