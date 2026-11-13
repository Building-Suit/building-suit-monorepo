from pathlib import Path
import re,xml.etree.ElementTree as E,hashlib
root=Path(__file__).resolve().parents[5]
source=root/'packages/brand/assets/doctor-suit-mark-light.svg'
svg=E.fromstring(source.read_bytes());x,y,w,h=map(float,svg.attrib['viewBox'].split())
ns='http://schemas.android.com/apk/res/android';E.register_namespace('android',ns)
a=lambda key:'{'+ns+'}'+key
vector=E.Element('vector',{a('width'):'108dp',a('height'):'108dp',a('viewportWidth'):str(w),a('viewportHeight'):str(h)})
padding=E.SubElement(vector,'group',{a('scaleX'):str(2/3),a('scaleY'):str(2/3),a('translateX'):str(w/6),a('translateY'):str(h/6)})
origin=E.SubElement(padding,'group',{a('translateX'):str(-x),a('translateY'):str(-y)})
for node in svg:
 if node.tag.split('}')[-1]!='path' or set(node.attrib)-{'d','fill','transform'}:raise RuntimeError('Unsupported canonical icon structure')
 if not re.fullmatch(r'#[0-9a-fA-F]{6}',node.attrib['fill']):raise RuntimeError('Unsupported icon colour')
 parent=origin
 if node.get('transform'):
  match=re.fullmatch(r'translate\(([-+0-9.e]+)[, ]+([-+0-9.e]+)\)',node.get('transform'))
  if not match:raise RuntimeError('Unsupported icon transform')
  parent=E.SubElement(origin,'group',{a('translateX'):match[1],a('translateY'):match[2]})
 E.SubElement(parent,'path',{a('fillColor'):node.attrib['fill'],a('pathData'):node.attrib['d']})
out=Path(__file__).resolve().parents[1]/'android/app/src/main/res'
E.indent(vector)
(out/'drawable-v24/ic_launcher_foreground.xml').write_bytes(E.tostring(vector,encoding='utf-8',xml_declaration=True))
# Platform padding only; canonical vector geometry and colours are preserved.
bg=E.Element('shape',{'xmlns:android':ns,'android:shape':'rectangle'});E.SubElement(bg,'solid',{'android:color':'#141414'})
(out/'drawable/ic_launcher_background.xml').write_bytes(E.tostring(bg,encoding='utf-8',xml_declaration=True))
print('Generated Android vector from canonical Doctor mark:',hashlib.sha256(source.read_bytes()).hexdigest())
