// Server code freshness. The browser always loads the newest public files, but the server's
// own modules only change when the process restarts. A stamp of the files the server imports
// (followed from its entry file) tells us when the code on disk no longer matches this process.
import {readFileSync,statSync} from 'node:fs';
import path from 'node:path';
// Relative static imports, side-effect imports and literal dynamic imports of .js files.
// Bare package names (node:fs, npm packages) are not part of the app and are skipped.
const importPattern=/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+\.js)['"]/g;
export function serverModules(entry){
  const seen=new Set(),visit=file=>{if(seen.has(file))return;seen.add(file);let text='';try{text=readFileSync(file,'utf8')}catch{return}for(const m of text.matchAll(importPattern))visit(path.resolve(path.dirname(file),m[1]))};
  visit(path.resolve(entry));return [...seen];
}
export function createCodeStamp(entry){
  const files=serverModules(entry),stamp=()=>files.map(f=>{try{return f+':'+statSync(f).mtimeMs}catch{return f+':missing'}}).join('|'),startup=stamp();
  return {files,stale:()=>stamp()!==startup};
}
