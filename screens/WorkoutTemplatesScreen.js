// screens/WorkoutTemplatesScreen.js
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, Alert, StyleSheet, Modal, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Card from '../components/ui/Card';
import { palette, spacing, layout } from '../theme';
import { getAllWorkoutTemplates, deleteWorkoutTemplate, renameWorkoutTemplate } from '../store/templateStore';

export default function WorkoutTemplatesScreen() {
  const navigation = useNavigation();
  const [templates, setTemplates] = useState([]);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renamingId, setRenamingId] = useState(null);

  const load = async () => setTemplates(await getAllWorkoutTemplates());
  useEffect(() => { const unsub = navigation.addListener('focus', load); load(); return unsub; }, [navigation]);

  const startFromTemplate = (t) => {
    navigation.navigate('TrackWorkout', { template: t });
  };

  const remove = async (t) => {
    Alert.alert('Delete template?', `“${t.name}”`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteWorkoutTemplate(t.id); load(); } },
    ]);
  };

  const openRename = (t) => {
    setRenamingId(t.id);
    setRenameValue(t.name);
    setRenameOpen(true);
  };

  const confirmRename = async () => {
    const name = renameValue.trim();
    if (!name) { setRenameOpen(false); return; }
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
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900' }}>Workout Templates</Text>
        <View style={{ height: spacing(1) }} />
        {templates.length === 0 ? (
          <Text style={{ color: palette.sub }}>No templates yet. Save your current workout as a template from the Track screen.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {templates.map((t) => (
              <View key={t.id} style={styles.row}>
                <Pressable style={{ flex: 1 }} onPress={() => startFromTemplate(t)}>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.meta}>
                    {new Date(t.createdAt).toLocaleDateString()} • {t.blocks.length} exercises
                  </Text>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable onPress={() => openRename(t)} hitSlop={8}>
                    <Text style={styles.link}>Rename</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(t)} hitSlop={8}>
                    <Text style={styles.delete}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Rename Modal */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
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
              <Pressable onPress={() => setRenameOpen(false)}><Text style={styles.modalBtn}>Cancel</Text></Pressable>
              <Pressable onPress={confirmRename}><Text style={[styles.modalBtn, { fontWeight: '800' }]}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: { color: palette.text, fontWeight: '800' },
  meta: { color: palette.sub, marginTop: 2, fontSize: 12 },
  link: { color: '#2563EB', fontWeight: '800' },
  delete: { color: '#EF4444', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 14, backgroundColor: '#fff', padding: 16 },
  modalTitle: { color: palette.text, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
  },
  modalBtn: { color: '#2563EB', fontWeight: '700' },
});
