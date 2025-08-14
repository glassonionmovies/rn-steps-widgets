import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import Card from '../components/ui/Card';
import LineChart from '../components/LineChart';
import DonutChart from '../components/DonutChart';
import { palette, spacing, layout } from '../theme';

export default function ProgressScreen(){
  const weekly=[2,1,3,1,2,4,2]; // sample
  const muscle=[
    { value:30, color:'#ef4444' }, // chest
    { value:20, color:'#3b82f6' }, // back
    { value:35, color:'#22c55e' }, // legs
    { value:10, color:'#f59e0b' }, // shoulders
    { value:5,  color:'#a855f7' }, // arms
  ];
  return (
    <ScrollView style={{flex:1, backgroundColor: palette.bg}}
      contentContainerStyle={{ paddingHorizontal: layout.screenHMargin, paddingTop: spacing(2), paddingBottom: spacing(4) }}>
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.subtitle}>Track your fitness journey</Text>

      <Card style={{marginTop: spacing(2)}}>
        <Text style={styles.sectionTitle}>Weekly Progress</Text>
        <LineChart points={weekly}/>
      </Card>

      <Card style={{marginTop: spacing(2)}}>
        <Text style={styles.sectionTitle}>Muscle Group Distribution</Text>
        <DonutChart segments={muscle}/>
      </Card>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  title:{ color: palette.accent2, fontSize:34, fontWeight:'900' },
  subtitle:{ color: palette.sub, marginTop:4, fontSize:16 },
  sectionTitle:{ color: palette.text, fontSize:20, fontWeight:'800', marginBottom: spacing(1) },
});

