// components/charts/MultiLineChart.js
import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';

// --- helpers ---
const isNum = (n) => Number.isFinite(n);
const fmtK = (n) => `${Math.round((Number(n) || 0) / 1000)}k`;

function niceAxis(series) {
  const all = series.flatMap(s => (s.points || []).filter(isNum));
  const max = Math.max(1, ...all, 1);
  const niceMax = Math.ceil(max / 1000) * 1000 || 1000;
  const step = Math.max(1000, Math.ceil(niceMax / 3 / 1000) * 1000);
  const ticks = [0, step, step * 2, step * 3];
  return { max: step * 3, ticks };
}

// draw a segment using a rotated view
function segStyle(x1, y1, x2, y2, color, thickness = 2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!isNum(len) || len <= 0) return { display: 'none' };
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  // extend slightly so it tucks under dots
  const ext = 6;
  const ux = dx / len, uy = dy / len;
  const startX = x1 - ux * (ext / 2);
  const startY = y1 - uy * (ext / 2);
  return {
    position: 'absolute',
    left: startX,
    top: startY,
    width: len + ext,
    height: thickness,
    backgroundColor: color,
    transform: [{ rotateZ: `${ang}deg` }],
    borderRadius: thickness / 2,
  };
}

export default function MultiLineChart({
  labels = [],
  series = [],           // [{ label, color, points }]
  showYAxis = true,
}) {
  const [{ w, h }, setSize] = useState({ w: 0, h: 0 });

  // align lengths to avoid stray lines
  const aligned = useMemo(() => {
    const nLabels = labels.length;
    return series.map(s => {
      const pts = Array.isArray(s.points) ? s.points.slice() : [];
      const n = Math.min(nLabels, pts.length);
      return {
        ...s,
        n,
        points: pts.slice(0, n).map(v => {
          const nV = Number(v);
          return Number.isFinite(nV) ? nV : null; // keep 0, null invalid
        }),
      };
    });
  }, [series, labels]);

  const axis = useMemo(() => niceAxis(aligned), [aligned]);

  const AXIS_W = showYAxis ? 34 : 0;
  const BOT_H = 18;
  const innerW = Math.max(0, w - AXIS_W - 8);
  const innerH = Math.max(0, h - BOT_H - 8);

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
      style={{ height: 220, width: '100%' }}
    >
      {/* grid */}
      <View style={{ position: 'absolute', left: AXIS_W, top: 0, right: 0, bottom: BOT_H }}>
        {axis.ticks.map((t, idx) => {
          const y = innerH - (innerH * t) / axis.max;
          return (
            <View
              key={`g-${idx}`}
              style={{ position: 'absolute', left: 0, right: 0, top: y, height: 1, backgroundColor: '#E5E7EB' }}
            />
          );
        })}
      </View>

      {/* y-axis labels */}
      {showYAxis && (
        <View style={{ position: 'absolute', left: 0, top: 0, width: AXIS_W, bottom: BOT_H }}>
          {axis.ticks.map((t, idx) => {
            const y = innerH - (innerH * t) / axis.max;
            return (
              <Text
                key={`yl-${idx}`}
                style={{ position: 'absolute', right: 4, top: y - 7, fontSize: 10, color: '#6B7280' }}
              >
                {fmtK(t)}
              </Text>
            );
          })}
        </View>
      )}

      {/* lines & dots */}
      <View style={{ position: 'absolute', left: AXIS_W, right: 0, top: 0, bottom: BOT_H }}>
        {aligned.map((s, si) => {
          const n = s.n;
          if (n <= 0) return null;
          const xStep = n > 1 ? innerW / (n - 1) : innerW;
          const color = s.color || '#2563eb';

          // coords
          const pts = Array.from({ length: n }).map((_, i) => {
            const v = s.points[i];
            const valid = v !== null;
            const x = (n <= 1) ? innerW / 2 : i * xStep;
            const y = valid ? innerH - (v / axis.max) * innerH : null;
            return { x, y, valid };
          });

          return (
            <View key={`series-${si}`} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
              {/* segments between consecutive valid points */}
              {pts.map((p, i) => {
                if (i === 0) return null;
                const a = pts[i - 1], b = pts[i];
                if (!(a.valid && b.valid)) return null;
                return <View key={`seg-${si}-${i}`} style={segStyle(a.x, a.y, b.x, b.y, color, 2)} />;
              })}
              {/* dots (slightly larger to cover segment ends) */}
              {pts.map((p, i) =>
                p.valid ? (
                  <View
                    key={`dot-${si}-${i}`}
                    style={{
                      position: 'absolute',
                      left: p.x - 4, top: p.y - 4,
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: color,
                    }}
                  />
                ) : null
              )}
            </View>
          );
        })}
      </View>

      {/* x labels */}
      <View style={{ position: 'absolute', left: AXIS_W, right: 0, bottom: 0, height: BOT_H, flexDirection: 'row', justifyContent: 'space-between' }}>
        {labels
          .slice(0, Math.max(0, ...aligned.map(s => s.n)))
          .map((lab, i) => (
            <Text key={`xl-${i}`} style={{ fontSize: 10, color: '#6B7280' }}>{lab}</Text>
          ))}
      </View>
    </View>
  );
}
