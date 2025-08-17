// components/insights/VolumeReportCard.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';
import { getAllWorkouts } from '../../store/workoutStore';

const dayMs = 24 * 60 * 60 * 1000;
const isNum = (n) => Number.isFinite(n);
const fmtK = (n) => `${Math.round((Number(n) || 0) / 1000)}k`;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfWeek(ts) {
  const d = new Date(ts);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function niceAxis(values) {
  const max = Math.max(1, ...values.filter(isNum), 1);
  const niceMax = Math.ceil(max / 1000) * 1000 || 1000;
  const step = Math.max(1000, Math.ceil(niceMax / 3 / 1000) * 1000);
  const ticks = [0, step, step * 2, step * 3];
  return { max: step * 3, ticks };
}

function BarChart({ labels, points, color = '#2563eb', height = 140 }) {
  const AXIS_W = 34, BOT_H = 18;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const innerW = Math.max(0, size.w - AXIS_W - 8);
  const innerH = Math.max(0, size.h - BOT_H - 8);
  const axis = useMemo(() => niceAxis(points || []), [points]);
  const n = Math.min(labels.length, points.length);
  const gap = 10;
  const barW = n > 0 ? Math.max(10, (innerW - gap * (n - 1)) / n) : 0;

  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ height, width: '100%' }}
    >
      {/* grid */}
      <View style={{ position: 'absolute', left: AXIS_W, top: 0, right: 0, bottom: BOT_H }}>
        {axis.ticks.map((t, idx) => {
          const y = innerH - (innerH * t) / axis.max;
          return (
            <View
              key={`g-${idx}`}
              style={{ position: 'absolute', left: 0, right: 0, top: y, height: 1, backgroundColor: '#E5E7EB' }}
            />
          );
        })}
      </View>

      {/* y labels */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: AXIS_W, bottom: BOT_H }}>
        {axis.ticks.map((t, idx) => {
          const y = innerH - (innerH * t) / axis.max;
          return (
            <Text key={`yl-${idx}`} style={{ position: 'absolute', right: 4, top: y - 7, fontSize: 10, color: '#6B7280' }}>
              {fmtK(t)}
            </Text>
          );
        })}
      </View>

      {/* bars */}
      <View style={{ position: 'absolute', left: AXIS_W, right: 0, bottom: BOT_H, top: 0, flexDirection: 'row', alignItems: 'flex-end' }}>
        {Array.from({ length: n }).map((_, i) => {
          const v = Number(points[i]) || 0;
          const h = Math.max(0, Math.min(innerH, (v / axis.max) * innerH));
          return (
            <View key={`bar-${i}`} style={{ width: barW, marginRight: i === n - 1 ? 0 : gap, alignItems: 'center' }}>
              <View
                style={{
                  width: barW,
                  height: h,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  backgroundColor: color,
                }}
              />
            </View>
          );
        })}
      </View>

      {/* x labels */}
      <View style={{ position: 'absolute', left: AXIS_W, right: 0, bottom: 0, height: BOT_H, flexDirection: 'row' }}>
        {Array.from({ length: n }).map((_, i) => (
          <View key={`xl-${i}`} style={{ width: barW, marginRight: i === n - 1 ? 0 : gap, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#6B7280' }}>{labels[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function VolumeReportCard({
  group = null,            // e.g. 'Chest' or null for all groups
  rangeDays = 90,          // preferred prop name
  days,                    // alias prop (if provided, overrides rangeDays)
  color = '#2563eb',
  title = 'Volume Report',
}) {
  // Use `days` if provided, else `rangeDays`
  const windowDays = typeof days === 'number' ? days : rangeDays;

  const [series, setSeries] = useState({ labels: [], values: [] });

  useEffect(() => {
    let active = true;
    (async () => {
      const all = await getAllWorkouts();

      // Determine how many weekly buckets fit in the selected range
      const weeks = Math.max(4, Math.ceil(windowDays / 7));
      const end = startOfDay(Date.now());
      const start = end - (weeks * 7 - 1) * dayMs;

      const volsByWeek = new Map(); // key = weekStart, val = total volume
      (all || [])
        .filter(w => (w.startedAt || 0) >= start && (w.startedAt || 0) <= end)
        .forEach((w) => {
          const wk = startOfWeek(w.startedAt || Date.now());
          const vol = (w.blocks || []).reduce((acc, b) => {
            if (group && b.exercise?.muscleGroup !== group) return acc;
            const blockVol = (b.sets || []).reduce(
              (s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0),
              0
            );
            return acc + blockVol;
          }, 0);
          volsByWeek.set(wk, (volsByWeek.get(wk) || 0) + vol);
        });

      const thisWk = startOfWeek(end);
      const buckets = [];
      for (let i = weeks - 1; i >= 0; i--) {
        const wkStart = thisWk - i * 7 * dayMs;
        const d = new Date(wkStart);
        buckets.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: Math.round(volsByWeek.get(wkStart) || 0),
        });
      }

      if (active) {
        setSeries({
          labels: buckets.map(b => b.label),
          values: buckets.map(b => b.value),
        });
      }
    })();
    return () => { active = false; };
  }, [group, windowDays]);

  const empty = (series.values || []).every(v => (Number(v) || 0) === 0);

  return (
    <Card style={{ padding: spacing(2) }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing(1) }}>
        <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>
          {title}
        </Text>
        <Text style={{ color: palette.sub, fontSize: 12 }}>
          {group ? `${group} · ${windowDays} days` : `${windowDays} days`}
        </Text>
      </View>

      <BarChart labels={series.labels} points={series.values} color={color} height={140} />

      {empty && (
        <Text style={{ color: palette.sub, marginTop: 6, fontSize: 12 }}>
          No {group ? group.toLowerCase() + ' ' : ''}workouts in the selected window.
        </Text>
      )}
    </Card>
  );
}
