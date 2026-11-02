// Editor timeline export: Final Cut Pro 7 XML ("xmeml"), which Adobe Premiere Pro imports as
// "Final Cut Pro XML" and DaVinci Resolve imports as a timeline. Clips reference the original
// source files on this computer, so the editor re-links nothing and keeps full quality.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fileUrl=file=>'file://localhost'+String(file).split('/').map(encodeURIComponent).join('/');
// clips: [{name, file, fileDuration (s), in (s), out (s)}], all on one source frame rate.
export function buildXmeml({name,fps,width,height,clips}){
  const timebase=Math.round(fps)||30,ntsc=Math.abs(fps-Math.round(fps))>.01?'TRUE':'FALSE',fr=s=>Math.round(s*timebase);
  const rate=`<rate><timebase>${timebase}</timebase><ntsc>${ntsc}</ntsc></rate>`,files=new Map();let at=0;
  const items=clips.map((c,i)=>{const len=fr(c.out)-fr(c.in),start=at;at+=len;let fileId=files.get(c.file);const first=!fileId;if(first){fileId='file-'+(files.size+1);files.set(c.file,fileId)}
    const fileXml=first?`<file id="${fileId}"><name>${esc(c.file.split('/').pop())}</name><pathurl>${esc(fileUrl(c.file))}</pathurl>${rate}<duration>${fr(c.fileDuration)}</duration><media><video><samplecharacteristics><width>${width}</width><height>${height}</height></samplecharacteristics></video><audio><channelcount>2</channelcount></audio></media></file>`:`<file id="${fileId}"/>`;
    return {i,start,end:at,len,c,fileXml}});
  const clip=(it,kind,fileXml)=>`<clipitem id="${kind}-${it.i+1}"><name>${esc(it.c.name||'Clip '+(it.i+1))}</name><duration>${fr(it.c.fileDuration)}</duration>${rate}<start>${it.start}</start><end>${it.end}</end><in>${fr(it.c.in)}</in><out>${fr(it.c.in)+it.len}</out>${fileXml}${kind==='audio'?'<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>':''}</clipitem>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4"><sequence id="sequence-1"><name>${esc(name)}</name><duration>${at}</duration>${rate}<media><video><format><samplecharacteristics>${rate}<width>${width}</width><height>${height}</height></samplecharacteristics></format><track>${items.map(it=>clip(it,'video',it.fileXml)).join('')}</track></video><audio><track>${items.map(it=>clip(it,'audio',`<file id="${files.get(it.c.file)}"/>`)).join('')}</track></audio></media></sequence></xmeml>\n`;
}
