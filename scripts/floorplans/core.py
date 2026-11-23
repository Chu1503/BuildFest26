"""Turn a wall mask + interior mask + a few annotations into GoGo's imported-building format."""
import numpy as np, cv2, math
import paths  # noqa: F401  (sets the working directory)
R2=lambda v:round(float(v),2)
def poly_mask(shape,polys,val=255):
    m=np.zeros(shape,np.uint8)
    for p in polys: cv2.fillPoly(m,[np.round(np.array(p,np.float32)).astype(np.int32)],val)
    return m
def line_mask(shape,lines,width):
    m=np.zeros(shape,np.uint8)
    for ln in lines: cv2.polylines(m,[np.round(np.array(ln,np.float32)).astype(np.int32)],False,255,max(1,int(round(width))))
    return m
def los(free,a,b):
    n=int(max(abs(b[0]-a[0]),abs(b[1]-a[1])))+1
    xs=np.round(np.linspace(a[0],b[0],n)).astype(int);ys=np.round(np.linspace(a[1],b[1],n)).astype(int)
    if xs.min()<0 or ys.min()<0 or xs.max()>=free.shape[1] or ys.max()>=free.shape[0]: return False
    return bool(free[ys,xs].all())
def nearest_on(mask,p,maxr=200):
    x,y=int(round(p[0])),int(round(p[1]))
    if 0<=y<mask.shape[0] and 0<=x<mask.shape[1] and mask[y,x]: return (x,y),0.0
    ys,xs=np.nonzero(mask[max(0,y-maxr):y+maxr,max(0,x-maxr):x+maxr])
    if not len(xs): return None,None
    xs=xs+max(0,x-maxr);ys=ys+max(0,y-maxr);d=(xs-x)**2+(ys-y)**2;k=int(d.argmin())
    return (int(xs[k]),int(ys[k])),math.sqrt(d[k])

def build_floor(fi,cfg,walls,area,scale,log=print):
    """fi: floor index. cfg keys: label, rooms[{id,label,point}], lifts[{group,point}], entrance{point,label}|None,
    exits[{point,label}], restrooms[[x,y]], stairs[x,y], seals[lines], openings[lines], blocks[polys], spacing_m, clear_m"""
    H,W=walls.shape;sh=(H,W)
    w=walls.copy()
    if cfg.get('seals'): w|=line_mask(sh,cfg['seals'],max(3,.25/scale))
    if cfg.get('openings'): w&=~line_mask(sh,cfg['openings'],max(6,cfg.get('door_m',1.0)/scale))
    blocked=(w>0)|(area==0)
    if cfg.get('blocks'): blocked|=poly_mask(sh,cfg['blocks'])>0
    walk=(~blocked).astype(np.uint8)
    n,lab=cv2.connectedComponents(walk,connectivity=8)
    anchors=[('lift',l['point']) for l in cfg.get('lifts',[])]+([('entrance',cfg['entrance']['point'])] if cfg.get('entrance') else [])
    keep=set()
    for kind,p in anchors:
        q,dd=nearest_on(walk,p,60)
        if q is None: raise SystemExit(f'floor {fi}: {kind} {p} not near walkable space')
        keep.add(lab[q[1],q[0]])
    reach=np.isin(lab,list(keep)).astype(np.uint8)
    dist=cv2.distanceTransform(reach,cv2.DIST_L2,5)
    free=(dist>=cfg.get('clear_m',.35)/scale).astype(np.uint8)
    g=max(2,cfg.get('spacing_m',1.2)/scale)
    nodes=[];edges=[];idx={}
    fl=cfg['label']
    def wp(p): return [R2((p[0]-W/2)*scale),R2((p[1]-H/2)*scale)]
    cols=int(W/g)+1;rows=int(H/g)+1
    for j in range(rows):
        for i in range(cols):
            x,y=int(round(i*g+g/2)),int(round(j*g+g/2))
            if x<W and y<H and free[y,x]:
                nid=f'p{fi}-{x}-{y}';idx[(i,j)]=(nid,(x,y));X,Z=wp((x,y));nodes.append(dict(id=nid,label='Passage · '+fl,x=X,z=Z,floor=fi))
    for (i,j),(nid,p) in idx.items():
        for di,dj in [(1,0),(0,1),(1,1),(1,-1),(2,1),(1,2),(2,-1),(1,-2)]:
            o=idx.get((i+di,j+dj))
            if o and los(free,p,o[1]): edges.append(dict(a=nid,b=o[0],meters=R2(math.dist(p,o[1])*scale)))
    pts=np.array([v[1] for v in idx.values()]) if idx else np.zeros((0,2));ids=[v[0] for v in idx.values()]
    def attach(nid,label,p,kind=None):
        q,dd=nearest_on(free,p,int(3/scale))
        if q is None: q,dd=nearest_on(reach,p,int(3/scale))
        if q is None: log(f'  !! {fl}: {label} at {p} is outside reachable space');return None
        if dd*scale>.6: log(f'  ~ {fl}: {label} snapped {dd*scale:.1f} m')
        X,Z=wp(q);nodes.append(dict(id=nid,label=label,x=X,z=Z,floor=fi))
        d=np.hypot(pts[:,0]-q[0],pts[:,1]-q[1]);order=np.argsort(d)
        c=0
        for k in order[:40]:
            if d[k]*scale>6:break
            if los(reach,q,tuple(pts[k])): edges.append(dict(id=f'access-{nid}-{ids[k]}',a=nid,b=ids[k],meters=R2(max(.05,d[k]*scale))));c+=1
            if c>=4:break
        if not c: log(f'  !! {fl}: {label} could not connect')
        return q
    plan_rooms=[];lifts=[];exits=[]
    ent=None
    if cfg.get('entrance'):
        e=cfg['entrance'];q=attach('entrance',e['label'],e['point']);ent=list(q)
    for k,r in enumerate(cfg.get('rooms',[])):
        rid=r.get('id') or f'room{fi}-{k}'
        q=attach(rid,f"{r['label']} · {fl}",r['point'])
        if q: plan_rooms.append(dict(id=rid,label=r['label'],point=list(q)))
    for l in cfg.get('lifts',[]):
        q=attach(f"lift{l['group']}-{fi}",f"{l.get('name','Elevator')} · {fl}",l['point']);lifts.append(list(q))
    for k,x in enumerate(cfg.get('exits',[])):
        q=attach(f'exit{fi}-{k}',x['label'],x['point'])
        if q: exits.append(dict(id=f'exit{fi}-{k}',label=x['label'],point=list(q)))
    # stitch components that the clearance mask split apart (narrow doors / corridors)
    from skimage.graph import MCP_Geometric
    pos={n['id']:(int(round(n['x']/scale+W/2)),int(round(n['z']/scale+H/2))) for n in nodes}
    def comps():
        par={n['id']:n['id'] for n in nodes}
        def f(x):
            while par[x]!=x: par[x]=par[par[x]];x=par[x]
            return x
        for e in edges: par[f(e['a'])]=f(e['b'])
        return f
    lift_ids=[n['id'] for n in nodes if n['id'].startswith(('lift','entrance'))] or [nodes[0]['id']]
    for _ in range(6*len(lift_ids)):
        f=comps();anchor=lift_ids[_%len(lift_ids)];main=f(anchor)
        groups={}
        for n in nodes: groups.setdefault(f(n['id']),[]).append(n['id'])
        others=[g for r,g in groups.items() if r!=main and any(not i.startswith('p') for i in g) or (r!=main and len(g)>=8)]
        if not others: break
        cost=np.where(reach>0,1+3/(1+dist),np.inf)
        mcp=MCP_Geometric(cost)
        starts=[(pos[i][1],pos[i][0]) for i in groups[main] if reach[pos[i][1],pos[i][0]]]
        cum,_=mcp.find_costs(starts)
        for g in others:
            best=min(g,key=lambda i:cum[pos[i][1],pos[i][0]] if reach[pos[i][1],pos[i][0]] else np.inf)
            if not np.isfinite(cum[pos[best][1],pos[best][0]]): continue
            path=mcp.traceback((pos[best][1],pos[best][0]))
            pts=[(x,y) for y,x in path][::max(1,int(g_step:=g_px))] if False else [(x,y) for y,x in path]
            step=max(2,int(g/2)) if False else max(2,int(cfg.get('spacing_m',1.2)/scale/2))
            chain=pts[::step]+[pts[-1]]
            # endpoints: nearest main node to chain start
            d0=min(groups[main],key=lambda i:math.dist(pos[i],chain[0]))
            prev=d0
            for k,p in enumerate(chain[1:-1]):
                nid=f'p{fi}-s{p[0]}-{p[1]}'
                if nid not in pos:
                    X,Z=wp(p);nodes.append(dict(id=nid,label='Passage · '+fl,x=X,z=Z,floor=fi));pos[nid]=p
                edges.append(dict(a=prev,b=nid,meters=R2(max(.05,math.dist(pos[prev],p)*scale))));prev=nid
            edges.append(dict(a=prev,b=best,meters=R2(max(.05,math.dist(pos[prev],pos[best])*scale))))
    # restroom approaches are resolved by amenities.js against catalog places; keep their plan points.
    # zones / holes from reachable space
    cs,hier=cv2.findContours(reach,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
    zones=[];holes=[]
    for c,h in zip(cs,hier[0]):
        if cv2.contourArea(c)<4:continue
        a=cv2.approxPolyDP(c,1.2,True)[:,0,:].tolist()
        if len(a)<3:continue
        (holes if h[3]>=0 else zones).append(a)
    # mesh
    inside=((area>0)&~(w>0)).astype(np.uint8)
    if cfg.get('blocks'): inside&=~(poly_mask(sh,cfg['blocks'])>0)
    cell=.2/scale;cw=int(W/cell);ch=int(H/cell)
    small=cv2.resize(inside,(cw,ch),interpolation=cv2.INTER_AREA)
    slabs=[]
    for j in range(ch):
        row=small[j]>0;i=0
        while i<cw:
            if row[i]:
                s=i
                while i<cw and row[i]:i+=1
                x0=s*cell;x1=i*cell;y=(j+.5)*cell
                slabs.append(dict(x=R2(((x0+x1)/2-W/2)*scale),z=R2((y-H/2)*scale),width=R2((x1-x0)*scale),depth=.2))
            else:i+=1
    wm=(w>0).astype(np.uint8)
    wm&=cv2.dilate(inside|reach,np.ones((5,5),np.uint8))  # only walls bordering the interior
    wc,_=cv2.findContours(wm,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    segs=[]
    for c in wc:
        if cv2.contourArea(c)<6 and len(c)<6:continue
        a=cv2.approxPolyDP(c,1.5,True)[:,0,:].tolist()
        for k in range(len(a)):
            p,q=a[k],a[(k+1)%len(a)]
            if math.dist(p,q)*scale>=.25: segs.append([wp(p),wp(q)])
    ys,xs=np.nonzero(inside);bx0,bx1,by0,by1=xs.min(),xs.max(),ys.min(),ys.max()
    mesh=dict(slabs=slabs,walls=segs,center=wp(((bx0+bx1)/2,(by0+by1)/2)),span=R2(max(bx1-bx0,by1-by0)*scale*.95))
    plan=dict(label=fl,image=cfg.get('image',''),width=W,height=H,scale=scale,zones=zones,exclusions=holes,walls=[],
              spawn=ent or lifts[0],lift=lifts[0],lifts=lifts,rooms=plan_rooms)
    if cfg.get('stairs'):plan['stairs']=cfg['stairs']
    if cfg.get('restrooms'):plan['restrooms']=[list(p) for p in cfg['restrooms']]
    if exits:plan['exits']=exits
    if cfg.get('note'):plan['note']=cfg['note']
    # connectivity report
    adj={}
    for e in edges: adj.setdefault(e['a'],[]).append(e['b']);adj.setdefault(e['b'],[]).append(e['a'])
    starts=[f"lift{l['group']}-{fi}" for l in cfg['lifts']];seen=set(starts);st=list(starts)
    while st:
        u=st.pop()
        for v in adj.get(u,[]):
            if v not in seen:seen.add(v);st.append(v)
    special=[x['id'] for x in nodes if not x['id'].startswith('p')]
    bad=[s for s in special if s not in seen]
    if bad: log(f'  !! {fl}: not connected to main lift: {bad}')
    log(f'{fl}: {len(nodes)} nodes, {len(edges)} edges, {len(slabs)} slabs, {len(segs)} walls, {len(zones)} zones, {len(holes)} holes')
    return dict(plan=plan,nodes=nodes,edges=edges,mesh=mesh,debug=dict(reach=reach,free=free,walls=w,idx=idx))

def debug_image(base,res,path,crop=True):
    vis=base.copy() if base.ndim==3 else cv2.cvtColor(base,cv2.COLOR_GRAY2BGR)
    ov=vis.copy();ov[res['debug']['reach']>0]=(200,240,200);vis=cv2.addWeighted(vis,.5,ov,.5,0)
    vis[res['debug']['walls']>0]=(30,30,30)
    P={n['id']:n for n in res['nodes']};pl=res['plan'];W,H,s=pl['width'],pl['height'],pl['scale']
    px=lambda n:(int(n['x']/s+W/2),int(n['z']/s+H/2))
    for e in res['edges']:
        if e['a'] in P and e['b'] in P: cv2.line(vis,px(P[e['a']]),px(P[e['b']]),(230,180,120),1)
    for n in res['nodes']:
        if not n['id'].startswith('p'):
            c=(0,0,255) if n['id'].startswith('lift') else (0,150,0) if n['id'].startswith(('entrance','exit')) else (200,0,200)
            cv2.circle(vis,px(n),6,c,-1);cv2.putText(vis,n['label'].split(' · ')[0][:24],(px(n)[0]+7,px(n)[1]+4),0,.4,c,1)
    for p in pl.get('restrooms',[]):cv2.rectangle(vis,(int(p[0])-5,int(p[1])-5),(int(p[0])+5,int(p[1])+5),(0,140,255),2)
    Hh,Ww=vis.shape[:2]
    for g in range(0,max(Ww,Hh),50):
        c=(255,120,120) if g%100==0 else (255,215,215)
        cv2.line(vis,(g,0),(g,Hh),c,1);cv2.line(vis,(0,g),(Ww,g),c,1)
        if g%100==0:
            for k in range(0,max(Ww,Hh),200):cv2.putText(vis,str(g),(g+2,k+12),0,.35,(255,0,0),1);cv2.putText(vis,str(g),(k+2,g-2),0,.35,(255,0,0),1)
    ys,xs=np.nonzero(res['debug']['walls']|cv2.dilate(res['debug']['reach'],None));m=40
    if crop and len(xs): vis=vis[max(0,ys.min()-m):ys.max()+m,max(0,xs.min()-m):xs.max()+m]
    cv2.imwrite(path,vis)
