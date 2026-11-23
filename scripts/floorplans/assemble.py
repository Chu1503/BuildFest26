"""Rebuild Discovery, Memorial Union and Chazen in building-demo/waypoint-data.js from the PDFs in building-demo/plans.

Run:  python scripts/floorplans/assemble.py   (needs pymupdf, opencv-python-headless, numpy, scipy, scikit-image)
"""
import json,math,os,sys,shutil,cv2
from paths import REPO
import mu_prep,chz_prep  # render the vector PDFs into wall/area masks
import mu_build,disc_build,chz_build
DEMO=os.path.join(REPO,'building-demo')
src=open(os.path.join(DEMO,'waypoint-data.js')).read()
head,body=src.split('export const data=',1);data=json.loads(body.strip().rstrip(';'))
def model(mid,name,floors,accent,room,entry_floor,source,note,entrance_label,default_room,groups_order):
    nodes=[];edges=[];plan=[];meshes=[]
    for r in floors:nodes+=r['nodes'];edges+=r['edges'];plan.append(r['plan']);meshes.append(r['mesh'])
    have={(n['id'].split('-')[0],n['floor']) for n in nodes if n['id'].startswith('lift')}
    for g in groups_order:
        fl=sorted(f for k,f in have if k=='lift'+g)
        for a,b in zip(fl,fl[1:]):edges.append(dict(id=f'lift{g}{a}',a=f'lift{g}-{a}',b=f'lift{g}-{b}',meters=round(4.5*(b-a),2),kind='elevator'))
    xs=[p for m in meshes for s in m['slabs'] for p in (s['x']-s['width']/2,s['x']+s['width']/2)];zs=[s['z'] for m in meshes for s in m['slabs']]
    return dict(id=mid,name=name,graph=dict(nodes=nodes,edges=edges),levels=len(floors),width=round(max(xs)-min(xs),2),depth=round(max(zs)-min(zs),2),
        accent=accent,roomColor=room,entranceLabel=entrance_label,defaultRoom=default_room,plan=dict(source=source,entryFloor=entry_floor,note=note,floors=plan),floorMeshes=meshes)
mu=mu_build.run();ds=[disc_build.run()];cz=chz_build.run()
old=data['models']
data['models']['union']=model('union','Memorial Union',mu,old['union']['accent'],old['union']['roomColor'],1,'/plans/memorial-union-directory-2017.pdf',
  'Traced from the 2017 Memorial Union directory: six levels with the marked elevators (west, central, east) and restrooms. Door openings the directory leaves out are inferred; verify on site.',
  'Langdon St entrance','room4-3',['A','B','B2'])
data['models']['discovery']=model('discovery','Discovery Building',ds,old['discovery']['accent'],old['discovery']['roomColor'],0,'/plans/discovery-floor1-2024.pdf',
  'Traced from the October 2024 first-floor plan (entrances A–E, elevators and restrooms by Aldo\'s Cafe). Only the first floor is mapped.',
  'Entrance A · Orchard St','room0-4',['A','B'])
data['models']['chazen']=model('chazen','Chazen Museum of Art',cz,old['chazen']['accent'],old['chazen']['roomColor'],0,'/plans/chazen-source-2021.pdf',
  'From your Spring 2021 Chazen PDF. Red closure markings are historical, not live status. Ground-floor elevator connection is inferred; verify it on site.',
  'Main entrance','room2-16',['A'])
for p in data['places']:
    if p['id']=='discovery':p['details']=['Step-free entrances A–E','Two elevators','Restrooms by Aldo\'s Cafe']
    if p['id']=='union':p['details']=['Step-free Langdon St entrance','Restrooms on every level','Three elevators']
open(os.path.join(DEMO,'waypoint-data.js'),'w').write(head+'export const data='+json.dumps(data,separators=(',',':'),ensure_ascii=False)+';\n')
# plan images
P=os.path.join(DEMO,'plans')
for fi in range(6):cv2.imwrite(os.path.join(P,f'union-{fi}.png'),cv2.imread(f'mu-f{fi}-raw.png'),[cv2.IMWRITE_PNG_COMPRESSION,9])
disc_build.raster();shutil.copy('disc-raw.jpeg',os.path.join(P,'discovery-1.jpg'))
for m in ('union','discovery','chazen'):
    g=data['models'][m]['graph'];print(m,len(g['nodes']),'nodes',len(g['edges']),'edges',[e['id'] for e in g['edges'] if e.get('kind')=='elevator'])
print('bytes',os.path.getsize(os.path.join(DEMO,'waypoint-data.js')))
