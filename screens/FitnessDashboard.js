import React, { useState } from 'react';
import { SafeAreaView, View, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import WidgetTwoHealth from '../components/WidgetTwoHealth'; // your working 7-day HealthKit widget
import WidgetThreeWorkout from '../components/WidgetThreeWorkout'; // your workout tracker
import MuscleGroupSelector from '../components/fitness/MuscleGroupSelector';
import ProgressChart from '../components/fitness/ProgressChart';

// Optional: keep or remove if you already have a Widget 1 bar chart
// import BarChart from '../components/BarChart';

export default function FitnessDashboard() {
  const [muscle, setMuscle] = useState('Full Body');
  const [progress, setProgress] = useState([
    // last 7 sessions example (replace with real data later)
    40, 46, 50, 48, 52, 55, 60
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      <Text style={styles.h1}>Dashboard</Text>

      <View style={styles.card}>
        <Text style={styles.h2}>Steps (Health)</Text>
        <WidgetTwoHealth />
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Workout</Text>
        <WidgetThreeWorkout />
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Focus</Text>
        <MuscleGroupSelector value={muscle} onChange={setMuscle} />
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Progress</Text>
        <ProgressChart data={progress} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7', padding: 16, gap: 16 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  h2: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  card: {
    backgroundColor: 'transparent',
    padding: 0,
    gap: 8,
  },
});
