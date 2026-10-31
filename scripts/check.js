import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const files=['server.js',...['lib','public','scripts'].flatMap(dir=>fs.readdirSync(dir).filter(file=>file.endsWith('.js')).map(file=>dir+'/'+file))];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status)process.exit(result.status)}console.log(`Syntax checked ${files.length} JavaScript files.`);
