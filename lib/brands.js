import {captionStyleIds} from '../public/caption-styles.js';
import {randomUUID} from 'node:crypto';
import {cleanCaptionLook} from '../public/brand-kit.js';
const styles=captionStyleIds;
export function cleanBrand(body){const name=String(body.name||'').trim().slice(0,80);if(!name)throw Error('Give your brand style a name.');return {name,captionStyle:styles.includes(body.captionStyle)?body.captionStyle:'punch',look:cleanCaptionLook(body.look,body.captionStyle)}}
export function createBrandApi(store){return async(req,res,json)=>{
 const route=new URL(req.url,'http://localhost').pathname;if(route!=='/api/brands')return false;
 try{if(req.method==='GET'){json(res,200,{brands:store.listRecords('brand_kit')});return true}if(req.method!=='POST'){json(res,405,{error:'Method not allowed'});return true}
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Error('Save brand styles from the local app.');let raw='';for await(const part of req){raw+=part;if(raw.length>12000)throw Error('Brand style is too large.')}const brand={...cleanBrand(JSON.parse(raw||'{}')),id:randomUUID(),createdAt:Date.now()};store.putRecord('brand_kit',brand.id,brand);json(res,201,brand);
 }catch(error){json(res,400,{error:error.message})}return true;
 }}
