export const workspaceNames={home:'Home',library:'Projects',clips:'Clips',edit:'Studio',jobs:'Activity',full:'Full video',exports:'Exports',brand:'Brand Kit',source:'New video'};
const routes={home:'home',projects:'library',discover:'clips',studio:'edit','full-video':'full',exports:'exports',jobs:'jobs',brand:'brand',import:'source'};
export function workspaceFromHash(hash){const route=String(hash||'').replace(/^#\/?/,'');return route==='clips'?'clips':routes[route]||'home'}
export function workspaceHash(workspace){return '#/'+(Object.keys(routes).find(key=>routes[key]===workspace)||'home')}
export function usableMoments(moments){return moments.filter(m=>!m.dismissed&&(m.status==='suggested'||m.approved||m.manual))}
export function projectSummary(project){const clips=usableMoments(project.state?.moments||[]);return {clips:project.clipCount??clips.length,windows:project.windowCount??project.state?.moments?.length??0}}
