import json,base64,struct,sys
from PIL import Image
L=json.load(open('assets/level.json')); T=Image.open('assets/terrain.png').convert('RGBA'); SP=Image.open('assets/sprites.png').convert('RGBA'); SJ=json.load(open('assets/sprites.json'))['rects']
W,H=L['w'],L['h']; cols=L['terrain']['cols']
u8=lambda s: base64.b64decode(s)
u16=lambda s: struct.unpack('<%dH'%(W*H), base64.b64decode(s))
kind=u8(L['kind']); floor=u16(L['floor']); wall=u16(L['wall'])
x0,y0,x1,y1=[int(v) for v in sys.argv[1:5]]; S=int(sys.argv[5]) if len(sys.argv)>5 else 16
img=Image.new('RGBA',((x1-x0)*S,(y1-y0)*S),(5,5,12,255))
def cell(c):
    return T.crop(((c%cols)*32,(c//cols)*32,(c%cols)*32+32,(c//cols)*32+32)).resize((S,S),Image.NEAREST)
for r in range(y0,y1):
    for c in range(x0,x1):
        i=r*W+c
        if kind[i] in (1,3) and floor[i]!=0xFFFF: img.paste(cell(floor[i]),((c-x0)*S,(r-y0)*S))
        elif kind[i]==2 and wall[i]!=0xFFFF:
            v=L['walls'][wall[i]]; cc=v['cells'][3]
            im=cell(cc); 
            if v['glass']: img.alpha_composite(im,((c-x0)*S,(r-y0)*S))
            else: img.paste(im,((c-x0)*S,(r-y0)*S))
for p in L['props']:
    if p['x']<x0 or p['x']>=x1 or p['y']<y0 or p['y']>=y1: continue
    s=p.get('s',-1)
    if p['k']=='door': s=p['fr'][0]
    if s is None or s<0: continue
    rx,ry,rw,rh,ox,oy,fw,fh=SJ[s][:8]
    sp=SP.crop((rx,ry,rx+rw,ry+rh))
    k=S/32; sp=sp.resize((max(1,int(rw*k)),max(1,int(rh*k))),Image.NEAREST)
    px=int((p['x']-x0)*S+ox*k+ (S-fw*k)/2); py=int((p['y']-y0)*S+oy*k+(S-fh*k))
    img.alpha_composite(sp,(max(0,px),max(0,py))) if px>=0 and py>=0 else None
img.save(sys.argv[6] if len(sys.argv)>6 else '/tmp/claude-0/-home-user/012874d7-24af-53c0-8772-b755ac538d83/scratchpad/top.png')
