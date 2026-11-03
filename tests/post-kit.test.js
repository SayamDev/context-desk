import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {zipBlob,crc32} from '../public/zip.js';
import {notesText} from '../public/post-kit.js';

test('the post kit ZIP opens with a standard unzip and keeps every file intact',async()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const png=new Uint8Array(4096).map((_,i)=>(i*31)&255),files=[{name:'title-card-9x16.png',data:new Blob([png])},{name:'caption.txt',data:'Falla accuses Samer\n\n#realityshow\n'},{name:'culture-notes.txt',data:'والله: I swear\n'}];
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'kit-')),zip=path.join(dir,'kit.zip');await fs.writeFile(zip,Buffer.from(await (await zipBlob(files)).arrayBuffer()));
  assert.match(execFileSync('unzip',['-t',zip]).toString(),/No errors detected/);
  execFileSync('unzip',['-q',zip,'-d',path.join(dir,'out')]);
  assert.deepEqual(new Uint8Array(await fs.readFile(path.join(dir,'out','title-card-9x16.png'))),png);
  assert.equal(await fs.readFile(path.join(dir,'out','caption.txt'),'utf8'),'Falla accuses Samer\n\n#realityshow\n');
  assert.equal(await fs.readFile(path.join(dir,'out','culture-notes.txt'),'utf8'),'والله: I swear\n');
  // UTF-8 names (flag 0x800) read back exactly in a modern reader; macOS's bundled unzip predates UTF-8 names.
  const named=path.join(dir,'named.zip');await fs.writeFile(named,Buffer.from(await (await zipBlob([{name:'ملاحظات.txt',data:'x'}])).arrayBuffer()));
  assert.equal(execFileSync('python3',['-c','import sys,zipfile;print(zipfile.ZipFile(sys.argv[1]).namelist()[0])',named]).toString().trim(),'ملاحظات.txt');
  await fs.rm(dir,{recursive:true,force:true});
});

test('culture notes in the kit leave out the ones switched off the video',()=>{
  assert.equal(notesText([{phrase:'والله',literal:'by God',meaning:'I swear'},{phrase:'يلا',literal:'come on',meaning:'Hurry',hidden:true}]),'والله (by God): I swear');
  assert.equal(notesText(undefined),'');
});
