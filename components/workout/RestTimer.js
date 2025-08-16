// components/workout/RestTimer.js
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, Pressable, Vibration } from 'react-native';

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function RestTimerBase({ seconds = 90, vibrate = true, onComplete }, ref) {
  const [remain, setRemain] = useState(seconds);
  const [running, setRunning] = useState(false);
  const tick = useRef(null);

  const clear = () => { if (tick.current) { clearInterval(tick.current); tick.current = null; } };

  useEffect(() => () => clear(), []);

  const start = () => {
    // if at 0, start a fresh interval from preset seconds
    setRemain((prev) => (prev <= 0 ? seconds : prev));
    setRunning(true);
    clear();
    tick.current = setInterval(() => {
      setRemain((prev) => {
        if (prev <= 1) {
          clear();
          setRunning(false);
          if (vibrate) Vibration.vibrate(400);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pause = () => {
    setRunning(false);
    clear();
  };

  const add = (delta) => {
    setRemain((prev) => clamp(prev + delta, 0, 60 * 60)); // clamp to 0..60min
  };

  useImperativeHandle(ref, () => ({ start, pause, add, set: (s) => setRemain(clamp(s, 0, 3600)) }));

  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');

  const btn = {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Single compact row: -30 | Start | mm:ss | Pause | +30 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => add(-30)} style={btn}><Text>-30s</Text></Pressable>
        <Pressable onPress={start} style={btn}><Text>{running ? 'Restart' : 'Start'}</Text></Pressable>

        <Text style={{ fontSize: 20, fontWeight: '800', minWidth: 72, textAlign: 'center' }}>
          {mm}:{ss}
        </Text>

        <Pressable onPress={pause} style={btn}><Text>Pause</Text></Pressable>
        <Pressable onPress={() => add(+30)} style={btn}><Text>+30s</Text></Pressable>
      </View>
    </View>
  );
}

export default forwardRef(RestTimerBase);
