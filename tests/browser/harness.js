// Browser test harness: starts a throwaway server (own data folder, no .env, no AI key) and
// opens it in the installed Chrome. CHROME_PATH points at another Chromium build if needed.
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const root=path.resolve(import.meta.dirname,'../..');
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>resolve(port))}).on('error',reject)});

export async function startApp({env={}}={}){
  const port=await freePort(),dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'context-browser-'));
  const child=spawn(process.execPath,['server.js'],{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,MODEL_API_KEY:'',...env,PORT:String(port),CONTEXT_DESK_DATA_DIR:dataDir,NODE_ENV:'test'}});
  let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
  const url=`http://127.0.0.1:${port}`;
  for(let i=0;;i++){
    if(child.exitCode!==null)throw Error('Server exited before it started:\n'+log);
    try{if((await fetch(url+'/api/status')).ok)break}catch{}
    if(i>100)throw Error('Server did not start in 10 s:\n'+log);
    await new Promise(r=>setTimeout(r,100));
  }
  return {url,dataDir,log:()=>log,async stop(){child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));await fs.rm(dataDir,{recursive:true,force:true})}};
}

export async function openBrowser(){
  return chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'});
}

// A page that records everything that would mean the app is broken for a user.
// The first-visit intro is marked as seen unless a test asks for a new visitor (intro: true).
export async function watchedPage(browser,url,{viewport={width:1440,height:900},intro=false}={}){
  const page=await browser.newPage({viewport}),problems=[];
  if(!intro)await page.addInitScript(()=>{try{localStorage.setItem('context-desk-welcomed','1')}catch{/* Storage blocked: the intro shows. */}});
  page.on('pageerror',e=>problems.push('page error: '+e.message));
  page.on('console',m=>{if(m.type()==='error')problems.push('console error: '+m.text())});
  page.on('response',r=>{if(r.url().startsWith(url)&&r.status()>=400)problems.push(`HTTP ${r.status()} ${r.url().slice(url.length)}`)});
  await page.goto(url,{waitUntil:'networkidle'});
  return {page,problems};
}
