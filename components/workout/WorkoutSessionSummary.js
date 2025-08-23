// components/workout/WorkoutSessionSummary.js
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';

/**
 * Props:
 * - blocks: Array<{ exercise: { id, name, muscleGroup, equipment, icon? }, sets: Array<{ weight, reps }> }>
 * - units: 'lb' | 'kg'
 * - showFinish?: boolean (unused here but preserved for compatibility)
 * - showTitle?: boolean
 * - titleOverride?: string
 * - compact?: boolean
 * - showCard?: boolean  // default true; when false, render without outer Card
 */
export default function WorkoutSessionSummary({
  blocks = [],
  units = 'lb',
  showFinish = false,     // kept for API compatibility
  showTitle = true,
  titleOverride,
  compact = false,
  showCard = true,
}) {
  const safeBlocks = useMemo(
    () =>
      (Array.isArray(blocks) ? blocks : [])
        .map((b, i) => {
          const exercise = b?.exercise || {};
          const sets = Array.isArray(b?.sets) ? b.sets : [];
          return {
            id: String(b?.id ?? `blk_${i}`),
            exercise: {
              id: String(exercise?.id ?? `ex_${i}`),
              name: String(exercise?.name ?? 'Exercise'),
              muscleGroup: String(exercise?.muscleGroup ?? ''),
              equipment: String(exercise?.equipment ?? ''),
              icon: exercise?.icon ?? null,
            },
            sets: sets
              .map((s, si) => ({
                id: String(s?.id ?? `${i}_${si}`),
                weight: Number(s?.weight) || 0,
                reps: Number(s?.reps) || 0,
              }))
              .filter((s) => Number.isFinite(s.weight) && Number.isFinite(s.reps)),
          };
        })
        .filter((b) => (b.sets?.length || 0) > 0),
    [blocks]
  );

  const summary = useMemo(() => {
    const totalSets = safeBlocks.reduce((acc, b) => acc + (b.sets?.length || 0), 0);
    const totalVolume = safeBlocks.reduce(
      (acc, b) => acc + b.sets.reduce((a, s) => a + s.weight * s.reps, 0),
      0
    );
    return { totalSets, totalVolume };
  }, [safeBlocks]);

  const TitleRow = () =>
    showTitle ? (
      <Text style={{ color: palette.text, fontSize: 16, fontWeight: '900', marginBottom: spacing(0.5) }}>
        {titleOverride || 'Workout'}
        <Text style={{ color: palette.text, fontWeight: '900' }}>
          {`  •  ${summary.totalSets} sets  •  ${Math.round(summary.totalVolume).toLocaleString()} ${units}`}
        </Text>
      </Text>
    ) : null;

  const Inner = () => (
    <View>
      <TitleRow />
      {safeBlocks.map((b) => {
        const ex = b.exercise; // ← centralized; never use a free `ex`
        const head = `${ex.name}${ex.muscleGroup ? ` • ${ex.muscleGroup}` : ''}`;
        return (
          <View
            key={b.id}
            style={{
              paddingVertical: compact ? 6 : 8,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(0,0,0,0.06)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: compact ? 4 : 6 }}>
              {!!ex.icon && <Text style={{ fontSize: 16, marginRight: 8 }}>{ex.icon}</Text>}
              <Text style={{ color: palette.text, fontWeight: '800' }}>{head}</Text>
            </View>
            <Text style={{ color: palette.sub }}>{formatSets(b.sets, units)}</Text>
          </View>
        );
      })}
    </View>
  );

  if (showCard === false) return <Inner />;

  return (
    <Card style={{ padding: spacing(2) }}>
      <Inner />
    </Card>
  );
}

function formatSets(sets, units) {
  if (!sets || sets.length === 0) return 'No sets';
  // group identical (weight,reps) tuples
  const key = (s) => `${Number(s.weight) || 0}x${Number(s.reps) || 0}`;
  const map = new Map();
  for (const s of sets) {
    const k = key(s);
    map.set(k, (map.get(k) || 0) + 1);
  }
  const parts = [];
  for (const [k, count] of map.entries()) {
    const [w, r] = k.split('x');
    parts.push(`${count}×(${Number(w)}×${Number(r)} ${units})`);
  }
  return parts.join(' + ');
}
