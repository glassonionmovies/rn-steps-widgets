// components/workout/WorkoutSessionPreviewCard.js
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';

/**
 * Reusable workout preview.
 * - Shows each exercise with optional icon and its sets inline.
 * - By default wraps content in a Card. Pass `noCard` to render flat.
 *
 * Props:
 *  - workout: { units?: 'lb'|'kg', blocks: [{ id, exercise:{ name, icon? }, sets:[{ reps, weight }] }] }
 *  - onPress?: () => void
 *  - noCard?: boolean  -> when true, renders without the Card wrapper
 */
export default function WorkoutSessionPreviewCard({ workout, onPress, noCard = false }) {
  const units = workout?.units || 'lb';
  const blocks = Array.isArray(workout?.blocks) ? workout.blocks : [];
  if (blocks.length === 0) return null;

  const Wrapper = noCard ? View : Card;
  const wrapperProps = noCard ? { style: styles.flat } : { style: styles.card };

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Wrapper {...wrapperProps}>
        <View style={{ gap: 10 }}>
          {blocks.map((block) => {
            const ex = block?.exercise || {};
            const name = ex.name || 'Exercise';
            const icon = ex.icon || '🏋️';

            const sets = Array.isArray(block?.sets) ? block.sets : [];
            return (
              <View key={block.id || name} style={styles.exerciseRow}>
                <Text style={styles.exerciseIcon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{name}</Text>
                  <View style={styles.setsRow}>
                    {sets.map((s, i) => {
                      const w = Number(s?.weight) || 0;
                      const r = Number(s?.reps) || 0;
                      return (
                        <Text key={s?.id || i} style={styles.setChip}>
                          {r} x {w}{units}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </Wrapper>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing(1.5),
  },
  flat: {
    paddingVertical: spacing(1),
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  exerciseIcon: {
    fontSize: 18,
    marginTop: 3,
  },
  exerciseName: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  setsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setChip: {
    color: palette.sub,
    fontSize: 12,
  },
});
