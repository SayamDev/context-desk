import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';

export const defaultDataRoot=path.resolve(process.env.CONTEXT_DESK_DATA_DIR||path.join(import.meta.dirname,'../.context-desk'));
export function openStore(root=defaultDataRoot){
  root=path.resolve(root);fs.mkdirSync(root,{recursive:true,mode:0o700});fs.mkdirSync(path.join(root,'assets'),{recursive:true});fs.mkdirSync(path.join(root,'sources'),{recursive:true});
  const db=new DatabaseSync(path.join(root,'studio.sqlite'));db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO schema_version VALUES(1);
    CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,source_id TEXT,revision INTEGER NOT NULL DEFAULT 0,state_json TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,last_opened INTEGER NOT NULL,trashed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,document TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS moments(project_id TEXT NOT NULL REFERENCES projects(id),id TEXT NOT NULL,document TEXT NOT NULL,PRIMARY KEY(project_id,id));
    CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,relative_path TEXT NOT NULL,size INTEGER NOT NULL,mime TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS project_source ON projects(source_id);`);
  const decode=row=>{if(!row)return null;const state=JSON.parse(row.state_json);const exports=new Map();for(const item of api.listRecords('export_result').filter(e=>e.projectId===row.id))exports.set(item.url,item);for(const item of state.exports||[])exports.set(item.url,item);state.exports=[...exports.values()];const moments=new Map(db.prepare('SELECT document FROM moments WHERE project_id=?').all(row.id).map(r=>{const m=JSON.parse(r.document);return [m.id,m]}));for(const m of state.moments||[])moments.set(m.id,m);return {id:row.id,title:row.title,sourceId:row.source_id,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,lastOpened:row.last_opened,trashed:Boolean(row.trashed),state:{...state,moments:[...moments.values()]}}};
  const api={root,close:()=>db.close(),
    createProject({id=randomUUID(),title='Untitled recording',sourceId=null}={}){const now=Date.now();db.prepare('INSERT OR IGNORE INTO projects(id,title,source_id,created_at,updated_at,last_opened) VALUES(?,?,?,?,?,?)').run(id,String(title).slice(0,160),sourceId,now,now,now);return this.getProject(id)},
    getProject(id){const p=decode(db.prepare('SELECT * FROM projects WHERE id=?').get(id));if(!p)throw Error('Project not found.');return p},
    sourceTitle(id,title){db.prepare('UPDATE projects SET title=? WHERE id=? AND revision=0').run(String(title).slice(0,160),id)},
    touchProject(id){db.prepare('UPDATE projects SET last_opened=? WHERE id=?').run(Date.now(),id)},
    saveProject(id,state,expectedRevision,{title,clientId,sequence}={}){if(!state||typeof state!=='object'||Array.isArray(state))throw Error('Invalid project document.');db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT revision FROM projects WHERE id=?').get(id);if(!row)throw Error('Project not found.');if(row.revision!==expectedRevision){const error=Error('A newer project revision exists. Reopen the project before saving over another tab.');error.status=409;throw error}db.prepare('UPDATE projects SET state_json=?,revision=revision+1,updated_at=?,title=COALESCE(?,title) WHERE id=?').run(JSON.stringify(state),Date.now(),title?String(title).slice(0,160):null,id);if(clientId)this.putRecord('project_editor',id,{clientId,sequence});db.exec('COMMIT');return this.getProject(id)}catch(error){db.exec('ROLLBACK');throw error}},
    listProjects({sort='updated',direction='desc',search='',trashed=false}={}){const columns={title:'title COLLATE NOCASE',created:'created_at',updated:'updated_at',opened:'last_opened'};const column=columns[sort]||columns.updated,dir=direction==='asc'?'ASC':'DESC';return db.prepare(`SELECT * FROM projects WHERE trashed=? AND title LIKE ? ORDER BY ${column} ${dir},id ASC`).all(trashed?1:0,'%'+String(search).slice(0,160)+'%').map(decode)},
    trashProject(id,trashed){db.prepare('UPDATE projects SET trashed=?,updated_at=? WHERE id=?').run(trashed?1:0,Date.now(),id)},
    putMoment(projectId,moment){db.prepare('INSERT INTO moments(project_id,id,document) VALUES(?,?,?) ON CONFLICT(project_id,id) DO UPDATE SET document=excluded.document').run(projectId,moment.id,JSON.stringify(moment));db.prepare('UPDATE projects SET updated_at=? WHERE id=?').run(Date.now(),projectId)},
    putRecord(kind,id,value){db.prepare('INSERT INTO records(kind,id,document,updated_at) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET document=excluded.document,updated_at=excluded.updated_at').run(kind,id,JSON.stringify(value),Date.now())},
    getRecord(kind,id){const row=db.prepare('SELECT document FROM records WHERE kind=? AND id=?').get(kind,id);return row?JSON.parse(row.document):null},
    listRecords(kind){return db.prepare('SELECT document FROM records WHERE kind=? ORDER BY updated_at,id').all(kind).map(r=>JSON.parse(r.document))},
    registerAsset(id,size,mime){if(!/^[a-f0-9]{64}$/.test(id)||!Number.isSafeInteger(size)||size<0)throw Error('Invalid media asset.');db.prepare('INSERT OR IGNORE INTO assets VALUES(?,?,?,?,?)').run(id,path.join('assets',id),size,mime,Date.now())},
    assetPath(id){if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid asset ID.');const row=db.prepare('SELECT * FROM assets WHERE id=?').get(id);if(!row)throw Error('Media asset not found.');const file=path.resolve(root,row.relative_path);if(!file.startsWith(root+path.sep))throw Error('Invalid asset path.');return {...row,file}},
    putAsset(bytes,mime='application/octet-stream'){const id=createHash('sha256').update(bytes).digest('hex'),relative=path.join('assets',id);if(!fs.existsSync(path.join(root,relative))){fs.writeFileSync(path.join(root,relative+'.tmp'),bytes,{mode:0o600});fs.renameSync(path.join(root,relative+'.tmp'),path.join(root,relative))}db.prepare('INSERT OR IGNORE INTO assets VALUES(?,?,?,?,?)').run(id,relative,bytes.length,mime,Date.now());return {id,url:'/api/assets/'+id,size:bytes.length,type:mime}},
    sourceDirectory(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid source ID.');return path.join(root,'sources',id)}
  };return api;
}
let singleton;export function studioStore(){return singleton??=openStore()}
