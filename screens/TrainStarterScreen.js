// screens/TrainStarterScreen.js
import React from 'react';
import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Card from '../components/ui/Card';
import { palette, spacing, layout } from '../theme';

export default function TrainStarterScreen() {
  const navigation = useNavigation();

  const goPreviousPattern = () => {
    try {
      const routes = require('../navigation/routes');
      if (routes?.goProgressHome) {
        routes.goProgressHome(navigation, { selectPattern: true });
        return;
      }
    } catch {}
    navigation.navigate('Progress', { screen: 'ProgressHome', params: { selectPattern: true } });
  };

  const goTemplates = () => {
    navigation.navigate('WorkoutTemplates');
  };

  const goBlank = () => {
    navigation.navigate('TrackWorkout'); // fresh session
  };

  const goAIRecommended = () => {
    Alert.alert('Coming soon', 'Rep.AI Recommended is not available yet.');
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
          Start Training
        </Text>
        <Text style={{ color: palette.sub, marginTop: 4 }}>
          Choose how you’d like to begin your session
        </Text>

        <View style={{ height: spacing(1.5) }} />

        {/* 1) Previous Workout Pattern */}
        <Pressable
          onPress={goPreviousPattern}
          style={{
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0,0,0,0.06)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18 }}>📜</Text>
            <View>
              <Text style={{ color: palette.text, fontWeight: '800' }}>Previous Workout Pattern</Text>
              <Text style={{ color: palette.sub, fontSize: 12 }}>Pick from your recent sessions</Text>
            </View>
          </View>
          <Text style={{ color: palette.sub, fontSize: 18 }}>{'›'}</Text>
        </Pressable>

        {/* 2) Saved Template */}
        <Pressable
          onPress={goTemplates}
          style={{
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0,0,0,0.06)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18 }}>🧩</Text>
            <View>
              <Text style={{ color: palette.text, fontWeight: '800' }}>Saved Template</Text>
              <Text style={{ color: palette.sub, fontSize: 12 }}>Start from a pre-defined plan</Text>
            </View>
          </View>
          <Text style={{ color: palette.sub, fontSize: 18 }}>{'›'}</Text>
        </Pressable>

        {/* 3) Blank Workout */}
        <Pressable
          onPress={goBlank}
          style={{
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0,0,0,0.06)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18 }}>🆕</Text>
            <View>
              <Text style={{ color: palette.text, fontWeight: '800' }}>Blank Workout</Text>
              <Text style={{ color: palette.sub, fontSize: 12 }}>Start with an empty session</Text>
            </View>
          </View>
          <Text style={{ color: palette.sub, fontSize: 18 }}>{'›'}</Text>
        </Pressable>

        {/* 4) Rep.AI Recommended (disabled for now) */}
        <Pressable
          onPress={goAIRecommended}
          style={{
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: 0.5,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18 }}>🤖</Text>
            <View>
              <Text style={{ color: palette.text, fontWeight: '800' }}>Rep.AI Recommended</Text>
              <Text style={{ color: palette.sub, fontSize: 12 }}>Coming soon</Text>
            </View>
          </View>
          <Text style={{ color: palette.sub, fontSize: 18 }}>{'›'}</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}
