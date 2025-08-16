// utils/coach.js
// Centralized "Rep.Ai" heuristics. No external deps.

const DAY_MS = 24 * 60 * 60 * 1000;

const isValidSet = (s) => (Number(s?.weight) || 0) > 0 && (Number(s?.reps) || 0) > 0;
const e1RM = (w, r) => Number(w) * (1 + Number(r) / 30); // Epley
const startOfDay = (ts) => {
  const d = new Date(ts || Date.now());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const dayKey = (ts) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// ----- Linear regression (least squares) on (x,y) where x in days -----
function linearRegression(points) {
  // points: [{x, y}]
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (const p of points) {
    sumX += p.x; sumY += p.y;
    sumXY += p.x * p.y; sumXX += p.x * p.x; sumYY += p.y * p.y;
  }
  const denom = (n * sumXX - sumX * sumX) || 1;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  // r^2
  const meanY = sumY / n;
  const ssTot = sumYY - n * meanY * meanY;
  const ssRes = points.reduce((acc, p) => acc + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2 };
}

// ----- ACWR: acute (7d avg) vs chronic (28d avg of prior 28 days) -----
function computeACWR(byDayMap, todayTs = Date.now()) {
  // byDayMap: Map<dayKey, volume>
  const today0 = startOfDay(todayTs);
  // Build an array of last 35 days (we need 7 + 28)
  const arr = [];
  for (let i = 34; i >= 0; i--) {
    const ts = today0 - i * DAY_MS;
    const key = dayKey(ts);
    arr.push(Number(byDayMap.get(key) || 0));
  }
  const last7 = arr.slice(-7);
  const prev28 = arr.slice(0, 28);
  const acuteAvg = last7.reduce((a, b) => a + b, 0) / 7;
  const chronicAvg = prev28.reduce((a, b) => a + b, 0) / 28;
  if (!isFinite(chronicAvg) || chronicAvg <= 0) {
    return { ratio: null, acuteAvg, chronicAvg: 0, status: 'unknown', message: 'Not enough history for ACWR.' };
  }
  const ratio = acuteAvg / chronicAvg;
  let status, message;
  if (ratio > 1.3) {
    status = 'high';
    message = 'Your recent load spiked above your 4-week baseline (ACWR > 1.3). Watch recovery and consider tapering.';
  } else if (ratio < 0.8) {
    status = 'low';
    message = 'Your recent load is below your 4-week baseline (ACWR < 0.8). You may be under-stimulating this pattern.';
  } else {
    status = 'optimal';
    message = 'Your recent load is in an optimal range vs baseline (ACWR 0.8–1.3).';
  }
  return { ratio, acuteAvg, chronicAvg, status, message };
}

// ----- Notes parser (simple keyword scan) -----
function parseNotes(workouts, { group = null, exercise = null } = {}) {
  // Scans w.note, b.note, s.note for flags
  const hits = { fail: 0, elbow: 0, shoulder: 0, back: 0, knee: 0, form: 0, rep4or5: 0 };
  const rxFail = /\bfail(ed|ing)?\b|\bmiss(ed)?\b/i;
  const rxElbow = /\belbow\b/i;
  const rxShoulder = /\bshoulder\b/i;
  const rxBack = /\bback\b/i;
  const rxKnee = /\bknee(s)?\b/i;
  const rxForm = /\bform|technique|cue\b/i;
  const rxRep4or5 = /\brep(s)?\s*(4|5)\b|\b4(th)?\b|\b5(th)?\b/i;

  (workouts || []).forEach((w) => {
    const considerWorkout = !group && !exercise ? true : true; // we’ll filter at block level mostly
    if (!considerWorkout) return;

    const scanText = (t) => {
      if (!t || typeof t !== 'string') return;
      if (rxFail.test(t)) hits.fail++;
      if (rxElbow.test(t)) hits.elbow++;
      if (rxShoulder.test(t)) hits.shoulder++;
      if (rxBack.test(t)) hits.back++;
      if (rxKnee.test(t)) hits.knee++;
      if (rxForm.test(t)) hits.form++;
      if (rxRep4or5.test(t)) hits.rep4or5++;
    };

    if (w.note) scanText(w.note);

    (w.blocks || []).forEach((b) => {
      const inGroup = group ? b?.exercise?.muscleGroup === group : true;
      const isExercise = exercise
        ? (b?.exercise?.id || b?.exercise?.name) === (exercise.id || exercise.name)
        : true;
      if (!inGroup || !isExercise) return;

      if (b.note) scanText(b.note);
      (b.sets || []).forEach((s) => {
        if (s.note) scanText(s.note);
      });
    });
  });

  const tips = [];
  if (hits.fail >= 3) tips.push('Frequent failure notes detected. Consider leaving 1–2 reps in reserve to sustain progress.');
  if (hits.rep4or5 >= 2) tips.push('You often mention sticking around reps 4–5. Add triceps emphasis (e.g., close-grip bench) next block.');
  if (hits.elbow >= 2) tips.push('Elbow discomfort noted. Consider neutral-grip accessories and monitor volume.');
  if (hits.shoulder >= 2) tips.push('Shoulder discomfort noted. Prioritize scapula control and avoid deep stretch under load temporarily.');
  if (hits.back >= 2) tips.push('Back fatigue/pain noted. Check bracing and consider reducing axial load this week.');
  if (hits.knee >= 2) tips.push('Knee discomfort noted. Use slower eccentrics, ensure warm-up, and watch quad-dominant volume.');
  if (hits.form >= 2) tips.push('Form cues appear often. Consider adding light technique sets or filming top sets for review.');
  return { hits, tips };
}

// ----- Group-level aggregates -----
function aggregateGroup(workouts, group, rangeDays) {
  const now = Date.now();
  const cutoff = typeof rangeDays === 'number' ? now - rangeDays * DAY_MS : null;

  const filtered = (workouts || []).filter((w) => !cutoff || (w.startedAt || 0) >= cutoff);

  const byDayVolume = new Map(); // key -> volume for this group
  const byExercise = new Map();  // id/name -> { exercise, volume, sessions:Set, bestSet }
  const sessions = [];

  filtered.forEach((w) => {
    let hit = false;
    (w.blocks || []).forEach((b) => {
      if (b?.exercise?.muscleGroup !== group) return;
      const blockVol = (b.sets || []).filter(isValidSet).reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0);
      if (blockVol > 0) {
        hit = true;
        const k = dayKey(startOfDay(w.startedAt || now));
        byDayVolume.set(k, (byDayVolume.get(k) || 0) + blockVol);

        const id = b.exercise?.id || b.exercise?.name;
        const cur = byExercise.get(id) || { exercise: b.exercise, volume: 0, sessions: new Set(), bestSet: { weight: 0, reps: 0 } };
        cur.volume += blockVol;
        cur.sessions.add(w.id);
        (b.sets || []).forEach((s) => {
          if (!isValidSet(s)) return;
          if (Number(s.weight) > cur.bestSet.weight || (Number(s.weight) === cur.bestSet.weight && Number(s.reps) > cur.bestSet.reps)) {
            cur.bestSet = { weight: Number(s.weight), reps: Number(s.reps) };
          }
        });
        byExercise.set(id, cur);
      }
    });
    if (hit) sessions.push(w);
  });

  // KPIs
  const totalVolume = Array.from(byDayVolume.values()).reduce((a, b) => a + b, 0);
  const workoutsCount = sessions.length;
  const weeks = Math.max(1, (typeof rangeDays === 'number' ? rangeDays : 90) / 7);
  const avgPerWeek = workoutsCount / weeks;

  // Previous equal period volume
  let deltaPct = null;
  if (typeof rangeDays === 'number') {
    const startPrev = (cutoff || now) - rangeDays * DAY_MS;
    const endPrev = cutoff || now;
    const prevVolume = (workouts || []).reduce((acc, w) => {
      const ts = w.startedAt || 0;
      if (ts >= startPrev && ts < endPrev) {
        let vol = 0;
        (w.blocks || []).forEach((b) => {
          if (b?.exercise?.muscleGroup !== group) return;
          vol += (b.sets || []).filter(isValidSet).reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0);
        });
        return acc + vol;
      }
      return acc;
    }, 0);
    deltaPct = prevVolume > 0 ? ((totalVolume - prevVolume) / prevVolume) * 100 : null;
  }

  // Top exercises
  const topExercises = Array.from(byExercise.values())
    .map((v) => ({ exercise: v.exercise, volume: v.volume, sessions: v.sessions.size, bestSet: v.bestSet }))
    .sort((a, b) => b.volume - a.volume);

  // Balance: top share
  let balance = null;
  if (topExercises.length > 0) {
    const top = topExercises[0];
    const topShare = totalVolume > 0 ? top.volume / totalVolume : 0;
    let status, message;
    if (topShare > 0.6) {
      status = 'skewed';
      message = `Training is heavily concentrated on ${top.exercise?.name}. Consider prioritizing #2–3 for balance.`;
    } else if (topShare < 0.3 && topExercises.length >= 3) {
      status = 'diverse';
      message = 'Nice variety across exercises—keep rotating to cover weak links.';
    } else {
      status = 'balanced';
      message = 'Solid balance of exercise selection.';
    }
    balance = { topName: top.exercise?.name, topShare, status, message };
  }

  // e1RM trend per group: use best e1RM across any exercise of this group per workout
  const e1rmPoints = [];
  sessions.forEach((w) => {
    let best = 0;
    (w.blocks || []).forEach((b) => {
      if (b?.exercise?.muscleGroup !== group) return;
      (b.sets || []).forEach((s) => {
        if (!isValidSet(s)) return;
        const est = e1RM(s.weight, s.reps);
        if (est > best) best = est;
      });
    });
    if (best > 0) {
      e1rmPoints.push({ x: (startOfDay(w.startedAt || now) - startOfDay(now)) / DAY_MS, y: best });
    }
  });
  e1rmPoints.sort((a, b) => a.x - b.x);
  const reg = e1rmPoints.length >= 3 ? linearRegression(e1rmPoints) : { slope: 0, r2: 0 };
  const slopePerWeek = reg.slope * 7; // convert (per-day) to per-week
  let trendMsg = null;
  if (e1rmPoints.length >= 3) {
    if (slopePerWeek > 0.5) trendMsg = `Strength trending up ~${slopePerWeek.toFixed(1)} lbs/week.`;
    else if (slopePerWeek < -0.3) trendMsg = `Strength trending down ~${Math.abs(slopePerWeek).toFixed(1)} lbs/week.`;
    else trendMsg = 'Strength trend is flat—aim for progressive overload.';
  }

  // ACWR on group-level volume
  const acwr = computeACWR(byDayVolume, now);

  // Notes
  const { tips: noteTips } = parseNotes(filtered, { group });

  return {
    byDayVolume,
    totalVolume,
    workoutsCount,
    avgPerWeek,
    deltaPct,
    topExercises,
    balance,
    e1rmTrend: { slopePerWeek, r2: reg.r2, message: trendMsg },
    acwr,
    noteTips,
  };
}

// ----- Exercise-level aggregates -----
function aggregateExercise(workouts, exercise) {
  const sessions = [];
  (workouts || []).forEach((w) => {
    let has = false;
    let vol = 0;
    let maxW = 0;
    let maxE1 = 0;
    (w.blocks || []).forEach((b) => {
      if ((b?.exercise?.id || b?.exercise?.name) !== (exercise?.id || exercise?.name)) return;
      (b.sets || []).forEach((s) => {
        if (!isValidSet(s)) return;
        has = true;
        const wv = Number(s.weight) || 0;
        const rv = Number(s.reps) || 0;
        vol += wv * rv;
        if (wv > maxW) maxW = wv;
        const est = e1RM(wv, rv);
        if (est > maxE1) maxE1 = est;
      });
    });
    if (has) sessions.push({ id: w.id, date: w.startedAt || Date.now(), vol, maxW, maxE1 });
  });
  sessions.sort((a, b) => (a.date || 0) - (b.date || 0));

  // Plateau detection on last N sessions e1RM
  const PLATEAU_SESSIONS = 4;
  const PLATEAU_BAND = 0.02; // 2%
  let plateau = null;
  if (sessions.length >= PLATEAU_SESSIONS + 1) {
    const lastN = sessions.slice(-PLATEAU_SESSIONS);
    const max = Math.max(...lastN.map((d) => d.maxE1 || 0));
    const min = Math.min(...lastN.map((d) => d.maxE1 || 0));
    if (max > 0 && (max - min) / max < PLATEAU_BAND) {
      plateau = {
        sessions: PLATEAU_SESSIONS,
        message: 'e1RM steady across recent sessions—consider deload or a 5×5 block for new stimulus.',
      };
    }
  }

  // e1RM trend slope per week
  const pts = sessions.map((s) => ({
    x: (startOfDay(s.date) - startOfDay(Date.now())) / DAY_MS,
    y: s.maxE1 || 0,
  }));
  const reg = pts.length >= 3 ? linearRegression(pts) : { slope: 0, r2: 0 };
  const slopePerWeek = reg.slope * 7;

  // ACWR for this exercise based on daily volume
  const byDay = new Map();
  sessions.forEach((s) => {
    const k = dayKey(startOfDay(s.date));
    byDay.set(k, (byDay.get(k) || 0) + (s.vol || 0));
  });
  const acwr = computeACWR(byDay, Date.now());

  // Notes
  const { tips: noteTips } = parseNotes(workouts, { exercise });

  return {
    sessions,
    e1rmTrend: { slopePerWeek, r2: reg.r2 },
    plateau,
    acwr,
    noteTips,
  };
}

export const coach = {
  e1RM,
  aggregateGroup,
  aggregateExercise,
  parseNotes,
  computeACWR,
};
export default coach;
