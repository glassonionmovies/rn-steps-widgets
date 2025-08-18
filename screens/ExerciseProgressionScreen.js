// screens/ExerciseProgressionScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path, Circle, G, Rect, Text as SvgText, Line } from 'react-native-svg';

import Card from '../components/ui/Card';
import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';

/* ------------ helpers (aligned to TopExercisesWidget) ------------ */
const epley = (w, r) => (Number(w) || 0) * (1 + (Number(r) || 0) / 30);
const isValidSet = (s) => (Number(s?.weight) || 0) > 0 && (Number(s?.reps) || 0) > 0;
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const safeKey = (v) => String(v ?? '').trim().toLowerCase();
const blockKeys = (b) => {
  const ex = b?.exercise || {};
  // TopExercisesWidget keys by (id || name); include title as a resilient fallback.
  return [ex.id, ex.name, ex.title].filter(Boolean).map(safeKey);
};

// tiny linear regression (x normalized 0..1) for dotted trend line
function regress(xs, ys) {
  const n = xs.length;
  if (n < 2) return { m: 0, b: ys[0] || 0 };
  const mx = xs.reduce((a, v) => a + v, 0) / n;
  const my = ys.reduce((a, v) => a + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const m = den ? num / den : 0;
  const b = my - m * mx;
  return { m, b };
}
const nearestIndex = (xs, x) =>
  xs.reduce((best, v, i) => (Math.abs(v - x) < Math.abs(xs[best] - x) ? i : best), 0);

/* ------------ compact line chart (fills its page) ------------ */
function PagerLineChart({
  sessions,                      // [{ date:number, e1rm:number, maxWeight:number, volume:number }]
  pick,                          // (s) => number
  suffix = '',
  height = 220,
  width = 320,
  yLabelFormatter,               // (v)=>string (optional)
}) {
  const ACCENT = palette?.accent || '#06B6D4';
  const PAD = 14;
  const [hover, setHover] = useState(null);

  // Build series
  const series = useMemo(() => {
    const ptsRaw = (sessions || []).map(s => ({ xIndex: s.date, yValue: Number(pick(s)) || 0, date: s.date }));
    if (!ptsRaw.length) return { pts: [], path: '', area: '', trendPath: '', yTicks: [] };

    const xs = ptsRaw.map((_, i) => i);
    const ys = ptsRaw.map(p => p.yValue);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const yLo = minY === maxY ? (minY - 1) : minY;
    const yHi = minY === maxY ? (maxY + 1) : maxY;

    const H = Math.max(height - PAD * 2, 1);
    const W = Math.max(width - PAD * 2, 1);

    const sx = (i) => PAD + (xs.length === 1 ? W / 2 : (i / (xs.length - 1)) * W);
    const sy = (v) => PAD + H - ((v - yLo) / (yHi - yLo)) * H;

    const pts = ptsRaw.map((p, i) => ({ x: sx(i), y: sy(p.yValue), rawY: p.yValue, rawX: p.date }));
    const path = pts.reduce((acc, p, i) => acc + (i ? ` L ${p.x} ${p.y}` : `M ${p.x} ${p.y}`), '');
    const area = `${path} L ${PAD + W} ${PAD + H} L ${PAD} ${PAD + H} Z`;

    // trend line over normalized i 0..1
    const xNorm = xs.map(i => (i - 0) / Math.max(1, xs.length - 1));
    const { m, b } = regress(xNorm, ys);
    const tlY0 = b;
    const tlY1 = m * 1 + b;
    const trendPath = `M ${PAD} ${sy(tlY0)} L ${PAD + W} ${sy(tlY1)}`;

    // simple y ticks (4 lines)
    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
      const v = yLo + ((yHi - yLo) * i) / ticks;
      return { y: sy(v), v };
    });

    // simple x labels (first/middle/last dates)
    const xi = [0, Math.floor((xs.length - 1) / 2), xs.length - 1].filter((v, i, a) => a.indexOf(v) === i);

    return { pts, path, area, trendPath, yTicks, PAD, W, H, xIndexLabels: xi.map(i => ({ i, x: sx(i), date: ptsRaw[i].date })) };
  }, [sessions, pick, height, width]);

  const onTouch = (evt) => {
    if (!series.pts.length) return;
    const x = evt.nativeEvent.locationX;
    const idx = nearestIndex(series.pts.map(p => p.x), x);
    const p = series.pts[idx];
    setHover({ i: idx, x: p.x, y: p.y });
  };

  if (!sessions?.length) {
    return <Text style={{ color: palette.sub }}>No sessions yet. Log a few workouts to see your progression.</Text>;
  }

  return (
    <Svg width={width} height={height}>
      {/* y grid */}
      {series.yTicks.map((t, k) => (
        <G key={`g-${k}`}>
          <Line x1={series.PAD} y1={t.y} x2={series.PAD + series.W} y2={t.y} stroke={palette.border} strokeWidth="1" />
          <SvgText x={4} y={t.y + 4} fontSize="10" fill={palette.sub}>
            {yLabelFormatter ? yLabelFormatter(t.v) : Math.round(t.v)}
          </SvgText>
        </G>
      ))}

      {/* area (opacity for soft fill) */}
      <Path d={series.area} fill={ACCENT} fillOpacity={0.18} />

      {/* line */}
      <Path d={series.path} stroke={ACCENT} strokeWidth="2" fill="none" />

      {/* trend (dotted) */}
      <Path d={series.trendPath} stroke={palette.sub} strokeWidth="1.5" strokeDasharray="4 4" fill="none" />

      {/* points */}
      {series.pts.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="#fff"
          stroke={ACCENT}
          strokeWidth="2"
          onPress={(evt) => { evt?.stopPropagation?.(); setHover({ i, x: p.x, y: p.y }); }}
        />
      ))}

      {/* x labels (first/mid/last) */}
      {series.xIndexLabels.map((lab, k) => (
        <SvgText key={`xl-${k}`} x={lab.x} y={height - 4} fontSize="10" fill={palette.sub} textAnchor="middle">
          {new Date(lab.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
        </SvgText>
      ))}

      {/* hover */}
      {!!hover && (() => {
        const i = hover.i;
        const p = series.pts[i];
        const s = sessions[i];
        const label = `${Math.round(p.rawY)}${suffix}`;
        const dateStr = fmtDate(s.date);

        const boxW = 140, boxH = 48;
        const bx = Math.min(Math.max(hover.x - boxW / 2, 6), width - boxW - 6);
        const by = Math.max(hover.y - boxH - 12, 6);

        return (
          <G>
            <Line x1={p.x} y1={0} x2={p.x} y2={height} stroke={palette.border} strokeWidth="1" />
            <Rect x={bx} y={by} width={boxW} height={boxH} rx="6" ry="6" fill="white" stroke={palette.border} />
            <SvgText x={bx + 8} y={by + 18} fontSize="12" fill={palette.text}>{label}</SvgText>
            <SvgText x={bx + 8} y={by + 34} fontSize="11" fill={palette.sub}>{dateStr}</SvgText>
          </G>
        );
      })()}

      {/* touch layer */}
      <Rect x="0" y="0" width={width} height={height} fill="transparent" onPress={onTouch} onLongPress={onTouch} />
    </Svg>
  );
}

/* ------------ main screen ------------ */
export default function ExerciseProgressionScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  // Support BOTH shapes:
  // 1) { exerciseName, muscleGroup, exerciseId }
  // 2) { exercise: { exerciseName, muscleGroup, exerciseId } }
  const raw = route?.params || {};
  const p = (raw.exercise && typeof raw.exercise === 'object') ? raw.exercise : raw;

  const exerciseName = p.exerciseName ?? p.name ?? p.title ?? 'Progression';
  const exerciseId   = p.exerciseId   ?? p.id   ?? null;
  const muscleGroup  = p.muscleGroup  ?? p.group ?? null;

  useEffect(() => {
    const title = exerciseName && exerciseName !== 'Progression' ? `${exerciseName} Progression` : 'Progression';
    navigation.setOptions({ title });
  }, [exerciseName, navigation]);

  const [workouts, setWorkouts] = useState([]);
  useEffect(() => { (async () => { try { setWorkouts((await getAllWorkouts()) || []); } catch {} })(); }, []);

  /* ---------- sessions + PRs (same keying as TopExercisesWidget) ---------- */
  const { sessions, bests } = useMemo(() => {
    const targetKeyPrimary = safeKey(exerciseId || exerciseName);
    const targetKeyAltName = safeKey(exerciseName);

    const sess = [];
    let bestE1 = { val: 0, date: null };
    let heaviest = { weight: 0, date: null };
    let mostReps = { reps: 0, weight: 0, date: null };
    let mostVolume = { vol: 0, date: null };

    (workouts || []).forEach((w) => {
      let touched = false;
      let volThis = 0;
      let maxE1 = 0;
      let maxW = 0;

      (w.blocks || []).forEach((b) => {
        if (muscleGroup && b?.exercise?.muscleGroup && b.exercise.muscleGroup !== muscleGroup) return;
        const keys = blockKeys(b);
        const matches = keys.includes(targetKeyPrimary) || keys.includes(targetKeyAltName);
        if (!matches) return;

        (b.sets || []).filter(isValidSet).forEach((s) => {
          touched = true;
          const weight = Number(s.weight) || 0;
          const reps   = Number(s.reps) || 0;
          const vol    = weight * reps;
          const e1     = epley(weight, reps);

          volThis += vol;
          if (weight > maxW) maxW = weight;
          if (e1 > maxE1) maxE1 = e1;
          if (e1 > bestE1.val) bestE1 = { val: e1, date: w?.endedAt || w?.startedAt };
          if (weight > heaviest.weight) heaviest = { weight, date: w?.endedAt || w?.startedAt };
          if (reps > mostReps.reps)     mostReps = { reps, weight, date: w?.endedAt || w?.startedAt };
        });
      });

      if (touched) {
        const ts = w?.endedAt || w?.startedAt || w?.date || w?.createdAt || new Date().toISOString();
        sess.push({
          id: w?.id,
          date: new Date(ts).getTime(),
          e1rm: maxE1,
          maxWeight: maxW,
          volume: volThis,
        });
        if (volThis > (mostVolume.vol || 0)) mostVolume = { vol: volThis, date: ts };
      }
    });

    sess.sort((a, b) => (a.date || 0) - (b.date || 0));
    return { sessions: sess, bests: { bestE1, heaviest, mostReps, mostVolume } };
  }, [workouts, exerciseId, exerciseName, muscleGroup]);

  /* -------- pager state -------- */
  const [pageW, setPageW] = useState(0);
  const [page, setPage] = useState(0);
  const pagerRef = useRef(null);

  const titles = [
    'Strength Progression (e1RM)',
    'Max Weight per Session',
    'Session Volume',
  ];
  const suffixes = [' lbs', ' lbs', ' lbs'];
  const pickers = [
    (s) => s.e1rm,
    (s) => s.maxWeight,
    (s) => s.volume,
  ];

  const onScroll = (e /** @type {NativeSyntheticEvent<NativeScrollEvent>} */) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = e.nativeEvent.layoutMeasurement.width || pageW || 1;
    const i = Math.round(x / w);
    if (i !== page) setPage(i);
  };

  /* -------- render -------- */
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingHorizontal: layout.screenHMargin,
        paddingTop: spacing(2),
        paddingBottom: spacing(4),
        gap: spacing(2),
      }}
    >
      {/* Header */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.title}>{exerciseName}</Text>
        <Text style={styles.sub}>Progression</Text>
      </Card>

      {/* Charts pager */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>{titles[page]}</Text>
        <View style={{ height: spacing(1) }} />

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(e) => setPageW(e.nativeEvent.layout.width)}
        >
          {[0, 1, 2].map((idx) => (
            <View key={idx} style={{ width: pageW || 1 }}>
              <PagerLineChart
                sessions={sessions}
                pick={pickers[idx]}
                suffix={suffixes[idx]}
                width={pageW || 1}
                height={220}
                yLabelFormatter={(v) =>
                  idx === 2 ? Math.round(v).toLocaleString() : Math.round(v)
                }
              />
            </View>
          ))}
        </ScrollView>

        {/* dots */}
        <View style={{ alignSelf: 'center', flexDirection: 'row', gap: 6, marginTop: spacing(1) }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: i === page ? palette.text : palette.border,
              }}
            />
          ))}
        </View>
      </Card>

      {/* All-Time Bests */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>All-Time Bests</Text>
        <View style={{ height: spacing(1) }} />
        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.k}>Best e1RM</Text>
            <Text style={styles.v}>{bests.bestE1.val > 0 ? `${Math.round(bests.bestE1.val)} lbs` : '—'}</Text>
            <Text style={styles.d}>{bests.bestE1.date ? `on ${fmtDate(bests.bestE1.date)}` : ''}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.k}>Heaviest Weight</Text>
            <Text style={styles.v}>{bests.heaviest.weight > 0 ? `${Math.round(bests.heaviest.weight)} lbs` : '—'}</Text>
            <Text style={styles.d}>{bests.heaviest.date ? `on ${fmtDate(bests.heaviest.date)}` : ''}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.k}>Most Volume (Workout)</Text>
            <Text style={styles.v}>{bests.mostVolume.vol > 0 ? `${Math.round(bests.mostVolume.vol).toLocaleString()} lbs` : '—'}</Text>
            <Text style={styles.d}>{bests.mostVolume.date ? `on ${fmtDate(bests.mostVolume.date)}` : ''}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.k}>Most Reps (Single Set)</Text>
            <Text style={styles.v}>
              {bests.mostReps.reps > 0
                ? `${bests.mostReps.reps} reps @ ${Math.round(bests.mostReps.weight)} lbs`
                : '—'}
            </Text>
            <Text style={styles.d}>{bests.mostReps.date ? `on ${fmtDate(bests.mostReps.date)}` : ''}</Text>
          </View>
        </View>
      </Card>

      {/* Rep.AI Analysis */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>Rep.AI Analysis</Text>
        <View style={{ height: spacing(1) }} />
        <View style={styles.aiRow}>
          <Text style={styles.aiIcon}>🧠</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Plateau Detection</Text>
            <Text style={styles.aiBody}>
              {(sessions.length >= 3 && Math.abs(sessions.at(-1).e1rm - sessions.at(-3).e1rm) / Math.max(1, sessions.at(-3).e1rm) <= 0.01)
                ? 'Your e1RM has been flat across the last 3 sessions. Consider a deload or nutrition tweak.'
                : 'Progress looks healthy — keep your training consistent and recover well.'}
            </Text>
          </View>
        </View>

        <View style={{ height: spacing(1) }} />

        <View style={styles.aiRow}>
          <Text style={styles.aiIcon}>🔗</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Accessory Suggestions</Text>
            <Text style={styles.aiBody}>{`To drive your ${exerciseName || 'lift'}, try:`}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {['Tricep Dips','Skull Crushers','Close-Grip Bench','Face Pulls','Incline DB Press'].map((ex, i) => (
                <Pressable key={i} onPress={() => { /* navigation.navigate('ExerciseDetail', { name: ex }) */ }} style={styles.pill}>
                  <Text style={styles.pillText}>{ex}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

/* ------------ styles ------------ */
const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: '900' },
  sub: { color: palette.sub, marginTop: 2 },

  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  cell: { flexBasis: '48%', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  k: { color: palette.sub, fontSize: 12 },
  v: { color: palette.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
  d: { color: palette.sub, fontSize: 11, marginTop: 2 },

  aiRow: { flexDirection: 'row', gap: spacing(1), alignItems: 'flex-start' },
  aiIcon: { fontSize: 18, width: 22, textAlign: 'center' },
  aiTitle: { color: palette.text, fontWeight: '800' },
  aiBody: { color: palette.text, opacity: 0.8, marginTop: 2, lineHeight: 18 },

  pill: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'transparent' },
  pillText: { color: palette.text, fontWeight: '700', fontSize: 12 },
});
