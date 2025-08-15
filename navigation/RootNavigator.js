// navigation/RootNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import ProgressScreen from '../screens/ProgressScreen';
import TrackWorkoutScreen from '../screens/TrackWorkoutScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerTitleAlign: 'center',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Progress" component={ProgressScreen} />
        <Stack.Screen name="TrackWorkout" component={TrackWorkoutScreen} options={{ title: 'Track Workout' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
