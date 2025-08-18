// components/insights/RepAIWellnessInsightsWidget.js
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, spacing } from '../../theme';

/**
 * Props:
 *  - name: string
 *  - latestCheckin: { energy: number, sleep: number, mode?: 'fasting'|'maintenance'|'bulking' }
 *  - workouts: Workout[]
 *  - mode: optional override
 *
 * Note: Parent <Card> controls outer margins; this component adds internal padding to match other widgets.
 */
export default function RepAIWellnessInsightsWidget({
  name = 'Athlete',
  latestCheckin = null,
  workouts = [],
  mode: modeProp,
}) {
  const mode = (modeProp || latestCheckin?.mode || 'maintenance');

  // Readiness score (60% energy, 40% sleep)
  const readiness = useMemo(() => {
    if (!latestCheckin) {
      return { score: null, band: 'unknown', msg: 'Log today’s check-in to unlock personalized guidance.' };
    }
    const e = Number(latestCheckin.energy) || 0;
    const s = Number(latestCheckin.sleep) || 0;
    const score = Math.round(0.6 * e + 0.4 * s);
    let band, msg;
    if (score >= 7) { band = 'high';     msg = 'High readiness — green light to push intensity or add a top set.'; }
    else if (score >= 4) { band = 'moderate'; msg = 'Moderate readiness — hit planned work with crisp technique.'; }
    else { band = 'low';  msg = 'Low readiness — trim volume ~10–20% or focus on mobility/technique.'; }
    return { score, band, msg };
  }, [latestCheckin]);

  // Minimal workout summarize
  function summarizeWorkout(w) {
    let vol = 0;
    (w.blocks || []).forEach(b =>
      (b.sets || []).forEach(s => {
        const weight = Number(s?.weight) || 0;
        const reps = Number(s?.reps) || 0;
        if (weight > 0 && reps > 0) vol += weight * reps;
      })
    );
    return { volume: vol };
  }

  // Last 7 days snapshot
  const week = useMemo(() => {
    const now = Date.now(), weekMs = 7*24*60*60*1000;
    const recent = (workouts || []).filter(w => (w.startedAt || 0) >= (now - weekMs));
    const prev   = (workouts || []).filter(w => (w.startedAt || 0) >= (now - 2*weekMs) && (w.startedAt || 0) < (now - weekMs));
    const volSum = arr => arr.reduce((a, w) => a + summarizeWorkout(w).volume, 0);
    const vNow = volSum(recent), vPrev = volSum(prev);
    const delta = vPrev > 0 ? Math.round(((vNow - vPrev)/vPrev) * 100) : (vNow > 0 ? 100 : 0);
    return { count: recent.length, volume: vNow, deltaPct: delta };
  }, [workouts]);

  // Simple rules engine
  const rec = useMemo(() => {
    const band = readiness.band;
    const out = { training: '', nutrition: '', habits: [] };

    if (band === 'high') {
      out.training = mode === 'bulking'
        ? 'Heavy day: add 1 top set on your main lift; target RPE 8–9 on final sets.'
        : 'Solid day: complete planned volume; add a back-off set if time allows.';
    } else if (band === 'moderate') {
      out.training = mode === 'fasting'
        ? 'Technique day: keep sets at RPE 6–7; prioritize quality over load.'
        : 'Steady day: complete core work at planned loads; skip optional intensifiers.';
    } else {
      out.training = 'Deload/maintenance: cut volume ~15% or switch to mobility & light cardio.';
    }

    if (mode === 'bulking')          out.nutrition = 'Mild surplus: anchor protein; add carbs pre/post-workout.';
    else if (mode === 'maintenance') out.nutrition = 'Balanced: protein each meal; time most carbs around training.';
    else                              out.nutrition = 'Deficit-friendly: lean protein & veggies; lower carbs away from training.';

    if (band === 'low') out.habits.push('10–20 min mobility or easy walk');
    if (band !== 'low') out.habits.push('Warm-up: 5–8 min ramp + 1–2 ramp sets');
    out.habits.push('Hydration: sip water throughout sessions');

    return out;
  }, [readiness, mode]);

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Rep.AI Wellness Insights</Text>
        <Text style={styles.sub}>Hi {name}! Mode: <Text style={styles.bold}>{cap(mode)}</Text></Text>
      </View>
      <View style={styles.divider} />

      {/* KPI Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCell}>
          <Text style={styles.kpiLabel}>Readiness</Text>
          <Text style={styles.kpiValue}>
            {readiness.score != null ? `${readiness.score}/10 (${cap(readiness.band)})` : '—'}
          </Text>
        </View>
        <View style={styles.kpiCell}>
          <Text style={styles.kpiLabel}>Sessions</Text>
          <Text style={styles.kpiValue}>{week.count}</Text>
        </View>
        <View style={styles.kpiCell}>
          <Text style={styles.kpiLabel}>Volume</Text>
          <Text style={styles.kpiValue}>{Math.round(week.volume).toLocaleString()}</Text>
        </View>
      </View>

      {/* Readiness note */}
      <Text style={styles.note}>{readiness.msg}</Text>

      {/* Sections */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Training</Text>
        <Text style={styles.body}>{rec.training}</Text>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Nutrition</Text>
        <Text style={styles.body}>{rec.nutrition}</Text>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Habits</Text>
        {rec.habits.map((h, i) => (
          <Text key={i} style={styles.body}>• {h}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // NEW: internal padding to match other widgets
  container: {
    padding: spacing(2),
  },

  /* Header */
  headerRow: { gap: 4, marginBottom: spacing(1) },
  h1: { color: palette.text, fontSize: 16, fontWeight: '800' },
  sub: { color: palette.sub, fontSize: 12 },
  bold: { color: palette.text, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border, marginVertical: spacing(1) },

  /* KPI Row */
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kpiCell: { flex: 1, paddingVertical: 4, paddingRight: spacing(1) },
  kpiLabel: { color: palette.sub, fontSize: 12 },
  kpiValue: { color: palette.text, fontWeight: '800', fontSize: 14, marginTop: 2 },

  /* Notes & Sections */
  note: { color: palette.sub, fontSize: 12, marginTop: spacing(1) },
  sectionBlock: { marginTop: spacing(1.25) },
  sectionTitle: { color: palette.text, fontSize: 14, fontWeight: '800', marginBottom: 6 },
  body: { color: palette.text, fontSize: 13, lineHeight: 18 },
});
