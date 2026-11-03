// A minimal ZIP writer for small download bundles (stored, no compression: images are already
// compressed and text files are tiny). Names are UTF-8. Returns a Blob of type application/zip.
const table=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
export function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}

export async function zipBlob(files){
  const encoder=new TextEncoder(),parts=[],central=[];let offset=0;
  for(const file of files){
    const name=encoder.encode(file.name),data=file.data instanceof Blob?new Uint8Array(await file.data.arrayBuffer()):typeof file.data==='string'?encoder.encode(file.data):new Uint8Array(file.data);
    const crc=crc32(data),local=new DataView(new ArrayBuffer(30));
    // Local header: version 20, UTF-8 names (bit 11), stored, no date (1980-01-01).
    [[0,0x04034b50,4],[4,20,2],[6,0x0800,2],[8,0,2],[10,0,2],[12,0x21,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,name.length,2],[28,0,2]].forEach(([at,v,n])=>n===4?local.setUint32(at,v,true):local.setUint16(at,v,true));
    parts.push(local,name,data);
    const entry=new DataView(new ArrayBuffer(46));
    [[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x0800,2],[10,0,2],[12,0,2],[14,0x21,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[30,0,2],[32,0,2],[34,0,2],[36,0,2],[38,0,4],[42,offset,4]].forEach(([at,v,n])=>n===4?entry.setUint32(at,v,true):entry.setUint16(at,v,true));
    central.push(entry,name);offset+=30+name.length+data.length;
  }
  const size=central.reduce((n,p)=>n+p.byteLength,0),end=new DataView(new ArrayBuffer(22));
  [[0,0x06054b50,4],[4,0,2],[6,0,2],[8,files.length,2],[10,files.length,2],[12,size,4],[16,offset,4],[20,0,2]].forEach(([at,v,n])=>n===4?end.setUint32(at,v,true):end.setUint16(at,v,true));
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
