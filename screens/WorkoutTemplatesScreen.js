// screens/WorkoutTemplatesScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, View, Text, Pressable, Alert, StyleSheet, Modal, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/ui/Card';
import WorkoutSessionPreviewCard from '../components/workout/WorkoutSessionPreviewCard';

import { palette, spacing, layout } from '../theme';
import {
  getAllWorkoutTemplates,
  deleteWorkoutTemplate,
  renameWorkoutTemplate,
} from '../store/templateStore';

export default function WorkoutTemplatesScreen() {
  const navigation = useNavigation();
  const [templates, setTemplates] = useState([]);

  // Rename modal
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renamingId, setRenamingId] = useState(null);

  const load = useCallback(async () => {
    const all = await getAllWorkoutTemplates();
    const sorted = [...(all || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setTemplates(sorted);
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const startFromTemplate = (t) => {
    navigation.navigate('TrackWorkout', { template: t });
  };

  const remove = async (t) => {
    Alert.alert('Delete template?', `“${t.name}”`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkoutTemplate(t.id);
          load();
        },
      },
    ]);
  };

  const openRename = (t) => {
    setRenamingId(t.id);
    setRenameValue(t.name);
    setRenameOpen(true);
  };

  const confirmRename = async () => {
    const name = renameValue.trim();
    if (!name) {
      setRenameOpen(false);
      return;
    }
    await renameWorkoutTemplate(renamingId, name);
    setRenameOpen(false);
    setRenamingId(null);
    setRenameValue('');
    load();
  };

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
      <Card style={{ padding: spacing(2) }}>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900' }}>
          Workout Templates
        </Text>
        <View style={{ height: spacing(1) }} />

        {templates.length === 0 ? (
          <Text style={{ color: palette.sub }}>
            No templates yet. Save your current workout as a template from the Track screen.
          </Text>
        ) : (
          <View style={{ gap: spacing(2) }}>
            {templates.map((t) => {
              const created =
                t?.createdAt
                  ? new Date(t.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '';

              return (
                <Card key={t.id} style={{ padding: spacing(2) }}>
                  {/* Header row: name (left), date (right) */}
                  <View style={styles.headerRow}>
                    <Text style={styles.tplName} numberOfLines={1}>
                      {t.name || 'Template'}
                    </Text>
                    {!!created && <Text style={styles.tplDate}>{created}</Text>}
                  </View>

                  {/* Preview (do NOT filter completed; templates are blueprints) */}
                  <Pressable onPress={() => startFromTemplate(t)} style={{ marginTop: spacing(1) }}>
                    <WorkoutSessionPreviewCard
                      title={undefined}             // title already shown in header row
                      units={t.units || 'lb'}
                      blocks={t.blocks || []}
                      showOnlyCompleted={false}     // ← important: show all sets from template
                    />
                  </Pressable>

                  {/* Actions */}
                  <View style={styles.actionsRow}>
                    <Pressable onPress={() => openRename(t)} hitSlop={8}>
                      <Text style={styles.link}>Rename</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(t)} hitSlop={8}>
                      <Text style={styles.delete}>Delete</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </Card>

      {/* Rename Modal */}
      <Modal
        visible={renameOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename Template</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Template name"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <Pressable onPress={() => setRenameOpen(false)}>
                <Text style={styles.modalBtn}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmRename}>
                <Text style={[styles.modalBtn, { fontWeight: '800' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  tplName: { color: palette.text, fontWeight: '900', fontSize: 16, flexShrink: 1 },
  tplDate: { color: palette.sub, fontWeight: '800', fontSize: 12, marginLeft: 8 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    marginTop: spacing(1),
  },
  link: { color: '#2563EB', fontWeight: '800' },
  delete: { color: '#EF4444', fontWeight: '800' },

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
  modalTitle: { color: palette.text, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
  },
});
