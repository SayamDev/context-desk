// Setup check: what this computer has and what each missing piece stops working, with the fix.
// The same list as npm run setup. Reports only presence (never paths' contents or secret values).
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const projectRoot=path.resolve(import.meta.dirname,'..');
function run(cmd,args,env){return new Promise(resolve=>{let out='';const c=spawn(cmd,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);const t=setTimeout(()=>c.kill('SIGTERM'),8000);c.on('close',code=>{clearTimeout(t);resolve({ok:code===0,out})});c.on('error',()=>{clearTimeout(t);resolve({ok:false,out:''})})})}
export async function healthChecks({env=process.env,platform=process.platform,runner=run,dataDir}={}){
  const ffmpeg=env.FFMPEG_PATH||path.join(projectRoot,'.runtime/bin/ffmpeg'),checks=[];
  const add=(id,label,ok,needed,fix,blocks)=>checks.push({id,label,ok,needed,fix:ok?'':fix,blocks:ok?'':blocks});
  add('node','Node.js 22.13 or newer',Number(process.versions.node.split('.')[0])>=22,true,'Install Node.js LTS from https://nodejs.org, then restart.','The app cannot run.');
  const filters=await runner(ffmpeg,['-hide_banner','-filters']);
  add('ffmpeg','FFmpeg (video processing)',filters.ok,true,'Run npm run setup in the project folder.','Imports, clips and exports.');
  add('captions','Burned-in captions (FFmpeg with libass)',filters.ok&&/ ass /.test(filters.out),true,'Run npm run setup (it installs Homebrew’s ffmpeg-full), then restart.','Exports with subtitles or a hook.');
  const ytdlp=await runner(env.YTDLP_PYTHON||'python3',['-c','import yt_dlp'],{PYTHONPATH:[path.join(projectRoot,'.runtime'),env.PYTHONPATH].filter(Boolean).join(path.delimiter)});
  add('importer','Video link importer (yt-dlp)',ytdlp.ok,false,'Run npm run setup.','Pasting YouTube, Twitch or Kick links (uploading files still works).');
  add('ai','AI key (Meta)',Boolean(env.MODEL_API_KEY),true,'Open .env, set MODEL_API_KEY=your key, then restart.','Speech, translation, clip finding and post copy.');
  if(platform==='darwin'){const swift=await runner('/usr/bin/swift',['--version']);add('vision','Apple Vision tools (Swift)',swift.ok,false,'Run xcode-select --install.','Speaker framing and Find what’s shown.')}
  let writable=false;if(dataDir)try{const probe=path.join(dataDir,'.write-check');await fs.writeFile(probe,'ok');await fs.rm(probe);writable=true}catch{}
  if(dataDir)add('storage','Project storage is writable',writable,true,'Check the folder permissions of the data directory (CONTEXT_DESK_DATA_DIR).','Saving projects and exports.');
  return {ready:checks.every(c=>c.ok||!c.needed),checks};
}
