// utils/loadTestData.js
import AsyncStorage from '@react-native-async-storage/async-storage';
const WORKOUTS_KEY = 'rnsteps.workouts.v1';
const TEMPLATES_KEY = 'workout:templates';

const MG = ['Chest','Back','Shoulders','Arms','Legs','Abs'];
const NOW = Date.now();

function uid() { return 'xxxxxxxx-xxxx'.replace(/[x]/g, () => Math.floor(Math.random()*16).toString(16)); }
function rand(min, max) { return Math.floor(min + Math.random()*(max-min+1)); }
function pick(arr) { return arr[rand(0, arr.length-1)]; }
function daysAgo(n){ return NOW - n*24*60*60*1000; }
function roundToPlate(w, units='lb'){ const inc = units==='kg'?2.5:5; return Math.round((w||0)/inc)*inc; }

const CATALOG = [
  { id:'ex_bb_bench', name:'Barbell Bench Press', muscleGroup:'Chest', equipment:'barbell', icon:'bench' },
  { id:'ex_db_press', name:'Dumbbell Bench Press', muscleGroup:'Chest', equipment:'dumbbell', icon:'db' },
  { id:'ex_cable_fly', name:'Cable Fly', muscleGroup:'Chest', equipment:'cable', icon:'fly' },
  { id:'ex_pulldown', name:'Lat Pulldown', muscleGroup:'Back', equipment:'machine', icon:'lat' },
  { id:'ex_row', name:'Seated Row', muscleGroup:'Back', equipment:'machine', icon:'row' },
  { id:'ex_db_row', name:'DB Row', muscleGroup:'Back', equipment:'dumbbell', icon:'dbrow' },
  { id:'ex_ohp', name:'Barbell Overhead Press', muscleGroup:'Shoulders', equipment:'barbell', icon:'ohp' },
  { id:'ex_db_sh', name:'DB Shoulder Press', muscleGroup:'Shoulders', equipment:'dumbbell', icon:'db' },
  { id:'ex_lat_raise', name:'Lateral Raise', muscleGroup:'Shoulders', equipment:'dumbbell', icon:'lat' },
  { id:'ex_curl', name:'DB Curl', muscleGroup:'Arms', equipment:'dumbbell', icon:'curl' },
  { id:'ex_triceps', name:'Cable Pressdown', muscleGroup:'Arms', equipment:'cable', icon:'tri' },
  { id:'ex_hammer', name:'Hammer Curl', muscleGroup:'Arms', equipment:'dumbbell', icon:'curl' },
  { id:'ex_squat', name:'Back Squat', muscleGroup:'Legs', equipment:'barbell', icon:'squat' },
  { id:'ex_rdl', name:'Romanian Deadlift', muscleGroup:'Legs', equipment:'barbell', icon:'rdl' },
  { id:'ex_legpress', name:'Leg Press', muscleGroup:'Legs', equipment:'machine', icon:'press' },
  { id:'ex_legext', name:'Leg Extension', muscleGroup:'Legs', equipment:'machine', icon:'ext' },
  { id:'ex_hamcurl', name:'Hamstring Curl', muscleGroup:'Legs', equipment:'machine', icon:'curl' },
  { id:'ex_plank', name:'Plank', muscleGroup:'Abs', equipment:'bodyweight', icon:'plank' },
  { id:'ex_cablecr', name:'Cable Crunch', muscleGroup:'Abs', equipment:'cable', icon:'crunch' },
  { id:'ex_hangleg', name:'Hanging Leg Raise', muscleGroup:'Abs', equipment:'bodyweight', icon:'leg' },
];

function baselineWeight(ex, units) {
  const lb = {
    barbell: { Chest: 135, Back: 0,  Shoulders: 95,  Legs: 185, Arms: 0, Abs: 0 },
    dumbbell:{ Chest: 55,  Back: 60, Shoulders: 40,  Legs: 0,   Arms: 25, Abs: 0 },
    machine: { Chest: 80,  Back: 100,Shoulders: 60,  Legs: 180, Arms: 50, Abs: 30 },
    cable:   { Chest: 35,  Back: 0,  Shoulders: 0,   Legs: 0,   Arms: 40, Abs: 35 },
    bodyweight: { Chest:0, Back:0, Shoulders:0, Legs:0, Arms:0, Abs:0 }
  };
  const base = lb[ex.equipment]?.[ex.muscleGroup] ?? 0;
  return units==='kg' ? Math.round(base/2.2046) : base;
}

function makeSet(ex, units, intensity=1){
  const repsByGroup = { Chest:[8,12], Back:[8,12], Shoulders:[8,12], Arms:[10,15], Legs:[6,12], Abs:[12,20] };
  const [minR,maxR] = repsByGroup[ex.muscleGroup] || [8,12];
  const reps = rand(minR,maxR);
  let w = baselineWeight(ex, units);
  w = roundToPlate(w * (0.9 + Math.random()*0.2) * intensity, units);
  return { id: uid(), weight: w, reps, completedAt: 0 };
}

function makeBlock(ex, units, sets=3, startTime){
  const block = { id: uid(), exercise: ex, sets: [] };
  let t = startTime;
  for (let i=0;i<sets;i++){
    const s = makeSet(ex, units, 0.95 + i*0.03);
    t += 90_000 + rand(-20_000, 20_000);
    s.completedAt = t;
    block.sets.push(s);
  }
  return block;
}

function sessionFor(groups, units, dayOffset){
  const startedAt = daysAgo(dayOffset) + rand(18_00_000, 21_00_000); // ~5–6 PM
  let t = startedAt;
  const picks = [];
  groups.forEach(g => {
    const comp = CATALOG.filter(e => e.muscleGroup===g && (e.equipment==='barbell' || e.equipment==='machine' || e.name.includes('Press') || e.name.includes('Row')));
    const acc  = CATALOG.filter(e => e.muscleGroup===g && !comp.includes(e));
    const exs = [];
    if (comp.length) exs.push(pick(comp));
    if (Math.random()<0.6 && comp.length>1) exs.push(pick(comp.filter(e=>e.id!==exs[0].id)));
    if (acc.length)  exs.push(pick(acc));
    exs.forEach(ex => {
      const sets = ex.muscleGroup==='Legs' ? rand(3,4) : rand(2,4);
      picks.push(makeBlock(ex, units, sets, t));
      t += sets*(100_000 + rand(30_000,60_000));
    });
  });
  const finishedAt = t;
  return { id: uid(), title: `${groups.join('/') } Session`, units, startedAt, finishedAt, blocks: picks };
}

function planCalendar() {
  const days = [];
  const order = [ ['Push'], ['Pull'], ['Legs'], ['Upper'], ['Lower'], ['Full'] ];
  for (let d=20; d>=0; d--){
    const o = order[d % order.length][0].toLowerCase();
    if (o==='push')      days.push(['Chest','Shoulders','Arms']);
    else if (o==='pull') days.push(['Back','Arms']);
    else if (o==='legs') days.push(['Legs','Abs']);
    else if (o==='upper')days.push(['Chest','Back','Shoulders','Arms']);
    else if (o==='lower')days.push(['Legs','Abs']);
    else                 days.push(['Chest','Back','Legs','Shoulders','Arms','Abs'].filter(()=>Math.random()<0.5));
  }
  // Ensure ≥3 hits per group
  const counts = Object.fromEntries(MG.map(g=>[g,0]));
  days.forEach(gs => gs.forEach(g => counts[g]++));
  MG.forEach(g => { while (counts[g] < 3) { days.push([g]); counts[g]++; } });
  return days;
}

export async function generateTestData({ units='lb' } = {}) {
  const cal = planCalendar();
  const workouts = cal.map((groups, idx) => sessionFor(groups, units, cal.length-idx));
  return workouts;
}

export async function loadTestData({ units='lb', overwrite=true, includeTemplates=true } = {}) {
  const workouts = await generateTestData({ units });
  if (!overwrite) {
    const raw = await AsyncStorage.getItem(WORKOUTS_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    workouts.push(...existing);
  }
  await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));

  if (includeTemplates) {
    const templates = [
      {
        id: uid(), name: 'Push – Hypertrophy', createdAt: NOW - 10*86400000, units,
        blocks: [
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_db_press'), sets:[{id:uid(),weight: roundToPlate(60,units), reps:10},{id:uid(),weight: roundToPlate(60,units), reps:10},{id:uid(),weight: roundToPlate(60,units), reps:8}] },
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_db_sh'),   sets:[{id:uid(),weight: roundToPlate(40,units), reps:10},{id:uid(),weight: roundToPlate(40,units), reps:9}] },
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_triceps'), sets:[{id:uid(),weight: roundToPlate(40,units), reps:12},{id:uid(),weight: roundToPlate(40,units), reps:12}] },
        ]
      },
      {
        id: uid(), name: 'Pull – Back Focus', createdAt: NOW - 9*86400000, units,
        blocks: [
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_pulldown'), sets:[{id:uid(),weight: roundToPlate(110,units), reps:10},{id:uid(),weight: roundToPlate(110,units), reps:9}] },
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_row'), sets:[{id:uid(),weight: roundToPlate(100,units), reps:10},{id:uid(),weight: roundToPlate(100,units), reps:10}] },
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_curl'),   sets:[{id:uid(),weight: roundToPlate(25,units), reps:12},{id:uid(),weight: roundToPlate(25,units), reps:10}] },
        ]
      },
      {
        id: uid(), name: 'Lower – Squat + Hinge', createdAt: NOW - 8*86400000, units,
        blocks: [
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_squat'),    sets:[{id:uid(),weight: roundToPlate(185,units), reps:6},{id:uid(),weight: roundToPlate(185,units), reps:6},{id:uid(),weight: roundToPlate(185,units), reps:5}] },
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_rdl'),      sets:[{id:uid(),weight: roundToPlate(155,units), reps:8},{id:uid(),weight: roundToPlate(155,units), reps:8}] },
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_legext'),   sets:[{id:uid(),weight: roundToPlate(90,units), reps:12},{id:uid(),weight: roundToPlate(90,units), reps:12}] },
          { id: uid(), exercise: CATALOG.find(e=>e.id==='ex_hamcurl'),  sets:[{id:uid(),weight: roundToPlate(70,units), reps:12}] },
        ]
      }
    ];
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }

  return { count: workouts.length };
}
