// screens/ExerciseProgressionScreen.js
import React, { useMemo, useCallback, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Card from '../components/ui/Card';
import MultiLineChart from '../components/charts/MultiLineChart';
import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';
import coach from '../utils/coach';

const METRICS = ['e1RM', 'Max Weight', 'Volume / Workout'];
const isValidSet = (s) => (Number(s?.weight)||0) > 0 && (Number(s?.reps)||0) > 0;

function Chips({ value, onChange, options }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange?.(opt)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
              borderColor: active ? '#6366f1' : '#e5e7eb', backgroundColor: active ? '#eef2ff' : '#fff',
            }}
          >
            <Text style={{ color: active ? '#4f46e5' : palette.text, fontWeight: active ? '800' : '600' }}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ExerciseProgressionScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const exercise = route?.params?.exercise || {};
  const [workouts, setWorkouts] = useState([]);
  const [metric, setMetric] = useState('e1RM');

  useFocusEffect(useCallback(() => {
    let mounted = true;
    (async () => {
      const all = await getAllWorkouts();
      if (mounted) setWorkouts(all || []);
    })();
    return () => { mounted = false; };
  }, []));

  // Aggregate through coach
  const exAgg = useMemo(() => coach.aggregateExercise(workouts, exercise), [workouts, exercise]);

  const labels = useMemo(() => exAgg.sessions.map((d) => {
    const dt = new Date(d.date);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  }), [exAgg.sessions]);

  const series = useMemo(() => {
    if (metric === 'e1RM') {
      return [{ label: 'e1RM (lbs)', color: '#2563eb', points: exAgg.sessions.map((d) => Math.round(d.maxE1 || 0)) }];
    } else if (metric === 'Max Weight') {
      return [{ label: 'Max Weight (lbs)', color: '#a855f7', points: exAgg.sessions.map((d) => Math.round(d.maxW || 0)) }];
    } else {
      return [{ label: 'Volume / Workout (lbs)', color: '#22c55e', points: exAgg.sessions.map((d) => Math.round(d.vol || 0)) }];
    }
  }, [metric, exAgg.sessions]);

  // PRs
  const prs = useMemo(() => {
    const bestE1 = Math.max(0, ...exAgg.sessions.map((d) => d.maxE1 || 0));
    const bestW  = Math.max(0, ...exAgg.sessions.map((d) => d.maxW  || 0));
    const bestVol= Math.max(0, ...exAgg.sessions.map((d) => d.vol   || 0));
    const getDate = (val, key) => {
      const hit = exAgg.sessions.find((d) => Math.round(d[key]) === Math.round(val));
      return hit ? new Date(hit.date) : null;
    };
    return {
      e1rm: { value: bestE1, date: getDate(bestE1, 'maxE1') },
      weight: { value: bestW, date: getDate(bestW, 'maxW') },
      volume: { value: bestVol, date: getDate(bestVol, 'vol') },
    };
  }, [exAgg.sessions]);

  // Compose Rep.Ai messages
  const insights = useMemo(() => {
    const out = [];
    const slope = exAgg.e1rmTrend?.slopePerWeek ?? 0;
    if (exAgg.sessions.length >= 3) {
      if (slope > 0.5) out.push(`e1RM trending up ~${slope.toFixed(1)} lbs/week—nice momentum.`);
      else if (slope < -0.3) out.push(`e1RM trending down ~${Math.abs(slope).toFixed(1)} lbs/week—review recovery/technique.`);
      else out.push('e1RM trend is flat—try a small progression or variation.');
    }
    if (exAgg.plateau) out.push(exAgg.plateau.message);
    if (exAgg.acwr?.ratio != null) {
      const r = exAgg.acwr.ratio.toFixed(2);
      if (exAgg.acwr.status === 'high') out.push(`ACWR ${r}: recent ${exercise?.name || 'exercise'} load spike—monitor fatigue or taper.`);
      else if (exAgg.acwr.status === 'low') out.push(`ACWR ${r}: consider adding a bit more volume for this lift.`);
      else out.push(`ACWR ${r}: load is balanced for this lift.`);
    }
    (exAgg.noteTips || []).forEach((t) => out.push(t));
    return out;
  }, [exAgg, exercise?.name]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: layout.screenHMargin, gap: spacing(2) }}
    >
      {/* Header */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.title}>
          {exercise?.icon ? `${exercise.icon} ` : ''}{exercise?.name || 'Exercise'}
        </Text>
        <Chips value={metric} onChange={setMetric} options={METRICS} />
      </Card>

      {/* Chart */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>Strength Progression</Text>
        <MultiLineChart
          labels={labels}
          series={series}
          showValues
          yMode="joint"
        />
        {exAgg.sessions.length === 0 && (
          <Text style={{ color: palette.sub, marginTop: 6 }}>No sessions logged for this exercise yet.</Text>
        )}
      </Card>

      {/* PRs */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>All-Time Bests</Text>
        <View style={{ gap: 8 }}>
          <Row label="🏆 Estimated 1-Rep Max" value={`${Math.round(prs.e1rm.value || 0)} lbs`} date={prs.e1rm.date} />
          <Row label="🥇 Heaviest Weight" value={`${Math.round(prs.weight.value || 0)} lbs`} date={prs.weight.date} />
          <Row label="📈 Most Volume (Workout)" value={`${Math.round(prs.volume.value || 0).toLocaleString()} lbs`} date={prs.volume.date} />
        </View>
      </Card>

      {/* AI Coach */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>🧠 Rep.Ai Analysis</Text>
        {insights.map((t, i) => (
          <Text key={i} style={{ color: palette.text, marginTop: 4 }}>{t}</Text>
        ))}
      </Card>
    </ScrollView>
  );
}

function Row({ label, value, date }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: palette.text, fontWeight: '700' }}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: palette.text, fontWeight: '800' }}>{value}</Text>
        <Text style={{ color: palette.sub, fontSize: 12 }}>
          {date ? new Date(date).toLocaleDateString() : '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: '900', marginBottom: spacing(1) },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: spacing(1) },
});
