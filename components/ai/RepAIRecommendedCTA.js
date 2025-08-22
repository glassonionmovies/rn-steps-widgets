// components/ai/RepAIRecommendedCTA.js
import React from 'react';
import { View } from 'react-native';
import GradientButton from '../ui/GradientButton';
import useRepAIPlan from '../../utils/useRepAIPlan';

export default function RepAIRecommendedCTA(props) {
  const { label = 'Rep.AI Recommended', planOverrides } = props;
  const { recommend, busy } = useRepAIPlan();

  return (
    <View>
      <GradientButton
        title={busy ? 'Planning…' : label}
        onPress={() => recommend(planOverrides)}
        disabled={busy}
      />
    </View>
  );
}
