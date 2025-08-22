// components/charts/ActivityReportCard.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';
import { writeSteps7 } from '../../utils/healthSteps';

// Optional HealthKit (guarded)
let AppleHealthKit = null;
try {
  const mod = require('react-native-health');
  AppleHealthKit = mod?.default ?? mod;
} catch {}

// Optional react-native-svg (guarded)
let SvgPkg = null;
try {
  SvgPkg = require('react-native-svg');
} catch {}

const CHART_HEIGHT_LINE = 180; // ~75% of prior 240
const CHART_HEIGHT_BAR  = 165; // ~75% of prior 220

const dayStart = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const dayEnd   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const isFiniteNum = (n) => Number.isFinite(n);
const fmtK = (n) => `${Math.round((Number(n) || 0) / 1000)}k`;

function normalizeSteps(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    if (payload.length === 0) return null;
    if (typeof payload[0] === 'number') return payload.map(n => Number(n) || 0);
    if (typeof payload[0] === 'object') return payload.map(o => Number(o?.value ?? o?.steps ?? o?.count ?? 0) || 0);
  }
  if (payload?.days && Array.isArray(payload.days)) return payload.days.map(d => Number(d?.value ?? 0) || 0);
  return null;
}
async function readCachedSteps7() {
  const keys = ['WidgetTwoHealth:steps7', 'health:steps7', 'WidgetTwoHealth:days'];
  for (const k of keys) {
    const raw = await AsyncStorage.getItem(k);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const arr = normalizeSteps(parsed);
      if (arr && arr.length) return arr;
    } catch {
      if (raw.includes(',')) {
        const arr = raw.split(',').map(x => Number(x.trim()) || 0);
        if (arr.length) return arr;
      }
    }
  }
  return null;
}
async function fetchHealthKit7() {
  if (!AppleHealthKit || typeof AppleHealthKit.initHealthKit !== 'function') return null;

  const today = dayStart(new Date());
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); days.push(d); }

  const perms = { permissions: { read: [AppleHealthKit.Constants.Permissions.Steps], write: [] } };
  const hasAvail = typeof AppleHealthKit.isAvailable === 'function';
  const hasHealthAvail = typeof AppleHealthKit.isHealthDataAvailable === 'function';
  if (hasAvail) {
    const ok = await new Promise(res => AppleHealthKit.isAvailable((err, available) => res(!err && available !== false)));
    if (!ok) return null;
  } else if (hasHealthAvail && !AppleHealthKit.isHealthDataAvailable()) {
    return null;
  }
  const initOk = await new Promise(res => AppleHealthKit.initHealthKit(perms, (err) => res(!err)));
  if (!initOk) return null;

  const opts = { startDate: dayStart(days[0]).toISOString(), endDate: dayEnd(days[6]).toISOString(), includeManuallyAdded: true };
  const samples = await new Promise(res => AppleHealthKit.getDailyStepCountSamples(opts, (err, results) => res(err ? [] : results || [])));

  // Build a map keyed by LOCAL date (avoid UTC slice off-by-one)
  const map = Object.create(null);
  samples.forEach(r => {
    if (!r?.startDate) return;
    const dt = new Date(r.startDate);
    const y  = dt.getFullYear();
    const m  = String(dt.getMonth() + 1).padStart(2, '0');
    const d  = String(dt.getDate()).padStart(2, '0');
    const k  = `${y}-${m}-${d}`;
    const val = typeof r.value === 'number' ? r.value : 0;
    map[k] = (map[k] || 0) + val;
  });

  const out = days.map(d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;
    return Math.round(map[key] || 0);
  });

  try { await writeSteps7(out); } catch {}
  return out;
}
function ensure7(arr) {
  const a = (Array.isArray(arr) ? arr : []).map(v => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const last7 = a.slice(-7);
  if (last7.length < 7) return Array(7 - last7.length).fill(0).concat(last7);
  return last7;
}
function niceAxis(values) {
  const finiteVals = values.filter(isFiniteNum);
  const max = Math.max(1, ...finiteVals, 1);
  const niceMax = Math.ceil(max / 1000) * 1000 || 1000;
  const step = Math.max(1000, Math.ceil(niceMax / 3 / 1000) * 1000);
  const ticks = [0, step, step * 2, step * 3];
  return { max: step * 3, ticks };
}

// ---------- Fallback BAR chart ----------
function BarChartMini({ labels, points, showYAxis = true }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const AXIS_W = showYAxis ? 34 : 0;
  const BOT_H = 18;

  const innerW = Math.max(0, size.w - AXIS_W - 8);
  const innerH = Math.max(0, size.h - BOT_H - 8);

  const axis = useMemo(() => niceAxis(points), [points]);

  const n = Math.min(labels.length, points.length);
  const gap = 8;
  const barW = n > 0 ? Math.max(12, (innerW - gap * (n - 1)) / n) : 0;

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
      style={{ height: CHART_HEIGHT_BAR, width: '100%' }}
    >
      {/* GRID */}
      <View style={{ position: 'absolute', left: AXIS_W, top: 0, right: 0, bottom: BOT_H }}>
        {axis.ticks.map((t, idx) => {
          const y = innerH - (innerH * t) / axis.max;
          return (
            <View
              key={`grid-${idx}`}
              style={{ position: 'absolute', left: 0, right: 0, top: y, height: 1, backgroundColor: '#E5E7EB' }}
            />
          );
        })}
      </View>

      {/* Y AXIS */}
      {showYAxis && (
        <View style={{ position: 'absolute', left: 0, top: 0, width: 34, bottom: BOT_H }}>
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

      {/* BARS */}
      <View style={{ position: 'absolute', left: AXIS_W, right: 0, bottom: BOT_H, top: 0, flexDirection: 'row', alignItems: 'flex-end' }}>
        {Array.from({ length: n }).map((_, i) => {
          const v = Number(points[i]) || 0;
          const h = Math.max(0, Math.min(innerH, (v / axis.max) * innerH));
          return (
            <View key={`bar-${i}`} style={{ width: barW, marginRight: i === n - 1 ? 0 : gap, alignItems: 'center' }}>
              <View style={{ width: barW, height: h, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#06b6d4' }} />
            </View>
          );
        })}
      </View>

      {/* X LABELS */}
      <View style={{ position: 'absolute', left: AXIS_W, right: 0, bottom: 0, height: BOT_H, flexDirection: 'row' }}>
        {Array.from({ length: n }).map((_, i) => (
          <View key={`xl-${i}`} style={{ width: barW, marginRight: i === n - 1 ? 0 : 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#6B7280' }}>{labels[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------- SVG Line Chart (interactive, NO SHADING) ----------
function LineChartInteractive({ labels, points, showYAxis = true }) {
  const { Svg, Path, Line, Circle } = SvgPkg;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const AXIS_W = showYAxis ? 34 : 0;
  const BOT_H = 18;
  const innerW = Math.max(0, size.w - AXIS_W - 8);
  const innerH = Math.max(0, size.h - BOT_H - 8);

  const axis = useMemo(() => niceAxis(points), [points]);

  const n = Math.min(labels.length, points.length);
  const xStep = n > 1 ? innerW / (n - 1) : innerW;

  // coords (0 is valid; null/NaN => gap)
  const coords = useMemo(() => {
    return Array.from({ length: n }).map((_, i) => {
      const raw = Number(points[i]);
      const valid = isFiniteNum(raw);
      const v = valid ? raw : null;
      const x = (n <= 1) ? innerW / 2 : i * xStep;
      const y = valid ? innerH - (v / axis.max) * innerH : null;
      return { x, y, v, valid, i };
    });
  }, [n, points, innerW, innerH, axis.max, xStep]);

  // build a path with gaps (M/L per segment)
  const pathD = useMemo(() => {
    let d = '';
    let open = false;
    coords.forEach((p) => {
      if (p.valid) {
        if (!open) { d += `M ${p.x} ${p.y}`; open = true; }
        else { d += ` L ${p.x} ${p.y}`; }
      } else {
        open = false;
      }
    });
    return d || 'M 0 0';
  }, [coords]);

  // interaction
  const [hoverIndex, setHoverIndex] = useState(null);
  const hitboxRef = useRef(null);
  function handleTouch(evt) {
    const { locationX } = evt.nativeEvent;
    const x = Math.max(0, Math.min(innerW, locationX));
    if (n <= 1) { setHoverIndex(0); return; }
    const idx = Math.round(x / xStep);
    setHoverIndex(Math.max(0, Math.min(n - 1, idx)));
  }

  const hover = useMemo(() => {
    if (hoverIndex == null) return null;
    const p = coords[hoverIndex];
    if (!p || !p.valid) return { x: p?.x ?? 0, y: null, value: null, label: labels[hoverIndex] };
    return { x: p.x, y: p.y, value: p.v, label: labels[hoverIndex] };
  }, [hoverIndex, coords, labels]);

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
      style={{ height: CHART_HEIGHT_LINE, width: '100%' }}
    >
      {/* Y labels */}
      {showYAxis && (
        <View style={{ position: 'absolute', left: 0, top: 0, width: AXIS_W, bottom: BOT_H }}>
          {niceAxis(points).ticks.map((t, idx) => {
            const y = innerH - (innerH * t) / axis.max;
            return (
              <Text key={`yl-${idx}`} style={{ position: 'absolute', right: 4, top: y - 7, fontSize: 10, color: '#6B7280' }}>
                {fmtK(t)}
              </Text>
            );
          })}
        </View>
      )}

      {/* SVG layer */}
      <View style={{ position: 'absolute', left: AXIS_W, right: 0, top: 0, bottom: BOT_H }}>
        <Svg width={innerW} height={innerH}>
          {/* grid */}
          {axis.ticks.map((t, idx) => {
            const y = innerH - (innerH * t) / axis.max;
            return <Line key={`g-${idx}`} x1={0} x2={innerW} y1={y} y2={y} stroke="#E5E7EB" strokeWidth={1} />;
          })}

          {/* single line (no shading) */}
          <Path d={pathD} stroke="#06b6d4" strokeWidth={2} fill="none" />

          {/* dots */}
          {coords.map((p, i) =>
            p.valid ? <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={3} fill="#06b6d4" /> : null
          )}

          {/* hover line + dot */}
          {hover && hover.y != null && (
            <>
              <Line x1={hover.x} x2={hover.x} y1={0} y2={innerH} stroke="#9CA3AF" strokeDasharray="3,3" />
              <Circle cx={hover.x} cy={hover.y} r={5} fill="#06b6d4" />
              <Circle cx={hover.x} cy={hover.y} r={8} stroke="#06b6d4" strokeOpacity={0.25} fill="none" />
            </>
          )}
        </Svg>
      </View>

      {/* X labels */}
      <View style={{ position: 'absolute', left: AXIS_W, right: 0, bottom: 0, height: BOT_H, flexDirection: 'row', justifyContent: 'space-between' }}>
        {labels.slice(0, n).map((lab, i) => (
          <Text key={`xl-${i}`} style={{ fontSize: 10, color: '#6B7280' }}>{lab}</Text>
        ))}
      </View>

      {/* Tooltip */}
      {hover && hover.value != null && (
        <View
          style={{
            position: 'absolute',
            left: AXIS_W + Math.max(0, Math.min(innerW - 96, hover.x - 48)),
            top: Math.max(0, Math.min(innerH - 44, (hover.y ?? innerH / 2) - 44)),
            paddingVertical: 6,
            paddingHorizontal: 8,
            borderRadius: 8,
            backgroundColor: '#111827',
          }}
        >
          <Text style={{ color: '#9CA3AF', fontSize: 10, marginBottom: 2 }}>{hover.label}</Text>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{hover.value.toLocaleString()} steps</Text>
        </View>
      )}

      {/* Touch handler overlay */}
      <View
        ref={hitboxRef}
        style={{ position: 'absolute', left: AXIS_W, right: 0, top: 0, bottom: BOT_H }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={() => setHoverIndex(null)}
      />
    </View>
  );
}

// ---------- Card wrapper ----------
export default function ActivityReportCard() {
  const [steps, setSteps] = useState(Array(7).fill(0));

  const load = useCallback(async () => {
    const cached = await readCachedSteps7();
    if (cached && cached.length) {
      setSteps(ensure7(cached));
      // Continue to try fresh HK in background for next view
    }
    const hk = await fetchHealthKit7();
    if (hk && hk.length) {
      setSteps(ensure7(hk));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    load();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') load(); });
    return () => { mounted = false; sub.remove(); };
  }, [load]);

  // Refresh when screen gains focus (fixes "stale after navigating back" in release)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const labels = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const arr = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); arr.push(`${d.getMonth() + 1}/${d.getDate()}`); }
    return arr;
  }, []);

  const total = steps.reduce((a, b) => a + (Number(b) || 0), 0);
  const SvgAvailable = !!SvgPkg;

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text style={styles.title}>Activity Report</Text>
      {SvgAvailable ? (
        <LineChartInteractive labels={labels} points={steps} showYAxis />
      ) : (
        <BarChartMini labels={labels} points={steps} showYAxis />
      )}
      {total === 0 && (
        <Text style={{ color: palette.sub, marginTop: 6, fontSize: 12 }}>
          No steps found. Open the Wellness screen once (to sync) or grant Apple Health permissions.
        </Text>
      )}
      {!SvgAvailable && (
        <Text style={{ color: palette.sub, marginTop: 6, fontSize: 11 }}>
          Tip: install <Text style={{ fontWeight: '800', color: palette.text }}>react-native-svg</Text> for the interactive line chart.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 16, fontWeight: '800', marginBottom: spacing(1) },
});
