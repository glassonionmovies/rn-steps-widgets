import React from 'react';
import { Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function GradientButton({ title, onPress, style, textStyle }) {
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 16, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#6a5cff', '#4ac3ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[{ paddingVertical: 16, alignItems: 'center', borderRadius: 16 }, style]}
      >
        <Text style={[{ color: 'white', fontWeight: '600', fontSize: 16 }, textStyle]}>
          {title}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
