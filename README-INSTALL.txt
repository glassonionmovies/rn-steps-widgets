Drop-in upgrade for TrackWorkout (JavaScript)

1) Copy `components/workout/` folder into your project's `components/`.
2) Copy `store/workoutStore.js` into your project's `store/` (create the folder if needed).
3) Replace your `screens/TrackWorkoutScreen.js` with the one in `screens/` here.
4) Install dependency:
   npm i @react-native-async-storage/async-storage uuid
   # or
   yarn add @react-native-async-storage/async-storage uuid
5) iOS pods (if bare): npx pod-install
6) Run: npx expo start -c, then iOS/Android.

Notes:
- Rest timer auto-starts when a set's weight>0 and reps>0.
- Units default is 'lb' — wire to your settings if you track units globally.
- Data is saved under key rnsteps.workouts.v1 in AsyncStorage.
