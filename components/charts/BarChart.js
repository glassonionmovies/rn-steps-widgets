// components/charts/BarChart.js
import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';

function niceAxis(values) {
  const max = Math.max(1, ...values.map(v => Number(v) || 0));
  const niceMax = Math.ceil(max / 1000) * 1000 || 1000;        // round up to nearest 1k
  const step = Math.max(1000, Math.ceil(niceMax / 3 / 1000) * 1000);
  const ticks = [0, step, step * 2, step * 3];
  return { max: step * 3, ticks };
}
const fmtK = (n) => `${Math.round((Number(n) || 0) / 1000)}k`;

export default function BarChart({ labels = [], values = [] }) {
  const [{ w, h }, setSize] = useState({ w: 0, h: 0 });
  const axis = useMemo(() => niceAxis(values), [values]);

  const AXIS_W = 34;   // space for y labels
  const BOT_H = 18;    // space for x labels

  const innerW = Math.max(0, w - AXIS_W - 8);
  const innerH = Math.max(0, h - BOT_H - 8);

  const bars = useMemo(() => {
    return labels.map((label, i) => {
      const v = Number(values[i]) || 0;
      const hPct = Math.min(100, (v / axis.max) * 100);
      return { label, value: v, heightPct: `${hPct}%`, key: `${label}-${i}` };
    });
  }, [labels, values, axis.max]);

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
      style={{ height: 220, width: '100%' }}
    >
      {/* Axes + grid */}
      <View style={{ position: 'absolute', left: AXIS_W, top: 0, right: 0, bottom: BOT_H }}>
        {/* Horizontal grid lines */}
        {axis.ticks.map((t, idx) => {
          const y = innerH - (innerH * t) / axis.max;
          return (
            <View
              key={`grid-${idx}`}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: y,
                height: 1,
                backgroundColor: '#E5E7EB',
              }}
            />
          );
        })}
      </View>

      {/* Y labels */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: AXIS_W, bottom: BOT_H }}>
        {axis.ticks.map((t, idx) => {
          const y = innerH - (innerH * t) / axis.max;
          return (
            <Text
              key={`ylab-${idx}`}
              style={{
                position: 'absolute', right: 4, top: y - 7,
                fontSize: 10, color: '#6B7280',
              }}
            >
              {fmtK(t)}
            </Text>
          );
        })}
      </View>

      {/* Bars + X labels */}
      <View style={{ position: 'absolute', left: AXIS_W, right: 0, bottom: 0, height: innerH + BOT_H }}>
        <View style={{ height: innerH, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 8 }}>
          {bars.map(b => (
            <View key={b.key} style={{ alignItems: 'center', width: Math.max(20, innerW / (bars.length * 1.25)) }}>
              <View style={{ width: 20, height: b.heightPct, backgroundColor: '#06b6d4', borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
            </View>
          ))}
        </View>
        <View style={{ height: BOT_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }}>
          {labels.map((lab, i) => (
            <Text key={`x-${i}`} style={{ fontSize: 10, color: '#6B7280' }}>{lab}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}
