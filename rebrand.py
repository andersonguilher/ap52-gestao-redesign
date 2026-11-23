import re,glob,colorsys,sys
def tf(r,g,b):
    h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255); h*=360
    if not (160<=h<=200) or s<0.04: return None   # only teal/petrol family; true greens (<160) are semantic
    if s>=0.25:
        if l<0.30: h,s=213,max(s,0.62)
        elif l<0.60: h,s=203,max(s,0.50)
        else: h=206
    else: h=210
    rr,gg,bb=colorsys.hls_to_rgb(h/360,l,min(s,1)); return round(rr*255),round(gg*255),round(bb*255)
def hexsub(m):
    v=m.group(1); r,g,b=int(v[0:2],16),int(v[2:4],16),int(v[4:6],16)
    t=tf(r,g,b); return m.group(0) if not t else '#%02x%02x%02x'%t
def rgbasub(m):
    r,g,b=int(m.group(2)),int(m.group(3)),int(m.group(4)); t=tf(r,g,b)
    return m.group(0) if not t else f'{m.group(1)}({t[0]},{t[1]},{t[2]}'
n=0
for f in glob.glob('*.css')+glob.glob('*.js')+['index.html']:
    s=open(f,encoding='utf-8').read(); o=s
    s=re.sub(r'#([0-9a-fA-F]{6})\b',hexsub,s)
    s=re.sub(r'(rgba?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)',rgbasub,s)
    s=re.sub(r'#e8a33d','#42b9eb',s,flags=re.I)   # amber accent -> brand cyan
    if s!=o: open(f,'w',encoding='utf-8',newline='').write(s); n+=1; print('changed',f)
print(n)
