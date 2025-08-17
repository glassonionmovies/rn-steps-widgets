// components/workout/StepperNumber.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, Platform, StyleSheet } from 'react-native';
import { palette, spacing } from '../../theme';

export default function StepperNumber({
  value = 0,
  onChange,
  step = 1,
  min = 0,
  max = 10000,
  large = true,
  onManualOpen, // optional external handler
  testID,
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(String(value ?? 0));
  const holdRef = useRef(null);

  useEffect(() => () => clearInterval(holdRef.current), []);

  const clamp = (n) => Math.max(min, Math.min(max, n));

  const nudge = (delta) => {
    const next = clamp((Number(value) || 0) + delta);
    if (next !== value) onChange?.(next);
  };

  const startHold = (delta) => {
    nudge(delta);
    clearInterval(holdRef.current);
    // small delay then fast repeat
    const first = setTimeout(() => {
      holdRef.current = setInterval(() => nudge(delta), 70);
    }, 220);
    holdRef.current = {
      _id: 'priming',
      clear: () => clearTimeout(first),
    };
  };

  const endHold = () => {
    if (!holdRef.current) return;
    if (holdRef.current.clear) holdRef.current.clear();
    clearInterval(holdRef.current);
    holdRef.current = null;
  };

  const openManual = () => {
    if (onManualOpen) return onManualOpen();
    setManual(String(value ?? 0));
    setManualOpen(true);
  };

  const applyManual = () => {
    const parsed = clamp(Number(manual) || 0);
    onChange?.(parsed);
    setManualOpen(false);
  };

  return (
    <View style={[styles.wrap, large && styles.wrapLg]} testID={testID}>
      <Pressable
        onPress={() => nudge(-step)}
        onPressIn={() => startHold(-step)}
        onPressOut={endHold}
        style={[styles.btn, styles.btnLeft]}
        hitSlop={12}
        accessibilityLabel="decrement"
      >
        <Text style={styles.btnText}>−</Text>
      </Pressable>

      <Pressable onPress={openManual} style={styles.valueBox} hitSlop={6}>
        <Text style={[styles.valueText, large && styles.valueTextLg]}>{value ?? 0}</Text>
      </Pressable>

      <Pressable
        onPress={() => nudge(step)}
        onPressIn={() => startHold(step)}
        onPressOut={endHold}
        style={[styles.btn, styles.btnRight]}
        hitSlop={12}
        accessibilityLabel="increment"
      >
        <Text style={styles.btnText}>＋</Text>
      </Pressable>

      {/* Manual entry modal (simple + lightweight) */}
      <Modal transparent visible={manualOpen} animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 8 }}>Enter value</Text>
            <TextInput
              autoFocus
              value={manual}
              onChangeText={setManual}
              keyboardType={Platform.select({ ios: 'number-pad', android: 'numeric' })}
              returnKeyType="done"
              onSubmitEditing={applyManual}
              style={styles.input}
            />
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <Pressable onPress={() => setManualOpen(false)}><Text style={{ color: palette.sub }}>Cancel</Text></Pressable>
              <Pressable onPress={applyManual}><Text style={{ color: '#2563eb', fontWeight: '700' }}>Set</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  wrapLg: { height: 44, minWidth: 140 },
  btn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  btnLeft: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(0,0,0,0.08)' },
  btnRight:{ borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(0,0,0,0.08)' },
  btnText: { fontSize: 22, color: palette.text, fontWeight: '800' },
  valueBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  valueText: { fontSize: 18, color: palette.text, fontWeight: '800' },
  valueTextLg: { fontSize: 22 },
  modalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.25)', alignItems:'center', justifyContent:'center' },
  modalCard: { width:'80%', borderRadius:12, backgroundColor:'#fff', padding:16 },
  input: {
    borderRadius:10, paddingHorizontal:12, paddingVertical:10, backgroundColor:'#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth, borderColor:'rgba(0,0,0,0.1)', fontSize:18, color:palette.text,
  },
});
