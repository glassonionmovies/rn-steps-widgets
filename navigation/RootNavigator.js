// navigation/RootNavigator.js
import React from 'react';
import { Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';                  // Wellness (for now)
import ProgressScreen from '../screens/ProgressScreen';
import TrackWorkoutScreen from '../screens/TrackWorkoutScreen';
import MuscleInsightsScreen from '../screens/MuscleInsightsScreen';
import ExerciseProgressionScreen from '../screens/ExerciseProgressionScreen';
import PlanningScreen from '../screens/PlanningScreen';
import SetupScreen from '../screens/SetupScreen';

// NEW
import WorkoutTemplatesScreen from '../screens/WorkoutTemplatesScreen';
import TrainStarterScreen from '../screens/TrainStarterScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- Tab icon component using your PNGs ---
function TabIcon({ routeName, focused, size }) {
  const map = {
    Wellness: require('../assets/tabs/wellness_tab.png'),
    Progress: require('../assets/tabs/progress_tab.png'),
    Train:    require('../assets/tabs/train_tab.png'),
    Goals:    require('../assets/tabs/goals_tab.png'),
    Setup:    require('../assets/tabs/setup_tab.png'),
  };
  const source = map[routeName];
  const finalSize = routeName === 'Train' ? 28 : size; // emphasize center tab
  return (
    <Image
      source={source}
      style={{
        width: finalSize,
        height: finalSize,
        opacity: focused ? 1 : 0.65,
        transform: [{ scale: focused ? 1.05 : 1 }],
      }}
      resizeMode="contain"
    />
  );
}

// --- Stacks per tab ---
function WellnessStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WellnessHome" component={HomeScreen} />
    </Stack.Navigator>
  );
}

function ProgressStack() {
  return (
    <Stack.Navigator screenOptions={{ headerBackTitleVisible: false }}>
      <Stack.Screen name="ProgressHome" component={ProgressScreen} options={{ title: 'Progress' }} />
      <Stack.Screen
        name="MuscleInsights"
        component={MuscleInsightsScreen}
        options={({ route }) => ({ title: `${route?.params?.group || 'Muscle'} Insights` })}
      />
      <Stack.Screen
        name="ExerciseProgression"
        component={ExerciseProgressionScreen}
        options={({ route }) => ({ title: route?.params?.exercise?.name || route?.params?.exerciseName || 'Progression' })}
      />
    </Stack.Navigator>
  );
}

function TrainStack() {
  // IMPORTANT: TrainStarter is first—tab state is preserved, so if you’re already on TrackWorkout
  // and switch tabs, returning to Train will show TrackWorkout (not the starter).
  return (
    <Stack.Navigator screenOptions={{ headerBackTitleVisible: false }}>
      <Stack.Screen name="TrainStarter" component={TrainStarterScreen} options={{ title: 'Train' }} />
      <Stack.Screen name="TrackWorkout" component={TrackWorkoutScreen} options={{ title: 'Track Workout' }} />
      <Stack.Screen name="WorkoutTemplates" component={WorkoutTemplatesScreen} options={{ title: 'Workout Templates' }} />
    </Stack.Navigator>
  );
}

function GoalsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="GoalsHome" component={PlanningScreen} options={{ title: 'Planning' }} />
    </Stack.Navigator>
  );
}

function SetupStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SetupHome" component={SetupScreen} options={{ title: 'Setup' }} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
          tabBarActiveTintColor: '#6a5cff',
          tabBarInactiveTintColor: '#9aa3af',
          tabBarStyle: {
            height: 64,
            paddingTop: 6,
            paddingBottom: 10,
            backgroundColor: '#ffffff',
            borderTopWidth: 0.5,
            borderTopColor: '#e5e7eb',
          },
          tabBarIcon: ({ focused, size }) => (
            <TabIcon routeName={route.name} focused={focused} size={size} />
          ),
        })}
      >
        <Tab.Screen name="Wellness" component={WellnessStack} />
        <Tab.Screen name="Progress" component={ProgressStack} />
        <Tab.Screen name="Train"    component={TrainStack} />
        <Tab.Screen name="Goals"    component={GoalsStack} options={{ tabBarLabel: 'Planning' }} />
        <Tab.Screen name="Setup"    component={SetupStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
