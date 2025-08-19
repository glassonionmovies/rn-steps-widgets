// screens/PreviewRecommendedScreen.js
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import { palette, spacing } from '../theme';
import { generateRecommendedPlan } from '../utils/repAIPlanner';

export default function PreviewRecommendedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const readiness = route?.params?.readiness || { energy: 6, sleep: 6 };
  const goalMode = route?.params?.goalMode || 'maintenance';

  const [plan, setPlan] = useState(null);
  const [keepUnder45, setKeepUnder45] = useState(true);
  const [hardness, setHardness] = useState(0); // -1 lighter, 0 base, +1 harder

  useEffect(() => {
    (async () => {
      const p = await generateRecommendedPlan({ readiness, goalMode });
      setPlan(p);
    })();
  }, [readiness, goalMode]);

  const adjustedPlan = useMemo(() => {
    if (!plan) return null;
    const mult = hardness === 1 ? 1.03 : hardness === -1 ? 0.95 : 1.0;
    const blocks = (plan.blocks || []).map(b => ({
      ...b,
      sets: b.sets.map(s => ({
        ...s,
        weight: Math.round((s.weight || 0) * mult / 5) * 5, // quick round here for display
      })),
    }));

    // Simple time estimate: ~70s work per set + rest (compound/accessory)
    const estSeconds =
      blocks.reduce((acc, b) => {
        const rest = (b.exercise?.muscleGroup === 'Legs' || b.exercise?.equipment === 'Barbell') ? (plan.restHints?.compound || 150) : (plan.restHints?.accessory || 75);
        return acc + b.sets.length * (70 + rest);
      }, 0);
    const estMin = Math.round(estSeconds / 60);

    // If keepUnder45 and estimate > 45, trim one accessory set from each accessory block
    let trimmedBlocks = blocks;
    if (keepUnder45 && estMin > 45) {
      trimmedBlocks = blocks.map((b, idx) => {
        const isAccessory = idx > 0;
        if (!isAccessory) return b;
        if (b.sets.length > 2) return { ...b, sets: b.sets.slice(0, b.sets.length - 1) };
        return b;
      });
    }

    return { ...plan, blocks: trimmedBlocks, _estMin: estMin, hardness };
  }, [plan, keepUnder45, hardness]);

  function startWorkout() {
    if (!adjustedPlan) return;

    // Convert to the same shape as a Template (unsaved temp template)
    const templateLike = {
      name: adjustedPlan.name,
      units: adjustedPlan.units || 'lb',
      blocks: adjustedPlan.blocks.map(b => ({
        exercise: b.exercise,
        sets: b.sets.map(s => ({ weight: s.weight || 0, reps: s.reps || 0 })),
      })),
    };

    navigation.navigate('Train', {
      screen: 'TrackWorkout',
      params: {
        template: templateLike,
        fromRecommended: true,
        adoptRestHints: true, // Track screen can pick this to preset rest timer if you like
      },
    });
  }

  if (!adjustedPlan) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: spacing(2) }}>
        <Card style={{ padding: spacing(2) }}>
          <Text style={styles.h}>Rep.AI is planning your session…</Text>
          <Text style={{ color: palette.sub }}>Using history, readiness, and goal mode.</Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: spacing(2), gap: spacing(1.5), paddingBottom: spacing(4) }}>
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.title}>{adjustedPlan.name}</Text>
        <Text style={{ color: palette.sub, marginTop: 6 }}>
          Focused on {adjustedPlan.meta?.focus}. Est. {adjustedPlan._estMin} min.
        </Text>
        <View style={{ height: spacing(1) }} />
        {adjustedPlan.rationale?.map((r, i) => (
          <Text key={i} style={{ color: palette.text, opacity: 0.9 }}>• {r}</Text>
        ))}
      </Card>

      <Card style={{ padding: spacing(2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.h}>Plan Controls</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable onPress={() => setHardness(-1)} hitSlop={6}><Text style={[styles.chip, hardness===-1 && styles.chipActive]}>Lighter</Text></Pressable>
            <Pressable onPress={() => setHardness(0)} hitSlop={6}><Text style={[styles.chip, hardness===0 && styles.chipActive]}>Base</Text></Pressable>
            <Pressable onPress={() => setHardness(1)} hitSlop={6}><Text style={[styles.chip, hardness===1 && styles.chipActive]}>Harder</Text></Pressable>
          </View>
        </View>
        <View style={{ height: spacing(1) }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>Keep under 45 min</Text>
          <Switch value={keepUnder45} onValueChange={setKeepUnder45} />
        </View>
      </Card>

      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.h}>Exercises</Text>
        <View style={{ height: spacing(1) }} />
        {adjustedPlan.blocks.map((b, i) => (
          <View key={i} style={{ paddingVertical: 6, borderBottomWidth: i<adjustedPlan.blocks.length-1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: 'rgba(0,0,0,0.08)' }}>
            <Text style={{ color: palette.text, fontWeight: '900' }}>
              {b.exercise?.icon ? `${b.exercise.icon} ` : ''}{b.exercise?.name}
            </Text>
            <Text style={{ color: palette.sub, marginTop: 2 }}>
              {b.sets.map((s, j) => `${s.reps} @ ${s.weight}`).join(' • ')}
            </Text>
          </View>
        ))}
      </Card>

      <GradientButton title="Start" onPress={startWorkout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: '900' },
  h: { color: palette.text, fontWeight: '900' },
  chip: { color: palette.text, fontWeight: '800' },
  chipActive: { color: '#6a5cff' },
});
