import test from 'node:test';
import assert from 'node:assert/strict';
import {startApp,openBrowser} from './harness.js';

test('tab sharing can be cancelled and reconnected without losing captured windows',async()=>{
  const app=await startApp(),browser=await openBrowser();
  try{
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      navigator.mediaDevices.getDisplayMedia=async()=>{
        if(window.cancelNextShare){window.cancelNextShare=false;throw new DOMException('Cancelled','NotAllowedError')}
        const canvas=document.createElement('canvas');
        canvas.width=320;canvas.height=180;
        const ctx=canvas.getContext('2d');
        let tick=0;
        const timer=setInterval(()=>{
          ctx.fillStyle='hsl('+tick++%360+' 80% 45%)';
          ctx.fillRect(0,0,320,180);
        },30);
        const stream=canvas.captureStream(30);
        window.endShare=()=>{
          clearInterval(timer);
          const track=stream.getVideoTracks()[0];
          track.stop();
          track.dispatchEvent(new Event('ended'));
        };
        return stream;
      };
    });
    await page.route('**/api/frame',route=>route.fulfill({json:{found:true,confidence:1,x:0,y:0,width:1,height:1}}));
    await page.goto(app.url,{waitUntil:'networkidle'});
    await page.locator('#screenButton').evaluate(button=>button.click());
    const pause=page.getByRole('button',{name:'Pause clipping',exact:true});
    const resume=page.getByRole('button',{name:'Resume clipping',exact:true});
    const reconnect=page.getByRole('button',{name:'Reconnect live tab',exact:true});
    await pause.waitFor();
    await page.getByRole('button',{name:'Find source player'}).click();
    const sourceHelp=page.getByRole('dialog',{name:'Use the original player'});
    await sourceHelp.getByText('View tab',{exact:true}).waitFor();
    await sourceHelp.getByRole('button',{name:'Got it'}).click();
    assert.equal(await page.context().pages().length,1);
    await page.waitForTimeout(1250);
    await pause.click();
    await resume.click();
    await pause.waitFor();
    await page.waitForTimeout(1250);
    await page.evaluate(()=>window.endShare());
    await reconnect.waitFor();
    await page.evaluate(()=>{window.cancelNextShare=true});
    await reconnect.click();
    await page.waitForFunction(()=>document.querySelector('#liveBarToggle').textContent==='Reconnect live tab'&&!document.querySelector('#liveBarToggle').disabled);
    const projects=async()=> (await (await page.request.get(app.url+'/api/projects')).json()).projects;
    const [before]=await projects();
    await reconnect.click();
    await pause.waitFor();
    await page.waitForFunction(()=>document.querySelector('#liveBarDetail').textContent.includes('2 windows'));
    const after=await projects();
    assert.deepEqual(after.map(project=>project.id),[before.id]);
    await page.waitForFunction(async projectId=>{
      const response=await fetch('/api/projects/'+projectId);
      const project=await response.json();
      const windows=(project.state?.moments||[]).filter(moment=>moment.sourceType==='screen');
      return windows.length===2&&windows.every(moment=>moment.blob?.assetId);
    },before.id);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await app.stop()}
});
