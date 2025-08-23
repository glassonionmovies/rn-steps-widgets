// screens/TrainStarterScreen.js
import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/ui/Card';
import { palette, spacing, layout } from '../theme';

// NOTE: Removed imports of getAllWorkouts and generatePlan from ../utils/repAIPlanner
// The PreviewRecommended screen will now handle Rep.AI generation (and show debug payload).

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

  // 4) Rep.AI Recommended → navigate to preview; generation + debug happen there
  const goAIRecommended = () => {
    if (busyAI) return;
    // No local generation here. PreviewRecommended will build history-aware payload
    // and call the LLM (and show the exact payload at the bottom for debugging).
    navigation.navigate('PreviewRecommended', { source: 'train_starter' });
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

        {/* 4) Rep.AI Recommended (generation handled in PreviewRecommended) */}
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
