// components/workout/RestTimer.js
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, Pressable, Vibration } from 'react-native';

function RestTimerBase({ seconds=90 }, ref){
  const [remain, setRemain] = useState(seconds);
  const [running, setRunning] = useState(false);
  const tick = useRef(null);

  useEffect(() => () => { if (tick.current) clearInterval(tick.current); }, []);

  const start = () => {
    if (tick.current) clearInterval(tick.current);
    setRemain(seconds);
    setRunning(true);
    tick.current = setInterval(() => {
      setRemain(prev => {
        if (prev <= 1){
          if (tick.current) clearInterval(tick.current);
          setRunning(false);
          Vibration.vibrate(400);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  const reset = () => { if (tick.current) clearInterval(tick.current); setRemain(seconds); setRunning(false); };
  useImperativeHandle(ref, () => ({ start, reset }));

  const mm = String(Math.floor(remain/60)).padStart(2,'0');
  const ss = String(remain%60).padStart(2,'0');

  return (
    <View style={{ alignItems:'center', marginTop:8 }}>
      <Text style={{ opacity:0.7, fontSize:14 }}>Rest Timer</Text>
      <Text style={{ fontSize:24, fontWeight:'600', marginVertical:4 }}>{mm}:{ss}</Text>
      <View style={{ flexDirection:'row', gap:12 }}>
        <Pressable onPress={start} style={{ paddingHorizontal:12, paddingVertical:8, borderRadius:16, borderWidth:1 }}><Text>{running? 'Restart':'Start'}</Text></Pressable>
        <Pressable onPress={reset} style={{ paddingHorizontal:12, paddingVertical:8, borderRadius:16, borderWidth:1 }}><Text>Reset</Text></Pressable>
      </View>
    </View>
  );
}
export default forwardRef(RestTimerBase);
