// navigation/routes.js
export const goMuscleInsights = (nav, group) =>
    nav.navigate('Progress', { screen: 'MuscleInsights', params: { group } });
  
  export const goExerciseProgression = (nav, exercise) =>
    nav.navigate('Progress', { screen: 'ExerciseProgression', params: { exercise } });
  
  export const goProgressHome = (nav) =>
    nav.navigate('Progress', { screen: 'ProgressHome' });
  
  export const goTrackWorkout = (nav, params) =>
    nav.navigate('Train', { screen: 'TrackWorkout', params });
  