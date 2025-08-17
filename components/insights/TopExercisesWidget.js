// components/insights/TopExercisesWidget.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';
import { getAllWorkouts } from '../../store/workoutStore';

const dayMs = 24 * 60 * 60 * 1000;
const epley = (w, r) => (Number(w)||0) * (1 + (Number(r)||0) / 30);
const isValidSet = (s) => (Number(s?.weight) || 0) > 0 && (Number(s?.reps) || 0) > 0;

export default function TopExercisesWidget({
  group,            // 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Abs'
  rangeDays = 90,   // lookback window
  maxItems = 5,     // how many to show
  title = 'Top Exercises',
}) {
  const navigation = useNavigation();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const all = await getAllWorkouts();
      const cutoff = Date.now() - rangeDays * dayMs;

      // Map exerciseKey -> { id, name, icon, volume, sessions:Set<workoutId>, bestSet:{weight,reps,e1} }
      const byExercise = new Map();

      (all || [])
        .filter(w => (w.startedAt || 0) >= cutoff)
        .forEach(w => {
          const wid = w.id;
          (w.blocks || []).forEach(b => {
            if (b.exercise?.muscleGroup !== group) return;
            const exId = b.exercise?.id || b.exercise?.name || 'exercise';
            const exName = b.exercise?.name || 'Exercise';
            const exIcon = b.exercise?.icon;

            let acc = byExercise.get(exId);
            if (!acc) {
              acc = { id: exId, name: exName, icon: exIcon, volume: 0, sessions: new Set(), bestSet: null };
              byExercise.set(exId, acc);
            }

            let blockBest = acc.bestSet;
            let blockVol = 0;

            (b.sets || []).filter(isValidSet).forEach(s => {
              const weight = Number(s.weight) || 0;
              const reps   = Number(s.reps) || 0;
              const vol = weight * reps;
              blockVol += vol;

              const e1 = epley(weight, reps);
              if (!blockBest || e1 > blockBest.e1) {
                blockBest = { weight, reps, e1 };
              }
            });

            if (blockVol > 0) {
              acc.volume += blockVol;
              acc.sessions.add(wid);
              acc.bestSet = blockBest;
            }
          });
        });

      const arr = Array.from(byExercise.values())
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, maxItems)
        .map(x => ({
          ...x,
          sessions: x.sessions.size,
        }));

      if (active) setRows(arr);
    })();
    return () => { active = false; };
  }, [group, rangeDays, maxItems]);

  const empty = rows.length === 0;

  const openExercise = (row) => {
    // Prefer a routes helper if your app has one; otherwise navigate into Progress stack.
    try {
      const routes = require('../../navigation/routes');
      if (routes?.goExerciseProgression) {
        routes.goExerciseProgression(navigation, { exerciseName: row.name, muscleGroup: group, exerciseId: row.id });
        return;
      }
    } catch {}
    navigation.navigate('Progress', {
      screen: 'ExerciseProgression',
      params: { exerciseName: row.name, muscleGroup: group, exerciseId: row.id },
    });
  };

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: spacing(1) }}>
        {title} <Text style={{ color: palette.sub, fontSize: 12 }}>• last {rangeDays} days</Text>
      </Text>

      {empty ? (
        <Text style={{ color: palette.sub }}>No {group?.toLowerCase?.() || 'group'} exercises logged in this period.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => openExercise(row)}
              style={{
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(0,0,0,0.06)',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Left: Icon + Name */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {!!row.icon && <Text style={{ fontSize: 16 }}>{row.icon}</Text>}
                  <Text style={{ color: palette.text, fontWeight: '800' }}>{row.name}</Text>
                </View>

                {/* Right: chevron */}
                <Text style={{ color: palette.sub, fontSize: 18 }}>{'›'}</Text>
              </View>

              {/* Metrics line */}
              <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <Text style={{ color: palette.sub }}>
                  Volume: {Math.round(row.volume).toLocaleString()}
                </Text>
                <Text style={{ color: palette.sub }}>
                  Sessions: {row.sessions}
                </Text>
                {row.bestSet ? (
                  <Text style={{ color: palette.sub }}>
                    Best: {row.bestSet.reps} reps @ {row.bestSet.weight}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}
