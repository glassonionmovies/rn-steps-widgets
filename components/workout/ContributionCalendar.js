// components/workout/ContributionCalendar.js
import React, { useMemo } from 'react';
import { View } from 'react-native';

export default function ContributionCalendar({ days = 90, dayValues = new Map(), color = '#2563eb', cell = 12, gap = 3 }) {
  // Build columns per week, rows per weekday
  const cols = Math.ceil(days / 7);
  const today = new Date(); today.setHours(0,0,0,0);

  const grid = useMemo(() => {
    // Build array of last `days` dates
    const arr = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const val = Number(dayValues.get(key) || 0);
      arr.push({ date: d, key, val });
    }
    // normalize to 0..1 for color intensity
    const max = Math.max(1, ...arr.map(a => a.val));
    arr.forEach(a => { a.intensity = max ? (a.val / max) : 0; });
    return arr;
  }, [days, dayValues]);

  function rgba(hex, alpha) {
    const h = hex.replace('#','');
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
    }

  return (
    <View style={{ flexDirection: 'row', gap }}>
      {Array.from({ length: cols }).map((_, ci) => (
        <View key={ci} style={{ gap }}>
          {Array.from({ length: 7 }).map((_, ri) => {
            const idx = ci * 7 + ri;
            const a = grid[idx];
            const alpha = a ? (a.intensity * 0.8 + 0.15) : 0.15; // keep faint baseline
            return (
              <View
                key={ri}
                style={{
                  width: cell, height: cell, borderRadius: 3,
                  backgroundColor: rgba(color, a ? alpha : 0.15),
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
