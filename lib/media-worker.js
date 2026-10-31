import {spawn} from 'node:child_process';
import path from 'node:path';
const executable=()=>process.env.FFMPEG_PATH||path.resolve(import.meta.dirname,'../.runtime/bin/ffmpeg');
export function captureFrame(file,time){return new Promise((resolve,reject)=>{
  const child=spawn(executable(),['-v','error','-ss',String(Math.max(0,time)),'-protocol_whitelist','file,pipe','-format_whitelist','mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,mpegts,mpeg,mpegvideo','-i',file,'-frames:v','1','-vf','scale=640:-2','-q:v','5','-f','image2pipe','-vcodec','mjpeg','pipe:1'],{stdio:['ignore','pipe','pipe']});let size=0,parts=[],settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);if(error){child.kill('SIGTERM');reject(error)}else{const bytes=Buffer.concat(parts);if(bytes.length<100)reject(Error('This source frame could not be decoded.'));else resolve(bytes)}};const timer=setTimeout(()=>finish(Error('Frame decoding timed out.')),30000);
  child.stdout.on('data',part=>{size+=part.length;if(size>2000000)finish(Error('Source frame exceeded the preview limit.'));else parts.push(part)});child.stderr.resume();child.on('error',()=>finish(Error('FFmpeg is unavailable. Run the importer setup.')));child.on('close',code=>finish(code===0?null:Error('Could not decode this video frame.')));
})}
