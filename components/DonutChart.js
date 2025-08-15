// components/DonutChart.js
import React, {useMemo, useState} from 'react';
import {View, Text} from 'react-native';
import * as Haptics from 'expo-haptics';
import {PieChart} from 'react-native-gifted-charts';
import {palette} from '../theme';

export default function DonutChart({
  segments = [],             // [{ value, color }]
  radius = 96,
  innerRadius = 64,
  centerLabel = 'Total',
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const data = useMemo(
    () =>
      segments.map((s, i) => ({
        value: s.value,
        color: s.color,
        text: '',
        shiftX: i === activeIndex ? 6 : 0,
        shiftY: i === activeIndex ? 6 : 0,
      })),
    [segments, activeIndex]
  );

  const total = useMemo(
    () => segments.reduce((acc, s) => acc + (s.value || 0), 0),
    [segments]
  );
  const activeVal = segments[activeIndex]?.value ?? 0;

  return (
    <View style={{alignItems: 'center', justifyContent: 'center'}}>
      <PieChart
        data={data}
        donut
        radius={radius}
        innerRadius={innerRadius}
        sectionAutoFocus
        focusOnPress
        strokeColor="#fff"
        strokeWidth={2}
        showGradient
        innerCircleColor="#fff"
        onPress={(_, index) => {
          setActiveIndex(index);
          Haptics.selectionAsync();
        }}
      />
      <View
        pointerEvents="none"
        style={{position: 'absolute', alignItems: 'center', justifyContent: 'center'}}>
        <Text style={{fontSize: 12, opacity: 0.6}}>{centerLabel}</Text>
        <Text style={{fontSize: 22, fontWeight: '800', color: palette.text}}>
          {activeVal}
        </Text>
        <Text style={{fontSize: 12, opacity: 0.6}}>of {total}</Text>
      </View>
    </View>
  );
}
