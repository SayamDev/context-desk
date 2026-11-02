// What Context Desk has produced on this computer, for the Home impact strip. Counts are
// measured; the time-saved figure is an estimate and is labelled as one wherever it is shown.
export const manualMinutesPerShort=15; // Cutting, captioning and reframing one Short by hand.
export function createImpact(store){
  const read=()=>store.getRecord('impact','totals')||{shorts:0,readySecondsTotal:0,fastestReadySeconds:null};
  return {
    recordShort({readySeconds}){const t=read(),ready=Number.isFinite(readySeconds)&&readySeconds>=0?readySeconds:null;
      store.putRecord('impact','totals',{shorts:t.shorts+1,readySecondsTotal:t.readySecondsTotal+(ready??0),timedShorts:(t.timedShorts||0)+(ready===null?0:1),fastestReadySeconds:ready===null?t.fastestReadySeconds:Math.min(t.fastestReadySeconds??ready,ready)})},
    summary(){const t=read(),exports=store.listRecords('export_result').length,made=t.shorts+exports;
      return {shorts:t.shorts,exports,averageReadySeconds:t.timedShorts?Math.round(t.readySecondsTotal/t.timedShorts):null,fastestReadySeconds:t.fastestReadySeconds==null?null:Math.round(t.fastestReadySeconds),
        estimatedMinutesSaved:made*manualMinutesPerShort,assumption:`about ${manualMinutesPerShort} minutes of manual editing per clip`}}
  };
}
