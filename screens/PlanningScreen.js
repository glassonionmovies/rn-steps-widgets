// screens/PlanningScreen.js
// Focused Planning screen: ONLY "Rep.AI Recommended".
// No pre-generation here; we just navigate to the Preview screen in the Train stack.

import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/ui/Card';
import { palette, spacing, layout } from '../theme';

export default function PlanningScreen() {
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);

  const goAIRecommended = () => {
    if (busy) return;
    setBusy(true);
    try {
      // Navigate to the PreviewRecommended screen in the Train stack.
      // The preview screen will handle LLM generation.
      navigation.navigate('Train', {
        screen: 'PreviewRecommended',
        params: { source: 'planning' },
      });
    } finally {
      // immediate reset so the button doesn't stay disabled if user returns
      setBusy(false);
    }
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
          Plan Your Training
        </Text>
        <Text style={{ color: palette.sub, marginTop: 4 }}>
          Use Rep.AI to create today’s workout (goals coming soon)
        </Text>

        <View style={{ height: spacing(1.5) }} />

        {/* Only action: Rep.AI Recommended */}
        <Pressable
          onPress={goAIRecommended}
          style={[rowStyle, busy && { opacity: 0.6 }]}
          disabled={busy}
        >
          <View style={iconTextRow}>
            <Text style={{ fontSize: 18 }}>🤖</Text>
            <View>
              <Text style={titleStyle}>Rep.AI Recommended</Text>
              <Text style={subtitleStyle}>
                {busy ? 'Opening…' : 'Smart plan for today'}
              </Text>
            </View>
          </View>
          <Text style={chevronStyle}>{busy ? '…' : '›'}</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

// Styles aligned with Train screen’s row look
const rowStyle = {
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(0,0,0,0.06)',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const iconTextRow = { flexDirection: 'row', alignItems: 'center', gap: 10 };
const titleStyle = { color: palette.text, fontWeight: '800' };
const subtitleStyle = { color: palette.sub, fontSize: 12 };
const chevronStyle = { color: palette.sub, fontSize: 18 };
