// components/LineChart.js
import React, {useMemo} from 'react';
import {View, Text} from 'react-native';
import * as Haptics from 'expo-haptics';
import {LineChart} from 'react-native-gifted-charts';
import {palette} from '../theme'; // uses your palette

export default function LineChartInteractive({
  points = [],
  height = 200,
  labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
}) {
  const data = useMemo(
    () =>
      points.map((v, i) => ({
        value: v,
        label: labels[i % labels.length],
      })),
    [points, labels]
  );

  return (
    <View pointerEvents="box-none">
      <LineChart
        data={data}
        height={height}
        curved
        initialSpacing={12}
        endSpacing={12}
        animateOnDataChange
        animationDuration={700}
        isAnimated
        thickness={3}
        color1={palette.accent2}
        areaChart
        startFillColor1={palette.accent2}
        endFillColor1={palette.accent2}
        startOpacity={0.18}
        endOpacity={0.02}
        hideRules={false}
        showVerticalLines
        yAxisTextStyle={{opacity: 0.7}}
        xAxisLabelTextStyle={{opacity: 0.7}}

        // Interactivity
        showPointerStrip
        pointerConfig={{
          pointerStripHeight: height + 12,
          pointerStripColor: palette.accent2,
          pointerStripWidth: 2,
          pointerColor: palette.accent2,
          showPointerStripOnPressIn: true,
          activatePointersOnLongPress: true,
          autoAdjustPointerLabelPosition: true,
          pointerLabelWidth: 110,
          pointerLabelHeight: 64,
          pointerLabelComponent: items => {
            const {value, label} = items?.[0] || {};
            return (
              <View
                style={{
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  shadowOffset: {width: 0, height: 4},
                }}>
                <Text style={{fontSize: 12, opacity: 0.7}}>{label}</Text>
                <Text style={{fontSize: 18, fontWeight: '800'}}>{value}</Text>
              </View>
            );
          },
          onPress: () => Haptics.selectionAsync(),
          onPointerSelect: () => Haptics.selectionAsync(),
        }}
      />
    </View>
  );
}
