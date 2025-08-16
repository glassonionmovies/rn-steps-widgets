// components/workout/RecentWorkoutsPanel.js
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';
import { getAllWorkouts, computeSummary } from '../../store/workoutStore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

export default function RecentWorkoutsPanel() {
  const [items, setItems] = useState([]);
  const navigation = useNavigation();

  useFocusEffect(useCallback(() => {
    let mounted = true;
    (async () => {
      const all = await getAllWorkouts();
      const sorted = (all || []).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      const last10 = sorted.slice(0, 10).map(w => ({ w, sum: computeSummary(w) }));
      if (mounted) setItems(last10);
    })();
    return () => { mounted = false; };
  }, []));

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text style={{ color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>
        Recent Workouts
      </Text>
      {items.length === 0 ? (
        <Text style={{ color: palette.sub }}>No workouts saved yet.</Text>
      ) : (
        <View>
          {items.map(({ w, sum }, idx) => {
            const d = new Date(w.startedAt || Date.now());
            const date = d.toLocaleDateString();
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <Pressable
                key={w.id}
                onPress={() => navigation.navigate('TrackWorkout', { workoutId: w.id })}
                style={{ paddingVertical: 10 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>{date}</Text>
                    <Text style={{ color: palette.sub, fontSize: 12 }}>{time}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>
                      {sum.totalSets} sets • {Math.round(sum.totalVolume)} {w.units || 'lb'}
                    </Text>
                    <Text style={{ color: palette.sub, fontSize: 12 }}>
                      {sum.exercises} exercises • {sum.durationMin} min
                    </Text>
                  </View>
                </View>
                {idx < items.length - 1 && <View style={{ height: 1, backgroundColor: '#e5e7eb', opacity: 0.5, marginTop: 10 }} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
}
