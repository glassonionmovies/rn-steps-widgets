// utils/planNormalize.js
// Normalizes the LLM response into the canonical in-app shape,
// preserves structured "why" and synthesizes a plain-text justification.

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const isFiniteNumber = (n) => Number.isFinite(Number(n));

function coerceNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function summarizeWhy(why) {
  if (!why) return '';
  try {
    if (typeof why === 'string') return why;
    const parts = [];
    if (why.overview) parts.push(why.overview);

    if (Array.isArray(why.perExercise) && why.perExercise.length) {
      parts.push(
        'Per exercise:',
        ...why.perExercise.map((p) => {
          const ex = p?.exerciseName ? `${p.exerciseName}: ` : '';
          return `• ${ex}${p?.reason || ''}`.trim();
        })
      );
    }
    if (why.volumeCheck?.byMuscleGroup?.length) {
      parts.push(
        'Volume checks:',
        ...why.volumeCheck.byMuscleGroup.map((v) => {
          const d = typeof v.deltaPct === 'number' ? `${v.deltaPct.toFixed(1)}%` : '';
          return `• ${v.group}: today ${v.todayVolume} vs recent ${v.recentAvg} (${d}) → ${v.ok ? 'OK' : 'Adjust'}`;
        })
      );
    }
    if (why.safetyAndFeasibility) parts.push(`Safety: ${why.safetyAndFeasibility}`);
    return parts.join('\n');
  } catch {
    return '';
  }
}

export function normalizePlan(inputPlan) {
  const nowIso = new Date().toISOString();
  const plan = inputPlan || {};

  const name = plan.name || 'Rep.AI Plan';
  const units = plan.units === 'kg' ? 'kg' : 'lb';
  const why = plan.why || null;

  const blocks = Array.isArray(plan.blocks) ? plan.blocks : [];
  const normBlocks = blocks.map((b) => {
    const exIn = b?.exercise || {};
    const ex = {
      id: exIn.id || uid(),
      name: exIn.name || 'Unknown Exercise',
      muscleGroup: exIn.muscleGroup || 'unknown',
      equipment: exIn.equipment || 'bodyweight',
      pattern: exIn.pattern || 'general',
    };

    const setsIn = Array.isArray(b?.sets) ? b.sets : [];
    const sets = setsIn
      .map((s) => ({
        id: uid(),
        weight: coerceNumber(s?.weight, 0),
        reps: coerceNumber(s?.reps, 0),
      }))
      .filter((s) => isFiniteNumber(s.weight) && isFiniteNumber(s.reps));

    const notes = b?.notes ? String(b.notes) : undefined;

    // Guarantee minimum one set with numbers to satisfy downstream UI
    if (!sets.length) sets.push({ id: uid(), weight: 0, reps: 0 });

    return {
      id: uid(),
      exercise: ex,
      sets,
      ...(notes ? { notes } : {}),
    };
  });

  const meta = {
    createdAt: nowIso,
    justification: summarizeWhy(why) || 'Plan tailored to history, vitals, and preferences.',
    whyRaw: why || null, // keep structured details for richer UI
  };

  return {
    id: uid(),
    name,
    units,
    blocks: normBlocks,
    meta,
  };
}

