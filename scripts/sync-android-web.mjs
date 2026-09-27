import fs from 'node:fs';
const src=new URL('../building-demo/',import.meta.url),dest=new URL('../traveler-app/app/src/main/assets/web/',import.meta.url);
fs.mkdirSync(dest,{recursive:true});
// Keep the Android-specific planner, voice assistant, and 2D renderer intact.
for(const f of ['amenities.js','building.js','catalog-data.js','routing.js','positioning.js','active-building.js','waypoint-data.js','campus.js'])fs.copyFileSync(new URL(f,src),new URL(f,dest));
fs.cpSync(new URL('vendor/',src),new URL('vendor/',dest),{recursive:true});
fs.cpSync(new URL('plans/',src),new URL('plans/',dest),{recursive:true});
console.log('Shared Android navigation assets synced; mobile UI preserved.');
