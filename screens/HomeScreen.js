// screens/HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import StatCard from '../components/StatCard';
import WidgetTwoHealth from '../components/WidgetTwoHealth';
import { palette, spacing, layout } from '../theme';

export default function HomeScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingHorizontal: layout.screenHMargin,
        paddingTop: spacing(2),
        paddingBottom: spacing(4),
      }}
    >
      {/* Header */}
      <LinearGradient
        colors={['#6a5cff', '#4ac3ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.title}>FitTracker</Text>
        <Text style={styles.subtitle}>Track your workouts, crush your goals</Text>
      </LinearGradient>

      {/* Live Health widget */}
      <Card style={{ marginTop: spacing(2) }}>
        <WidgetTwoHealth />
      </Card>

      {/* Stats grid row 1 */}
      <View style={styles.grid}>
        <View style={styles.col}>
          <StatCard
            label="Workouts"
            value="15"
            sublabel="This week"
            footer="+12% from last week"
          />
        </View>
        <View style={styles.col}>
          <StatCard label="Duration" value="720" sublabel="Minutes" footer="+1% from last week" />
        </View>
      </View>

      {/* Stats grid row 2 */}
      <View style={styles.grid}>
        <View style={styles.col}>
          <StatCard
            label="Streak"
            value="7"
            sublabel="Days"
            footer="+8% from last week"
          />
        </View>
        <View style={styles.col}>
          <StatCard label="Avg/Week" value="4.2" sublabel="Workouts" footer="—" />
        </View>
      </View>

      {/* CTAs */}
      <View style={{ marginTop: spacing(2), rowGap: spacing(1) }}>
        <GradientButton
          title="Start New Workout"
          onPress={() => navigation.navigate('TrackWorkout')}
        />
        <GradientButton
          title="View Progress"
          onPress={() => navigation.navigate('Progress')}
        />
      </View>

      {/* Recent Workouts */}
      <Card style={{ marginTop: spacing(2) }}>
        <Text style={styles.sectionTitle}>Recent Workouts</Text>
        <View style={{ height: spacing(1) }} />

        <Card style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}>
          <Text style={styles.itemTitle}>Push Day</Text>
          <Text style={styles.itemMeta}>6 exercises · 45 min · Today</Text>
          <View style={{ height: spacing(1) }} />
          <GradientButton title="Start Workout" onPress={() => navigation.navigate('TrackWorkout')} />
        </Card>

        <View style={{ height: spacing(2) }} />

        <Card>
          <Text style={styles.itemTitle}>Leg Blast</Text>
          <Text style={styles.itemMeta}>8 exercises · 60 min · Yesterday</Text>
          <View style={{ height: spacing(1) }} />
          <GradientButton title="Start Workout" onPress={() => navigation.navigate('TrackWorkout')} />
        </Card>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    borderRadius: 16,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2),
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 4, fontSize: 14 },

  sectionTitle: { color: palette.text, fontSize: 20, fontWeight: '800' },
  itemTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },
  itemMeta: { color: palette.sub, marginTop: 4 },

  grid: {
    flexDirection: 'row',
    marginTop: spacing(2),
    columnGap: spacing(1),
  },
  col: {
    flex: 1,
  },
});
