// components/insights/RepAiAnalysisWidget.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';
import { getAllWorkouts } from '../../store/workoutStore';

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
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 37, g: 99, b: 235 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/**
 * Rep.AI Insights Widget
 * Props:
 *  - group: 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Abs'
 *  - rangeDays?: number (default 90)
 *  - accentColor?: string (hex). If omitted, uses color by group.
 */
export default function RepAiAnalysisWidget({ group, rangeDays = 90, accentColor }) {
  const accent = accentColor || GROUP_META[group]?.color || '#2563eb';
  const { r, g, b } = hexToRgb(accent);

  const [metrics, setMetrics] = useState({
    totalVolume: 0,
    sessions: 0,
    prs: 0,
    acwr: null, // Acute: last 7d / Chronic weekly: last 28d avg
  });

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
            const reps   = Number(s?.reps) || 0;
            if (weight <= 0 || reps <= 0) return;

            const vol = weight * reps;
            const e1  = epley(weight, reps);
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

      // ACWR
      const acuteStart = end - 6 * dayMs;
      const chronicStart = end - 27 * dayMs;
      let acute = 0, chronicTotal = 0;
      for (let i = 0; i < 7; i++) acute += byDay.get(acuteStart + i * dayMs) || 0;
      for (let i = 0; i < 28; i++) chronicTotal += byDay.get(chronicStart + i * dayMs) || 0;
      const chronicWeekly = chronicTotal / 4;
      const acwr = chronicWeekly > 0 ? (acute / chronicWeekly) : null;

      if (active) setMetrics({ totalVolume, sessions, prs, acwr });
    })();
    return () => { active = false; };
  }, [group, rangeDays]);

  const items = useMemo(() => {
    const arr = [];
    const { totalVolume, prs, acwr } = metrics;

    // Readiness / Load
    if (acwr == null) arr.push('📊 Not enough recent data for ACWR. Log a few more sessions for precise load guidance.');
    else if (acwr < 0.8) arr.push('🧭 Load is below recent average. Add 1–2 working sets for this group this week.');
    else if (acwr <= 1.3) arr.push('✅ Load is balanced. Good to progress—keep the momentum going!');
    else if (acwr <= 1.5) arr.push('⚠️ Load trending high. Monitor fatigue; consider a slight volume reduction.');
    else arr.push('🛑 ACWR is very high. Plan a deload or cut volume to reduce injury risk.');

    // PRs
    if (prs > 0) arr.push(`🏆 ${prs} new PR${prs === 1 ? '' : 's'} for ${group} this period—great work!`);
    else arr.push(`💡 No new PRs for ${group}. Try a top single @ RPE 8, then back-off sets to drive progress.`);

    // Activity nudge
    if (totalVolume === 0) arr.push(`🔁 No ${group.toLowerCase()} work logged in the last ${rangeDays} days. Add a light session to get moving.`);

    return arr;
  }, [metrics, group, rangeDays]);

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>Rep.AI </Text>
      <View style={{ marginTop: 8, gap: 10 }}>
        {items.map((t, i) => (
          <View
            key={i}
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: `rgba(${r},${g},${b},0.08)`,
              borderWidth: 1,
              borderColor: `rgba(${r},${g},${b},0.18)`,
            }}
          >
            <Text style={{ color: palette.text }}>{t}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
