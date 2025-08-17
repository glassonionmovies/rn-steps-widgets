// components/charts/VolumeReportCard.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';
import { getAllWorkouts } from '../../store/workoutStore';

const CHART_HEIGHT = 180; // match Activity height (~75% of old)
const AXIS_W = 34;
const BOT_H = 18;
const fmtK = (n) => `${Math.round((Number(n) || 0) / 1000)}k`;
const isNum = (n) => Number.isFinite(n);

function niceAxis(values) {
  const max = Math.max(1, ...values.filter(isNum), 1);
  const niceMax = Math.ceil(max / 1000) * 1000 || 1000;
  const step = Math.max(1000, Math.ceil(niceMax / 3 / 1000) * 1000);
  const ticks = [0, step, step * 2, step * 3];
  return { max: step * 3, ticks };
}
function startOfWeek(ts) {
  const d = new Date(ts);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day; // start Sun
  d.setDate(diff); d.setHours(0,0,0,0);
  return d.getTime();
}

export default function VolumeReportCard() {
  const [weeks, setWeeks] = useState({ labels: [], values: [] });

  useEffect(() => {
    let active = true;
    (async () => {
      const all = await getAllWorkouts();
      const volsByWeek = new Map();

      (all || []).forEach((w) => {
        const wk = startOfWeek(w.startedAt || Date.now());
        const vol = (w.blocks || []).reduce(
          (acc, b) => acc + (b.sets || []).reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0),
          0
        );
        volsByWeek.set(wk, (volsByWeek.get(wk) || 0) + vol);
      });

      // last 8 weeks (including current)
      const now = new Date(); now.setHours(0,0,0,0);
      const thisWk = startOfWeek(now.getTime());
      const weeksArr = [];
      for (let i = 7; i >= 0; i--) {
        const wkStart = thisWk - i * 7 * 24 * 60 * 60 * 1000;
        const d = new Date(wkStart);
        weeksArr.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: Math.round(volsByWeek.get(wkStart) || 0),
        });
      }

      if (active) {
        setWeeks({
          labels: weeksArr.map(x => x.label),
          values: weeksArr.map(x => x.value),
        });
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800', marginBottom: spacing(1) }}>
        Volume Report
      </Text>
      <BarChart labels={weeks.labels} points={weeks.values} />
      {weeks.values.every(v => (Number(v) || 0) === 0) && (
        <Text style={{ color: palette.sub, marginTop: 6, fontSize: 12 }}>
          No workouts in the last 8 weeks.
        </Text>
      )}
    </Card>
  );
}

function BarChart({ labels, points }) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const innerW = Math.max(0, size.w - AXIS_W - 8);
  const innerH = Math.max(0, size.h - BOT_H - 8);
  const axis = useMemo(() => niceAxis(points || []), [points]);

  const n = Math.min(labels.length, points.length);
  const gap = 10;
  const barW = n > 0 ? Math.max(10, (innerW - gap * (n - 1)) / n) : 0;

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
      style={{ height: CHART_HEIGHT, width: '100%' }}
    >
      {/* grid */}
      <View style={{ position: 'absolute', left: AXIS_W, top: 0, right: 0, bottom: BOT_H }}>
        {axis.ticks.map((t, idx) => {
          const y = innerH - (innerH * t) / axis.max;
          return (
            <View key={`g-${idx}`} style={{ position: 'absolute', left: 0, right: 0, top: y, height: 1, backgroundColor: '#E5E7EB' }} />
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
              <View style={{ width: barW, height: h, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#2563eb' }} />
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
