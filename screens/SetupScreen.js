// screens/SetupScreen.js
import React, { useState } from 'react';
import { ScrollView, View, Text, Alert, Share, Platform, Modal, Pressable, TextInput, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';

// ---------- helpers (export) ----------
const isCompleted = (s) =>
  !!s?.completedAt ||
  ((Number(s?.weight) || 0) > 0 && (Number(s?.reps) || 0) > 0);

const epley = (w, r) => (Number(w) || 0) * (1 + (Number(r) || 0) / 30);

function toISO(ts) {
  try {
    if (!ts) return '';
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
  } catch {
    return '';
  }
}

function safe(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function csvEscape(s) {
  const v = safe(s);
  if (v.includes('"') || v.includes(',') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function buildRows(workouts = []) {
  const rows = [];
  (workouts || []).forEach((w) => {
    const startedAtISO = toISO(w.startedAt);
    const finishedAtISO = toISO(w.finishedAt);
    const title = w.title || '';
    const units = w.units || 'lb';

    (w.blocks || []).forEach((b) => {
      const ex = b.exercise || {};
      const exerciseId = ex.id ?? '';
      const exerciseName = ex.name ?? 'Exercise';
      const muscleGroup = ex.muscleGroup ?? '';
      const equipment = ex.equipment ?? '';
      const icon = ex.icon ?? '';

      (b.sets || []).forEach((s, idx) => {
        if (!isCompleted(s)) return;

        const setNumber = idx + 1;
        const weight = Number(s?.weight) || 0;
        const reps = Number(s?.reps) || 0;
        const volume = weight * reps;
        const e1rm = Math.round(epley(weight, reps));

        const rpe = s?.rpe ?? '';
        const perceivedDifficulty = s?.difficulty ?? s?.effort ?? '';
        const notes = s?.note ?? s?.notes ?? '';
        const completedAtISO = toISO(s?.completedAt);

        rows.push({
          workout_id: w.id || '',
          started_at: startedAtISO,
          finished_at: finishedAtISO,
          title,
          units,

          exercise_id: exerciseId,
          exercise_name: exerciseName,
          muscle_group: muscleGroup,
          equipment,
          icon,

          set_number: setNumber,
          weight,
          reps,
          volume,
          e1rm,

          completed_at: completedAtISO,
          rpe,
          perceived_difficulty: perceivedDifficulty,
          notes,
        });
      });
    });
  });
  return rows;
}

function toCSV(rows) {
  const headers = [
    'workout_id',
    'started_at',
    'finished_at',
    'title',
    'units',
    'exercise_id',
    'exercise_name',
    'muscle_group',
    'equipment',
    'icon',
    'set_number',
    'weight',
    'reps',
    'volume',
    'e1rm',
    'completed_at',
    'rpe',
    'perceived_difficulty',
    'notes',
  ];
  const head = headers.join(',');
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')).join('\n');
  return head + '\n' + body + '\n';
}

async function shareFileAsync(uri, _mimeType, dialogTitle) {
  try {
    if (Platform.OS === 'ios') {
      await Share.share({ url: uri, title: dialogTitle });
    } else {
      await Share.share({ message: uri, url: uri, title: dialogTitle });
    }
  } catch {
    Alert.alert('Share failed', 'Unable to open the share dialog.');
  }
}

// ---------- destructive delete helpers ----------
const CHECKIN_KEY = 'wellness:checkins';
const NAME_KEY = 'profile:name';

async function deleteAllDataHard() {
  // Try store-specific clears if available, then fall back to full AsyncStorage.clear()
  try {
    // Workouts
    try {
      const ws = require('../store/workoutStore');
      if (ws?.deleteAllWorkouts) {
        await ws.deleteAllWorkouts();
      } else if (ws?.clearAllWorkouts) {
        await ws.clearAllWorkouts();
      } else if (ws?.getAllWorkouts && ws?.deleteWorkout) {
        const all = await ws.getAllWorkouts();
        for (const w of all || []) {
          if (w?.id) await ws.deleteWorkout(w.id);
        }
      }
    } catch {}

    // Templates
    try {
      const ts = require('../store/templateStore');
      if (ts?.clearAllWorkoutTemplates) {
        await ts.clearAllWorkoutTemplates();
      } else if (ts?.getAllWorkoutTemplates && ts?.deleteWorkoutTemplate) {
        const allT = await ts.getAllWorkoutTemplates();
        for (const t of allT || []) {
          if (t?.id) await ts.deleteWorkoutTemplate(t.id);
        }
      }
    } catch {}

    // Known single keys
    try { await AsyncStorage.removeItem(CHECKIN_KEY); } catch {}
    try { await AsyncStorage.removeItem(NAME_KEY); } catch {}

    // Final fallback: nuke everything persisted by the app
    await AsyncStorage.clear();
  } catch {
    // Even if a particular call fails, we tried our best—surface a generic error.
    throw new Error('Failed to fully clear local storage.');
  }
}

// ---------- screen ----------
export default function SetupScreen() {
  const [busy, setBusy] = useState(false);
  const [lastExportInfo, setLastExportInfo] = useState(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const EXACT = 'I UnDeRsTaNd';

  async function exportCSV() {
    try {
      setBusy(true);
      const all = await getAllWorkouts();
      const rows = buildRows(all);
      if (rows.length === 0) {
        Alert.alert('Nothing to export', 'No completed sets found in your history.');
        return;
      }
      const csv = toCSV(rows);
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
      const fileName = `repai_export_${stamp}.csv`;
      const uri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      setLastExportInfo({ kind: 'CSV', count: rows.length, uri });
      await shareFileAsync(uri, 'text/csv', 'Export Workouts (CSV)');
    } catch {
      Alert.alert('Export failed', 'Sorry, we could not export your data.');
    } finally {
      setBusy(false);
    }
  }

  async function exportJSON() {
    try {
      setBusy(true);
      const all = await getAllWorkouts();
      const rows = buildRows(all);
      if (rows.length === 0) {
        Alert.alert('Nothing to export', 'No completed sets found in your history.');
        return;
      }
      const pretty = JSON.stringify(rows, null, 2);
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
      const fileName = `repai_export_${stamp}.json`;
      const uri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, pretty, { encoding: FileSystem.EncodingType.UTF8 });
      setLastExportInfo({ kind: 'JSON', count: rows.length, uri });
      await shareFileAsync(uri, 'application/json', 'Export Workouts (JSON)');
    } catch {
      Alert.alert('Export failed', 'Sorry, we could not export your data.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteAll() {
    if (delText !== EXACT) return;
    try {
      setDelBusy(true);
      await deleteAllDataHard();
      setDelOpen(false);
      setDelText('');
      Alert.alert('Deleted', 'All local data has been removed.');
    } catch {
      Alert.alert('Delete failed', 'We could not remove all data.');
    } finally {
      setDelBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingHorizontal: layout.screenHMargin,
        paddingTop: spacing(2),
        paddingBottom: spacing(4),
        gap: spacing(2),
      }}
    >
      {/* Export widget */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900' }}>
          Data Export
        </Text>
        <Text style={{ color: palette.sub, marginTop: 6 }}>
          Export your full training history (completed sets only) for backup or migration.
          CSV opens in spreadsheets; JSON is developer-friendly.
        </Text>

        <View style={{ height: spacing(1.5) }} />

        <GradientButton
          title={busy ? 'Exporting…' : 'Export as CSV'}
          onPress={exportCSV}
          disabled={busy}
        />
        <View style={{ height: spacing(1) }} />
        <GradientButton
          title={busy ? 'Exporting…' : 'Export as JSON'}
          onPress={exportJSON}
          disabled={busy}
        />

        {lastExportInfo && (
          <View style={{ marginTop: spacing(1.5) }}>
            <Text style={{ color: palette.sub, fontSize: 12 }}>
              Last export: {lastExportInfo.kind} • {lastExportInfo.count} rows
            </Text>
            <Text style={{ color: palette.sub, fontSize: 12 }}>
              Saved at: {lastExportInfo.uri}
            </Text>
          </View>
        )}
      </Card>

      {/* What's included */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>
          What’s included
        </Text>
        <View style={{ height: 8 }} />
        <Text style={{ color: palette.sub }}>
          • Workout meta: ID, start/end time, title, units{'\n'}
          • Exercise meta: ID, name, muscle group, equipment, icon{'\n'}
          • Set data: set number, weight, reps, volume, e1RM, completion time{'\n'}
          • Optional: RPE, perceived difficulty, notes (if present)
        </Text>
      </Card>

      {/* Danger Zone */}
      <Card style={{ padding: spacing(2), borderColor: '#fecaca', borderWidth: StyleSheet.hairlineWidth }}>
        <Text style={{ color: '#991B1B', fontSize: 18, fontWeight: '900', marginBottom: spacing(1) }}>
          Danger Zone
        </Text>
        <Text style={{ color: palette.sub, marginBottom: spacing(1) }}>
          Permanently delete all locally stored data (workouts, templates, check-ins, and preferences).
          This action cannot be undone.
        </Text>

        <Pressable
          onPress={() => setDelOpen(true)}
          style={styles.dangerBtn}
          accessibilityRole="button"
          accessibilityLabel="Delete all data"
        >
          <Text style={styles.dangerBtnText}>Delete All Data</Text>
        </Pressable>
      </Card>

      {/* Confirm Delete Modal */}
      <Modal visible={delOpen} transparent animationType="fade" onRequestClose={() => setDelOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Type the confirmation to proceed</Text>
            <Text style={{ color: palette.sub, marginBottom: 8 }}>
              Please type <Text style={{ fontWeight: '900', color: palette.text }}>{EXACT}</Text> exactly to confirm.
            </Text>
            <TextInput
              value={delText}
              onChangeText={setDelText}
              placeholder={EXACT}
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <Pressable onPress={() => { setDelOpen(false); setDelText(''); }} disabled={delBusy}>
                <Text style={styles.modalBtn}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteAll}
                disabled={delBusy || delText !== EXACT}
                style={[
                  styles.modalDelete,
                  { opacity: delBusy || delText !== EXACT ? 0.5 : 1 },
                ]}
              >
                <Text style={styles.modalDeleteText}>{delBusy ? 'Deleting…' : 'Delete'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dangerBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: 'white',
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 16,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
  },
  modalBtn: { color: '#2563EB', fontWeight: '800' },
  modalDelete: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalDeleteText: { color: 'white', fontWeight: '900' },
});
