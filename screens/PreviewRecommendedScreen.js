// screens/PreviewRecommendedScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import WorkoutSessionPreviewCard from '../components/workout/WorkoutSessionPreviewCard';
import { palette, spacing, layout } from '../theme';

import { getAllWorkouts } from '../store/workoutStore';
import { generatePlan } from '../utils/repAIPlanner';

const INTENSITY_PRESETS = { low: 0.45, medium: 0.7, high: 0.95 };
const GOAL_OPTIONS = ['hypertrophy', 'strength', 'endurance'];
const EQUIP_OPTIONS = [
  { key: 'barbell',    label: 'Barbell',    icon: '🏋️' },
  { key: 'dumbbell',   label: 'Dumbbell',   icon: '🏋️‍♀️' },
  { key: 'machine',    label: 'Machine',    icon: '🛠️' },
  { key: 'cable',      label: 'Cable',      icon: '🧵' },
  { key: 'bodyweight', label: 'Bodyweight', icon: '🤸' },
];

export default function PreviewRecommendedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const incomingPlan = route?.params?.plan || null;

  const [history, setHistory] = useState([]);
  const [plan, setPlan] = useState(incomingPlan);

  // Customize controls
  const [minutes, setMinutes] = useState(50);
  const [intensity, setIntensity] = useState('medium'); // 'low' | 'medium' | 'high'
  const [notes, setNotes] = useState('');
  const [goal, setGoal] = useState('hypertrophy');      // from GOAL_OPTIONS
  const [equip, setEquip] = useState(new Set(EQUIP_OPTIONS.map(e => e.key))); // multi-select

  // Pull history once
  useEffect(() => {
    let mounted = true;
    (async () => {
      const all = await getAllWorkouts();
      if (!mounted) return;
      setHistory(all || []);

      if (!incomingPlan) {
        const auto = buildPlan(all, { minutes, intensity, notes, goal, equip });
        setPlan(auto);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildPlan(hist, opts) {
    const { minutes: m, intensity: int, goal: g, equip: eqSet } = opts;
    const readiness = INTENSITY_PRESETS[int] ?? INTENSITY_PRESETS.medium;
    const units = hist?.[0]?.units || 'lb';
    const equipment = Array.from(eqSet || []).filter(Boolean);
    const safeEquipment = equipment.length ? equipment : EQUIP_OPTIONS.map(e => e.key);

    return generatePlan({
      history: hist || [],
      goals: g || 'hypertrophy',
      split: 'upper', // (could be added as another selector later)
      timeBudgetMin: clampInt(m, 15, 120),
      equipment: safeEquipment,
      vitals: { readiness },
      settings: { units, plateIncrementLb: 5, plateIncrementKg: 2.5 },
      constraints: {},
      seed: Date.now(),
    });
  }

  function onGenerate() {
    const fresh = buildPlan(history, { minutes, intensity, notes, goal, equip });
    setPlan(fresh);
  }

  // Summary (sets & volume)
  const summary = useMemo(() => {
    const units = plan?.units || 'lb';
    let totalSets = 0, totalVolume = 0;
    for (const b of plan?.blocks || []) {
      for (const s of b?.sets || []) {
        const w = Number(s?.weight) || 0;
        const r = Number(s?.reps) || 0;
        totalSets += 1;
        totalVolume += w * r;
      }
    }
    return { totalSets, totalVolume: Math.round(totalVolume), units };
  }, [plan]);

  const when = useMemo(() => {
    const ts = plan?.createdAt || Date.now();
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [plan]);

  // Preview object (flat, no completion flags)
  const previewWorkout = useMemo(() => {
    if (!plan) return null;
    return {
      id: plan.id,
      title: plan.name || 'Rep.AI Plan',
      units: plan.units || 'lb',
      blocks: (plan.blocks || []).map((b, i) => ({
        id: b.id || `b_${i}`,
        exercise: b.exercise,
        sets: (b.sets || []).map((s, j) => ({
          id: s.id || `s_${i}_${j}`,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
        })),
      })),
    };
  }, [plan]);

  const startFromPlan = () => {
    if (!plan) return;
    const template = {
      name: plan.name || 'Rep.AI Plan',
      units: plan.units || 'lb',
      blocks: (plan.blocks || []).map(b => ({
        exercise: b.exercise,
        sets: (b.sets || []).map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
      })),
    };
    navigation.navigate('Train', { screen: 'TrackWorkout', params: { template } });
  };

  const justification = useMemo(() => {
    if (!plan) return '';
    const groups = Array.from(new Set((plan.blocks || []).map(b => b.exercise?.muscleGroup).filter(Boolean)));
    const patterns = Array.from(new Set((plan.blocks || []).map(b => b.exercise?.pattern).filter(Boolean)));
    const readyPct = Math.round((INTENSITY_PRESETS[intensity] ?? 0.7) * 100);
    const equipList = EQUIP_OPTIONS.filter(e => equip.has(e.key)).map(e => e.label).join(', ');

    const lines = [];
    lines.push(`• Goal: ${cap(goal)}  • Split: Upper`);
    lines.push(`• Intensity: ${cap(intensity)} (~${readyPct}% readiness)  • Time: ~${minutes} min`);
    lines.push(`• Equipment allowed: ${equipList || '—'}`);
    if (groups.length) lines.push(`• Target groups today: ${groups.join(' / ')}`);
    if (patterns.length) lines.push(`• Pattern coverage: ${patterns.map(humanizePattern).join(', ')}`);
    lines.push(`• Dose: ${summary.totalSets} sets, est. volume ${summary.totalVolume.toLocaleString()} ${summary.units}`);
    if (notes.trim()) lines.push(`• Your notes: “${notes.trim()}”`);
    return lines.join('\n');
  }, [plan, intensity, minutes, notes, goal, equip, summary]);

  function toggleEquip(name) {
    setEquip(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      if (next.size === 0) return new Set([name]); // keep at least one
      return next;
    });
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
      {/* 1) Customize */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>Customize</Text>

        {/* Time */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🕒</Text>
            <Text style={styles.label}>Available time</Text>
          </View>
          <View style={styles.timeRow}>
            <RoundPill label="−5" onPress={() => setMinutes(m => Math.max(15, m - 5))} />
            <TextInput
              value={String(minutes)}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/[^\d]/g, ''), 10);
                if (Number.isFinite(n)) setMinutes(clampInt(n, 15, 180));
                else if (t === '') setMinutes(0);
              }}
              placeholder="min"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              style={styles.minutesInput}
            />
            <Text style={{ color: palette.sub, marginLeft: 4 }}>min</Text>
            <RoundPill label="+5" onPress={() => setMinutes(m => Math.min(180, m + 5))} style={{ marginLeft: 8 }} />
          </View>
        </View>

        {/* Intensity */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>⚡</Text>
            <Text style={styles.label}>Intensity</Text>
          </View>
          <View style={styles.segment}>
            {(['low','medium','high']).map((lvl) => (
              <Pressable
                key={lvl}
                onPress={() => setIntensity(lvl)}
                style={[styles.segmentBtn, intensity === lvl && styles.segmentBtnActive]}
                hitSlop={6}
              >
                <Text style={[styles.segmentText, intensity === lvl && styles.segmentTextActive]}>
                  {lvl === 'low' ? '🧘' : lvl === 'high' ? '🔥' : '⚡'} {cap(lvl)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Goal */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>🎯</Text>
            <Text style={styles.label}>Goal</Text>
          </View>
          <View style={styles.segment}>
            {GOAL_OPTIONS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGoal(g)}
                style={[styles.segmentBtn, goal === g && styles.segmentBtnActive]}
                hitSlop={6}
              >
                <Text style={[styles.segmentText, goal === g && styles.segmentTextActive]}>
                  {cap(g)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Equipment */}
        <View style={styles.rowCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.rowIcon}>🧰</Text>
            <Text style={styles.label}>Equipment</Text>
          </View>
          <View style={styles.chipsWrap}>
            {EQUIP_OPTIONS.map((e) => {
              const active = equip.has(e.key);
              return (
                <Pressable
                  key={e.key}
                  onPress={() => toggleEquip(e.key)}
                  style={[styles.chip, active && styles.chipActive]}
                  hitSlop={6}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {e.icon} {e.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.rowCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.rowIcon}>🗒️</Text>
            <Text style={styles.label}>Notes / additions</Text>
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g., avoid heavy hinge; add curls; quads sore"
            placeholderTextColor="#9CA3AF"
            multiline
            style={styles.notesInput}
          />
        </View>

        <View style={{ height: spacing(1) }} />
        <GradientButton title="Generate" onPress={onGenerate} />
      </Card>

      {/* 2) Plan */}
      {!plan || !previewWorkout ? (
        <Card style={{ padding: spacing(2) }}>
          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>
            Building your Rep.AI plan…
          </Text>
          <Text style={{ color: palette.sub, marginTop: 6 }}>
            Using your history and preferences.
          </Text>
        </Card>
      ) : (
        <Card style={{ padding: spacing(2) }}>
          <View style={styles.headerRow}>
            <Text style={styles.name}>{plan.name || 'Rep.AI Plan'}</Text>
            <Text style={styles.headerSummary}>
              {summary.totalSets} {summary.totalSets === 1 ? 'set' : 'sets'} • {summary.totalVolume.toLocaleString()} {summary.units}
            </Text>
            <Text style={styles.date}>{when}</Text>
          </View>

          <WorkoutSessionPreviewCard
            workout={previewWorkout}
            onPress={startFromPlan}
            noCard
          />

          <View style={{ height: spacing(1) }} />
          <GradientButton title="Start this workout" onPress={startFromPlan} />
        </Card>
      )}

      {/* 3) Why this plan */}
      {plan && (
        <Card style={{ padding: spacing(2) }}>
          <Text style={styles.sectionTitle}>Why Rep.AI recommended this</Text>
          <Text style={styles.justText}>{justification}</Text>
        </Card>
      )}
    </ScrollView>
  );
}

/* ----------------- helpers & tiny UI atoms ----------------- */
function clampInt(n, lo, hi) { const x = Number(n) || 0; return Math.max(lo, Math.min(hi, x)); }
function cap(s){ return String(s||'').charAt(0).toUpperCase() + String(s||'').slice(1); }
function humanizePattern(p){
  switch(p){
    case 'horizontal_press': return 'Horizontal Press';
    case 'vertical_press': return 'Vertical Press';
    case 'horizontal_pull': return 'Horizontal Pull';
    case 'vertical_pull': return 'Vertical Pull';
    case 'hinge': return 'Hinge';
    case 'squat': return 'Squat';
    default: return cap(p);
  }
}

function RoundPill({ label, onPress, style }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.pillBtn, style]}>
      <Text style={styles.pillBtnText}>{label}</Text>
    </Pressable>
  );
}

/* ----------------- styles ----------------- */
const styles = StyleSheet.create({
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: spacing(1),
  },

  // Generic rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1.25),
    gap: 12,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 18 },

  label: { color: palette.text, fontWeight: '900' },

  // Time
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  minutesInput: {
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    color: palette.text,
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
  },
  pillBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillBtnText: { color: palette.text, fontWeight: '900' },

  // Segments
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    padding: 4,
    gap: 4,
  },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  segmentBtnActive: { backgroundColor: '#6a5cff' },
  segmentText: { color: palette.text, fontWeight: '800', fontSize: 12 },
  segmentTextActive: { color: 'white' },

  // Chips
  rowCol: { marginBottom: spacing(1.25), gap: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  chipActive: { backgroundColor: '#6a5cff' },
  chipText: { color: palette.text, fontWeight: '800', fontSize: 12 },
  chipTextActive: { color: 'white' },

  // Notes
  notesInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    minHeight: 64,
    textAlignVertical: 'top',
  },

  // Plan header (matches Templates)
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: spacing(1),
    gap: spacing(1),
  },
  name: { color: palette.text, fontWeight: '900', fontSize: 16, flexShrink: 1 },
  headerSummary: { color: palette.text, fontWeight: '800', fontSize: 12 },
  date: { color: palette.sub, fontSize: 12 },

  // Why card
  justText: { color: palette.sub, lineHeight: 20 },
});
