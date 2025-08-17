// components/workout/PlateCalculatorModal.js
import React, { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { palette, spacing } from '../../theme';

const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5];

export default function PlateCalculatorModal({
  visible,
  onClose,
  onDone,
  unit = 'lb',
  plates = DEFAULT_PLATES,
  initialBarWeight = 45,
}) {
  const [barWeight, setBarWeight] = useState(initialBarWeight);
  const [pairs, setPairs] = useState(() => Object.fromEntries(plates.map(p => [p, 0])));

  const total = useMemo(() => {
    const bothSides = Object.entries(pairs).reduce((sum, [p, c]) => sum + Number(p) * 2 * Number(c), 0);
    return Math.round((barWeight + bothSides) * 100) / 100;
  }, [barWeight, pairs]);

  const nudgePair = (plate, delta) => {
    setPairs(prev => {
      const next = { ...prev, [plate]: Math.max(0, Number(prev[plate] || 0) + delta) };
      return next;
    });
  };

  const changeBar = (w) => setBarWeight(Math.max(0, w));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Barbell Weight Calculator</Text>

          {/* bar weight choices */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {[45, 44, 35, 20].map(w => (
              <Pressable
                key={w}
                onPress={() => changeBar(w)}
                style={[
                  styles.chip,
                  barWeight === w && { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
                ]}
              >
                <Text style={{ color: barWeight === w ? '#4F46E5' : palette.text, fontWeight: '800' }}>
                  Bar {w} {unit}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* plate rows */}
          {plates.map(p => (
            <View key={p} style={styles.row}>
              <Text style={{ color: palette.text, fontWeight: '700', width: 50 }}>{p}</Text>
              <Pressable style={styles.roundBtn} onPress={() => nudgePair(p, -1)}><Text style={styles.roundTxt}>−</Text></Pressable>
              <View style={styles.countBox}><Text style={styles.countTxt}>{pairs[p]}</Text></View>
              <Pressable style={styles.roundBtn} onPress={() => nudgePair(p, +1)}><Text style={styles.roundTxt}>＋</Text></Pressable>
              <Text style={{ color: palette.sub, marginLeft: 6 }}>pairs</Text>
            </View>
          ))}

          <View style={{ height: 8 }} />
          <Text style={{ color: palette.text, fontWeight: '800', fontSize: 18, textAlign: 'center' }}>
            Total: {total} {unit}
          </Text>

          <View style={{ height: 14 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
            <Pressable onPress={onClose}><Text style={{ color: palette.sub }}>Cancel</Text></Pressable>
            <Pressable onPress={() => { onDone?.(total); onClose?.(); }}>
              <Text style={{ color: '#2563eb', fontWeight: '800' }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.35)', alignItems:'center', justifyContent:'center' },
  card: { width:'92%', borderRadius:16, backgroundColor:'#fff', padding:16 },
  title: { color: palette.text, fontSize:18, fontWeight:'900', marginBottom: 8 },
  row: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical: 6 },
  roundBtn: {
    width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center',
    backgroundColor:'#F3F4F6', borderWidth: StyleSheet.hairlineWidth, borderColor:'rgba(0,0,0,0.08)',
  },
  roundTxt: { fontSize:20, fontWeight:'800', color: palette.text },
  countBox: {
    minWidth:44, paddingHorizontal:10, paddingVertical:6, borderRadius:8, alignItems:'center',
    backgroundColor:'#fff', borderWidth: StyleSheet.hairlineWidth, borderColor:'rgba(0,0,0,0.12)',
  },
  countTxt: { color: palette.text, fontWeight:'800' },
  chip: {
    paddingHorizontal:10, paddingVertical:6, borderRadius:999,
    borderWidth:1, borderColor:'#E5E7EB', backgroundColor:'#fff',
  },
});
