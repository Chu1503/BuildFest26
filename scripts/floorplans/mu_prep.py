from extract import *
d=fitz.open(DL+'memorial-union-directory-2017.pdf')
FL=[(6,'Lower Level',10.3),(5,'Floor 1',0),(4,'Floor 2',20.3),(3,'Floor 3',79.4),(2,'Floor 4',63.0),(1,'Floor 5',84.7)]
OX,OY,PX=400,160,5
W,H=int(245*PX),int(225*PX)
LIGHT=[(0.82,0.8,0.77),(0.91,0.91,0.88),(0.92,0.91,0.88),(0.9,0.89,0.87),(0.93,0.92,0.89),(0.83,0.8,0.77)]
DARK=(0.21,0.21,0.22)
out={}
for fi,(i,label,dy) in enumerate(FL):
    page=d[i];ps=paths(page)
    div=sorted(set(round(min(q[0] for pl in p['polys'] for q in pl),1) for p in ps if p['color'] and near(p['color'],(0.8,0.78,0.76)) and max(q[0] for pl in p['polys'] for q in pl)-min(q[0] for pl in p['polys'] for q in pl)<1))
    L,R=div[0],div[-1];s=90.9/(R-L)
    tf=lambda q:(((472.9+(q[0]-L)*s)-OX)*PX,(q[1]*s+dy-OY)*PX)
    walls=canvas(W,H);area=canvas(W,H);thin=canvas(W,H)
    for p in ps:
        if p['fill'] and any(near(p['fill'],c) for c in LIGHT): draw(area,p,tf,fill=True)
    for p in ps:
        if p['fill'] and (near(p['fill'],(0.14,0.12,0.13)) or near(p['fill'],DARK)): draw(walls,p,tf,fill=True)
        if p['color'] and near(p['color'],DARK) and 's' in p['type']:
            draw(walls if p['width']>1.0 else thin,p,tf,stroke=max(2,p['width']*s*PX),closed=bool(p['closePath']))
    # text
    texts=[]
    for b in page.get_text('dict')['blocks']:
        for ln in b.get('lines',[]):
            t=''.join(sp['text'] for sp in ln['spans']).strip()
            if not t: continue
            x0,y0,x1,y1=ln['bbox'];cx,cy=tf(((x0+x1)/2,(y0+y1)/2))
            if 0<cx<W and 0<cy<H: texts.append((round(cx),round(cy),t,round(ln['spans'][0]['size'],1)))
    E=[tuple(round(v) for v in tf(((min(a[0] for a in pl)+max(a[0] for a in pl))/2,(min(a[1] for a in pl)+max(a[1] for a in pl))/2))) for p in ps if p['fill'] and near(p['fill'],(0.82,0.14,0.16)) for pl in p['polys']]
    WC=[tuple(round(v) for v in tf(((min(a[0] for a in pl)+max(a[0] for a in pl))/2,(min(a[1] for a in pl)+max(a[1] for a in pl))/2))) for p in ps if p['fill'] and near(p['fill'],(0.97,0.58,0.11)) for pl in p['polys']]
    np.save(f'mu-f{fi}-walls.npy',walls);np.save(f'mu-f{fi}-area.npy',area);np.save(f'mu-f{fi}-thin.npy',thin)
    clip=fitz.Rect(L+(OX-472.9)/s,(OY-dy)/s,L+(OX+W/PX-472.9)/s,(OY+H/PX-dy)/s)
    pix=page.get_pixmap(matrix=fitz.Matrix(s*PX,s*PX),clip=clip,annots=False)
    raw=np.frombuffer(pix.samples,np.uint8).reshape(pix.h,pix.w,pix.n)[:,:,:3][:,:,::-1].copy()
    raw=cv2.resize(raw,(W,H));cv2.imwrite(f'mu-f{fi}-raw.png',raw)
    vis=cv2.cvtColor(area//4+170,cv2.COLOR_GRAY2BGR);vis[thin>0]=(0,140,255);vis[walls>0]=(40,40,40)
    for g in range(0,max(W,H),50):
        c=(255,0,0) if g%250==0 else (255,210,210)
        cv2.line(vis,(g,0),(g,H),c,1);cv2.line(vis,(0,g),(W,g),c,1)
        if g%100==0: cv2.putText(vis,str(g),(g+2,12),0,.4,(255,0,0),1);cv2.putText(vis,str(g),(2,g-2),0,.4,(255,0,0),1)
    for x,y in E: cv2.circle(vis,(x,y),9,(0,0,230),2)
    for x,y in WC: cv2.circle(vis,(x,y),7,(0,160,0),2)
    for x,y,t,sz in texts: cv2.putText(vis,t[:22],(x-20,y+4),0,.38,(160,0,160),1)
    cv2.imwrite(f'mu-f{fi}-vis.png',vis)
    out[fi]=dict(label=label,E=E,WC=WC,texts=texts)
    print(fi,label,'E',E,'WC',WC)
json.dump(out,open('mu-meta.json','w'),indent=0)
