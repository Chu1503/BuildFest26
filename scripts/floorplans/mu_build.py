import numpy as np,cv2,json,sys
from core import build_floor,debug_image
SCALE=0.0814
def R(label,p):return dict(label=label,point=p)
L=lambda g,p,name:dict(group=g,point=p,name=name)
WEST,CENT,EAST='A','B','B2'
F=[
 dict(label='Lower Level',rooms=[R('Mendota Lodge (B104)',[300,125]),R('Outdoor UW Service Desk (B101)',[405,160]),R('Outdoor UW Program Office & Hoofers (B105)',[370,215]),
   R('Outdoor UW & Wisconsin Hoofers',[200,220]),R('Winkler Lounge (B152)',[215,395]),R('Chart Room North (B147A)',[345,410]),R('Chart Room South (B147B)',[345,460]),
   R('Harold C. Bradley Lounge (B176)',[315,520]),R('Wheelhouse Studios (B184)',[200,600]),R('Festival Room (B196)',[255,800])],
   openings=[[(230,742),(230,778)],[(330,490),(330,555)],[(300,410),(335,410)],[(300,460),(335,460)],[(290,400),(325,400)],[(150,712),(150,745)],[(215,328),(215,362)],[(320,135),(352,128)]],lifts=[L(WEST,[365,700],'West elevator')],restrooms=[[347,321],[347,363],[357,760]]),
 dict(label='Floor 1',openings=[[(285,972),(285,1002)],[(295,960),(370,960)],[(180,212),(180,258)],[(180,318),(180,362)]],entrance=dict(label='Langdon St entrance · Floor 1',point=[215,1045]),
   rooms=[R('Shannon Sunset Lounge (1133)',[205,105]),R('Fan Taylor Lobby (1130)',[180,290]),R('Shannon Hall (1130)',[185,485]),R('Campus & Visitor Relations Desk (1186)',[180,960]),
   R('Box Office / Bus Tickets',[305,890]),R('Stiftskeller (1205)',[480,720]),R('Der Rathskeller (1211)',[625,735]),R('Lakeview Lounge (1341)',[980,485]),R('Strada (1333)',[950,640]),
   R('Daily Scoop (1324)',[1110,670]),R('Carte (1305)',[840,800]),R('Badger Market (1310)',[925,930]),R("Peet's Coffee (1314)",[1130,895]),R('Gekas Commons (1214)',[625,975]),
   R('Paul Bunyan Room (1206)',[485,985]),R('Health Room (1210)',[580,1065]),R('Study Lounge (1220)',[750,975])],
   lifts=[L(WEST,[430,844],'West elevator'),L(CENT,[723,850],'Central elevator'),L(EAST,[973,849],'East elevator')],
   exits=[dict(label='East entrance (Peet\'s) · Floor 1',point=[1075,925])],
   restrooms=[[73,273],[287,260],[317,314],[686,933],[645,1056],[1026,712],[1026,757]],stairs=[375,640]),
 dict(label='Floor 2',openings=[[(790,880),(790,912)],[(840,865),(870,865)],[(740,915),(905,915)],[(830,800),(872,800)],[(280,830),(322,830)],[(815,740),(815,775)]],rooms=[R('Play Circle Theater (2190)',[237,861]),R('Class of 1925 Gallery',[377,756]),R('Hamel Family Browsing Library (2206)',[472,771]),R('Main Lounge (2218)',[607,761]),
   R('Main Gallery (2220)',[747,751]),R('Tripp Commons (2324)',[957,631]),R('Profile Room (2318)',[1027,776]),R('Annex (2214)',[547,921]),R('Founders Room (2210)',[467,971]),
   R('CESO (2224)',[727,991]),R('Inn Wisconsin West (2312A)',[957,941]),R('Inn Wisconsin East (2312B)',[1037,951])],
   lifts=[L(WEST,[387,839],'West elevator'),L(CENT,[706,851],'Central elevator'),L(EAST,[955,843],'East elevator')],restrooms=[[284,631],[797,809],[832,809]]),
 dict(label='Floor 3',rooms=[R('Theater Offices (3193)',[349,801]),R('Beefeaters North (3318B)',[965,780]),R('Beefeaters South (3318A)',[962,825]),R('Boardroom (3316)',[960,866]),
   R('Old Madison West (3312A)',[870,950]),R('Old Madison East (3312B)',[950,955])],
   lifts=[L(WEST,[385,872],'West elevator'),L(EAST,[885,846],'East elevator')],restrooms=[[776,871],[776,835]]),
 dict(label='Floor 4',rooms=[R('Accounting (4187)',[168,807]),R('Human Resources (4186)',[188,922]),R('Council Room (4195)',[290,800]),R('Great Hall (4214)',[548,762]),
   R("Class of '24 Reception Room (4235)",[748,777]),R('Langdon Room (4204)',[438,977]),R('Capitol View Room (4224)',[673,987]),R('State Room West (4304)',[853,947]),
   R('State Room East (4306)',[968,932]),R('Park View (4310)',[950,870]),R('Club Suites',[868,620])],
   lifts=[L(WEST,[355,860],'West elevator'),L(CENT,[646,850],'Central elevator'),L(EAST,[873,843],'East elevator')],restrooms=[[287,914],[950,789],[950,820],[491,919],[607,918]]),
 dict(label='Floor 5',rooms=[R('Terrace Overlook Conference Room (5195D)',[440,730]),R('Directors Suite & Membership (5195)',[390,870]),R('Marketing (5218)',[552,945]),
   R('WUD Offices & Leadership Center (5231)',[715,790])],
   lifts=[L(WEST,[345,885],'West elevator'),L(CENT,[679,882],'Central elevator')],restrooms=[[627,907]]),
]
def run(only=None):
    out=[]
    for fi,cfg in enumerate(F):
        if only is not None and fi!=only: continue
        walls=np.load(f'mu-f{fi}-walls.npy');area=np.load(f'mu-f{fi}-area.npy');thin=np.load(f'mu-f{fi}-thin.npy')
        cfg=dict(cfg,image=f'/plans/union-{fi}.png',spacing_m=1.2,clear_m=.3)
        res=build_floor(fi,cfg,walls|thin,area,SCALE)
        debug_image(cv2.imread(f'mu-f{fi}-raw.png'),res,f'dbg-mu-{fi}.png')
        out.append(res)
    return out
if __name__=='__main__':
    run(int(sys.argv[1]) if len(sys.argv)>1 else None)
