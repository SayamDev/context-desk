import test from 'node:test';
import assert from 'node:assert/strict';
import {startApp,openBrowser,watchedPage} from './harness.js';

test('Home guide, global Exports and background notifications remain reachable on a phone',async()=>{
  const app=await startApp(),browser=await openBrowser();
  try{
    const {page,problems}=await watchedPage(browser,app.url,{viewport:{width:390,height:844}});
    const nav=page.getByRole('navigation',{name:'Workspace',exact:true});
    await nav.getByRole('button',{name:'Home',exact:true}).waitFor();
    await page.getByRole('button',{name:'Guide',exact:true}).click();
    await page.getByRole('heading',{name:'How to use Context Desk'}).waitFor();
    await page.getByRole('button',{name:'Close guide'}).click();
    let status='running',polls=0;
    await page.route('**/api/jobs',route=>{
      polls++;
      return route.fulfill({json:{counts:{[status]:1},jobs:[{id:'notice-qa',kind:'export',status,sourceName:'An export in the background',duration:12,phase:'Rendering',output:status==='complete'?{url:'/app.js',type:'video/mp4'}:null}]}});
    });
    await nav.getByRole('button',{name:'Exports',exact:true}).click();
    await page.getByRole('heading',{name:'Exports',exact:true}).waitFor();
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.waitForFunction(()=>Boolean(document.querySelector('[data-job-row="notice-qa"][data-state="running"]')));
    status='complete';
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    const bell=page.getByRole('button',{name:'Notifications, 1 unread'});
    await bell.click();
    await page.getByRole('button',{name:/Video export ready/}).click();
    await page.getByRole('button',{name:'Notifications',exact:true}).waitFor();
    assert.ok(polls>=2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(problems,[]);
  }finally{await browser.close();await app.stop()}
});
