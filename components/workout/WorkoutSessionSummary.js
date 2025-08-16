// components/workout/WorkoutSessionSummary.js
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Card from '../ui/Card';
import GradientButton from '../ui/GradientButton';
import { palette, spacing } from '../../theme';

function isCompletedSet(s) {
  const w = Number(s?.weight) || 0;
  const r = Number(s?.reps) || 0;
  return w > 0 && r > 0 && !!s?.completedAt; // only sets marked done
}

export default function WorkoutSessionSummary({
  blocks = [],
  units = 'lb',
  onFinish,
  showFinish = true,   // control visibility of the button
  showTitle = true,    // NEW: control visibility of the heading
}) {
  const unitLabel = units === 'lb' ? 'lbs' : 'kg';

  const live = useMemo(() => {
    let totalVolume = 0;
    let totalSets = 0;
    const byExercise = [];

    (blocks || []).forEach((b) => {
      const completed = (b.sets || []).filter(isCompletedSet);
      if (completed.length === 0) return; // skip exercises with no completed sets

      const volume = completed.reduce(
        (acc, s) => acc + (Number(s.weight) || 0) * (Number(s.reps) || 0),
        0
      );
      const sets = completed.length;

      totalVolume += volume;
      totalSets += sets;

      byExercise.push({
        id: b.id,
        name: b.exercise?.name || 'Exercise',
        icon: b.exercise?.icon,
        sets,
        volume,
      });
    });

    return { totalVolume, totalSets, byExercise };
  }, [blocks]);

  return (
    <Card style={{ padding: spacing(2) }}>
      {showTitle && (
        <Text style={{ color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>
          Workout Session Summary
        </Text>
      )}

      <View style={{ marginBottom: spacing(1) }}>
        <Text style={{ color: palette.text, fontWeight: '800' }}>
          {live.totalSets} sets • {live.totalVolume.toFixed(0)} {unitLabel}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        {live.byExercise.length > 0 ? (
          live.byExercise.map((e) => (
            <View
              key={e.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {!!e.icon && <Text style={{ fontSize: 16 }}>{e.icon}</Text>}
                <Text style={{ color: palette.text, fontWeight: '700' }}>{e.name}</Text>
              </View>
              <Text style={{ color: palette.sub }}>
                {e.sets} sets • {Math.round(e.volume)} {unitLabel}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: palette.sub }}>No completed sets yet.</Text>
        )}
      </View>

      {showFinish && typeof onFinish === 'function' && (
        <>
          <View style={{ height: spacing(1.5) }} />
          <GradientButton title="Finish & Save" onPress={onFinish} />
        </>
      )}
    </Card>
  );
}
