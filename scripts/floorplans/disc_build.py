import numpy as np,cv2,math,json,os
import pymupdf as fitz
from paths import PLANS
from core import build_floor,debug_image,line_mask,poly_mask
SCALE=6.096/104.6  # 20 ft scale bar = 104.6 px in the source raster
W,H=1660,1290
OUT=[(5,145),(150,145),(150,15),(1265,15),(1265,58),(1600,58),(1600,650),(1660,650),(1660,1040),(1530,1040),(1430,1215),(1380,1215),(245,725),(175,640),(75,598),(70,525),(5,525)]
def circle(c,r,a0,a1,n=24):return [(c[0]+r*math.cos(math.radians(a)),c[1]+r*math.sin(math.radians(a))) for a in np.linspace(a0,a1,n)]
FC=(850,460)
WALLS=[
 # 1145 seminar room, doors on the south-east face
 [(322,400),(230,358),(305,165),(440,222),(405,437),(375,424)],
 # 1130 D-shaped room, doors along the north face
 [(490,412),(465,405),(455,470),(480,530),(520,555),(570,530),(600,480),(605,455),(590,450)],
 # 1170 and 1260 classrooms, doors to the atrium
 [(605,140),(550,140),(550,60),(720,60),(720,140),(665,140)],
 [(990,205),(930,205),(930,125),(1105,125),(1105,205),(1045,205)],
 # H.F. DeLuca Forum ring, four openings
 circle(FC,190,195,255),circle(FC,190,285,345),circle(FC,190,15,75),circle(FC,190,105,165),
 # Aldo's Cafe, opening on its west side
 [(1360,135),(1360,60)],[(1360,205),(1360,265),(1592,265)],
 # Steenbock's on Orchard, door on its west side
 [(1265,815),(1265,725),(1655,725)],[(1265,885),(1265,1035),(1655,1035)],
]
# exterior walls (drawn for the 3D view) with entrance gaps A–E
EXT=[[(150,60),(150,15),(1265,15),(1265,58),(1290,58)],[(1340,58),(1600,58),(1600,560)],[(1600,630),(1600,650),(1660,650),(1660,1040),(1530,1040),(1440,1197)],
     [(1370,1210),(270,736)],[(200,668),(175,640),(75,598),(70,525),(5,525),(5,145),(80,145)]]
BLOCKS=[
 [(1368,270),(1545,270),(1545,530),(1368,530)],            # restroom + elevator core
 [(1540,300),(1592,300),(1592,385),(1540,385)],            # east stair
 [(1270,272),(1335,300),(1295,492),(1155,415)],            # central stair by the welcome desk
 [(5,145),(100,145),(100,468),(5,468)],                    # west offices
 [(30,468),(110,468),(110,505),(30,505)],                  # west stair
 [(165,148),(250,148),(250,200),(165,200)],[(165,415),(250,415),(250,465),(165,465)],[(140,470),(250,470),(250,522),(140,522)],
 [(585,650),(900,800),(865,870),(550,725)],                # long work tables
 [(480,600),(585,640),(545,735),(445,690)],[(905,795),(1050,860),(1010,940),(870,875)],  # planters
 [(455,15),(720,15),(720,58),(545,58),(545,100),(455,100)],[(820,15),(1262,15),(1262,100),(820,100)],[(1205,100),(1292,100),(1292,215),(1205,215)],
 circle((1200,500),0,0,1,1)[:0] or [(1135,478),(1262,520),(1258,545),(1130,505)],  # welcome desk counter
]
R=lambda l,p:dict(label=l,point=p)
CFG=dict(label='Level 1',image='/plans/discovery-1.jpg',spacing_m=1.2,clear_m=.35,
 entrance=dict(label='Entrance A · Orchard St',point=[1565,595]),
 rooms=[R('Room 1145',[335,300]),R('Room 1130',[530,470]),R('Room 1170',[635,100]),R('Room 1260',[1018,165]),R('H.F. DeLuca Forum',[850,460]),
        R("Aldo's Cafe",[1475,160]),R("Steenbock's on Orchard",[1460,880]),R('Welcome Desk',[1195,555]),R('Breakout tables (W. Johnson St side)',[720,880])],
 lifts=[dict(group='A',point=[1352,435],name='Elevator'),dict(group='B',point=[1352,495],name='Elevator')],
 exits=[dict(label='Entrance B · W. Johnson & Orchard',point=[1400,1185]),dict(label='Entrance C · W. Johnson St',point=[245,700]),
        dict(label='Entrance D · northwest',point=[160,95]),dict(label='Entrance E · north',point=[1312,95])],
 restrooms=[[1356,352],[1356,300]],stairs=[1245,380],blocks=BLOCKS,
 note='Traced from the October 2024 Discovery Building first-floor plan. Room doors and the elevator position are read from the drawing; verify on site.')
def raster():
    if not os.path.exists('disc-raw.jpeg'):
        d=fitz.open(os.path.join(PLANS,'discovery-floor1-2024.pdf'));x=d.extract_image(d[0].get_images()[0][0])
        open('disc-raw.jpeg','wb').write(x['image'])
    return cv2.imread('disc-raw.jpeg')
def masks():
    walls=line_mask((H,W),WALLS+EXT,.22/SCALE)
    area=poly_mask((H,W),[OUT])
    return walls,area
def run():
    walls,area=masks()
    res=build_floor(0,CFG,walls,area,SCALE)
    debug_image(raster(),res,'dbg-disc.png')
    return res
if __name__=='__main__':run()
