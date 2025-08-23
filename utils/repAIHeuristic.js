// utils/repAIHeuristic.js
// Original heuristic planner extracted to avoid require cycles.

export function generatePlan(input) {
  const now = Date.now();
  const {
    history = [],
    goals = 'hypertrophy',            // 'hypertrophy' | 'strength' | 'endurance'
    split = 'full',                   // 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs'
    timeBudgetMin = 45,
    equipment = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    catalog = DEFAULT_CATALOG,
    constraints = {},                 // { avoidMuscles?: string[], targetMuscles?: string[], injuries?: string[] }
    vitals = {},                      // { readiness?: 0..1, energy?: 0..1, sleepQuality?: 0..1, sorenessByGroup?: { Legs: 0..1, ... } }
    settings = {},                    // { units?: 'lb'|'kg', plateIncrementLb?: number, plateIncrementKg?: number, maxHeavyHingesPer7d?: number }
    seed = now,
  } = input || {};

  const rnd = mulberry32(seed >>> 0);

  const units = settings.units || inferUnits(history) || 'lb';
  const plateIncLb = clamp(settings.plateIncrementLb ?? 5, 1, 10);
  const plateIncKg = clamp(settings.plateIncrementKg ?? 2.5, 0.5, 5);
  const maxHeavyHinges7d = settings.maxHeavyHingesPer7d ?? 1;

  // 1) Signals from history
  const perGroup = aggregateHistory(history);
  const hingesIn7d = perGroup.pattern7dCount['hinge'] || 0;

  // 2) Choose priority groups (split + fairness)
  const priorityGroups = pickGroupsForSplit(split);
  priorityGroups.sort((a, b) => {
    const gapA = perGroup.gapDays[a] ?? 999, gapB = perGroup.gapDays[b] ?? 999;
    if (gapA !== gapB) return gapB - gapA;
    const volA = perGroup.vol7[a] ?? 0, volB = perGroup.vol7[b] ?? 0;
    return volA - volB;
  });

  // 3) Budget from readiness + time
  const readiness = clamp(vitals.readiness ?? blendReadiness(vitals), 0, 1);
  const baseSets = goals === 'strength' ? 22 : goals === 'endurance' ? 18 : 24;
  const setBudget = scaleByReadinessAndTime(baseSets, readiness, timeBudgetMin, goals);

  // 4) Build pool
  const pool = buildExercisePool(catalog, equipment, constraints, vitals);

  // 5) Pick exercises
  const picks = chooseExercises(pool, priorityGroups, goals, rnd, {
    hingesIn7d,
    maxHeavyHinges7d,
    lastUsedByExercise: perGroup.lastUsedByExercise,
  });

  // 6) Dose sets/reps/weights
  const scheme = repScheme(goals);
  const plateInc = units === 'kg' ? plateIncKg : plateIncLb;
  const plannedBlocks = picks.map((ex) => {
    const last = perGroup.lastPerf[ex.id] || null;
    const target = nextLoadTarget(ex, last, scheme, plateInc, units);
    const sets = Array.from({ length: target.sets }).map(() => ({
      id: uid(rnd),
      weight: target.weight,
      reps: target.reps,
    }));
    return { id: uid(rnd), exercise: ex, sets };
  });

  // 7) Trim / safety
  const trimmed = trimToBudget(plannedBlocks, setBudget, priorityGroups);
  const safe = deDuplicatePatterns(trimmed);

  // 8) Name
  const name = smartName(split, goals, priorityGroups);

  return { id: uid(rnd), name, createdAt: now, units, blocks: safe };
}

/* ---------------- helpers (exporting some for LLM wrapper) ---------------- */

export function e1RM(weight, reps) { const w=Number(weight)||0, r=Number(reps)||0; return w>0&&r>0? w*(1+r/30) : 0; }
export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
export function uid(rnd=Math.random){ const s=()=>Math.floor(rnd()*0xffffffff).toString(16).padStart(8,'0'); return `${s()}-${s()}`; }
export function mulberry32(a){ return function(){ let t=(a+=0x6d2b79f5); t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
export function inferUnits(history){ for (const w of history||[]) if (w?.units==='kg'||w?.units==='lb') return w.units; return null; }
export function blendReadiness(v){ const arr=[v.readiness,v.energy,v.sleepQuality].filter(x=>typeof x==='number'&&isFinite(x)); return arr.length? clamp(arr.reduce((a,b)=>a+b,0)/arr.length,0,1) : 0.8; }
export function cap(s){ if(!s) return ''; return String(s).charAt(0).toUpperCase()+String(s).slice(1).toLowerCase(); }

export function scaleByReadinessAndTime(base, ready, timeMin, goals){
  const perSetSec = goals==='strength'?180 : goals==='endurance'?75 : 105;
  const maxSetsByTime = Math.floor((timeMin*60)/perSetSec);
  const scaled = Math.round(base * (0.7 + 0.45*ready)); // ~0.7x..1.15x
  return clamp(scaled, Math.min(12, maxSetsByTime), Math.max(8, maxSetsByTime));
}

export function pickGroupsForSplit(split){
  switch (split) {
    case 'upper': return ['Chest','Back','Shoulders','Arms'];
    case 'lower': return ['Legs','Abs'];
    case 'push':  return ['Chest','Shoulders','Arms'];
    case 'pull':  return ['Back','Arms'];
    case 'legs':  return ['Legs','Abs'];
    case 'full':
    default:      return ['Chest','Back','Shoulders','Arms','Legs','Abs'];
  }
}

export function aggregateHistory(history){
  const now=Date.now(), vol7=Object.create(null), lastDate=Object.create(null),
        lastPerf=Object.create(null), lastUsedByExercise=Object.create(null),
        pattern7dCount=Object.create(null);
  for (const w of history||[]) {
    for (const b of w?.blocks||[]) {
      const ex=b?.exercise||{}; const group=ex.muscleGroup; const pattern=ex.pattern;
      for (const s of b?.sets||[]) {
        const done=Number(s?.completedAt)||0; const weight=Number(s?.weight)||0; const reps=Number(s?.reps)||0;
        if (done>0 && weight>0 && reps>0){
          if (now-done <= 7*86400000) {
            vol7[group]=(vol7[group]||0)+weight*reps;
            if(pattern) pattern7dCount[pattern]=(pattern7dCount[pattern]||0)+1;
          }
          lastDate[group]=Math.max(lastDate[group]||0, done);
          const key=ex.id; const best=lastPerf[key]?.bestSet||null; const e=e1RM(weight,reps);
          if (!best || e>best.e1RM) lastPerf[key]={ bestSet:{weight,reps,e1RM:e}, at:done };
          lastUsedByExercise[key]=done;
        }
      }
    }
  }
  const gapDays=Object.create(null);
  for (const g of ['Chest','Back','Shoulders','Arms','Legs','Abs']) {
    gapDays[g]=lastDate[g]? Math.floor((now-lastDate[g])/86400000) : 999;
  }
  return { vol7, gapDays, lastPerf, lastUsedByExercise, pattern7dCount };
}

export function buildExercisePool(catalog,equipment,constraints,vitals){
  const allowed=new Set(equipment);
  const avoid=new Set((constraints.avoidMuscles||[]).map(cap));
  const target=new Set((constraints.targetMuscles||[]).map(cap));
  const sore=vitals.sorenessByGroup||{};
  const pool = (catalog||[])
    .filter(ex => {
      if (ex?.equipment && !allowed.has(ex.equipment)) return false;
      if (avoid.has(cap(ex.muscleGroup))) return false;
      if (constraints.injuries?.includes('lower_back') && (ex.pattern==='hinge')) return false;
      return true;
    })
    .map(ex => {
      const mg=cap(ex.muscleGroup);
      const sorePenalty=clamp(Number(sore[mg]||0),0,1);
      const targetBonus = target.size ? (target.has(mg)?0.25:-0.1) : 0;
      return { ...ex, __score: 1 - 0.4*sorePenalty + targetBonus, pattern: ex.pattern || inferPattern(ex) };
    });
  return pool;
}

export function inferPattern(ex){
  const n=(ex?.name||'').toLowerCase();
  if (n.includes('deadlift')||n.includes('rdl')||n.includes('hinge')) return 'hinge';
  if (n.includes('squat')||n.includes('lunge')||n.includes('split squat')||n.includes('leg press')) return 'squat';
  if (n.includes('row')) return 'horizontal_pull';
  if (n.includes('pulldown')||n.includes('pull-up')) return 'vertical_pull';
  if (n.includes('bench')||n.includes('press')) {
    if (n.includes('overhead')||n.includes('shoulder')) return 'vertical_press';
    return 'horizontal_press';
  }
  return 'isolation';
}

export function chooseExercises(pool, priorityGroups, goals, rnd, ctx){
  const picks=[], chosen=new Set();
  const compounds=pool.filter(x=>x.pattern && x.pattern!=='isolation');
  const accessories=pool.filter(x=>x.pattern==='isolation');
  const perGComp=Object.create(null), perGAcc=Object.create(null);

  for (const ex of compounds){ const g=cap(ex.muscleGroup); (perGComp[g] ||= []).push(ex); }
  for (const ex of accessories){ const g=cap(ex.muscleGroup); (perGAcc[g] ||= []).push(ex); }

  const allowHinge = (ctx.hingesIn7d||0) < (ctx.maxHeavyHinges7d||1);

  // one compound per priority group
  for (const g of priorityGroups){
    const list=(perGComp[g]||[]).filter(ex=>allowHinge || ex.pattern!=='hinge');
    if (!list.length) continue;
    const ex=weightedPick(list,rnd);
    if (!chosen.has(ex.id)){ picks.push(ex); chosen.add(ex.id); }
  }

  // ensure global pattern coverage
  const patternsNeeded=['horizontal_press','vertical_press','horizontal_pull','vertical_pull','squat','hinge'];
  for (const p of patternsNeeded){
    if (p==='hinge' && !allowHinge) continue;
    if (!picks.some(ex=>ex.pattern===p)){
      const cands=compounds.filter(ex=>ex.pattern===p && !chosen.has(ex.id));
      if (cands.length){ const ex=weightedPick(cands,rnd); picks.push(ex); chosen.add(ex.id); }
    }
  }

  // one accessory per group
  for (const g of priorityGroups){
    const cands=(perGAcc[g]||[]).filter(ex=>!chosen.has(ex.id));
    if (cands.length){ const acc=weightedPick(cands,rnd); picks.push(acc); chosen.add(ex.id); }
  }

  // keep it concise
  while (picks.length>6) picks.pop();
  return picks;
}

export function weightedPick(arr,rnd){
  if(!arr.length) return null;
  const scores=arr.map(x=>Math.max(0.01,Number(x.__score||1)));
  const sum=scores.reduce((a,b)=>a+b,0);
  let r=rnd()*sum;
  for(let i=0;i<arr.length;i++){ r-=scores[i]; if(r<=0) return arr[i]; }
  return arr[arr.length-1];
}

export function repScheme(goals){
  switch(goals){
    case 'strength':  return { setsPrimary:4, setsAccessory:3, repsMin:3,  repsMax:6,  restSec:180, loadBumpPct:0.025 };
    case 'endurance': return { setsPrimary:3, setsAccessory:2, repsMin:12, repsMax:20, restSec:75,  loadBumpPct:0.02  };
    default:          return { setsPrimary:3, setsAccessory:2, repsMin:8,  repsMax:12, restSec:105, loadBumpPct:0.02  };
  }
}

export function nextLoadTarget(ex,last,scheme,plateInc,units){
  const isPrimary = ex.pattern && ex.pattern!=='isolation';
  const sets = isPrimary ? scheme.setsPrimary : scheme.setsAccessory;
  const repMin=scheme.repsMin, repMax=scheme.repsMax;
  let targetReps = Math.round((repMin+repMax)/2);
  let weight = baseStartingWeight(ex, units);

  if (last?.bestSet){
    const lw=last.bestSet.weight, lr=last.bestSet.reps;
    const hitTop = lr >= repMax*0.66;
    if (hitTop){ weight = roundToPlate(lw*(1+scheme.loadBumpPct), plateInc); targetReps = Math.max(repMin, lr-1); }
    else       { weight = roundToPlate(lw, plateInc); targetReps = Math.min(repMax, Math.max(repMin, lr+1)); }
  }
  return { sets, reps: targetReps, weight };
}

export function roundToPlate(w, inc) { if (!isFinite(w)) return 0; return Math.max(0, Math.round(w / inc) * inc); }

export function baseStartingWeight(ex, units){
  const lb = {
    barbell:{Chest:135,Back:0,Shoulders:95,Legs:185,Arms:0,Abs:0},
    dumbbell:{Chest:55,Back:60,Shoulders:40,Legs:0,Arms:25,Abs:0},
    machine:{Chest:80,Back:100,Shoulders:60,Legs:180,Arms:50,Abs:30},
    cable:{Chest:35,Back:0,Shoulders:0,Legs:0,Arms:40,Abs:35},
    bodyweight:{Chest:0,Back:0,Shoulders:0,Legs:0,Arms:0,Abs:0}
  };
  const base = lb[ex.equipment]?.[ex.muscleGroup] ?? 0;
  return units==='kg' ? Math.round(base/2.2046) : base;
}

export function trimToBudget(blocks,setBudget,priorityGroups){
  const out=[], byG=Object.create(null); let sets=0;
  for (const b of blocks) (byG[cap(b.exercise.muscleGroup)] ||= []).push(b);

  // take best from priority groups first
  for (const g of priorityGroups){
    const list=(byG[g]||[]).sort((a,b)=>importance(b)-importance(a));
    if (list.length){ const pick=list.shift(); out.push(pick); sets+=pick.sets.length; byG[g]=list; }
  }

  // then fill with remaining
  const rest=[]; Object.values(byG).forEach(list=>list?.forEach(b=>rest.push(b)));
  rest.sort((a,b)=>importance(b)-importance(a));
  for (const b of rest){ if (sets + b.sets.length > setBudget) continue; out.push(b); sets+=b.sets.length; }

  // if still over, drop isolation first
  while (sets>setBudget && out.length){
    const idx=out.findIndex(b=>b.exercise.pattern==='isolation');
    const drop=idx>=0?idx:out.length-1;
    sets-=out[drop].sets.length;
    out.splice(drop,1);
  }
  return out;
}

export function importance(block){
  const p=block.exercise.pattern;
  const g=cap(block.exercise.muscleGroup);
  const comp=(p && p!=='isolation')?2:0;
  const small=(g==='Shoulders'||g==='Arms'||g==='Abs')?0.15:0;
  return comp+small+1;
}

export function deDuplicatePatterns(blocks){
  const seen=new Set(), out=[];
  for(const b of blocks){
    const key=`${b.exercise.pattern}:${b.exercise.muscleGroup}`;
    if (seen.has(key)){
      if (b.exercise.pattern==='isolation') out.push(b);
      continue;
    }
    seen.add(key); out.push(b);
  }
  return out;
}

export function smartName(split,goals,groups){
  const label={hypertrophy:'Hypertrophy',strength:'Strength',endurance:'Endurance'}[goals]||'Training';
  const g=(groups||[]).slice(0,2).join('/');
  const s=split==='full'?'Full Body':cap(split);
  return `${s} – ${label}${g?` (${g})`:''}`;
}

export const DEFAULT_CATALOG = [
  { id:'ex_bb_back_squat', name:'Barbell Back Squat', muscleGroup:'Legs', equipment:'barbell', pattern:'squat' },
  { id:'ex_bb_deadlift',   name:'Barbell Deadlift',   muscleGroup:'Back', equipment:'barbell', pattern:'hinge' },
  { id:'ex_bb_bench',      name:'Barbell Bench Press',muscleGroup:'Chest',equipment:'barbell', pattern:'horizontal_press' },
  { id:'ex_bb_ohp',        name:'Barbell Overhead Press', muscleGroup:'Shoulders', equipment:'barbell', pattern:'vertical_press' },
  { id:'ex_db_press',      name:'Dumbbell Bench Press',muscleGroup:'Chest',equipment:'dumbbell', pattern:'horizontal_press' },
  { id:'ex_db_sh_press',   name:'Dumbbell Shoulder Press', muscleGroup:'Shoulders', equipment:'dumbbell', pattern:'vertical_press' },
  { id:'ex_lat_pulldown',  name:'Lat Pulldown',       muscleGroup:'Back', equipment:'machine', pattern:'vertical_pull' },
  { id:'ex_seated_row',    name:'Seated Row',         muscleGroup:'Back', equipment:'machine', pattern:'horizontal_pull' },
  { id:'ex_cable_fly',     name:'Cable Fly',          muscleGroup:'Chest',equipment:'cable',   pattern:'isolation' },
  { id:'ex_lat_raise',     name:'Lateral Raise',      muscleGroup:'Shoulders',equipment:'dumbbell', pattern:'isolation' },
  { id:'ex_triceps_pd',    name:'Triceps Pressdown',  muscleGroup:'Arms', equipment:'cable',   pattern:'isolation' },
  { id:'ex_db_curl',       name:'Dumbbell Curl',      muscleGroup:'Arms', equipment:'dumbbell',pattern:'isolation' },
  { id:'ex_ham_curl',      name:'Hamstring Curl',     muscleGroup:'Legs', equipment:'machine', pattern:'isolation' },
  { id:'ex_leg_ext',       name:'Leg Extension',      muscleGroup:'Legs', equipment:'machine', pattern:'isolation' },
  { id:'ex_calf_raise',    name:'Standing Calf Raise',muscleGroup:'Legs', equipment:'machine', pattern:'isolation' },
];

