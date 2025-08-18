// components/workout/RecentWorkoutsPanel.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

/**
 * Props:
 * - workouts?: array (if omitted, panel will self-load from store)
 * - titleText?: string
 * - onOpen?: (workoutObj) => void
 * - showStartNewButton?: boolean (default true)
 */
export default function RecentWorkoutsPanel({
  workouts: propWorkouts,
  titleText = 'Recent Workouts',
  onOpen,
  showStartNewButton = true,
}) {
  const navigation = useNavigation();
  const [internal, setInternal] = useState(null); // null = not loaded

  // Self-load if parent didn't pass workouts
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

  // Use startedAt when present; fall back to createdAt if provided (e.g., templates as pseudo sessions)
  const ts = (w) => (w.startedAt ?? w.createdAt ?? 0);
  const last10 = useMemo(
    () => [...data].sort((a, b) => (ts(b) || 0) - (ts(a) || 0)).slice(0, 10),
    [data]
  );

  const defaultOpenWorkout = (id) => {
    if (goTrackWorkout) {
      goTrackWorkout(navigation, id ? { workoutId: id } : undefined);
    } else {
      navigation.navigate('Train', {
        screen: 'TrackWorkout',
        params: id ? { workoutId: id } : undefined,
      });
    }
  };

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text
        style={{
          color: palette.text,
          fontSize: 18,
          fontWeight: '800',
          marginBottom: spacing(1),
        }}
      >
        {titleText}
      </Text>

      {last10.length === 0 ? (
        <Text style={{ color: palette.sub }}>No workouts yet.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {last10.map((w) => {
            const dateMs = ts(w) || Date.now();
            const when = new Date(dateMs).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            // Show a title when available; keep dates as-is
            const title =
              w.title ||
              w.workoutTitle ||
              w.templateName ||
              w?.template?.name ||
              w.name || // allow template.name if passed through
              null;

            const handleOpen = () => {
              if (onOpen) return onOpen(w);
              return defaultOpenWorkout(w.id);
            };

            return (
              <Pressable
                key={w.id}
                onPress={handleOpen}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0,0,0,0.06)',
                }}
              >
                {/* Date heading (unchanged) */}
                <Text
                  style={{
                    color: palette.text,
                    fontWeight: '800',
                    marginBottom: title ? 2 : 6,
                  }}
                >
                  {when}
                </Text>

                {/* Optional workout/template title line */}
                {title ? (
                  <Text
                    style={{
                      color: palette.sub,
                      fontWeight: '700',
                      marginBottom: 6,
                    }}
                  >
                    {title}
                  </Text>
                ) : null}

                {/* Summary UI; for templates we still show blocks summary */}
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

      {showStartNewButton ? (
        <>
          <View style={{ height: spacing(1) }} />
          <GradientButton title="Start New Workout" onPress={() => defaultOpenWorkout(null)} />
        </>
      ) : null}
    </Card>
  );
}
