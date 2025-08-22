// screens/WorkoutTemplatesScreen.js
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/ui/Card';
import WorkoutSessionPreviewCard from '../components/workout/WorkoutSessionPreviewCard';
import { palette, spacing, layout } from '../theme';
import { getAllWorkoutTemplates } from '../store/templateStore';

export default function WorkoutTemplatesScreen() {
  const navigation = useNavigation();
  const [templates, setTemplates] = useState([]);

  // Load & sort by createdAt DESC (newest first)
  const load = async () => {
    const raw = await getAllWorkoutTemplates();
    const sorted = (raw || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setTemplates(sorted);
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation]);

  const startFromTemplate = (t) => {
    navigation.navigate('TrackWorkout', { template: t });
  };

  // Local summary for templates
  function summarizeTemplate(t) {
    const units = t?.units || 'lb';
    let totalSets = 0;
    let totalVolume = 0;
    for (const b of t?.blocks || []) {
      for (const s of b?.sets || []) {
        const w = Number(s?.weight) || 0;
        const r = Number(s?.reps) || 0;
        totalSets += 1;
        totalVolume += w * r;
      }
    }
    return { totalSets, totalVolume, units };
  }

  // Decorate blocks for preview
  function asPreviewWorkoutFromTemplate(t) {
    const fakeDone = Date.now();
    return {
      id: t.id,
      title: t.name || 'Template',
      units: t.units || 'lb',
      blocks: (t.blocks || []).map((b, i) => ({
        id: b.id || `b_${i}`,
        exercise: b.exercise,
        sets: (b.sets || []).map((s, j) => ({
          id: s.id || `s_${i}_${j}`,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          completedAt: fakeDone,
          __preview: true,
        })),
      })),
    };
  }

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
      {/* Screen heading */}
      <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900' }}>
        Workout Template
      </Text>

      {templates.length === 0 ? (
        <Text style={{ color: palette.sub }}>
          No templates yet. Save your current workout as a template from the Track screen.
        </Text>
      ) : (
        <View style={{ gap: spacing(2) }}>
          {templates.map((t) => {
            const preview = asPreviewWorkoutFromTemplate(t);
            const { totalSets, totalVolume, units } = summarizeTemplate(t);
            const when = t.createdAt
              ? new Date(t.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '';

            return (
              <Card key={t.id} style={{ padding: spacing(2) }}>
                {/* Name (left) + Summary (middle) + Date (right) */}
                <View style={styles.headerRow}>
                  <Pressable style={{ flex: 1 }} onPress={() => startFromTemplate(t)}>
                    <Text style={styles.name}>{t.name}</Text>
                  </Pressable>
                  <Text style={styles.summary}>
                    {totalSets} sets • {Math.round(totalVolume).toLocaleString()} {units}
                  </Text>
                  <Text style={styles.date}>{when}</Text>
                </View>

                {/* Exercise preview */}
                <WorkoutSessionPreviewCard
                  workout={preview}
                  onPress={() => startFromTemplate(t)}
                  noCard
                />
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: spacing(1),
    gap: spacing(1),
  },
  name: {
    color: palette.text,
    fontWeight: '900',
    fontSize: 16,
    flexShrink: 1,
  },
  summary: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 12,
  },
  date: {
    color: palette.sub,
    fontSize: 12,
  },
});
