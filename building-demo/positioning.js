// Relative mapping requires a confirmed indoor anchor and heading. No surveyed georeference.
export const freshFix=(s,now=Date.now())=>Number.isFinite(s?.latitude)&&Number.isFinite(s?.longitude)&&Number.isFinite(s?.accuracy)&&s.accuracy>0&&s.accuracy<=3&&now-s.receivedAt<10000&&s.ageMs>=0&&s.ageMs<10000&&!s.mock;
export function relativePosition(anchor,s,offset){const n=(s.latitude-anchor.latitude)*111320,e=(s.longitude-anchor.longitude)*111320*Math.cos(anchor.latitude*Math.PI/180);return [anchor.p[0]+e*Math.cos(offset)+n*Math.sin(offset),anchor.p[1],anchor.p[2]+e*Math.sin(offset)-n*Math.cos(offset)];}
export function floorSuggestion(delta,base,height=4.5){if(!Number.isFinite(delta)||Math.abs(delta)<height*.75)return null;return Math.max(0,Math.min(7,base+Math.round(delta/height)));}
