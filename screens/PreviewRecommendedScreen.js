// screens/PreviewRecommendedScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import WorkoutSessionPreviewCard from '../components/workout/WorkoutSessionPreviewCard';

import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadOpenAISettings, buildHistorySummary, recommendPlan } from '../services/llmCompat';
import { normalizePlan } from '../utils/planNormalize';

const LLM_CACHE_KEY = 'repai:last_llm_plan_v1';
const CHECKIN_KEY = 'wellness:checkins';

const isoToday = () => new Date().toISOString().slice(0, 10);
const sameDay = (a, b) => (a || '').slice(0, 10) === (b || '').slice(0, 10);

// UI bits
function cap(s) { if (!s) return ''; const str = String(s); return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(); }
function platformMono() { if (Platform.OS === 'ios') return 'Menlo'; if (Platform.OS === 'android') return 'monospace'; return 'monospace'; }
function Mono({ children }) { return <Text style={{ color: palette.text, fontFamily: platformMono(), fontSize: 12, lineHeight: 18 }}>{children}</Text>; }
function Chip({ label, selected, onPress, emoji }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}>
      {emoji ? <Text style={{ marginRight: 6 }}>{emoji}</Text> : null}
      <Text style={[styles.chipText, selected ? styles.chipTextOn : styles.chipTextOff]}>{label}</Text>
    </Pressable>
  );
}

// Robust vitals reader: prefer today's entry; fallback to last entry if today missing.
// Coerces string/number → number and preserves zeros.
async function readVitalsFromCheckins() {
  let energy, sleep, mode, weightLb;

  try {
    const raw = await AsyncStorage.getItem(CHECKIN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr) && arr.length) {
      const today = isoToday();

      // 1) Try today's entry (scan from end for safety)
      let idxToday = -1;
      for (let i = arr.length - 1; i >= 0; i--) {
        const e = arr[i];
        if (e?.at && sameDay(e.at, today)) { idxToday = i; break; }
      }

      const pick = idxToday >= 0 ? arr[idxToday] : arr[arr.length - 1]; // 2) fallback: most recent entry
      if (pick) {
        const eNum = Number(pick.energy);
        if (Number.isFinite(eNum)) energy = eNum;

        const sNum = Number(pick.sleep);
        if (Number.isFinite(sNum)) sleep = sNum;

        if (typeof pick.mode === 'string') mode = pick.mode;

        const wNum = Number(pick.weightLb);
        if (Number.isFinite(wNum)) weightLb = wNum;
      }
    }
  } catch {}

  // Return only defined fields
  const out = {};
  if (energy !== undefined) out.energy = energy;
  if (sleep !== undefined) out.sleep = sleep;
  if (mode !== undefined) out.mode = mode;
  if (weightLb !== undefined) out.weightLb = weightLb;
  return out;
}

export default function PreviewRecommendedScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Customize controls
  const [minutes, setMinutes] = useState(50);
  const [intensity, setIntensity] = useState('medium');
  const [goal, setGoal] = useState('hypertrophy');
  const [equip, setEquip] = useState(['barbell','dumbbell','machine','cable','bodyweight']);
  const [notes, setNotes] = useState('');
  const [splitOverride, setSplitOverride] = useState(null); // "upper" | "lower" | null

  // State
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState(null);

  // Route vitals (optional extras from other screens)
  const vitalsFromRoute = useMemo(() => {
    const r = route?.params || {};
    return {
      // handle nested readiness if present
      energy: r?.readiness?.energy ?? r?.energy,
      sleep: r?.readiness?.sleep ?? r?.sleep ?? r?.sleepQuality,
      mode: r?.mode,
      weightLb: r?.weightLb,
    };
  }, [route?.params]);

  const toggleEquip = (key) => {
    setEquip((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return Array.from(s);
    });
  };

  const loadCachedPlan = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(LLM_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.plan) {
        setPlan(parsed.plan);
        setLastGeneratedAt(parsed.generatedAt || null);
      }
    } catch {}
  }, []);

  const saveCachedPlan = useCallback(async (p) => {
    try {
      const payload = { generatedAt: Date.now(), plan: p };
      await AsyncStorage.setItem(LLM_CACHE_KEY, JSON.stringify(payload));
      setLastGeneratedAt(payload.generatedAt);
    } catch {}
  }, []);

  const isEmptyObj = (o) => !o || typeof o !== 'object' || Object.keys(o).length === 0;

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { apiKey, model, endpoint } = await loadOpenAISettings();
      if (!apiKey) throw new Error('Missing OpenAI API key (check Setup screen or app config).');

      // --- history/units ---
      const history = await getAllWorkouts();
      const units = (history?.[0]?.units === 'kg') ? 'kg' : 'lb';
      const historySummary = buildHistorySummary(history);

      // --- vitals: authoritative read from check-ins + merge route; ALWAYS include energy/sleep if available
      const storedVitals = await readVitalsFromCheckins();

      const merged = { ...(storedVitals || {}) };
      // overlay route only if provided (preserving zeros)
      if (vitalsFromRoute?.energy !== undefined) merged.energy = Number(vitalsFromRoute.energy);
      if (vitalsFromRoute?.sleep !== undefined) merged.sleep = Number(vitalsFromRoute.sleep);
      if (typeof vitalsFromRoute?.mode === 'string') merged.mode = vitalsFromRoute.mode;
      if (vitalsFromRoute?.weightLb !== undefined) merged.weightLb = Number(vitalsFromRoute.weightLb);

      const vitalsResolved = isEmptyObj(merged) ? {} : merged;

      // --- split: "No preference" when nothing selected
      const prefsSplit = splitOverride ? splitOverride : 'No preference';

      const prefs = {
        goal,
        split: prefsSplit,
        timeBudgetMin: minutes,
        equipment: [...equip],
        units,
        intensity,
        comment: notes,
        constraints: {},
      };

      // For absolute clarity, log the vitals we're about to send:
      console.log('[PreviewRecommended] VITALS GOING TO LLM:', JSON.stringify(vitalsResolved));

      const out = await recommendPlan({
        prefs,
        vitals: vitalsResolved,   // << pass through
        historySummary,
        apiKey,
        model,
        endpoint,
      });

      const llmPlan = out?.plan || out;
      const normalized = normalizePlan(llmPlan);
      if (!normalized) throw new Error('Plan could not be generated.');

      setPlan(normalized);
      await saveCachedPlan(normalized);
    } catch (e) {
      console.error('Plan generation failed:', e);
      setError(e?.message || 'Failed to generate plan.');
    } finally {
      setLoading(false);
    }
  }, [minutes, goal, equip, intensity, notes, vitalsFromRoute, splitOverride, saveCachedPlan]);

  useEffect(() => { loadCachedPlan(); }, [loadCachedPlan]);

  const startThisPlan = () => {
    if (!plan) return;
    navigation.navigate('Train', {
      screen: 'TrackWorkout',
      params: {
        template: {
          name: plan.name,
          units: plan.units,
          blocks: (plan.blocks || []).map((b) => ({
            exercise: b.exercise,
            sets: (b.sets || []).map((s) => ({ weight: s.weight, reps: s.reps })),
          })),
        },
      },
    });
  };

  const lastGenLabel = lastGeneratedAt ? `Last generated ${new Date(lastGeneratedAt).toLocaleString()}` : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingHorizontal: layout.screenHMargin,
        paddingTop: spacing(2),
        paddingBottom: spacing(4),
        rowGap: spacing(2),
      }}
    >
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.h1}>Customize</Text>

        <View style={styles.row}>
          <Text style={styles.label}>⏱ Time (min)</Text>
          <TextInput value={String(minutes)} onChangeText={(t) => setMinutes(Number(t) || 0)} keyboardType="numeric" style={styles.input} />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>🔥 Intensity</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['low','medium','high'].map((lvl) => (
              <Chip key={lvl} label={cap(lvl)} emoji={lvl==='low'?'🟢':lvl==='medium'?'🟡':'🔴'} selected={intensity===lvl} onPress={() => setIntensity(lvl)} />
            ))}
          </View>
        </View>

        <View style={{ height: spacing(1) }} />
        <View style={styles.row}>
          <Text style={[styles.label, styles.labelTop]}>🎯 Goal</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['hypertrophy','strength','endurance'].map((g) => (
              <Chip key={g} label={cap(g)} selected={goal===g} onPress={() => setGoal(g)} />
            ))}
          </View>
        </View>

        <View style={{ height: spacing(1) }} />
        <View style={styles.row}>
          <Text style={[styles.label, styles.labelTop]}>🪓 Split (optional)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['upper','lower'].map((opt) => (
              <Chip key={opt} label={cap(opt)} selected={splitOverride === opt} onPress={() => setSplitOverride(splitOverride === opt ? null : opt)} />
            ))}
          </View>
          {!splitOverride && (
            <Text style={{ color: palette.sub, marginTop: 6, fontSize: 12 }}>
              Split: <Text style={{ fontWeight: '800', color: palette.text }}>No preference</Text>
            </Text>
          )}
        </View>

        <View style={{ height: spacing(1) }} />
        <View style={styles.row}>
          <Text style={[styles.label, styles.labelTop]}>🏋 Equipment</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['barbell','dumbbell','machine','cable','bodyweight'].map((e) => (
              <Chip key={e} label={cap(e)} selected={equip.includes(e)} onPress={() => {
                setEquip(prev => {
                  const s = new Set(prev);
                  if (s.has(e)) s.delete(e); else s.add(e);
                  return Array.from(s);
                });
              }} />
            ))}
          </View>
        </View>

        <TextInput
          placeholder="Any notes or preferences?"
          placeholderTextColor="#9CA3AF"
          style={[styles.input, { marginTop: spacing(1), height: 60 }]}
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <View style={{ marginTop: spacing(1) }}>
          <GradientButton title={loading ? 'Generating…' : 'Generate'} onPress={generate} disabled={loading} />
          {!!lastGenLabel && (
            <Text style={{ color: palette.sub, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
              {lastGenLabel}
            </Text>
          )}
        </View>
      </Card>

      {error && (
        <Card style={{ padding: spacing(2), borderColor: '#F87171', borderWidth: 1 }}>
          <Text style={{ color: '#B91C1C', fontWeight: '900', marginBottom: 4 }}>Error</Text>
          <Text style={{ color: palette.text }}>{error}</Text>
        </Card>
      )}

      {plan && (
        <Card style={{ padding: spacing(2) }}>
          <WorkoutSessionPreviewCard title={plan.name} units={plan.units} blocks={plan.blocks} />
          <View style={{ marginTop: spacing(1) }}>
            <GradientButton title="Start This Plan" onPress={startThisPlan} />
          </View>
        </Card>
      )}

      {plan?.meta?.justification && (
        <Card style={{ padding: spacing(2) }}>
          <Text style={styles.h1}>Why Rep.AI Recommended This</Text>
          <Mono>{plan.meta.justification}</Mono>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 18, fontWeight: '900', color: palette.text, marginBottom: spacing(1) },
  row: { marginTop: spacing(1) },
  label: { color: palette.text, fontWeight: '800', marginBottom: 4 },
  labelTop: { marginTop: spacing(0.5) },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: palette.text,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipOn: { backgroundColor: '#6a5cff', borderColor: '#6a5cff' },
  chipOff: { backgroundColor: '#fff', borderColor: '#D1D5DB' },
  chipText: { fontWeight: '800' },
  chipTextOn: { color: '#fff' },
  chipTextOff: { color: palette.text },
});
