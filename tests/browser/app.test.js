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
