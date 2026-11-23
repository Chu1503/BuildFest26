import pymupdf as fitz, numpy as np, cv2, json, sys
from paths import PLANS
DL=PLANS+'/'
def paths(page):
    out=[]
    for d in page.get_drawings():
        polys=[];cur=[]
        for it in d['items']:
            k=it[0]
            if k=='l': a,b=it[1],it[2]; seg=[a,b]
            elif k=='c': a,c1,c2,b=it[1:5]; seg=[a+(c1-a)*0+ (a)*0] ; seg=[ (a*(1-t)**3+c1*3*t*(1-t)**2+c2*3*t*t*(1-t)+b*t**3) for t in np.linspace(0,1,9)]
            elif k=='re': r=it[1]; polys.append([r.tl,r.tr,r.br,r.bl,r.tl]); continue
            elif k=='qu': q=it[1]; polys.append([q.ul,q.ur,q.lr,q.ll,q.ul]); continue
            else: continue
            if cur and abs(cur[-1].x-seg[0].x)<.01 and abs(cur[-1].y-seg[0].y)<.01: cur+=seg[1:]
            else:
                if cur: polys.append(cur)
                cur=list(seg)
        if cur: polys.append(cur)
        out.append(dict(type=d['type'],color=d.get('color'),fill=d.get('fill'),width=d.get('width') or 0,polys=[[(p.x,p.y) for p in pl] for pl in polys],closePath=d.get('closePath')))
    return out
def near(c,ref,tol=.04): return c is not None and all(abs(a-b)<tol for a,b in zip(c,ref))
def canvas(w,h): return np.zeros((h,w),np.uint8)
def draw(img,path,tf,stroke=None,fill=False,closed=False):
    for pl in path['polys']:
        pts=np.array([tf(p) for p in pl],np.float32)
        if fill and len(pts)>2: cv2.fillPoly(img,[np.round(pts*8).astype(np.int32)],255,cv2.LINE_8,3)
        if stroke: cv2.polylines(img,[np.round(pts*8).astype(np.int32)],closed,255,max(1,int(round(stroke))),cv2.LINE_8,3)
