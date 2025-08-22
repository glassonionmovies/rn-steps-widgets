// screens/PlanningScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import { palette, spacing } from '../theme';

import { generatePlan } from '../utils/repAIPlanner';
import { getAllWorkouts } from '../store/workoutStore';

export default function PlanningScreen() {
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);

  async function onRecommendPress() {
    try {
      setBusy(true);

      const history = await getAllWorkouts();
      setEmptyHint(!history || history.length === 0);

      const vitals = {}; // plug in if available
      const plan = generatePlan({
        history,
        goals: 'hypertrophy',           // or from user setting
        split: 'upper',                 // or current selection
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

      navigation.navigate('Train', {
        screen: 'PreviewRecommended',
        params: { plan, source: 'planning' },
      });
    } finally {
      setBusy(false);
    }
  }

  const subText = useMemo(() => {
    if (emptyHint) {
      return 'Tip: Load test data from Setup for a richer plan preview.';
    }
    return 'Create and manage templates — or let Rep.AI plan your next session.';
  }, [emptyHint]);

  return (
    <View style={{ flex: 1, padding: spacing(2) }}>
      <Card style={{ padding: spacing(2) }}>
        <Text style={{ color: palette.text, fontSize: 20, fontWeight: '900' }}>
          Planning
        </Text>
        <Text style={{ color: palette.sub, marginTop: 6 }}>
          {subText}
        </Text>

        <View style={{ height: spacing(1) }} />

        <GradientButton
          title={busy ? 'Planning…' : 'Rep.AI Recommended'}
          onPress={onRecommendPress}
          disabled={busy}
        />
      </Card>
    </View>
  );
}
