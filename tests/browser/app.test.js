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
    await page.getByRole('button',{name:'Add a video'}).first().waitFor();
    const setup=page.locator('.setup-check');
    await setup.waitFor();
    assert.match(await setup.innerText(),/AI key \(Meta\)/);
    assert.doesNotMatch(await setup.innerText(),/FFmpeg/);
    assert.deepEqual(problems,[]);
  }finally{await app.stop()}
});

test('the setup check lists FFmpeg and captions when FFmpeg is missing',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:'/nonexistent/ffmpeg'}});
  try{
    const {page}=await watchedPage(browser,app.url);
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
    for(const workspace of ['library','clips','jobs']){
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
    await page.setInputFiles('#fileInput',file);
    await page.waitForURL(/#\/discover$/);
    await page.getByText('Video ready. Add a Meta API key').waitFor();
    await page.getByText('All changes saved',{exact:false}).first().waitFor();
    const {projects}=await (await fetch(app.url+'/api/projects')).json();
    assert.equal(projects.length,1);
    assert.equal(projects[0].title,'sample.mp4');
    assert.equal(Math.round(projects[0].duration),6);
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#projectTitle')?.value==='sample.mp4');
    assert.equal(await page.evaluate(()=>document.body.dataset.workspace),'clips');
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
    const [uploaded]=(await (await fetch(app.url+'/api/projects')).json()).projects,sourceDir=path.join(app.dataDir,'sources',uploaded.sourceId);
    assert.ok(await exists(sourceDir));
    await api('/api/projects/'+uploaded.id,{action:'trash',trashed:true});
    await page.locator('.workspace-nav [data-workspace=library]').click();await page.locator('#showProjectTrash').check();
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
    await page.reload({waitUntil:'networkidle'});
    await page.locator('.ds-rail .brand-home, a[aria-label="Context Desk home"]').first().click();
    assert.equal(await page.getByRole('radio',{name:'Subtitles for the whole video'}).isChecked(),true);
    assert.deepEqual(problems,[]);
  }finally{await app.stop();await fs.rm(dir,{recursive:true,force:true})}
});

test('keyboard and screen readers: skip link, one main region, clip list before the monitor, Arabic titles keep their direction',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    assert.equal(await page.locator('main').count(),1);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Skip to content');
    const hash=await page.evaluate(()=>location.hash);await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'main');assert.equal(await page.evaluate(()=>location.hash),hash);
    await page.locator('.workspace-nav [data-workspace=clips]').click();
    assert.equal(await page.evaluate(()=>Boolean(document.querySelector('.queue-panel').compareDocumentPosition(document.querySelector('.monitor-panel'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('projectTitle')).unicodeBidi),'plaintext');
    assert.deepEqual(problems,[]);
  }finally{await app.stop()}
});

test('the Classic look switch turns the restyle off, survives a reload and turns it back on',async()=>{
  const app=await startApp({env:{FFMPEG_PATH:ffmpeg}});
  try{
    const {page,problems}=await watchedPage(browser,app.url);
    const restyleOn=()=>page.evaluate(()=>!document.getElementById('restyleCss').disabled);
    assert.equal(await restyleOn(),true);
    await page.locator('#openSettings').click();
    await page.locator('#classicLook').check();
    assert.equal(await restyleOn(),false);
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await restyleOn(),false);
    await page.locator('#openSettings').click();
    assert.equal(await page.locator('#classicLook').isChecked(),true);
    await page.locator('#classicLook').uncheck();
    assert.equal(await restyleOn(),true);
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
    await page.waitForFunction(()=>document.fullscreenElement?.id==='fsFrame');
    assert.equal(await page.evaluate(()=>document.getElementById('fsFrame').contains(document.getElementById('fsBar'))),true);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'fsFrame');
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
