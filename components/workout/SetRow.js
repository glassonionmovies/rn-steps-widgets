// components/workout/SetRow.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, TextInput, Text, Pressable } from 'react-native';
import { palette } from '../../theme';

function epley(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return undefined;
  return Math.round(w * (1 + r / 30) * 10) / 10; // 0.1 precision
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function SetRow({ index, set, onChange, onRemove, prev, units = 'lb', prevDoneAt }) {
  const done = !!set.completedAt;

  const [w, setW] = useState(String(set.weight ?? ''));
  const [r, setR] = useState(String(set.reps ?? ''));

  useEffect(() => {
    const weight = Number(w);
    const reps = Number(r);
    const est1RM = epley(weight, reps);
    onChange?.({
      weight: isNaN(weight) ? 0 : weight,
      reps: isNaN(reps) ? 0 : reps,
      est1RM,
    });
  }, [w, r]);

  const curr1RM = useMemo(() => epley(Number(w), Number(r)), [w, r]);

  // previous set info (matched by index, from previous workout)
  const prevWeight = Number(prev?.weight) || 0;
  const prevReps = Number(prev?.reps) || 0;
  const prev1RM = prevWeight > 0 && prevReps > 0 ? epley(prevWeight, prevReps) : undefined;

  const unitLabel = units === 'lb' ? 'lbs' : 'kg';

  let deltaStr = '—';
  let deltaColor = '#16a34a'; // green
  if (prev1RM && curr1RM) {
    const deltaPct = ((curr1RM - prev1RM) / prev1RM) * 100;
    deltaStr = `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`;
    deltaColor = deltaPct < 0 ? '#ef4444' : '#16a34a';
  }

  // derive rest label (prefer stored restMs; else compute from completedAt & prevDoneAt)
  const restMs = set.restMs ?? (set.completedAt && prevDoneAt ? set.completedAt - prevDoneAt : 0);
  const restLabel = formatDuration(restMs);

  const inputBase = {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  };
  const inputStyle = done
    ? { ...inputBase, backgroundColor: '#E5E7EB', borderColor: '#CBD5E1', fontWeight: '700' }
    : { ...inputBase, backgroundColor: '#FFFFFF', borderColor: '#e5e7eb' };

  const iconButtonStyle = {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: done ? '#CBD5E1' : '#e5e7eb',
    backgroundColor: done ? '#E5E7EB' : 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={{ paddingVertical: 8 }}>
      {/* Top row: index, inputs, actions */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          padding: 8,
          borderRadius: 14,
          borderWidth: done ? 1 : 0,
          borderColor: done ? '#CBD5E1' : 'transparent',
          backgroundColor: done ? '#F1F5F9' : 'transparent',
        }}
      >
        <Text style={{ width: 28, fontSize: 12, opacity: 0.6 }}>{index + 1}</Text>

        {/* Inputs */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            keyboardType="numeric"
            value={w}
            onChangeText={setW}
            placeholder="kg/lb"
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, minWidth: 120, color: palette.text, ...inputStyle }}
          />
          <TextInput
            keyboardType="numeric"
            value={r}
            onChangeText={setR}
            placeholder="reps"
            placeholderTextColor="#9CA3AF"
            style={{ width: 100, color: palette.text, ...inputStyle }}
          />
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* ✓ marks done; stores completedAt and restMs (based on prevDoneAt) */}
          <Pressable
            onPress={() => {
              const now = Date.now();
              const rest = prevDoneAt ? now - prevDoneAt : undefined;
              onChange?.({ completedAt: now, restMs: rest });
            }}
            style={iconButtonStyle}
          >
            <Text style={{ fontSize: 22 }}>✓</Text>
          </Pressable>

          {/* ✕ delete */}
          <Pressable onPress={onRemove} style={iconButtonStyle}>
            <Text style={{ fontSize: 20 }}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom row: Prev, 1RM, Δ%, Rest */}
      <View style={{ marginLeft: 36, marginTop: 8, flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 12, opacity: 0.85, fontWeight: done ? '700' : '500' }}>
          {prev1RM ? `Prev: ${prevWeight} ${unitLabel} × ${prevReps}` : 'Prev: —'}
        </Text>
        <Text style={{ fontSize: 12, opacity: 0.85, fontWeight: done ? '700' : '500' }}>
          1RM: {curr1RM ? curr1RM : '—'}
        </Text>
        <Text style={{ fontSize: 12, color: deltaColor, fontWeight: done ? '800' : '700' }}>
          Δ {deltaStr}
        </Text>
        <Text style={{ fontSize: 12, opacity: 0.85, fontWeight: done ? '800' : '600' }}>
          Rest {restLabel}
        </Text>
      </View>
    </View>
  );
}
