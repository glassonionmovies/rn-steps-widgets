// components/workout/WorkoutHistoryList.js (no VirtualizedList inside ScrollView)
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';
import { getAllWorkouts } from '../../store/workoutStore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

function Row({ item, onPress }) {
  const d = new Date(item.startedAt || Date.now());
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>{date}</Text>
        <Text style={{ color: palette.sub, fontSize: 14 }}>{time}</Text>
      </View>
    </Pressable>
  );
}

export default function WorkoutHistoryList() {
  const [items, setItems] = useState([]);
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const all = await getAllWorkouts();
        const last10 = (all || []).slice(0, 10);
        if (mounted) setItems(last10);
      })();
      return () => {
        mounted = false;
      };
    }, [])
  );

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text style={{ color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>
        Recent Workouts
      </Text>

      {items.length === 0 ? (
        <Text style={{ color: palette.sub }}>No workouts saved yet.</Text>
      ) : (
        <View>
          {items.map((item, idx) => (
            <View key={item.id}>
              <Row
                item={item}
                onPress={() => navigation.navigate('TrackWorkout', { workoutId: item.id })}
              />
              {idx < items.length - 1 && (
                <View style={{ height: 1, backgroundColor: '#e5e7eb', opacity: 0.5 }} />
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
