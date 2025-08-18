// utils/realtimeExerciseRecommender.js

/**
 * Very first pass: recommend the same exercise and numbers
 * as the *last valid set* in the current session.
 *
 * @param {Object} session - { blocks, units, startedAt, workoutId }
 * @returns {null | { exercise, weight:number, reps:number, note?:string }}
 */
export function recommendNextExercise(session) {
    const blocks = session?.blocks || [];
    // Walk backwards to find last set with weight>0 and reps>0
    for (let b = blocks.length - 1; b >= 0; b--) {
      const block = blocks[b];
      const sets = block?.sets || [];
      for (let i = sets.length - 1; i >= 0; i--) {
        const s = sets[i];
        const w = Number(s?.weight) || 0;
        const r = Number(s?.reps) || 0;
        if (w > 0 && r > 0 && block?.exercise) {
          return {
            exercise: block.exercise, // reuse same exercise object
            weight: w,
            reps: r,
            note: 'Based on your last completed set of this session.',
          };
        }
      }
    }
    return null; // no signal yet
  }
  