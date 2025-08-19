// components/workout/RecentWorkoutsPanel.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Card from '../ui/Card';
import GradientButton from '../ui/GradientButton';
import WorkoutSessionSummary from './WorkoutSessionSummary';
import { palette, spacing } from '../../theme';
import { getAllWorkouts } from '../../store/workoutStore';

// Prefer helper if present (nested tabs); fall back to manual nested nav
let goTrackWorkout;
try {
  ({ goTrackWorkout } = require('../../navigation/routes'));
} catch (_) {
  goTrackWorkout = null;
}

export default function RecentWorkoutsPanel({ workouts: propWorkouts }) {
  const navigation = useNavigation();
  const [internal, setInternal] = useState(null); // null = not loaded

  const load = useCallback(async () => {
    // If parent provided workouts, don't self-load
    if (propWorkouts && propWorkouts.length) return;
    const all = await getAllWorkouts();
    setInternal(all || []);
  }, [propWorkouts]);

  // Initial load (for non-parent-provided usage)
  useEffect(() => {
    if (!propWorkouts || propWorkouts.length === 0) {
      load();
    }
  }, [propWorkouts, load]);

  // 🔁 Refresh whenever the screen regains focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const data = useMemo(() => {
    if (propWorkouts && propWorkouts.length) return propWorkouts;
    if (internal && internal.length) return internal;
    return [];
  }, [propWorkouts, internal]);

  const last10 = useMemo(
    () => [...data].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)).slice(0, 10),
    [data]
  );

  const openWorkout = (id) => {
    if (goTrackWorkout) {
      goTrackWorkout(navigation, id ? { workoutId: id } : undefined);
    } else {
      navigation.navigate('Train', { screen: 'TrackWorkout', params: id ? { workoutId: id } : undefined });
    }
  };

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: spacing(1) }}>
        Recent Workouts
      </Text>

      {last10.length === 0 ? (
        <Text style={{ color: palette.sub }}>No workouts yet.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {last10.map((w) => {
            const dt = new Date(w.startedAt || Date.now());
            const when = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

            return (
              <Pressable
                key={w.id}
                onPress={() => openWorkout(w.id)}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0,0,0,0.06)',
                }}
              >
                {/* Date heading (and optional user-defined title if present) */}
                <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 6 }}>
                  {when}{w.title ? ` • ${w.title}` : ''}
                </Text>

                {/* Summary UI (read-only preview) */}
                <View pointerEvents="none">
                  <WorkoutSessionSummary
                    blocks={w.blocks || []}
                    units={w.units || 'lb'}
                    showFinish={false}
                    showTitle={false}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ height: spacing(1) }} />
      <GradientButton title="Start New Workout" onPress={() => openWorkout(null)} />
    </Card>
  );
}
