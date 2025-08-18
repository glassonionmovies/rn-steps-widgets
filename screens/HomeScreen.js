// screens/HomeScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import StatCard from '../components/StatCard';
// REPLACED: Steps widget -> AI.Rep insights widget

import RepAIWellnessInsightsWidget from '../components/insights/RepAIWellnessInsightsWidget';
import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';

const CHECKIN_KEY = 'wellness:checkins';
const NAME_KEY = 'profile:name';
const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs'];

/* ---------- helpers ---------- */
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };
const todayKey = () => new Date().toISOString().slice(0,10);
const sameDay = (isoA, isoB) => (isoA || '').slice(0,10) === (isoB || '').slice(0,10);

function summarizeWorkout(w) {
  let vol = 0;
  let first = Infinity, last = -Infinity;
  (w.blocks || []).forEach(b => {
    (b.sets || []).forEach(s => {
      const weight = Number(s?.weight) || 0;
      const reps = Number(s?.reps) || 0;
      if (weight > 0 && reps > 0 && s?.completedAt) {
        vol += weight * reps;
        const t = new Date(s.completedAt).getTime();
        if (t) { first = Math.min(first, t); last = Math.max(last, t); }
      }
    });
  });
  const start = w.startedAt ? new Date(w.startedAt).getTime() : (first < Infinity ? first : null);
  const end   = w.endedAt   ? new Date(w.endedAt).getTime()   : (last > -Infinity ? last : null);
  const minutes = start && end && end > start ? Math.round((end - start) / 60000) : 0;

  const hit = new Set();
  (w.blocks || []).forEach(b => {
    const g = b.exercise?.muscleGroup;
    if (GROUPS.includes(g)) hit.add(g);
  });
  return { volume: vol, minutes, groups: Array.from(hit) };
}

function weekBuckets(n = 14) {
  const arr = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0,0,0,0);
    arr.push(d.getTime());
  }
  return arr; // newest-first
}

function longestStreakByDay(workouts) {
  const days = new Set((workouts || []).map(w => startOfDay(w.startedAt || Date.now())));
  const sorted = [...days].sort((a,b) => a - b);
  let best = 0, cur = 0, prev = null;
  sorted.forEach(day => {
    if (prev !== null && day - prev <= 24*60*60*1000) cur += 1;
    else cur = 1;
    best = Math.max(best, cur);
    prev = day;
  });
  return best;
}

/* ---------- Rep.AI Insights (inline) ---------- */
function RepAiInsights({ name, latestCheckin, workouts }) {
  const readiness = useMemo(() => {
    if (!latestCheckin) return null;
    const e = Number(latestCheckin.energy) || 0;
    const s = Number(latestCheckin.sleep) || 0;
    const score = Math.round(0.6 * e + 0.4 * s);
    let msg;
    if (score >= 7) msg = 'High energy & sleep — go for a PR or add an extra set on your main lift.';
    else if (score >= 4) msg = 'Moderate readiness — aim for quality technique and steady volume.';
    else msg = 'Low readiness — reduce volume ~10–20% or focus on mobility.';
    return { score, msg };
  }, [latestCheckin]);

  const weekly = useMemo(() => {
    const now = Date.now();
    const weekMs = 7*24*60*60*1000;
    const thisWeek = (workouts || []).filter(w => (w.startedAt || 0) >= (now - weekMs));
    const lastWeek = (workouts || []).filter(w => (w.startedAt || 0) >= (now - 2*weekMs) && (w.startedAt || 0) < (now - weekMs));
    const countThis = thisWeek.length, countPrev = lastWeek.length;
    const delta = countPrev ? Math.round(((countThis - countPrev) / countPrev) * 100) : (countThis > 0 ? 100 : 0);
    const vol = (arr) => arr.reduce((a, w) => a + summarizeWorkout(w).volume, 0);
    const volDelta = (p => p.prev ? Math.round(((p.cur - p.prev) / p.prev) * 100) : (p.cur > 0 ? 100 : 0))({cur: vol(thisWeek), prev: vol(lastWeek)});
    const hit = new Set(); thisWeek.forEach(w => summarizeWorkout(w).groups.forEach(g => hit.add(g)));
    const missing = GROUPS.find(g => !hit.has(g));
    return { countThis, delta, volDelta, missing };
  }, [workouts]);

  const tip = useMemo(() => {
    const d = new Date(); const hr = d.getHours();
    const dow = d.toLocaleDateString(undefined, { weekday: 'long' });
    if (hr < 11) return `Morning ${dow}: open with compounds and keep rests tight.`;
    if (hr < 17) return `Afternoon ${dow}: hydrate and aim for your main strength work.`;
    return `Evening ${dow}: consider a lighter session or mobility to aid sleep.`;
  }, []);

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text style={styles.sectionTitle}>Rep.AI Insights</Text>
      <View style={{ height: 8 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>⚡️ Readiness</Text>
          {latestCheckin ? (
            <>
              <Text style={styles.insightLine}>Energy {latestCheckin.energy}/10 • Sleep {latestCheckin.sleep}/10</Text>
              <Text style={styles.insightBody}>{readiness?.msg}</Text>
            </>
          ) : (
            <Text style={styles.insightBody}>No check-in yet. Log today’s energy & sleep to personalize your plan.</Text>
          )}
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>📈 Weekly Performance</Text>
          <Text style={styles.insightLine}>{weekly.countThis} workout{weekly.countThis === 1 ? '' : 's'} this week</Text>
          <Text style={styles.insightLine}>Volume change: {weekly.volDelta >= 0 ? '+' : ''}{weekly.volDelta}%</Text>
          <Text style={styles.insightBody}>
            {weekly.missing ? `You haven’t trained ${weekly.missing} yet — consider adding it.` : 'Nice balance so far.'}
          </Text>
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>💡 Tip</Text>
          <Text style={styles.insightBody}>{tip}</Text>
        </View>
      </ScrollView>
    </Card>
  );
}

/* ---------- Main Wellness screen ---------- */
export default function HomeScreen() {
  const [name, setName] = useState('Athlete');
  const [energy, setEnergy] = useState(6);
  const [sleep, setSleep] = useState(6);
  // NEW: mode for fasting/maintenance/bulking
  const [mode, setMode] = useState('maintenance');

  const [saving, setSaving] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [expanded, setExpanded] = useState(null); // null = decide after we know hasToday
  const decidedRef = useRef(false);

  // load profile/checkins/workouts
  useEffect(() => {
    let active = true;
    (async () => {
      try { const n = await AsyncStorage.getItem(NAME_KEY); if (n && active) setName(n); } catch {}
      try {
        const raw = await AsyncStorage.getItem(CHECKIN_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        if (active) setCheckins(Array.isArray(arr) ? arr : []);
        const last = Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
        if (last) {
          if (typeof last.energy === 'number') setEnergy(last.energy);
          if (typeof last.sleep === 'number') setSleep(last.sleep);
          // NEW: restore last mode if present
          if (typeof last.mode === 'string') setMode(last.mode);
        }
      } catch {}
      try { const all = await getAllWorkouts(); if (active) setWorkouts(all || []); } catch {}
    })();
    return () => { active = false; };
  }, []);

  const latest = useMemo(() => (checkins.length ? checkins[checkins.length - 1] : null), [checkins]);
  const hasToday = !!(latest && sameDay(latest.at, new Date().toISOString()));

  // decide initial collapsed/expanded once
  useEffect(() => {
    if (decidedRef.current) return;
    if (expanded === null) {
      setExpanded(!hasToday); // expanded if no check-in yet; collapsed if already checked in
      decidedRef.current = true;
    }
  }, [hasToday, expanded]);

  const saveCheckin = useCallback(async () => {
    try {
      setSaving(true);
      // NEW: persist mode in today's entry
      const entry = { at: new Date().toISOString(), energy: Math.round(energy), sleep: Math.round(sleep), mode };
      const raw = await AsyncStorage.getItem(CHECKIN_KEY);
      let arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) arr = [];
      const today = todayKey();
      const idx = arr.findIndex(x => sameDay(x.at, today));
      if (idx >= 0) arr[idx] = entry; else arr.push(entry);
      await AsyncStorage.setItem(CHECKIN_KEY, JSON.stringify(arr));
      setCheckins(arr);
      setExpanded(false); // collapse after save ✅
      Alert.alert('Saved', `Energy ${entry.energy}/10 • Sleep ${entry.sleep}/10 • Mode ${entry.mode}`);
    } catch (e) {
      Alert.alert('Error', 'Could not save your check-in.');
    } finally {
      setSaving(false);
    }
  }, [energy, sleep, mode]);

  // weekly stats + streaks
  const weekStats = useMemo(() => {
    const now = Date.now(), weekMs = 7*24*60*60*1000;
    const thisWeek = (workouts || []).filter(w => (w.startedAt || 0) >= (now - weekMs));
    const lastWeek = (workouts || []).filter(w => (w.startedAt || 0) >= (now - 2*weekMs) && (w.startedAt || 0) < (now - weekMs));

    const count = thisWeek.length, prevCount = lastWeek.length;
    const countDelta = prevCount ? Math.round(((count - prevCount) / prevCount) * 100) : (count > 0 ? 100 : 0);

    const dur = thisWeek.reduce((a, w) => a + summarizeWorkout(w).minutes, 0);
    const prevDur = lastWeek.reduce((a, w) => a + summarizeWorkout(w).minutes, 0);
    const durDelta = prevDur ? Math.round(((dur - prevDur) / prevDur) * 100) : (dur > 0 ? 100 : 0);

    // streak
    const byDay = new Set(thisWeek.map(w => startOfDay(w.startedAt || Date.now())));
    let curStreak = 0;
    const buckets = weekBuckets(14); // newest-first
    for (let i = 0; i < buckets.length; i++) {
      const day = buckets[i];
      if (byDay.has(day)) curStreak += 1;
      else if (i === 0) curStreak = 0;
      else break;
    }
    const record = longestStreakByDay(workouts);

    return { count, countDelta, dur, durDelta, curStreak, record, newRecord: curStreak > 0 && curStreak >= record };
  }, [workouts]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingHorizontal: layout.screenHMargin,
        paddingTop: spacing(2),
        paddingBottom: spacing(4),
        gap: spacing(2), // <-- margins/spacing unchanged
      }}
    >
      {/* Header — unchanged */}
      <LinearGradient colors={['#6a5cff', '#4ac3ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <Text style={styles.title}>Wellness</Text>
        <Text style={styles.subtitle}>Your daily readiness & guidance</Text>
      </LinearGradient>

      {/* 1) Daily Check-In */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>
          {hasToday ? `How you're feeling today` : `How are you feeling today, ${name}?`}
        </Text>

        {/* Collapsed summary (no sliders, no button). Tap to expand. */}
        {expanded === false && hasToday && (
          <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" style={{ paddingVertical: spacing(1) }}>
            <Text style={{ color: palette.text, fontWeight: '800' }}>
              {/* NEW: include Mode in summary */}
              Energy ⚡️ {latest.energy}/10    Sleep 🌙 {latest.sleep}/10     Mode 🍽️ {String(latest.mode || mode).replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
            <Text style={{ color: palette.sub, marginTop: 4, fontSize: 12 }}>Tap to adjust</Text>
          </Pressable>
        )}

        {/* Expanded state (sliders + Mode + Save). Keeps your layout/margins intact. */}
        {expanded !== false && (
          <>
            <View style={{ height: spacing(1) }} />

            <Text style={styles.label}>How energetic do you feel?</Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderHint}>Low</Text>
              <Slider
                style={{ flex: 1, height: 40 }}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={energy}
                onValueChange={setEnergy}
                minimumTrackTintColor="#6a5cff"
                maximumTrackTintColor="#d1d5db"
                thumbTintColor="#6a5cff"
              />
              <Text style={styles.sliderHint}>High</Text>
            </View>

            <View style={{ height: spacing(1.25) }} />

            <Text style={styles.label}>How well did you sleep?</Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderHint}>Poor</Text>
              <Slider
                style={{ flex: 1, height: 40 }}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={sleep}
                onValueChange={setSleep}
                minimumTrackTintColor="#6a5cff"
                maximumTrackTintColor="#d1d5db"
                thumbTintColor="#6a5cff"
              />
              <Text style={styles.sliderHint}>Best</Text>
            </View>

            {/* NEW: Mode selector (keeps same spacing cadence) */}
            <View style={{ height: spacing(1.25) }} />
            <Text style={styles.label}>Nutrition / Body Goal</Text>
            <View style={styles.modeRow}>
              {['fasting','maintenance','bulking'].map(opt => (
                <Pressable
                  key={opt}
                  onPress={() => setMode(opt)}
                  style={[styles.chip, mode === opt && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === opt }}
                >
                  <Text style={[styles.chipText, mode === opt && styles.chipTextSelected]}>
                    {opt[0].toUpperCase() + opt.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ height: spacing(1.5) }} />
            <GradientButton title={saving ? 'Saving…' : 'Save for Today'} onPress={saveCheckin} disabled={saving} />
          </>
        )}
      </Card>

      {/* 2) Rep.AI Insights & Recommendations (inline block unchanged) */}
      <RepAiInsights name={name} latestCheckin={latest} workouts={workouts} />

      {/* 3) This Week’s Activity */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>This Week’s Activity</Text>
        <View style={{ height: 8 }} />
        <View style={{ flexDirection: 'row', gap: spacing(1) }}>
          <View style={{ flex: 1 }}>
            <StatCard
              label="Workouts"
              value={String(weekStats.count)}
              sublabel={`${weekStats.countDelta >= 0 ? '+' : ''}${weekStats.countDelta}% from last week`}
              footer=""
            />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard
              label="Total Duration"
              value={String(weekStats.dur)}
              sublabel="Minutes"
              footer={`${weekStats.durDelta >= 0 ? '+' : ''}${weekStats.durDelta}% from last week`}
            />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard
              label="Streak"
              value={String(weekStats.curStreak)}
              sublabel="Days"
              footer={weekStats.newRecord ? '🔥 New record!' : ''}
            />
          </View>
        </View>
      </Card>

      {/* 4) REPLACED: Steps widget -> AI.Rep Insights widget (keeps same Card wrapper to preserve spacing) */}
      <Card>
        <RepAIWellnessInsightsWidget name={name} latestCheckin={latest} workouts={workouts} mode={mode} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    borderRadius: 16,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2),
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 4, fontSize: 14 },

  sectionTitle: { color: palette.text, fontSize: 20, fontWeight: '800' },

  label: { color: palette.text, fontWeight: '800' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderHint: { color: palette.sub, width: 40, textAlign: 'center' },

  insightCard: {
    width: 240,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  insightTitle: { color: palette.text, fontWeight: '800', marginBottom: 4 },
  insightLine: { color: palette.text },
  insightBody: { color: palette.sub, marginTop: 2 },

  // NEW: tiny style block for Mode chips (no global spacing changes)
  modeRow: { flexDirection:'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chip: { paddingVertical:8, paddingHorizontal:12, borderRadius:12, borderWidth:1, borderColor: palette.border, backgroundColor: 'transparent' },
  chipSelected: { backgroundColor: palette.accent + '22', borderColor: palette.accent },
  chipText: { color: palette.text, fontWeight:'600' },
  chipTextSelected: { color: palette.accent, fontWeight:'800' },
});
