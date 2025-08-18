// components/workout/RecentWorkoutsPanel.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Card from '../ui/Card';
import GradientButton from '../ui/GradientButton';
import WorkoutSessionSummary from './WorkoutSessionSummary';
import { palette, spacing } from '../../theme';
import { getAllWorkouts } from '../../store/workoutStore';

let goTrackWorkout;
try { ({ goTrackWorkout } = require('../../navigation/routes')); } catch (_) { goTrackWorkout = null; }

export default function RecentWorkoutsPanel({ workouts: propWorkouts, selectionMode: propSelectionMode }) {
  const navigation = useNavigation();
  const route = useRoute();
  const [internal, setInternal] = useState(null);

  const selectionMode = propSelectionMode ?? !!route?.params?.selectPattern;

  useEffect(() => {
    let active = true;
    (async () => {
      if (propWorkouts && propWorkouts.length) return;
      const all = await getAllWorkouts();
      if (active) setInternal(all || []);
    })();
    return () => { active = false; };
  }, [propWorkouts]);

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
    if (selectionMode) {
      // Use this workout as a PATTERN (clone) → new Track session
      navigation.navigate('Train', { screen: 'TrackWorkout', params: { patternFromWorkoutId: id } });
      return;
    }
    // Normal: open for editing/review
    if (goTrackWorkout) {
      goTrackWorkout(navigation, id ? { workoutId: id, mode: 'edit' } : undefined);
    } else {
      navigation.navigate('Train', { screen: 'TrackWorkout', params: id ? { workoutId: id, mode: 'edit' } : undefined });
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
                <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 6 }}>{when}</Text>
                <View pointerEvents="none">
                  <WorkoutSessionSummary
                    blocks={w.blocks || []}
                    units={w.units || 'lb'}
                    showFinish={false}
                    showTitle={false}
                    titleOverride={w.title}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {!selectionMode && (
        <>
          <View style={{ height: spacing(1) }} />
          <GradientButton title="Start New Workout" onPress={() => openWorkout(null)} />
        </>
      )}
    </Card>
  );
}
