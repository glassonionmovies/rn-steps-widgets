// components/workout/SetRow.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import StepperNumber from './StepperNumber';
import { palette, spacing } from '../../theme';
import Card from '../ui/Card';

const TYPES = ['Working', 'Warm-up', 'Drop Set', 'Failure'];
const TYPE_STYLES = {
  'Warm-up': { bg: '#EEF2FF', fg: '#4F46E5' },
  'Drop Set': { bg: '#FEF3C7', fg: '#9A3412' },
  'Failure': { bg: '#FEE2E2', fg: '#B91C1C' },
};

const HARDNESS = [
  { key: 'light', label: 'Light', icon: '🟢' },
  { key: 'moderate', label: 'Moderate', icon: '🟡' },
  { key: 'hard', label: 'Hard', icon: '🟠' },
  { key: 'very-hard', label: 'Very Hard', icon: '🔴' },
];

function isValidSet(s) {
  const w = Number(s?.weight) || 0;
  const r = Number(s?.reps) || 0;
  return w > 0 && r > 0;
}
const epley = (w, r) => (Number(w) || 0) * (1 + (Number(r) || 0) / 30);

export default function SetRow({
  index,
  exercise,
  set,
  units = 'lb',
  prevSameIndex,         // { weight, reps, e1rm } (weight/reps used to compute fallback e1rm)
  onChange,              // (patch) => void
  onRemove,              // () => void
  onToggleComplete,      // (doneBool) => void
}) {
  const [hardOpen, setHardOpen] = useState(false);

  // Collapse when set is completed; expand on tap
  const [collapsed, setCollapsed] = useState(!!set?.completedAt);
  useEffect(() => {
    setCollapsed(!!set?.completedAt);
  }, [set?.completedAt]);

  // Seed from previous if empty
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!isValidSet(set) && prevSameIndex && (prevSameIndex.weight || prevSameIndex.reps)) {
      onChange?.({ weight: prevSameIndex.weight || 0, reps: prevSameIndex.reps || 0 });
      seededRef.current = true;
    }
  }, [prevSameIndex, set?.weight, set?.reps]);

  const unitLabel = units === 'kg' ? 'kg' : 'lbs';

  const cur1rm = useMemo(() => epley(set?.weight, set?.reps), [set?.weight, set?.reps]);

  // Robust prev 1RM: explicit e1rm OR compute from prev weight/reps
  const prev1rm = useMemo(() => {
    const explicit = Number(prevSameIndex?.e1rm) || 0;
    if (explicit > 0) return explicit;
    const pw = Number(prevSameIndex?.weight) || 0;
    const pr = Number(prevSameIndex?.reps) || 0;
    return pw > 0 && pr > 0 ? epley(pw, pr) : 0;
  }, [prevSameIndex?.e1rm, prevSameIndex?.weight, prevSameIndex?.reps]);

  const deltaPct = useMemo(() => {
    if (!prev1rm || !cur1rm) return null;
    return Math.round(((cur1rm - prev1rm) / prev1rm) * 100);
  }, [cur1rm, prev1rm]);

  const done = !!set?.completedAt;
  const type = set?.type || 'Working';
  const typeStyle = TYPE_STYLES[type];

  const hardnessKey = set?.perceived || null; // 'light' | 'moderate' | 'hard' | 'very-hard' | null
  const hardnessIcon = HARDNESS.find(h => h.key === hardnessKey)?.icon || '💬';

  // ---------- Compact (done) view ----------
  if (collapsed) {
    return (
      <Card style={[styles.card, styles.compactCard]}>
        <View style={styles.compactRow}>
          {/* LEFT cluster: tap to expand */}
          <Pressable onPress={() => setCollapsed(false)} style={styles.compactLeft} hitSlop={6}>
            <Text style={styles.compactIndex}>{index + 1}</Text>

            {type !== 'Working' && (
              <View style={[styles.compactType, { backgroundColor: typeStyle.bg }]}>
                <Text style={{ color: typeStyle.fg, fontWeight: '800', fontSize: 11 }}>{type}</Text>
              </View>
            )}

            <Text numberOfLines={1} style={styles.compactSummary}>
              {`${Number(set?.weight) || 0} × ${Number(set?.reps) || 0} • 1RM ${Math.round(cur1rm || 0)}`}
              {deltaPct !== null ? ` • ${deltaPct >= 0 ? '+' : ''}${deltaPct}%` : ''}
            </Text>
          </Pressable>

          {/* RIGHT cluster: hardness + actions (same line) */}
          <View style={styles.compactRight}>
            <Pressable onPress={() => setHardOpen(true)} hitSlop={8} style={{ paddingHorizontal: 2 }}>
              <Text style={{ fontSize: 16 }}>{hardnessIcon}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const next = !done;
                onToggleComplete?.(next);
                setCollapsed(next);
              }}
              hitSlop={10}
              style={{ marginLeft: 8 }}
            >
              <Text style={{ fontSize: 20, color: done ? '#16a34a' : '#9CA3AF' }}>✔︎</Text>
            </Pressable>
            <Pressable onPress={onRemove} hitSlop={10} style={{ marginLeft: 10 }}>
              <Text style={{ color: '#B91C1C', fontWeight: '800' }}>✕</Text>
            </Pressable>
          </View>
        </View>

        {/* Hardness modal (tap closes immediately) */}
        <Modal
          visible={hardOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setHardOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 8 }}>
                How hard was this set?
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {HARDNESS.map((h) => {
                  const active = hardnessKey === h.key;
                  return (
                    <Pressable
                      key={h.key}
                      onPress={() => {
                        onChange?.({ perceived: h.key });
                        setHardOpen(false);
                      }}
                      style={[
                        styles.chip,
                        active && { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
                      ]}
                    >
                      <Text style={{ fontSize: 18 }}>{h.icon}</Text>
                      <Text style={{ color: active ? '#4F46E5' : palette.text, fontWeight: '800' }}>
                        {h.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      </Card>
    );
  }

  // ---------- Expanded (editable) view ----------
  return (
    <Card style={[styles.card, done && styles.doneCard]}>
      {/* Top Row */}
      <View style={styles.topRow}>
        <Text style={{ color: done ? '#9CA3AF' : palette.text, fontWeight: '800' }}>
          {index + 1}
        </Text>

        <Pressable
          onPress={() => {
            const i = TYPES.indexOf(type);
            const next = TYPES[(i + 1) % TYPES.length];
            onChange?.({ type: next === 'Working' ? undefined : next });
          }}
          style={[
            styles.typeChip,
            type !== 'Working' && { backgroundColor: typeStyle.bg, borderColor: '#0000' },
          ]}
        >
          <Text style={{ color: type !== 'Working' ? typeStyle.fg : palette.sub, fontWeight: '800' }}>
            {type !== 'Working' ? type : 'Set Type'}
          </Text>
        </Pressable>

        <Text
          numberOfLines={1}
          style={[styles.prevInline, { color: done ? '#9CA3AF' : palette.sub }]}
        >
          {prevSameIndex?.weight
            ? `Prev: ${prevSameIndex.weight} × ${prevSameIndex.reps}`
            : 'Prev: —'}
          {`  •  1RM ${Math.round(cur1rm || 0)}`}
          {deltaPct !== null ? `  ${deltaPct >= 0 ? '+' : ''}${deltaPct}%` : ''}
        </Text>

        <Pressable onPress={onRemove} hitSlop={10} style={{ marginLeft: 6 }}>
          <Text style={{ color: '#B91C1C', fontWeight: '800' }}>✕</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            const next = !done;
            onToggleComplete?.(next);
            setCollapsed(next);
          }}
          hitSlop={10}
          style={{ marginLeft: 10 }}
          accessibilityLabel={done ? 'mark not done' : 'mark done'}
        >
          <Text style={{ fontSize: 22, color: done ? '#16a34a' : '#9CA3AF' }}>✔︎</Text>
        </Pressable>
      </View>

      {/* Steppers */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <StepperNumber
            value={Number(set?.weight) || 0}
            onChange={(v) => onChange?.({ weight: v })}
            step={unitLabel === 'kg' ? 2.5 : 5}
            min={0}
            max={2000}
            large
            testID="weight-stepper"
          />
          <Text style={styles.caption}>Weight ({unitLabel})</Text>
        </View>

        <View style={{ width: spacing(1) }} />

        <View style={{ flex: 1 }}>
          <StepperNumber
            value={Number(set?.reps) || 0}
            onChange={(v) => onChange?.({ reps: v })}
            step={1}
            min={0}
            max={50}
            large
            testID="reps-stepper"
          />
          <Text style={styles.caption}>Reps</Text>
        </View>

        {/* Hardness bubble (icon only) */}
        <Pressable
          onPress={() => setHardOpen(true)}
          hitSlop={10}
          style={{ marginLeft: 8, alignSelf: 'center', padding: 8 }}
          accessibilityLabel="set hardness"
        >
          <Text style={{ fontSize: 18 }}>{hardnessIcon}</Text>
        </Pressable>
      </View>

      {/* Hardness modal (tap closes immediately) */}
      <Modal
        visible={hardOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHardOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={{ color: palette.text, fontWeight: '800', marginBottom: 8 }}>
              How hard was this set?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HARDNESS.map((h) => {
                const active = hardnessKey === h.key;
                return (
                  <Pressable
                    key={h.key}
                    onPress={() => {
                      onChange?.({ perceived: h.key });
                      setHardOpen(false);
                    }}
                    style={[
                      styles.chip,
                      active && { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{h.icon}</Text>
                    <Text style={{ color: active ? '#4F46E5' : palette.text, fontWeight: '800' }}>
                      {h.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing(1), paddingTop: spacing(0.75) },
  doneCard: { opacity: 0.58 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  prevInline: { fontSize: 12, marginLeft: 4, flexShrink: 1 },

  row: { flexDirection: 'row', alignItems: 'center' },
  caption: { marginTop: 4, color: palette.sub, fontSize: 11, textAlign: 'center' },

  // Compact layout
  compactCard: { paddingVertical: 10, paddingHorizontal: spacing(1) },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // keep right actions on same line
    gap: 8,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    maxWidth: '78%', // keeps right cluster close; avoids huge whitespace
  },
  compactIndex: { color: palette.text, fontWeight: '800', width: 18, textAlign: 'right' },
  compactType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  compactSummary: {
    color: palette.text,
    fontWeight: '700',
    flexShrink: 1,
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: { width: '86%', borderRadius: 12, backgroundColor: '#fff', padding: 16 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
