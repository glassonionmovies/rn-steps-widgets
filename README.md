# 🏋️‍♂️ FitTracker — Your Pocket Fitness Dashboard

**FitTracker** is a sleek, mobile-first fitness tracker built with **React Native** + **Expo** that integrates directly with **Apple HealthKit** to pull your last 7 days of step data.  
Track workouts, monitor progress, and crush your fitness goals — all in one gorgeous UI.

---

## ✨ Features

- 📊 **Live Health Data** — Automatically fetches your last 7 days of steps from Apple HealthKit.
- 🗓 **Progress Tracking** — View weekly trends & muscle group distribution with interactive charts.
- 📅 **Workout Logging** — Create, track, and manage workout sessions (sets, reps, weight, rest timers).
- 📈 **Statistics Dashboard** — Streaks, average workouts/week, total duration, and more.
- 🎨 **Beautiful UI** — Gradient headers, smooth cards, and polished shadows.
- 📱 **iOS Native** — Optimized for iOS, with support for release builds & Health permissions.

---

## 📷 Screenshots

| Home Dashboard | Progress Screen | Track Workout |
|---|---|---|
| ![Home](docs/screenshots/home.png) | ![Progress](docs/screenshots/progress.png) | ![Track](docs/screenshots/track.png) |

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/fittracker.git
cd fittracker

2. Install dependencies
npm install
# or
yarn install

3. iOS Setup

Make sure you have Xcode + CocoaPods installed.

Install pods:

cd ios && pod install && cd ..

🛠 Tech Stack

React Native (Expo Bare Workflow)

React Navigation — Native stack navigation

expo-linear-gradient — Gradient headers & buttons

Apple HealthKit — Step tracking

Custom Charts — Line chart & donut chart for progress visualization

AsyncStorage (planned) — Workout history persistence

🗺 Roadmap

 Add interactive, zoomable charts

 Enable workout templates

 Sync with cloud storage

 Android support (Health Connect)

 Share workout summaries with friends