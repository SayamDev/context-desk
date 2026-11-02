// Live signals beside the recorded buffer: public chat (Twitch IRC, YouTube live chat
// via yt-dlp) and a local laughter classifier (YAMNet). Only message text and arrival
// time are read from chat; author names, photos and IDs are never kept.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import readline from 'node:readline';

const projectRoot=path.resolve(import.meta.dirname,'..');
const ytEnv={...process.env,PYTHONPATH:[path.join(projectRoot,'.runtime'),process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)};
export const signalLimits={chatWindowSeconds:10,minChatHistory:6,laughThreshold:.12};

// Laughing in chat across languages and platforms: lol/lmao, KEKW/LUL/OMEGALUL, haha/jaja/hehe,
// "kkkk" (Portuguese), "www" (Japanese), "ههههه" (Arabic), "555" (Thai), "ㅋㅋ" (Korean), 哈哈, and emoji.
export const laughPattern=/(?:^|[^\p{L}\p{N}])(?:lo+l+|lmf?a+o+|rofl|kekw?|lul+|omegalul|icant|xd+|ha(?:ha)+h?|he(?:he)+|ja(?:ja)+|ka(?:ka)+|k{4,}|w{3,}|5{3,})(?=$|[^\p{L}\p{N}])|[😂🤣💀😹]|ه{4,}|ㅋ{2,}|(?:哈){2,}|(?:草){1,}/iu;
export const isLaugh=text=>laughPattern.test(String(text||''));

// A chat window is a spike when it is clearly busier than the recent baseline.
export function detectChatSpike(history,count,{minHistory=signalLimits.minChatHistory,factor=2.5,minimum=8}={}){
  if(!Number.isFinite(count)||history.length<minHistory||count<minimum)return false;
  const sorted=[...history].sort((a,b)=>a-b),median=Math.max(1,sorted[Math.floor(sorted.length/2)]);
  return count>=median*factor;
}
// Chat is laughing when enough messages in one window are laughs, not just one viewer.
export function detectChatLaughter({count,laughs},{minimum=4,share=.3}={}){return laughs>=minimum&&count>0&&laughs/count>=share;}

export function chatSource(url){
  const u=new URL(url),host=u.hostname.replace(/^www\.|^m\./,'');
  if(host==='twitch.tv'){const channel=u.pathname.split('/').filter(Boolean)[0];return /^[a-z0-9_]{3,25}$/i.test(channel||'')&&channel!=='videos'?{kind:'twitch',channel:channel.toLowerCase()}:null}
  if(host==='youtube.com'||host==='youtu.be')return {kind:'youtube'};
  return null;
}
export function parseTwitchLine(line){
  if(line.startsWith('PING'))return {ping:line.slice(5)};
  const m=line.match(/^(?:@\S+ )?:\S+ PRIVMSG #\S+ :(.*)$/);return m?{text:m[1]}:null;
}
export function parseYouTubeChatLine(line){
  try{
    const data=JSON.parse(line),actions=data.replayChatItemAction?.actions||[],out=[];
    for(const action of actions){const r=action.addChatItemAction?.item?.liveChatTextMessageRenderer;if(!r)continue;
      const text=(r.message?.runs||[]).map(run=>run.text??(run.emoji&&!run.emoji.isCustomEmoji&&!/^UC/.test(run.emoji.emojiId||'')?run.emoji.emojiId:run.emoji?.shortcuts?.[0])??'').join('').slice(0,500);
      const at=Number(r.timestampUsec)/1000;out.push({text,at:Number.isFinite(at)?at:Date.now()});}
    return out;
  }catch{return []}
}

// Starts reading public chat. onMessage({text, at}) gets arrival time in ms; returns stop().
export function startChat(url,{dir,onMessage,onStatus}){
  const source=chatSource(url);
  if(!source){onStatus('unavailable','Chat signals are available for Twitch and YouTube');return ()=>{}}
  if(source.kind==='twitch'){
    let socket,stopped=false,retry;
    const connect=()=>{
      socket=new WebSocket('wss://irc-ws.chat.twitch.tv:443');onStatus('connecting','Connecting to Twitch chat');
      socket.onopen=()=>{socket.send('CAP REQ :twitch.tv/tags');socket.send('PASS SCHMOOPIIE');socket.send(`NICK justinfan${Math.floor(10000+Math.random()*80000)}`);socket.send(`JOIN #${source.channel}`);onStatus('connected','Reading Twitch chat')};
      socket.onmessage=event=>{for(const line of String(event.data).split('\r\n')){if(!line)continue;const msg=parseTwitchLine(line);if(msg?.ping!==undefined)socket.send(`PONG ${msg.ping}`);else if(msg)onMessage({text:msg.text,at:Date.now()})}};
      socket.onclose=()=>{if(!stopped){onStatus('connecting','Twitch chat reconnecting');retry=setTimeout(connect,5000)}};
      socket.onerror=()=>{};
    };
    connect();
    return ()=>{stopped=true;clearTimeout(retry);try{socket?.close()}catch{/* Already closed. */}};
  }
  // YouTube: yt-dlp appends live chat as JSON lines; follow the growing file.
  const out=path.join(dir,'chat');let offset=0,partial='',stopped=false;
  const child=spawn(process.env.YTDLP_PYTHON||'python3',['-m','yt_dlp','--ignore-config','--no-plugin-dirs','--no-cache-dir','--skip-download','--write-subs','--sub-langs','live_chat','--js-runtimes','node','-o',out,url],{env:ytEnv,stdio:['ignore','ignore','ignore']});
  onStatus('connecting','Connecting to YouTube live chat');
  child.on('error',()=>onStatus('unavailable','Live chat needs the local importer (npm run setup:imports)'));
  child.on('close',()=>{if(!stopped)onStatus('unavailable','YouTube live chat closed or is turned off for this stream')});
  const poll=setInterval(async()=>{
    const file=[out+'.live_chat.json.part',out+'.live_chat.json'].find(existsSync);if(!file)return;
    try{const handle=await fs.open(file,'r');const {size}=await handle.stat();if(size>offset){const buffer=Buffer.alloc(Math.min(size-offset,2_000_000));await handle.read(buffer,0,buffer.length,offset);offset+=buffer.length;
      const lines=(partial+buffer.toString('utf8')).split('\n');partial=lines.pop();let first=offset===buffer.length;
      for(const line of lines)for(const msg of parseYouTubeChatLine(line))if(!first||Date.now()-msg.at<15000)onMessage(msg);
      onStatus('connected','Reading YouTube live chat')}
      await handle.close();}catch{/* The file is rotated between fragments; read again next tick. */}
  },1000);
  return ()=>{stopped=true;clearInterval(poll);if(child.exitCode===null)child.kill('SIGTERM')};
}

// Local laughter classifier: one shared Python worker running YAMNet (installed by npm run setup:laughter).
const laughRoot=path.join(projectRoot,'.runtime');
export function laughterInstalled(){return existsSync(path.join(laughRoot,'models/yamnet.tflite'))&&existsSync(path.join(laughRoot,'laughter/ai_edge_litert'))}
let worker=null;
function laughterWorker(){
  if(worker)return worker;if(!laughterInstalled())return null;
  const child=spawn(process.env.YTDLP_PYTHON||'python3',['-I',path.join(projectRoot,'scripts/laughter-worker.py'),laughRoot],{stdio:['pipe','pipe','ignore']});
  const pending=[],lines=readline.createInterface({input:child.stdout});
  lines.on('line',line=>{const next=pending.shift();if(!next)return;try{next.resolve(JSON.parse(line))}catch{next.resolve({laughter:0})}});
  child.on('close',()=>{for(const p of pending.splice(0))p.resolve({laughter:0});worker=null});
  child.on('error',()=>{worker=null});
  worker={analyse(file){return new Promise(resolve=>{pending.push({resolve});child.stdin.write(file+'\n')})},stop(){child.kill('SIGTERM')}};
  return worker;
}
export async function laughterScore(segmentFile,ffmpeg){
  const w=laughterWorker();if(!w)return null;const wav=segmentFile.replace(/\.ts$/,'.wav');
  const ok=await new Promise(resolve=>{const c=spawn(ffmpeg,['-v','error','-y','-i',segmentFile,'-vn','-ac','1','-ar','16000','-f','wav',wav],{stdio:'ignore'});c.on('close',code=>resolve(code===0));c.on('error',()=>resolve(false))});
  if(!ok)return null;try{return (await w.analyse(wav)).laughter??0}finally{fs.rm(wav,{force:true}).catch(()=>{})}
}
export function stopLaughterWorker(){worker?.stop()}
