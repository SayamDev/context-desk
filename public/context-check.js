export function mountContextCheck({after,getMoment,request,seek,include,applySubtitle,formatTime}){
  const panel=document.createElement('details');
  panel.className='context-check';
  panel.innerHTML='<summary>Check the Context</summary><p>Review the dialogue around your cut and compare it with the draft subtitles.</p><button type="button" class="cd-btn cd-btn-secondary">Find story beats</button><p role="status"></p><ol></ol>';
  after.after(panel);
  const run=panel.querySelector('button'),status=panel.querySelector('[role=status]'),list=panel.querySelector('ol');
  let owner=null,version=0;
  function sync(moment){
    if(moment!==owner){owner=moment;version++;panel.open=false;list.replaceChildren();status.textContent='';run.disabled=false}
    panel.hidden=!moment;
  }
  function render(result,moment){
    status.textContent=result.method==='no-transcript'?'No timed speech is saved for this clip. Generate subtitles first.':result.method==='muse'?'Muse Spark suggestions. Verify against the original audio.':'Showing nearby saved dialogue.';
    if(result.sampled)status.textContent+=' Long selection sampled at the beginning and end.';
    list.replaceChildren(...result.beats.map(beat=>{
      const row=document.createElement('li'),title=document.createElement('strong'),quote=document.createElement('p');
      title.textContent=beat.role+' · '+formatTime(moment.start+beat.start);
      quote.dir='auto';quote.textContent=beat.original;
      row.append(title,quote);
      for(const value of [beat.translation,beat.reason])if(value){const line=document.createElement('p');line.dir='auto';line.textContent=value;row.append(line)}
      const action=(label,callback)=>{
        const button=document.createElement('button');
        button.type='button';button.className='cd-btn cd-btn-sm cd-btn-secondary';button.textContent=label;
        button.onclick=async()=>{try{await callback()}catch(error){status.textContent=error.message}};row.append(button);
      };
      action('Jump to line',()=>seek(moment,beat.start));
      if(beat.start<moment.trimIn&&['Setup','Before the cut'].includes(beat.role))action('Include setup',async()=>{if(include(moment,beat.start)){await seek(moment,beat.start);status.textContent='Setup included. Press Play to review the new start.'}});
      if(beat.suggestion&&result.language){
        const proposal=document.createElement('p');
        const label=document.createElement('strong'),wording=document.createElement('span');
        label.textContent='Suggested subtitle ';wording.dir='auto';wording.textContent=beat.suggestion;
        proposal.append(label,wording);row.append(proposal);
        action('Use as draft',()=>{
          applySubtitle(moment,result.language,beat);
          status.textContent='Draft updated. Listen back and review before export.';
        });
      }
      return row;
    }));
  }
  run.onclick=async()=>{
    const moment=getMoment();if(!moment)return;
    const epoch=++version;run.disabled=true;status.textContent='Checking saved dialogue…';list.replaceChildren();
    try{const result=await request(moment);if(version===epoch&&getMoment()===moment)render(result,moment)}
    catch(error){if(version===epoch)status.textContent=error.message}
    finally{if(version===epoch)run.disabled=false}
  };
  return {sync};
}
