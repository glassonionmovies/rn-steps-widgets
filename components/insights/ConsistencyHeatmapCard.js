// components/insights/ConsistencyHeatmapCard.js
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
const dayMs = 24 * 60 * 60 * 1000;

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return { r: 37, g: 99, b: 235 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/**
 * Props:
 *  - title: string
 *  - byDay: Map<number, number> | Record<number, number>
 *  - color: string (hex)
 *  - group: string | null
 *  - days: number (default 90)
 *  - hint: string | (group) => string
 */
export default function ConsistencyHeatmapCard({
  title = 'Workout Consistency',
  byDay,
  color = '#2563eb',
  group,
  days = 90,
  hint = (g) => `Darker = more ${(g || 'muscle').toLowerCase()} volume that day`,
}) {
  // Normalize byDay to a Map
  const byDayMap = useMemo(() => {
    if (byDay instanceof Map) return byDay;
    if (byDay && typeof byDay === 'object') {
      const m = new Map();
      Object.keys(byDay).forEach((k) => m.set(Number(k), Number(byDay[k]) || 0));
      return m;
    }
    return new Map();
  }, [byDay]);

  const { r, g, b } = hexToRgb(color);

  // Build a weeks x 7 matrix covering the "days" window
  const matrix = useMemo(() => {
    const weeks = Math.max(1, Math.ceil(days / 7));
    const rows = 7;
    const end = startOfDay(Date.now());
    const start = end - (weeks * rows - 1) * dayMs;

    const cols = [];
    let maxVol = 1;
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let d = 0; d < rows; d++) {
        const ts = start + (w * rows + d) * dayMs;
        const v = byDayMap.get(ts) || 0;
        if (v > maxVol) maxVol = v;
        col.push({ ts, v });
      }
      cols.push(col);
    }

    return { cols, maxVol };
  }, [byDayMap, days]);

  const tone = (v, maxVol) => {
    if (v <= 0) return 'rgba(0,0,0,0.06)';
    const p = Math.min(1, v / maxVol);
    const a = 0.12 + 0.70 * p;
    return `rgba(${r},${g},${b},${a.toFixed(2)})`;
  };

  return (
    <Card style={{ padding: spacing(2) }}>
      {/* Header: title on left, small grey metadata right-aligned */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing(1),
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
        </View>
        <Text style={{ color: palette.sub, fontSize: 12 }}>
          {group ? `${group} · ${days} days` : `${days} days`}
        </Text>
      </View>

      {/* Heatmap */}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {matrix.cols.map((col, i) => (
          <View key={`wk-${i}`} style={{ flexDirection: 'column', gap: 4 }}>
            {col.map((cell, j) => (
              <View
                key={`c-${i}-${j}`}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: tone(cell.v, matrix.maxVol),
                }}
              />
            ))}
          </View>
        ))}
      </View>

      <Text style={{ color: palette.sub, marginTop: 6, fontSize: 11 }}>
        {typeof hint === 'function' ? hint(group) : hint}
      </Text>
    </Card>
  );
}
