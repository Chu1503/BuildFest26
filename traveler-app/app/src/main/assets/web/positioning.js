// Relative mapping requires a confirmed indoor anchor and heading. No surveyed georeference.
export const freshFix=(s,now=Date.now())=>Number.isFinite(s?.latitude)&&Number.isFinite(s?.longitude)&&Number.isFinite(s?.accuracy)&&s.accuracy>0&&s.accuracy<=3&&now-s.receivedAt>=0&&s.ageMs>=0&&now-s.receivedAt+s.ageMs<10000&&!s.mock;
export function relativePosition(anchor,s,offset){const n=(s.latitude-anchor.latitude)*111320,e=(s.longitude-anchor.longitude)*111320*Math.cos(anchor.latitude*Math.PI/180);return [anchor.p[0]+e*Math.cos(offset)+n*Math.sin(offset),anchor.p[1],anchor.p[2]+e*Math.sin(offset)-n*Math.cos(offset)];}
export function floorSuggestion(delta,base,height=4.5){if(!Number.isFinite(delta)||Math.abs(delta)<height*.75)return null;return Math.max(0,Math.min(7,base+Math.round(delta/height)));}

// Suppress jumps and jitter without inventing extra location accuracy. Position stays on the anchored floor.
export function filterPosition(last,p,now){if(!p.every(Number.isFinite))return null;if(!last)return {p:[...p],time:now};const seconds=Math.max(.05,(now-last.time)/1000),distance=Math.hypot(p[0]-last.p[0],p[2]-last.p[2]);if(p[1]!==last.p[1]||distance>Math.max(3,seconds*3))return null;if(distance<.35)return {p:[...last.p],time:now};const alpha=1-Math.exp(-seconds/1.1);return {p:[last.p[0]+(p[0]-last.p[0])*alpha,last.p[1],last.p[2]+(p[2]-last.p[2])*alpha],time:now};}
export function smoothHeading(previous,next){let delta=Math.atan2(Math.sin(next-previous),Math.cos(next-previous));return previous+delta*.18;}
