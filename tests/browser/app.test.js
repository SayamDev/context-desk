// Browser smoke tests: the real server and the real page in Chrome, with no AI key.
// Run with npm run test:browser. They need Chrome and FFmpeg (FFMPEG_PATH or .runtime/bin/ffmpeg).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {startApp,openBrowser,watchedPage} from './harness.js';

const ffmpeg=process.env.FFMPEG_PATH||path.resolve(import.meta.dirname,'../../.runtime/bin/ffmpeg');
let browser;
test.before(async()=>{browser=await openBrowser()});
test.after(async()=>{await browser?.close()});

test('a fresh install loads cleanly and the setup check names the missing AI key',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    await page.getByRole('button',{name:'New project',exact:true}).waitFor();
    const setup=page.locator('.setup-check');
    await setup.locator('summary').click();
    assert.match(await setup.innerText(),/AI key \(Meta\)/);
    assert.doesNotMatch(await setup.innerText(),/FFmpeg/);
    assert.deepEqual(problems,[]);
  }finally{await app.stop()}
});

test('the setup check lists FFmpeg and captions when FFmpeg is missing',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:'/nonexistent/ffmpeg'}});
  try{
    const {page}=await watchedPage(browser,app.url);
    await page.locator('.setup-check summary').click();
    const text=await page.locator('.setup-check').innerText();
    assert.match(text,/FFmpeg \(video processing\)/);
    assert.match(text,/Burned-in captions/);
    assert.match(text,/npm run setup/);
  }finally{await app.stop()}
});

test('every workspace opens without errors, and Studio waits for a clip',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    const nav=workspace=>page.locator(`.workspace-nav [data-workspace=${workspace}]`);
    assert.ok(await nav('edit').isDisabled());
    for(const workspace of ['library','jobs','brand']){
      await nav(workspace).click();
      await page.waitForFunction(w=>document.body.dataset.workspace===w,workspace);
    }
    await page.getByRole('link',{name:'Context Desk home'}).click();
    await page.waitForURL(/#\/home$/);
    await page.locator('#openSettings').click();
    await page.keyboard.press('Escape');
    assert.deepEqual(problems,[]);
  }finally{await app.stop()}
});

test('the home page fits phone screens without sideways scrolling',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    for(const width of [320,390]){
      const {page,problems}=await watchedPage(browser,app.url,{viewport:{width,height:844}});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      assert.ok(overflow<=1,`at ${width}px the page is ${overflow}px wider than the screen`);
      assert.deepEqual(problems,[]);
      await page.close();
    }
  }finally{await app.stop()}
});

test('an uploaded video becomes a saved project that survives a reload',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'context-sample-')),file=path.join(dir,'sample.mp4');
  execFileSync(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc=size=640x360:rate=25:duration=6','-f','lavfi','-i','sine=frequency=440:duration=6','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',file]);
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    const uploadButton=page.locator('#homeSourceActions .upload-button');
    const target=await uploadButton.boundingBox();
    let resumeUpload;
    const uploadPaused=new Promise(resolve=>{resumeUpload=resolve});
    await page.route('**/api/import/upload',async route=>{await uploadPaused;await route.continue()});
    await page.setInputFiles('#fileInput',file);
    const loader=page.getByRole('dialog',{name:'Preparing your long recording'});
    try{
      await loader.waitFor();
      assert.equal(await page.locator('#activityPanel').isVisible(),false);
      await loader.getByRole('button',{name:'Cancel',exact:true}).waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await loader.isVisible(),true);
      let chooserOpened=false;
      page.once('filechooser',()=>{chooserOpened=true});
      await page.mouse.click(target.x+target.width/2,target.y+target.height/2);
      assert.equal(chooserOpened,false);
    }finally{resumeUpload()}
    await loader.waitFor({state:'hidden'});
    await page.waitForURL(/#\/discover$/);
    await page.getByText('Video ready. Add a Meta API key').waitFor();
    await page.getByText('All changes saved',{exact:false}).first().waitFor();
    const {projects}=await (await fetch(app.url+'/api/projects')).json();
    assert.equal(projects.length,1);
    assert.equal(projects[0].title,'sample.mp4');
    assert.equal(Math.round(projects[0].duration),6);
    let resumeRestore;
    const restorePaused=new Promise(resolve=>{resumeRestore=resolve});
    await page.route('**/api/preferences',async route=>{await restorePaused;await route.continue()});
    await page.reload({waitUntil:'domcontentloaded'});
    const restoring=page.getByRole('dialog',{name:'Opening your saved workspace'});
    try{
      await restoring.waitFor();
      assert.equal(await page.locator('.workspace-nav').isVisible(),false);
      assert.equal(await page.locator('#activityPanel').isVisible(),false);
    }finally{resumeRestore()}
    await restoring.waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.querySelector('#projectTitle')?.value==='sample.mp4');
    assert.equal(await page.evaluate(()=>document.body.dataset.workspace),'clips');
    await page.getByRole('navigation',{name:'Project',exact:true}).getByRole('button',{name:'Full video',exact:true}).click();
    await page.getByRole('button',{name:'Edit video in Studio'}).click();
    await page.waitForURL(/#\/studio$/);
    await page.waitForFunction(()=>document.getElementById('clipVideo').readyState>=2);
    await page.locator('#trimOut').fill('4');
    await page.locator('#trimOut').blur();
    await page.waitForFunction(async id=>{
      const project=await (await fetch('/api/projects/'+id)).json();
      return project.state.moments.some(moment=>moment.trimOut===4);
    },projects[0].id);
    assert.deepEqual(problems,[]);
  }finally{await app.stop();await fs.rm(dir,{recursive:true,force:true})}
});

test('a trashed video is deleted for good, and Empty Trash also clears leftover recordings',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'context-sample-')),file=path.join(dir,'sample.mp4');
  execFileSync(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc=size=320x180:rate=25:duration=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',file]);
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}}),api=(url,body)=>fetch(app.url+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
  const exists=p=>fs.access(p).then(()=>true,()=>false);
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    await page.setInputFiles('#fileInput',file);await page.getByText('All changes saved',{exact:false}).first().waitFor();
    const projectNav=page.getByRole('navigation',{name:'Project',exact:true});
    await projectNav.getByRole('button',{name:'Full video',exact:true}).click();
    await page.waitForURL(/#\/full-video$/);
    assert.equal(await page.locator('#program').isVisible(),true);
    await projectNav.getByRole('button',{name:'Exports',exact:true}).click();
    await page.waitForURL(/#\/exports$/);
    await page.getByRole('button',{name:'Choose a clip',exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Chapter timestamps',exact:true}).isVisible(),false);
    await projectNav.getByRole('button',{name:'Clips',exact:true}).click();

    const [uploaded]=(await (await fetch(app.url+'/api/projects')).json()).projects,sourceDir=path.join(app.dataDir,'sources',uploaded.sourceId);
    assert.ok(await exists(sourceDir));
    await api('/api/projects/'+uploaded.id,{action:'trash',trashed:true});
    await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
    const actions=page.locator('.home-project-actions');
    await actions.getByRole('button',{name:'All projects'}).waitFor();
    await actions.getByRole('button',{name:'Trash (1)',exact:true}).click();
    await page.getByRole('button',{name:'Delete forever'}).waitFor();
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Delete forever'}).click();
    await page.waitForFunction(()=>location.hash==='#/home');await page.waitForLoadState('networkidle');
    assert.equal(await exists(sourceDir),false);
    assert.deepEqual((await (await fetch(app.url+'/api/projects?trash=1')).json()).projects,[]);
    // A leftover recording folder no project uses, and one more trashed project.
    const leftover=path.join(app.dataDir,'sources','66666666-6666-4666-8666-666666666666');await fs.mkdir(leftover,{recursive:true});await fs.writeFile(path.join(leftover,'source.mp4'),'x'.repeat(5000));
    const extra=await api('/api/projects',{title:'Old live session'});await api('/api/projects/'+extra.id,{action:'trash',trashed:true});
    await page.locator('.workspace-nav [data-workspace=library]').click();await page.locator('#showProjectTrash').check();
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:/Empty Trash/}).click();
    await page.getByText('Deleted 1 project for good.',{exact:false}).waitFor();
    assert.equal(await exists(leftover),false);
    assert.deepEqual(problems,[]);
  }finally{await app.stop();await fs.rm(dir,{recursive:true,force:true})}
});

test('Home > Subtitles for the whole video opens the whole-video track instead of a clip scan',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'context-sample-')),file=path.join(dir,'talk.mp4');
  execFileSync(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc=size=320x180:rate=25:duration=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',file]);
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    await page.getByRole('radio',{name:'Subtitles for the whole video'}).check();
    assert.match(await page.locator('#openStream').innerText(),/Subtitle video/);
    await page.setInputFiles('#fileInput',file);
    await page.waitForFunction(()=>document.getElementById('wholeSubtitleDetails')?.open);
    // No AI key in tests: it explains what is needed instead of starting a clip scan.
    await page.getByText('Translating the whole recording needs the Meta key',{exact:false}).waitFor();
    assert.equal(await page.locator('#batchProgress').innerText(),'Video ready. Subtitles for the whole video are below.');
    await page.waitForURL(/#\/full-video$/);
    await page.locator('#program').evaluate(video=>{video.currentTime=1.5});
    await page.waitForFunction(()=>!document.getElementById('program').seeking&&Object.entries(localStorage).some(([key,value])=>key.startsWith('context-desk:playhead:source:')&&Number(value)===1.5));
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>Math.abs(document.getElementById('program').currentTime-1.5)<.05);
    assert.equal(await page.locator('#program').evaluate(video=>video.paused),true);
    await page.locator('.ds-rail .brand-home, a[aria-label="Context Desk home"]').first().click();
    assert.equal(await page.getByRole('radio',{name:'Subtitles for the whole video'}).isChecked(),true);
    assert.deepEqual(problems,[]);
  }finally{await app.stop();await fs.rm(dir,{recursive:true,force:true})}
});

test('keyboard and screen readers: skip link, one main region, recorded video is separate from clips, Arabic titles keep their direction',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    assert.equal(await page.locator('main').count(),1);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Skip to content');
    const hash=await page.evaluate(()=>location.hash);await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'main');assert.equal(await page.evaluate(()=>location.hash),hash);
    await page.goto(app.url+'/#/discover');
    await page.waitForFunction(()=>document.body.dataset.workspace==='clips');
    assert.equal(await page.locator('#monitor').isVisible(),false);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('projectTitle')).unicodeBidi),'plaintext');
    assert.deepEqual(problems,[]);
  }finally{await app.stop()}
});

test('Studio fullscreen: a sharp picture with its play bar, which fades while watching and returns on movement',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    await page.evaluate(async()=>{const {mountPreviewFullscreen}=await import('/fullscreen.js');const frame=document.createElement('div'),bar=document.createElement('div'),holder=document.createElement('div');frame.id='fsFrame';frame.className='preview-frame';frame.style.cssText='position:fixed;left:20px;top:20px;width:320px;height:180px;z-index:9999';bar.id='fsBar';bar.textContent='play bar';holder.append(bar);document.body.append(frame,holder);
      window.fsChanges=[];mountPreviewFullscreen({frame,transport:bar,onChange:on=>window.fsChanges.push(on)})});
    await page.locator('#fsFrame .preview-fullscreen-toggle').click();
    // fullscreenchange arrives just after fullscreenElement is set, so wait for its effects.
    await page.waitForFunction(()=>document.fullscreenElement?.id==='fsFrame'&&document.getElementById('fsFrame').contains(document.getElementById('fsBar'))&&document.activeElement.id==='fsFrame');
    await page.waitForFunction(()=>document.getElementById('fsFrame').classList.contains('is-idle'),null,{timeout:5000});
    await page.mouse.move(200,200);await page.mouse.move(220,220);
    assert.equal(await page.evaluate(()=>document.getElementById('fsFrame').classList.contains('is-idle')),false);
    // Esc is handled by the browser itself; the same corner button exits.
    await page.locator('#fsFrame .preview-fullscreen-toggle').click();await page.waitForFunction(()=>!document.fullscreenElement);
    // The play bar goes back to its place once the browser reports the change.
    await page.waitForFunction(()=>!document.getElementById('fsFrame').contains(document.getElementById('fsBar')));
    assert.deepEqual(await page.evaluate(()=>window.fsChanges),[true,false]);
    assert.deepEqual(problems,[]);
  }finally{await app.stop()}
});

test('the trim bar zooms a 30-second clip in a 2-hour window, so dragging and arrow keys are precise',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    await page.evaluate(async()=>{const {createTrim}=await import('/ds.js');const host=document.createElement('div');host.id='trimTest';host.style.cssText='position:fixed;left:20px;top:20px;width:390px;z-index:9999;background:#000';document.body.append(host);
      window.trimCommits=[];host.append(createTrim({duration:7904,value:[340,370],onCommit:r=>window.trimCommits.push([...r])}).el)});
    const geo=await page.evaluate(()=>{const t=document.querySelector('#trimTest .cd-trim-track'),s=t.querySelector('.cd-trim-sel');return {track:t.getBoundingClientRect().width,sel:s.getBoundingClientRect().width,title:t.title,handle:t.querySelector('.cd-handle-in').getBoundingClientRect().width}});
    assert.equal(geo.title,'Showing 05:10–06:40');
    assert.ok(Math.abs(geo.sel/geo.track-1/3)<.02,`the clip fills ${Math.round(geo.sel/geo.track*100)}% of the bar`);
    assert.equal(geo.handle,24);
    const handle=page.locator('#trimTest .cd-handle-in'),box=await handle.boundingBox(),pxPerSecond=geo.track/90;
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+pxPerSecond*5,box.y+box.height/2,{steps:4});await page.mouse.up();
    const [start]=(await page.evaluate(()=>window.trimCommits)).at(-1);
    assert.ok(Math.abs(start-345)<=.5,`dragging 5 seconds' worth moved the start to ${start}`);
    await handle.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowRight');
    assert.ok(Math.abs((await page.evaluate(()=>window.trimCommits)).at(-1)[0]-(start+1.1))<.05);
    assert.deepEqual(problems,[]);
  }finally{await app.stop()}
});

test('choosing a video that is already in the Library opens it instead of saving a second copy',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'context-sample-')),file=path.join(dir,'twice.mp4');
  execFileSync(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc=size=640x360:rate=25:duration=6','-f','lavfi','-i','sine=frequency=440:duration=6','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',file]);
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    await page.setInputFiles('#fileInput',file);await page.getByText('All changes saved',{exact:false}).first().waitFor();
    const uploads=[];page.on('request',r=>{if(r.url().endsWith('/api/import/upload'))uploads.push(r.url())});
    // The same recording saved under another name.
    const copy=path.join(dir,'twice (copy).mp4');await fs.copyFile(file,copy);await page.setInputFiles('#fileInput',copy);
    await page.getByText('You already imported this video',{exact:false}).waitFor();
    assert.deepEqual(uploads,[],'the file was not copied again');
    const {projects}=await (await fetch(app.url+'/api/projects')).json();assert.equal(projects.length,1);
    assert.deepEqual(problems,[]);
  }finally{await app.stop();await fs.rm(dir,{recursive:true,force:true})}
});

test('Studio keyboard: arrows, J/K/L, frame steps and Home/End move the clip preview, with feedback over the picture',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'context-sample-')),file=path.join(dir,'keys.mp4');
  execFileSync(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc=size=640x360:rate=25:duration=40','-f','lavfi','-i','sine=frequency=440:duration=40','-c:v','libx264','-g','25','-pix_fmt','yuv420p','-c:a','aac','-shortest',file]);
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    let {page,problems}=await watchedPage(browser,app.url);
    await page.setInputFiles('#fileInput',file);await page.getByText('All changes saved',{exact:false}).first().waitFor();
    // A saved 30-second clip of the recording (10 s to 40 s), as Find clips would leave it.
    const [{id}]=(await (await fetch(app.url+'/api/projects')).json()).projects,project=await (await fetch(app.url+'/api/projects/'+id)).json();await page.close();
    const moment={id:'keys-clip',url:`/api/import/${id}/media`,frames:[],start:10,end:40,mediaStart:10,sourceName:'keys.mp4',sourceType:'file',manual:true,status:'manual',analysis:null,transcript:'',trimIn:0,trimOut:30,hook:'',alternateHook:'',frameMode:'fit',zoom:1,focusX:50,focusY:50,showHook:false,captionLanguage:'Original',captionStyle:'clean',captionCues:{Original:[]},captionReviewed:{},showCaptions:true,captionOffset:0};
    const saved=await fetch(app.url+'/api/projects/'+id,{method:'PUT',headers:{'Content-Type':'application/json',Origin:app.url},body:JSON.stringify({state:{...project.state,moments:[moment]},revision:project.revision,title:project.title})});assert.equal(saved.status,200,await saved.text());
    ({page,problems}=await watchedPage(browser,app.url+'/#/clips'));
    await page.locator('[data-card="keys-clip"]').waitFor({state:'attached'});
    await page.evaluate(()=>document.querySelector('[data-card="keys-clip"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
    await page.waitForFunction(()=>document.body.dataset.workspace==='edit'&&document.getElementById('activityPanel').hidden!==false&&document.getElementById('clipVideo').readyState>=2);
    // Pictures: the project has a poster, the trim bar a filmstrip, and the title card draws the clip's frame.
    const [listed]=(await (await fetch(app.url+'/api/projects')).json()).projects;assert.match(listed.thumbnail,/^\/api\/import\/[a-f0-9-]{36}\/frame\?t=\d+&w=320$/);
    assert.equal((await fetch(app.url+listed.thumbnail)).headers.get('content-type'),'image/jpeg');
    await page.waitForFunction(()=>document.querySelectorAll('#timelineFrames img[src]').length===8);
    await page.locator('#exportTab').click();await page.locator('#titleCardCanvas').waitFor();
    await page.waitForFunction(()=>{const c=document.getElementById('titleCardCanvas');if(c.width!==1280)return false;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let lit=0;for(let i=0;i<d.length;i+=4000)if(d[i]+d[i+1]+d[i+2]>120)lit++;return lit>20});
    assert.equal(await page.locator('#titleCardTitle').inputValue(),'keys.mp4');
    await page.locator('[data-card-look=signal]').click();assert.equal(await page.locator('[data-card-look=signal]').getAttribute('aria-pressed'),'true');
    await page.locator('#titleCardSize').selectOption('9:16');await page.waitForFunction(()=>document.getElementById('titleCardCanvas').height===1920);
    await page.locator('#captionTab').click();
    const at=()=>page.evaluate(()=>Math.round(document.getElementById('clipVideo').currentTime*100)/100);
    await page.evaluate(()=>document.activeElement?.blur());
    const step=async(key,expected)=>{await page.keyboard.press(key);await page.waitForFunction(t=>Math.abs(document.getElementById('clipVideo').currentTime-t)<.02,expected,{timeout:3000}).catch(async()=>assert.fail(`${key}: expected ${expected}, at ${await at()}`))};
    await step('ArrowRight',15);
    assert.match(await page.locator('.preview-osd').textContent(),/^\+5 s · 00:05 \/ 00:30$/);
    await step('l',25);await step('Shift+ArrowLeft',24);await step('j',14);await step('Period',14.04);await step('Comma',14);
    await step('End',39.96);await step('ArrowRight',39.96);await step('Home',10);await step('ArrowLeft',10);
    await page.keyboard.press('k');await page.waitForFunction(()=>!document.getElementById('clipVideo').paused);
    await page.keyboard.press('k');await page.waitForFunction(()=>document.getElementById('clipVideo').paused);
    assert.deepEqual(problems,[]);
  }finally{await app.stop();await fs.rm(dir,{recursive:true,force:true})}
});
