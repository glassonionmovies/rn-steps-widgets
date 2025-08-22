// utils/useRepAIPlan.js
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { generatePlan } from './repAIPlanner';
import { getAllWorkouts } from '../store/workoutStore';

// Optional nested-nav helper (if you have one)
let goTrackWorkout;
try {
  ({ goTrackWorkout } = require('../navigation/routes'));
} catch (_) {
  goTrackWorkout = null;
}

export default function useRepAIPlan(defaults = {}) {
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);

  const recommend = useCallback(async (overrides = {}) => {
    try {
      setBusy(true);
      const history = await getAllWorkouts();
      const {
        goals = 'hypertrophy',
        split = 'upper',
        timeBudgetMin = 50,
        equipment = ['barbell','dumbbell','machine','cable','bodyweight'],
        vitals = {},
        settings = { units: history[0]?.units || 'lb', plateIncrementLb: 5, plateIncrementKg: 2.5 },
        seed = Date.now(),
      } = { ...defaults, ...overrides };

      const plan = generatePlan({
        history, goals, split, timeBudgetMin, equipment, vitals, settings, seed,
      });

      // Navigate to the Preview inside Train stack (works from any tab)
      navigation.navigate('Train', {
        screen: 'PreviewRecommended',
        params: { plan, source: 'rep_ai' },
      });
    } catch (e) {
      Alert.alert('Rep.AI failed', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, [navigation, defaults]);

  return { recommend, busy };
}
