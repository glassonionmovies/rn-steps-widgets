import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { palette, spacing } from '../theme';

export default function StepsBarChart({ data, labels }) {
  const max = Math.max(...data, 1);
  const W = 320, H = 140, pad = 12;
  const barW = (W - pad*2) / data.length * 0.6;
  const step = (W - pad*2) / data.length;

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {data.map((v, i) => {
          const h = (v / max) * (H - 20);
          const x = pad + i*step + (step - barW)/2;
          const y = H - h - 10;
          return <Rect key={i} x={x} y={y} width={barW} height={h} rx="6" fill={palette.accent} />;
        })}
      </Svg>
      <View style={styles.labels}>
        {labels.map((l,i)=><Text key={i} style={styles.lbl}>{l}</Text>)}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  labels:{ flexDirection:'row', justifyContent:'space-between', marginTop: spacing(1) },
  lbl:{ color: '#9CA3AF', fontSize:12 }
});

