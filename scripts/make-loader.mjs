// Context Desk loader: the brand mark's four frames light up in turn (signal, volt, cue, signal),
// then the play triangle settles. 60 fps, 90 frames, seamless loop, transparent.
import fs from 'node:fs';
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).concat(1);
const ease={o:{x:[0.33],y:[0]},i:{x:[0.2],y:[1]}};
const anim=(frames)=>({a:1,k:frames.map(([t,s],n)=>n<frames.length-1?{t,s,...ease}:{t,s})});
const still=v=>({a:0,k:v});
// Mark geometry (28-unit viewBox) scaled x4 and offset 4 into a 120 x 120 canvas.
const tiles=[{c:[34,30],s:[36,28],color:'#ff5a1f'},{c:[86,30],s:[36,28],color:'#c9f23b'},{c:[86,82],s:[36,44],color:'#59d0f5'},{c:[34,82],s:[36,44],color:'#ff7a47'}];
const layers=[];
// Triangle on top: the ground colour cut through the frames, as in the logo.
layers.push({ddd:0,ind:1,ty:4,nm:'Play',sr:1,ks:{o:still(100),r:still(0),p:still([60,60,0]),a:still([60,60,0]),s:anim([[0,[100,100,100]],[64,[100,100,100]],[74,[108,108,100]],[86,[100,100,100]],[90,[100,100,100]]])},ao:0,
  shapes:[{ty:'gr',nm:'Triangle',it:[{ty:'sh',ks:still({i:[[0,0],[0,0],[0,0]],o:[[0,0],[0,0],[0,0]],v:[[40,36],[88,60],[40,84]],c:true})},{ty:'fl',c:still(hex('#f3f1ec')),o:still(100),r:1},{ty:'st',c:still(hex('#0b0b0d')),o:still(100),w:still(5),lc:2,lj:2},{ty:'tr',p:still([0,0]),a:still([0,0]),s:still([100,100]),r:still(0),o:still(100)}]}],ip:0,op:90,st:0,bm:0});
tiles.forEach((tile,i)=>{const t0=4+i*14,peak=[t0+10,t0+20],down=t0+34;
  layers.push({ddd:0,ind:i+2,ty:4,nm:'Frame '+(i+1),sr:1,ks:{o:anim([[0,[62]],[t0,[62]],[peak[0],[100]],[peak[1],[100]],[down,[62]],[90,[62]]]),r:still(0),p:still([...tile.c,0]),a:still([0,0,0]),s:anim([[0,[94,94,100]],[t0,[94,94,100]],[peak[0],[100,100,100]],[peak[1],[100,100,100]],[down,[94,94,100]],[90,[94,94,100]]])},ao:0,
    shapes:[{ty:'gr',nm:'Tile',it:[{ty:'rc',d:1,s:still(tile.s),p:still([0,0]),r:still(6)},{ty:'fl',c:still(hex(tile.color)),o:still(100),r:1},{ty:'tr',p:still([0,0]),a:still([0,0]),s:still([100,100]),r:still(0),o:still(100)}]}],ip:0,op:90,st:0,bm:0})});
const lottie={v:'5.7.4',fr:60,ip:0,op:90,w:120,h:120,nm:'Context Desk loader',ddd:0,assets:[],layers};
fs.writeFileSync(process.argv[2],JSON.stringify(lottie));console.log('frames',lottie.op,'layers',layers.length);
