import test from 'node:test';import assert from 'node:assert/strict';
import {cleanCaptionLook,captionFontSize,assColour,captionPlacement} from '../public/brand-kit.js';import {cleanBrand} from '../lib/brands.js';import {assDocument} from '../lib/exports.js';
test('brand settings validate fonts, colours, size and placement rather than entering filter syntax',()=>{
 const look=cleanCaptionLook({font:'bad,\nstyle',color:'{\\pos(0,0)}',accent:'#FFB283',scale:50,position:'outside'});assert.equal(look.font,'Arial');assert.equal(look.color,'#ffffff');assert.equal(look.accent,'#ffb283');assert.equal(look.scale,1.5);assert.equal(look.position,'bottom');assert.throws(()=>cleanBrand({name:' '}),/name/);
 assert.equal(assColour('#123456'),'&H00563412');assert.equal(captionPlacement('middle',1000,100),500);
});
test('caption type scales with export resolution and brand settings reach the rendered subtitle stylesheet',()=>{
 assert.ok(Math.abs(captionFontSize(1080,1920,{scale:1.2})-2*captionFontSize(540,960,{scale:1.2}))<=1);
 const m={start:0,end:5,trimIn:0,trimOut:5,captionLanguage:'English',captionStyle:'clean',captionLook:{font:'Manrope',color:'#123456',background:'#ffffff',scale:1.2,position:'top'},showCaptions:true,captionCues:{English:[{start:0,end:2,text:'The actual words.'}]}};
 const ass=assDocument(m,1080,1920);assert.match(ass,/Caption,Manrope,/);assert.match(ass,/&H00563412/);assert.match(ass,/The actual words/);
});
