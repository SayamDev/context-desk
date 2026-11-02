export const workspaceNames={home:'Home',library:'Library',clips:'Clips',edit:'Studio',jobs:'Exports',source:'New video'};
const routes={home:'home',projects:'library',discover:'clips',studio:'edit',jobs:'jobs',import:'source'};
export function workspaceFromHash(hash){return routes[String(hash||'').replace(/^#\/?/,'')]||'home'}
export function workspaceHash(workspace){return '#/'+(Object.keys(routes).find(key=>routes[key]===workspace)||'home')}
export function usableMoments(moments){return moments.filter(m=>!m.dismissed&&(m.status==='suggested'||m.approved||m.manual))}
export function projectSummary(project){const clips=usableMoments(project.state?.moments||[]);return {clips:project.clipCount??clips.length,windows:project.windowCount??project.state?.moments?.length??0}}
