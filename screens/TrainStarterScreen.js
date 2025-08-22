// screens/TrainStarterScreen.js
import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/ui/Card';
import { palette, spacing, layout } from '../theme';

import { getAllWorkouts } from '../store/workoutStore';
import { generatePlan } from '../utils/repAIPlanner';

export default function TrainStarterScreen() {
  const navigation = useNavigation();
  const [busyAI, setBusyAI] = useState(false);

  // 1) Previous Workout Pattern → Progress screen (scroll to Recent Workouts)
  const goPreviousPattern = () => {
    try {
      const routes = require('../navigation/routes');
      if (routes?.goProgressHome) {
        routes.goProgressHome(navigation, { selectPattern: true });
        return;
      }
    } catch {}
    navigation.navigate('Progress', {
      screen: 'ProgressHome',
      params: { selectPattern: true },
    });
  };

  // 2) Saved Template → Template list
  const goTemplates = () => {
    navigation.navigate('WorkoutTemplates');
  };

  // 3) Blank Workout → TrackWorkoutScreen with marker
  const goBlank = () => {
    navigation.navigate('TrackWorkout', { isBlank: true });
  };

  // 4) Rep.AI Recommended → generate plan like Planning screen, then preview
  const goAIRecommended = async () => {
    if (busyAI) return;
    try {
      setBusyAI(true);

      const history = await getAllWorkouts();
      const vitals = {}; // plug in readiness/soreness if available

      const plan = generatePlan({
        history,
        goals: 'hypertrophy',          // or pull from user setting
        split: 'upper',                // or current selection
        timeBudgetMin: 50,
        equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
        vitals,
        settings: {
          units: history?.[0]?.units || 'lb',
          plateIncrementLb: 5,
          plateIncrementKg: 2.5,
        },
        seed: Date.now(),
      });

      // We are inside Train stack already → direct navigate
      navigation.navigate('PreviewRecommended', { plan, source: 'train_starter' });
    } catch (e) {
      Alert.alert('Rep.AI failed', String(e?.message || e));
    } finally {
      setBusyAI(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingHorizontal: layout.screenHMargin,
        paddingTop: spacing(2),
        paddingBottom: spacing(4),
        gap: spacing(2),
      }}
    >
      <Card style={{ padding: spacing(2) }}>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900' }}>
          Start Training
        </Text>
        <Text style={{ color: palette.sub, marginTop: 4 }}>
          Choose how you’d like to begin your session
        </Text>

        <View style={{ height: spacing(1.5) }} />

        {/* 1) Previous Workout Pattern */}
        <Pressable onPress={goPreviousPattern} style={rowStyle}>
          <View style={iconTextRow}>
            <Text style={{ fontSize: 18 }}>📜</Text>
            <View>
              <Text style={titleStyle}>Previous Workout Pattern</Text>
              <Text style={subtitleStyle}>Pick from your recent sessions</Text>
            </View>
          </View>
          <Text style={chevronStyle}>{'›'}</Text>
        </Pressable>

        {/* 2) Saved Template */}
        <Pressable onPress={goTemplates} style={rowStyle}>
          <View style={iconTextRow}>
            <Text style={{ fontSize: 18 }}>🧩</Text>
            <View>
              <Text style={titleStyle}>Saved Template</Text>
              <Text style={subtitleStyle}>Start from a pre-defined plan</Text>
            </View>
          </View>
          <Text style={chevronStyle}>{'›'}</Text>
        </Pressable>

        {/* 3) Blank Workout */}
        <Pressable onPress={goBlank} style={rowStyle}>
          <View style={iconTextRow}>
            <Text style={{ fontSize: 18 }}>🆕</Text>
            <View>
              <Text style={titleStyle}>Blank Workout</Text>
              <Text style={subtitleStyle}>Start with an empty session</Text>
            </View>
          </View>
          <Text style={chevronStyle}>{'›'}</Text>
        </Pressable>

        {/* 4) Rep.AI Recommended (same logic as Planning) */}
        <Pressable
          onPress={goAIRecommended}
          style={[rowStyle, busyAI && { opacity: 0.6 }]}
          disabled={busyAI}
        >
          <View style={iconTextRow}>
            <Text style={{ fontSize: 18 }}>🤖</Text>
            <View>
              <Text style={titleStyle}>Rep.AI Recommended</Text>
              <Text style={subtitleStyle}>
                {busyAI ? 'Planning…' : 'Smart plan for today'}
              </Text>
            </View>
          </View>
          <Text style={chevronStyle}>{busyAI ? '…' : '›'}</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

// Reusable row styles
const rowStyle = {
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(0,0,0,0.06)',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const iconTextRow = { flexDirection: 'row', alignItems: 'center', gap: 10 };
const titleStyle = { color: palette.text, fontWeight: '800' };
const subtitleStyle = { color: palette.sub, fontSize: 12 };
const chevronStyle = { color: palette.sub, fontSize: 18 };
