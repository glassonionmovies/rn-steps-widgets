import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

export default function DonutChart({ segments }) {
  // segments: [{value, color}]
  const size=220, cx=size/2, cy=size/2, r=80, thick=30;
  const total = segments.reduce((a,b)=>a+b.value,0) || 1;
  let start=0;
  const toXY = (ang)=>[cx + Math.cos(ang)*r, cy + Math.sin(ang)*r];

  return (
    <Svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>
        {segments.map((s,idx)=>{
          const a0 = (start/total)*2*Math.PI - Math.PI/2;
          const a1 = ((start+s.value)/total)*2*Math.PI - Math.PI/2;
          start += s.value;
          const [x0,y0]=toXY(a0), [x1,y1]=toXY(a1);
          const large = (a1-a0)>Math.PI ? 1 : 0;
          const outer = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
          const [ix0,iy0]=[cx + Math.cos(a0)*(r-thick), cy + Math.sin(a0)*(r-thick)];
          const [ix1,iy1]=[cx + Math.cos(a1)*(r-thick), cy + Math.sin(a1)*(r-thick)];
          const inner = `L ${ix1} ${iy1} A ${r-thick} ${r-thick} 0 ${large} 0 ${ix0} ${iy0} Z`;
          return <Path key={idx} d={outer+inner} fill={s.color}/>;
        })}
      </G>
    </Svg>
  );
}

