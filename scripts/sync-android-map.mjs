import fs from 'node:fs';
import {nodes,edges,destinations} from '../building-demo/building.js';
fs.writeFileSync(new URL('../traveler-app/app/src/main/assets/building.json',import.meta.url),JSON.stringify({nodes,edges,destinations},null,2)+'\n');
console.log('Android offline graph updated. Rebuild the APK to include map changes.');
