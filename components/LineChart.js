import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { palette } from '../theme';

export default function LineChart({ points /* numbers */, labels=[] }) {
  const W=320, H=180, pad=20;
  const max=Math.max(...points,1), min=Math.min(...points,0);
  const range = Math.max(max-min, 1);
  const stepX=(W-pad*2)/(points.length-1);

  const xy = points.map((v,i)=>[
    pad + i*stepX,
    H - pad - ((v-min)/range)*(H-pad*2)
  ]);

  const d = xy.reduce((acc,[x,y],i)=>acc + (i?` L ${x} ${y}`:`M ${x} ${y}`),'');
  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={d} stroke={palette.accent} strokeWidth="3" fill="none" />
        {xy.map(([x,y],i)=>(
          <Circle key={i} cx={x} cy={y} r="4" fill={palette.accent}/>
        ))}
      </Svg>
    </View>
  );
}

