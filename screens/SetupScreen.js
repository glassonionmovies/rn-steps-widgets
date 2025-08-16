import React from 'react';
import { View, Text } from 'react-native';
export default function SetupScreen() {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ fontSize:18, fontWeight:'800' }}>Setup</Text>
      <Text style={{ marginTop:8, opacity:0.6 }}>Configure equipment, units, theme, etc.</Text>
    </View>
  );
}
