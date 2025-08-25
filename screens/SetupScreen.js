// screens/SetupScreen.js
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Alert,
  Share,
  Platform,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  Switch,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import AccountCard from '../components/account/AccountCard'; // <-- NEW
import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';

// ---------- constants (settings) ----------
const SETTINGS_KEY = 'settings:training';
const OPENAI_MODEL_KEY = 'openai:model';

// Updated models list (added GPT-5)
const OPENAI_MODELS = [
  { id: 'gpt-5-pro', label: 'GPT-5 Pro' },
  { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'o3-mini', label: 'O3-mini' },
  { id: 'o3-mini-high', label: 'O3-mini High' },
];

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

async function shareFileAsync(uri, dialogTitle) {
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
    throw new Error('Failed to fully clear local storage.');
  }
}

// ---------- screen ----------
export default function SetupScreen() {
  const [busy, setBusy] = useState(false);
  const [lastExportInfo, setLastExportInfo] = useState(null);

  // Delete modal
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const EXACT = 'I UnDeRsTaNd';

  // Training settings
  const [plateRounding, setPlateRounding] = useState('lb5'); // 'lb5' | 'kg2.5'
  const [adoptRestHints, setAdoptRestHints] = useState(true);

  // OpenAI model only (API key removed from UI)
  const [model, setModel] = useState(OPENAI_MODELS[0].id);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const selectedModel = OPENAI_MODELS.find((m) => m.id === model) || OPENAI_MODELS[0];

  // Load persisted settings (training + model)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s && typeof s === 'object') {
            if (s.plateRounding) setPlateRounding(s.plateRounding);
            if ('adoptRestHints' in s) setAdoptRestHints(!!s.adoptRestHints);
          }
        }
      } catch {}
      try {
        const m = await AsyncStorage.getItem(OPENAI_MODEL_KEY);
        if (typeof m === 'string' && OPENAI_MODELS.some((x) => x.id === m)) {
          setModel(m);
        }
      } catch {}
    })();
  }, []);

  async function saveSettings() {
    try {
      const payload = { plateRounding, adoptRestHints };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
      Alert.alert('Saved', 'Training settings updated.');
    } catch {
      Alert.alert('Save failed', 'Could not save settings. Please try again.');
    }
  }

  // Save ONLY the model (API key is read from app.json/app.config)
  async function saveOpenAISettings() {
    try {
      await AsyncStorage.setItem(OPENAI_MODEL_KEY, model);
      Alert.alert('Saved', 'OpenAI model updated.');
    } catch {
      Alert.alert('Save failed', 'Could not save OpenAI model. Please try again.');
    }
  }

  // --- Export actions ---
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
      await shareFileAsync(uri, 'Export Workouts (CSV)');
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
      await shareFileAsync(uri, 'Export Workouts (JSON)');
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
      {/* 0) Account (NEW, on top) */}
      <AccountCard />

      {/* 1) OpenAI Settings */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.header}>OpenAI Settings</Text>
        <Text style={{ color: palette.sub, marginBottom: 6 }}>
          API key is read from app config (app.json / app.config.js).
        </Text>

        {/* Model Picker */}
        <Text style={styles.label}>Model</Text>
        <Pressable
          onPress={() => setModelPickerOpen(true)}
          style={styles.pickerBtn}
          accessibilityRole="button"
          accessibilityLabel="Select OpenAI model"
        >
          <Text style={styles.pickerBtnText}>{selectedModel?.label || model}</Text>
          <Text style={{ color: palette.sub, fontSize: 16 }}>▾</Text>
        </Pressable>

        <View style={{ height: spacing(1.25) }} />
        <GradientButton title="Save OpenAI Settings" onPress={saveOpenAISettings} />
      </Card>

      {/* 2) Training Settings */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.header}>Training Settings</Text>

        <View style={{ height: spacing(1) }} />

        <Text style={styles.label}>Plate rounding</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <Pressable onPress={() => setPlateRounding('lb5')} hitSlop={6}>
            <Text style={{ color: plateRounding === 'lb5' ? '#6a5cff' : palette.text, fontWeight: '900' }}>
              Nearest 5 lb
            </Text>
          </Pressable>
          <Pressable onPress={() => setPlateRounding('kg2.5')} hitSlop={6}>
            <Text style={{ color: plateRounding === 'kg2.5' ? '#6a5cff' : palette.text, fontWeight: '900' }}>
              Nearest 2.5 kg
            </Text>
          </Pressable>
        </View>

        <View style={{ height: spacing(1) }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.label}>Adopt rest-timer hints</Text>
          <Switch value={adoptRestHints} onValueChange={setAdoptRestHints} />
        </View>

        <View style={{ height: spacing(1) }} />
        <GradientButton title="Save Settings" onPress={saveSettings} />
      </Card>

      {/* 3) Data Export */}
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

      {/* 4) What’s included */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.header}>What’s included</Text>
        <View style={{ height: 8 }} />
        <Text style={{ color: palette.sub }}>
          • Workout meta: ID, start/end time, title, units{'\n'}
          • Exercise meta: ID, name, muscle group, equipment, icon{'\n'}
          • Set data: set number, weight, reps, volume, e1RM, completion time{'\n'}
          • Optional: RPE, perceived difficulty, notes (if present)
        </Text>
      </Card>

      {/* 5) Danger Zone */}
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
      <Modal
        visible={delOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDelOpen(false)}
      >
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

      {/* Model Picker Modal */}
      <Modal
        visible={modelPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModelPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: 8 }]}>
            <Text style={styles.modalTitle}>Select Model</Text>
            <View style={{ marginVertical: 6 }}>
              {OPENAI_MODELS.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => { setModel(m.id); setModelPickerOpen(false); }}
                  style={({ pressed }) => [
                    styles.modelRow,
                    { backgroundColor: pressed ? '#F3F4F6' : '#fff' },
                  ]}
                >
                  <Text style={{ color: palette.text, fontWeight: '800' }}>{m.label}</Text>
                  {model === m.id ? <Text style={{ color: '#6a5cff', fontWeight: '900' }}>✓</Text> : null}
                </Pressable>
              ))}
            </View>
            <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
              <Pressable onPress={() => setModelPickerOpen(false)} hitSlop={8}>
                <Text style={styles.modalBtn}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { color: palette.text, fontSize: 18, fontWeight: '800' },
  label: { color: palette.text, fontWeight: '800', marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    backgroundColor: '#fff',
  },
  pickerBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerBtnText: { color: palette.text, fontWeight: '800' },
  modelRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

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
  modalBtn: { color: '#2563EB', fontWeight: '800' },
  modalDelete: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalDeleteText: { color: 'white', fontWeight: '900' },
});
