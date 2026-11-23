import numpy as np,cv2
from core import build_floor,debug_image,line_mask
SCALE=0.045
SEALS={0:[[(285,648),(285,734)],[(352,1178),(352,1302)]],1:[],2:[[(200,1055),(200,1360)]]}
SEEDS={0:(447,935),1:(827,1118),2:(609,468)}
def area_of(fi,extra_open=()):
    w=np.load(f'chz-f{fi}-walls.npy')|np.load(f'chz-f{fi}-light.npy')
    if SEALS[fi]: w|=line_mask(w.shape,SEALS[fi],6)
    free=(w==0).astype(np.uint8);ff=free.copy();mask=np.zeros((1602,1442),np.uint8)
    cv2.floodFill(ff,mask,SEEDS[fi],2)
    area=((ff==2)|(cv2.dilate((ff==2).astype(np.uint8),np.ones((9,9),np.uint8))>0)&(w>0)).astype(np.uint8)*255
    return w,area

R=lambda l,p,i=None:dict(label=l,point=p,**({'id':i} if i else {}))
F=[dict(label='Ground',entrance=dict(label='Main entrance · University Ave',point=[318,692]),
        rooms=[R('Mead Witter Lobby',[447,935],'room0-lobby'),R('Chazen Café',[369,538],'room0-cafe'),R('Visitor Services',[479,820],'room0-services'),
               R('Rowland Gallery',[1017,1026],'room0-gallery'),R('Rowland Gallery · south',[765,1292],'room0-south'),R('Coat room',[703,800],'room0-coat')],
        lifts=[dict(group='A',point=[527,899],name='Elevator · inferred')],liftInferred=True,exits=[dict(label='South exit',point=[400,1240])],
        restrooms=[[705,911]],stairs=[606,969],
        note='Ground-floor elevator position is inferred from the upper-level plans; verify it on site.'),
   dict(label='Level 2',rooms=[R('Object Study',[335,499],'room1-object'),R('Garfield Gallery',[827,1118],'room1-garfield')],
        lifts=[dict(group='A',point=[394,662],name='Elevator')],stairs=[540,922],
        note='Print Study is closed on the supplied 2021 map; excluded from demo destinations.'),
   dict(label='Level 3',rooms=[R('Gallery XVI (16)',[609,468],'room2-16'),R('Gallery XVII (17)',[611,856],'room2-17'),R('Gallery XV (15)',[896,456],'room2-15'),
               R('Gallery XIV (14)',[1192,456],'room2-14'),R('Gallery XIII (13)',[1193,857],'room2-13')],
        lifts=[dict(group='A',point=[750,664],name='Elevator')],restrooms=[[742,771],[742,1000]],stairs=[897,785],
        note='Galleries IX–XII are closed on the supplied 2021 map and are excluded. This is not current closure information.')]
def run():
    out=[]
    for fi,cfg in enumerate(F):
        w,a=area_of(fi)
        res=build_floor(fi,dict(cfg,image=f'/plans/chazen-{fi}.png',spacing_m=1.0,clear_m=.3),w,a,SCALE)
        if cfg.get('liftInferred'):res['plan']['liftInferred']=True
        debug_image(np.full((1600,1440,3),255,np.uint8),res,f'dbg-chz-{fi}.png')
        out.append(res)
    return out
if __name__=='__main__':run()
