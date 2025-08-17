// screens/MuscleInsightsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import Card from '../components/ui/Card';
import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';

// Reusable widgets
import VolumeReportCard from '../components/insights/VolumeReportCard';
import ConsistencyHeatmapCard from '../components/insights/ConsistencyHeatmapCard';
import RepAIAnalysisWidget from '../components/insights/RepAIAnalysisWidget';
import TopExercisesWidget from '../components/insights/TopExercisesWidget';

// ------------ Constants & helpers ------------
const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs'];

const GROUP_META = {
  Chest:     { color: '#ef4444', emoji: '💪' },
  Back:      { color: '#3b82f6', emoji: '🏋️‍♂️' },
  Shoulders: { color: '#f59e0b', emoji: '🛡️' },
  Arms:      { color: '#a855f7', emoji: '🦾' },
  Legs:      { color: '#22c55e', emoji: '🦵' },
  Abs:       { color: '#10b981', emoji: '🧘‍♂️' },
};

const dayMs = 24 * 60 * 60 * 1000;
const epley = (w, r) => (Number(w)||0) * (1 + (Number(r)||0) / 30);
function startOfDay(ts) { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }

// ------------ Small UI bits (local only) ------------
function GroupChips({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {GROUPS.map((g) => {
        const active = g === value;
        const meta = GROUP_META[g];
        return (
          <Pressable
            key={g}
            onPress={() => onChange?.(g)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? meta.color : '#e5e7eb',
              backgroundColor: active ? `${meta.color}15` : '#fff',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
            <Text style={{ color: active ? meta.color : palette.text, fontWeight: active ? '800' : '600' }}>
              {g}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RangeChips({ value, onChange, options = [30, 60, 90] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((d) => {
        const active = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => onChange?.(d)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? '#6366f1' : '#e5e7eb',
              backgroundColor: active ? '#eef2ff' : '#fff',
            }}
          >
            <Text style={{ color: active ? '#4f46e5' : palette.text, fontWeight: active ? '800' : '600' }}>
              {d} Days
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ACWRPill({ value }) {
  let label = '—';
  let bg = 'rgba(107,114,128,0.12)'; // gray
  let fg = '#374151';
  if (value != null) {
    if (value < 0.8)      { label = value.toFixed(2); bg = 'rgba(245,158,11,0.12)'; fg = '#b45309'; } // low
    else if (value <= 1.3){ label = value.toFixed(2); bg = 'rgba(16,185,129,0.12)'; fg = '#065f46'; } // ok
    else if (value <= 1.5){ label = value.toFixed(2); bg = 'rgba(245,158,11,0.12)'; fg = '#b45309'; } // highish
    else                  { label = value.toFixed(2); bg = 'rgba(239,68,68,0.12)';  fg = '#991b1b'; } // very high
  }
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: bg, borderRadius: 999 }}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: 12 }}>ACWR {label}</Text>
    </View>
  );
}

// ------------ Screen ------------
export default function MuscleInsightsScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const initialGroup =
    (route?.params?.group && GROUPS.includes(route.params.group)) ? route.params.group : 'Chest';

  const [group, setGroup] = useState(initialGroup);
  const [rangeDays, setRangeDays] = useState(90);
  const [selectorsOpen, setSelectorsOpen] = useState(false);

  // KPIs for the header/tiles + inputs for ConsistencyHeatmapCard/RepAIAnalysisWidget
  const [kpi, setKpi] = useState({
    totalVolume: 0,
    sessions: 0,
    acwr: null,
    prs: 0,
    byDay: new Map(),
  });

  const accent = GROUP_META[group].color;

  // Sync header title with emoji
  useEffect(() => {
    navigation.setOptions?.({ title: `${GROUP_META[group].emoji}  ${group} Insights` });
  }, [navigation, group]);

  // Compute KPIs from workouts (screen-specific; charts are encapsulated in widgets)
  useEffect(() => {
    let active = true;
    (async () => {
      const all = await getAllWorkouts();
      const end = startOfDay(Date.now());
      const start = end - (rangeDays - 1) * dayMs;
      const prevStart = start - rangeDays * dayMs;

      const byDay = new Map();
      const bestNow = new Map();
      const bestPrev = new Map();
      let totalVolume = 0;
      let sessions = 0;

      (all || []).forEach((w) => {
        const sDay = startOfDay(w.startedAt || Date.now());
        let sessionVolForGroup = 0;

        (w.blocks || []).forEach((b) => {
          if (b.exercise?.muscleGroup !== group) return;
          (b.sets || []).forEach((s) => {
            const weight = Number(s?.weight) || 0;
            const reps = Number(s?.reps) || 0;
            if (weight <= 0 || reps <= 0) return;

            const vol = weight * reps;
            const e1 = epley(weight, reps);
            const exKey = b.exercise?.name || b.exercise?.id;

            if (sDay >= start && sDay <= end) {
              const cur = bestNow.get(exKey) || 0;
              if (e1 > cur) bestNow.set(exKey, e1);
              sessionVolForGroup += vol;
            } else if (sDay >= prevStart && sDay < start) {
              const prv = bestPrev.get(exKey) || 0;
              if (e1 > prv) bestPrev.set(exKey, e1);
            }
          });
        });

        if (sessionVolForGroup > 0) {
          byDay.set(sDay, (byDay.get(sDay) || 0) + sessionVolForGroup);
          totalVolume += sessionVolForGroup;
          sessions += 1;
        }
      });

      let prs = 0;
      bestNow.forEach((nowVal, key) => {
        const prevVal = bestPrev.get(key) || 0;
        if (nowVal > prevVal && nowVal > 0) prs += 1;
      });

      // ACWR: acute (7d) vs chronic (28d weekly avg)
      const acuteStart = end - 6 * dayMs;
      const chronicStart = end - 27 * dayMs;
      let acute = 0, chronicTotal = 0;
      for (let i = 0; i < 7; i++) acute += byDay.get(acuteStart + i * dayMs) || 0;
      for (let i = 0; i < 28; i++) chronicTotal += byDay.get(chronicStart + i * dayMs) || 0;
      const chronicWeekly = chronicTotal / 4;
      const acwr = chronicWeekly > 0 ? (acute / chronicWeekly) : null;

      if (active) setKpi({ totalVolume, sessions, acwr, prs, byDay });
    })();
    return () => { active = false; };
  }, [group, rangeDays]);

  // Collapsible selector handlers
  const handleGroupChange = (gname) => {
    setGroup(gname);
    try { navigation.setParams?.({ group: gname }); } catch {}
    setSelectorsOpen(false);
  };
  const handleRangeChange = (d) => {
    setRangeDays(d);
    setSelectorsOpen(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: layout.screenHMargin, gap: spacing(2) }}
    >
      {/* Collapsible selectors */}
      {selectorsOpen ? (
        <Card style={{ padding: spacing(2) }}>
          <View style={{ gap: 8 }}>
            <GroupChips value={group} onChange={handleGroupChange} />
            <RangeChips value={rangeDays} onChange={handleRangeChange} options={[30, 60, 90]} />
          </View>
        </Card>
      ) : null}

      {/* Header / Hero — tap to expand selectors */}
      <Pressable onPress={() => setSelectorsOpen(true)}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <LinearGradient
            colors={[`${accent}30`, `${accent}10`]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ padding: spacing(2) }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 26 }}>{GROUP_META[group].emoji}</Text>
                <View>
                  <Text style={{ color: palette.text, fontSize: 18, fontWeight: '900' }}>{group} Insights</Text>
                  <Text style={{ color: 'rgba(0,0,0,0.55)' }}>Tap to change muscle group & days</Text>
                </View>
              </View>
              <ACWRPill value={kpi.acwr} />
            </View>
          </LinearGradient>
        </Card>
      </Pressable>

      {/* KPI Row */}
      <View style={{ flexDirection: 'row', gap: spacing(1) }}>
        <Card style={[styles.kpiCard, { backgroundColor: `${accent}10` }]}>
          <Text style={[styles.kpiLabel, { color: accent }]}>Total Volume</Text>
          <Text style={styles.kpiValue}>{Math.round(kpi.totalVolume).toLocaleString()} lbs</Text>
          <Text style={styles.kpiSub}>Last {rangeDays} days</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={[styles.kpiLabel, { color: accent }]}>Workouts</Text>
          <Text style={styles.kpiValue}>{kpi.sessions}</Text>
          <Text style={styles.kpiSub}>Completed</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={[styles.kpiLabel, { color: accent }]}>New PRs</Text>
          <Text style={styles.kpiValue}>{kpi.prs}</Text>
          <Text style={styles.kpiSub}>vs prior period</Text>
        </Card>
      </View>

      {/* Volume Report — REUSABLE WIDGET */}
      <VolumeReportCard
        title={`Volume Report — ${group}`}
        group={group}
        days={rangeDays}
        color={accent}
      />

      {/* Rep.AI Analysis — REUSABLE WIDGET */}
      <RepAIAnalysisWidget
        group={group}
        acwr={kpi.acwr}
        prs={kpi.prs}
        totalVolume={kpi.totalVolume}
        days={rangeDays} // safe to pass; widget may ignore if not used
      />

      {/* Consistency Heatmap — REUSABLE WIDGET */}
      <ConsistencyHeatmapCard
        byDay={kpi.byDay}
        color={accent}
        group={group}
        days={rangeDays}
      />

      {/* Top Exercises — REUSABLE WIDGET */}
      <TopExercisesWidget group={group} rangeDays={rangeDays} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kpiCard: { flex: 1, padding: spacing(1.5) },
  kpiLabel: { fontSize: 12, fontWeight: '800' },
  kpiValue: { color: palette.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  kpiSub:   { color: palette.sub, fontSize: 11, marginTop: 2 },
});
