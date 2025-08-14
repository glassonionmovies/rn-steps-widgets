import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import WidgetTwoHealth from './components/WidgetTwoHealth';
import WidgetThreeWorkout from './components/WidgetThreeWorkout';

// Hardcoded last 7 days of expected step counts (in thousands)
const DATA = [10, 8, 8, 8, 9, 7, 7];
const LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function BarChart({ data, labels }) {
  const max = Math.max(...data, 1);
  return (
    <View style={styles.chartContainer}>
      <Text style={styles.widgetTitle}>Expected Steps (Last s Days)</Text>
      <View style={styles.chart}>
        {data.map((value, idx) => {
          const heightPct = (value / max) * 100;
          return (
            <View key={idx} style={styles.barBlock}>
              <View style={[styles.bar, { height: `${heightPct}%` }]} accessibilityLabel={`${labels[idx]}: ${value}k steps`} />
              <Text style={styles.barLabel}>{labels[idx]}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Units: thousands of steps</Text>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {/* Widget 1: Simple bar chart */}
      <BarChart data={DATA} labels={LABELS} />

      {/* Widget 2: Health */}      
      <WidgetTwoHealth />

      {/* Widget 3: Workout */}
      <WidgetThreeWorkout />
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7', padding: 16, gap: 16 },
  widgetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  chartContainer: {
    backgroundColor: 'white', padding: 12, borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  chart: { height: 160, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 6 },
  barBlock: { alignItems: 'center', width: 36 },
  bar: { width: 26, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#4e9af1' },
  barLabel: { marginTop: 6, fontSize: 12, color: '#333' },
  legend: { marginTop: 8 },
  legendText: { fontSize: 12, color: '#666' },
  placeholder: {
    flex: 1, backgroundColor: 'white', borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2, padding: 12
  },
  placeholderText: { color: '#999', fontSize: 16 }
});
