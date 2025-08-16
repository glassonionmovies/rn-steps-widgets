// components/charts/MultiLineChart.js
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, {
  Polyline,
  Line as SvgLine,
  Text as SvgText,
  Circle,
} from 'react-native-svg';

/**
 * Props:
 *  - labels: string[]  // x-axis labels (same length as points)
 *  - series: Array<{
 *      label: string,
 *      color?: string,
 *      points: number[],
 *      format?: (n:number)=>string,  // optional per-series formatter
 *    }>
 *  - height?: number
 *  - padding?: number
 *  - yMode?: 'joint'|'dual'  // 'dual' = separate Y scales for series[0] & series[1]
 *  - showValues?: boolean     // draw value labels near each point
 */
export default function MultiLineChart({
  series = [],
  labels = [],
  height = 160,
  padding = 16,
  yMode = 'joint',
  showValues = true,
}) {
  const width = 320; // viewBox width; scales to container width
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const calc = useMemo(() => {
    const clamp1 = (n) => Math.max(1, Number.isFinite(n) ? n : 0);

    // Max across all points (joint mode)
    const allVals = series.flatMap((s) => (s.points || []).map((v) => Number(v) || 0));
    const jointMax = clamp1(Math.max(0, ...allVals));

    // Per-series max (dual mode)
    const perMax = series.map((s) =>
      clamp1(Math.max(0, ...((s.points || []).map((v) => Number(v) || 0))))
    );

    const toXY = (i, v, sIdx) => {
      const x =
        padding + innerW * (labels.length <= 1 ? 0 : i / (labels.length - 1));
      const maxFor = yMode === 'dual' ? perMax[sIdx] || 1 : jointMax;
      const ratio = (Number(v) || 0) / maxFor;
      const y = padding + innerH - innerH * ratio;
      return { x, y };
    };

    const paths = series.map((s, sIdx) => {
      const pts = (s.points || []).map((v, i) => toXY(i, v, sIdx));
      const pointsStr = pts.map(({ x, y }) => `${x},${y}`).join(' ');
      return { ...s, pts, pointsStr };
    });

    const gridY = 4;
    const leftMax = yMode === 'dual' ? perMax[0] || 1 : jointMax;
    const rightMax = yMode === 'dual' ? perMax[1] || leftMax : leftMax;

    const leftTicks = Array.from({ length: gridY + 1 }, (_, i) => {
      const y = padding + (innerH * i) / gridY;
      const val = Math.round(leftMax * (1 - i / gridY));
      return { y, val };
    });

    const rightTicks =
      yMode === 'dual' && series.length > 1
        ? Array.from({ length: gridY + 1 }, (_, i) => {
            const y = padding + (innerH * i) / gridY;
            const val = Math.round(rightMax * (1 - i / gridY));
            return { y, val };
          })
        : [];

    return { paths, leftTicks, rightTicks };
  }, [series, labels.length, padding, innerW, innerH, yMode]);

  const defaultFormat = (n) => {
    if (!Number.isFinite(n)) return '0';
    // show full numbers so you can verify values
    return Math.round(n).toString();
  };

  return (
    <View style={{ width: '100%' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* grid */}
        {calc.leftTicks.map((t, idx) => (
          <SvgLine
            key={`g${idx}`}
            x1={padding}
            y1={t.y}
            x2={padding + innerW}
            y2={t.y}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* left ticks */}
        {calc.leftTicks.map((t, idx) => (
          <SvgText
            key={`l${idx}`}
            x={padding - 6}
            y={t.y + 3}
            fontSize="10"
            fill="#6b7280"
            textAnchor="end"
          >
            {t.val}
          </SvgText>
        ))}

        {/* right ticks (dual mode) */}
        {calc.rightTicks.map((t, idx) => (
          <SvgText
            key={`r${idx}`}
            x={padding + innerW + 6}
            y={t.y + 3}
            fontSize="10"
            fill="#6b7280"
            textAnchor="start"
          >
            {t.val}
          </SvgText>
        ))}

        {/* lines */}
        {calc.paths.map((s, idx) => (
          <Polyline
            key={`p${idx}`}
            points={s.pointsStr}
            fill="none"
            stroke={s.color || '#2563eb'}
            strokeWidth="2.5"
          />
        ))}

        {/* end dots */}
        {calc.paths.map((s, idx) => {
          const last = s.pts[s.pts.length - 1];
          if (!last) return null;
          return <Circle key={`d${idx}`} cx={last.x} cy={last.y} r="3.5" fill={s.color || '#2563eb'} />;
        })}

        {/* x labels */}
        {labels.map((lab, i) => {
          const x = padding + innerW * (labels.length <= 1 ? 0 : i / (labels.length - 1));
          const y = padding + innerH + 14;
          return (
            <SvgText key={`x${i}`} x={x} y={y} fontSize="10" fill="#6b7280" textAnchor="middle">
              {lab}
            </SvgText>
          );
        })}

        {/* value labels at points */}
        {showValues &&
          calc.paths.map((s, sIdx) => {
            const fmt = s.format || defaultFormat;
            // offset labels to avoid overlapping between series
            const dy = sIdx === 0 ? -8 : 12;
            return s.pts.map(({ x, y }, i) => {
              const raw = s.points?.[i] ?? 0;
              const label = fmt(raw);
              // outline text for readability: draw stroke then fill
              return (
                <React.Fragment key={`val-${sIdx}-${i}`}>
                  <SvgText
                    x={x}
                    y={y + dy}
                    fontSize="10"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    fill="#000000"
                    textAnchor="middle"
                  >
                    {label}
                  </SvgText>
                  <SvgText
                    x={x}
                    y={y + dy}
                    fontSize="10"
                    fill={s.color || '#111827'}
                    textAnchor="middle"
                  >
                    {label}
                  </SvgText>
                </React.Fragment>
              );
            });
          })}
      </Svg>

      {/* legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
        {series.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: s.color || '#2563eb',
              }}
            />
            <Text style={{ fontSize: 12, color: '#374151' }}>
              {s.label}{yMode === 'dual' && i === 1 ? ' (right)' : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
