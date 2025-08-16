import React from 'react';
import { View, Text } from 'react-native';
export default function GoalsScreen() {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ fontSize:18, fontWeight:'800' }}>Goals & Templates</Text>
      <Text style={{ marginTop:8, opacity:0.6 }}>We’ll build this next.</Text>
    </View>
  );
}
