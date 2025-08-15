// components/workout/SetRow.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, TextInput, Text, Pressable } from 'react-native';

function epley(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return undefined;
  return Math.round(w * (1 + r / 30) * 10) / 10; // 0.1 precision
}

export default function SetRow({ index, set, onChange, onRemove }) {
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

  const est = useMemo(() => epley(Number(w), Number(r)), [w, r]);

  const inputStyle = {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  };

  const iconButtonStyle = {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
          opacity: done ? 0.6 : 1,
        }}
      >
        <Text style={{ width: 28, fontSize: 12, opacity: 0.6 }}>{index + 1}</Text>

        {/* Inputs block */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Weight: larger */}
          <TextInput
            keyboardType="numeric"
            value={w}
            onChangeText={setW}
            placeholder="kg/lb"
            style={{ flex: 1, minWidth: 120, ...inputStyle }}
          />
          {/* Reps */}
          <TextInput
            keyboardType="numeric"
            value={r}
            onChangeText={setR}
            placeholder="reps"
            style={{ width: 100, ...inputStyle }}
          />
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Bigger ✓ to mark done (greys out but still editable) */}
          <Pressable
            onPress={() => onChange?.({ completedAt: Date.now() })}
            style={iconButtonStyle}
          >
            <Text style={{ fontSize: 20 }}>✓</Text>
          </Pressable>

          {/* Delete */}
          <Pressable onPress={onRemove} style={iconButtonStyle}>
            <Text style={{ fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom row: Est. 1RM under the inputs */}
      <View style={{ marginLeft: 28, marginTop: 6 }}>
        <Text style={{ fontSize: 12, opacity: 0.6 }}>
          {est ? `Est. 1RM: ${est}` : ' '}
        </Text>
      </View>
    </View>
  );
}
