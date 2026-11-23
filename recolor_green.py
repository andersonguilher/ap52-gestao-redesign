import re,glob,colorsys
KEEP={'1a6b3c','14532d','2f8a5b','257a53','246b4e','1e7a54','16825d','1f7a54','19845f','1f6e4f'}
def tf(r,g,b,hx=None):
    h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255); h*=360
    if not (80<=h<175) or s<0.06: return None
    if hx and hx in KEEP: return None
    if s<0.30: H,S=210,s
    elif l<0.45: H,S=213,max(s,0.55)
    else: return None
    rr,gg,bb=colorsys.hls_to_rgb(H/360,l,min(S,1)); return round(rr*255),round(gg*255),round(bb*255)
def hexsub(m):
    v=m.group(1).lower(); r,g,b=int(v[0:2],16),int(v[2:4],16),int(v[4:6],16); t=tf(r,g,b,v)
    return m.group(0) if not t else '#%02x%02x%02x'%t
def rgbsub(m):
    t=tf(int(m.group(2)),int(m.group(3)),int(m.group(4))); return m.group(0) if not t else f'{m.group(1)}({t[0]},{t[1]},{t[2]}'
n=0
for f in glob.glob('site/demandas*.css')+glob.glob('site/asfaltinho-*.css'):
    s=open(f,encoding='utf-8').read(); o=s
    s=re.sub(r'#([0-9a-fA-F]{6})\b',hexsub,s); s=re.sub(r'(rgba?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)',rgbsub,s)
    if s!=o: open(f,'w',encoding='utf-8',newline='').write(s); n+=1; print('recolor',f)
print(n)
