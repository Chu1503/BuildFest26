from extract import *
d=fitz.open(DL+'chazen-source-2021.pdf');K=1440/648
tf=lambda q:(q[0]*K,q[1]*K)
for i in range(3):
    ps=paths(d[i]);walls=canvas(1440,1600);light=canvas(1440,1600)
    for p in ps:
        if p['color'] and near(p['color'],(0,0.41,0.5)): draw(walls,p,tf,stroke=max(3,p['width']*K*1.6),closed=bool(p['closePath']))
        if p['color'] and near(p['color'],(0.77,0.82,0.86)): draw(light,p,tf,stroke=max(3,p['width']*K*1.6),closed=bool(p['closePath']))
    # drop the locator thumbnail in the header
    walls[:280]=0;light[:280]=0
    np.save(f'chz-f{i}-walls.npy',walls);np.save(f'chz-f{i}-light.npy',light)
    vis=np.full((1600,1440,3),255,np.uint8);vis[light>0]=(200,180,150);vis[walls>0]=(90,60,0)
    for g in range(0,1600,50):
        c=(255,120,120) if g%100==0 else (255,220,220);cv2.line(vis,(g,0),(g,1600),c,1);cv2.line(vis,(0,g),(1440,g),c,1)
        if g%100==0:
            for k in range(0,1600,300):cv2.putText(vis,str(g),(g+2,k+14),0,.45,(255,0,0),1);cv2.putText(vis,str(g),(k+2,g-3),0,.45,(255,0,0),1)
    cv2.imwrite(f'chz-f{i}-vis.png',vis[250:1500,150:1300])
