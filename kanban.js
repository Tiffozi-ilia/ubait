/* Read-only status board. Normalized SP and sum(used)/sum(sp), as in epic totals.
 * No writes, drag/drop, history queries or extra API calls. */
globalThis.UbaitKanban=(()=>{
 'use strict';
 const K=globalThis.UbaitKanbanStatistics;
 const normalize=v=>String(v??'').trim().toLocaleLowerCase('ru').replace(/\s+/g,' ');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const formatter=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}),ids=new Intl.Collator('en',{numeric:true});
 const fmt=v=>v==null?'—':formatter.format(v);
 const percent=v=>v==null?'—':fmt(v)+'%';
 const pageSize=40;
 function statusOf(value){
  const id=K.currentStatus(value);if(id!=='other')return id;
  const key=normalize(value);
  if(['consultation','консультация'].includes(key))return 'consultation';
  return key?'custom:'+key:'unspecified';
 }
 function totals(tasks){
  let sp=0,used=0,missingSp=0,missingUsed=0;
  for(const task of tasks){
   if(!Number.isFinite(task.sp)||task.sp<0)missingSp++;else sp+=task.sp;
   if(!Number.isFinite(task.used))missingUsed++;else used+=task.used;
  }
  return {count:tasks.length,sp:tasks.length===missingSp&&tasks.length>0?null:sp,used,missingSp,missingUsed,
   pct:tasks.length&&!missingSp&&!missingUsed&&sp>0?used/sp*100:null};
 }
 function calculate(model,filters){
  const M=globalThis.StoryMapModel,f={...M.defaults(),...filters};
  const columns=K.statuses.map(s=>({...s,tasks:[]})),byStatus=new Map(columns.map(c=>[c.id,c]));
  const scope=[],search=f.search.trim().toLocaleLowerCase('ru');
  for(const task of model.stories.values()){
   const id=statusOf(task.status);
   if(id==='stop'||id==='trash'||!M.cutMatches(task,f)||(search&&!task.search.includes(search)))continue;
   scope.push(task);
   if(!byStatus.has(id))byStatus.set(id,{id,title:id==='consultation'?'Консультация':task.status||'Без статуса',color:'var(--sub)',tasks:[]});
   byStatus.get(id).tasks.push(task);
  }
  const extra=[...byStatus.values()].filter(c=>!columns.includes(c)).sort((a,b)=>a.title.localeCompare(b.title,'ru'));
  for(const column of [...columns,...extra]){
   column.tasks.sort((a,b)=>String(b.modified_at||'').localeCompare(String(a.modified_at||''))||ids.compare(b.id,a.id));
   Object.assign(column,totals(column.tasks));
  }
  return {scope,columns:[...columns,...extra],...totals(scope),model};
 }
 function readiness(c){
  const note=c.pct==null?(c.count?'Не хватает SP или освоенных SP для расчёта готовности':'Нет задач'):'Готовность: '+fmt(c.used)+' освоено / '+fmt(c.sp)+' SP';
  return '<div class="kb-board-readiness" title="'+esc(note)+'"><div class="kb-board-track" '+(c.pct==null?'':'role="progressbar" aria-label="Готовность статуса" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.max(0,Math.min(100,c.pct))+'"')+'><i style="width:'+(c.pct==null?0:Math.max(0,Math.min(100,c.pct)))+'%"></i></div><span>'+percent(c.pct)+'</span></div>';
 }
 function card(task,model){
  const epic=model.epics.get(task.epic_id),path=[task.project,epic?.missing?'Без эпика':epic?.title].filter(Boolean).join(' · ');
  return '<button type="button" class="kb-board-task" data-board-task="'+esc(task.id)+'" aria-label="'+esc(task.title)+' · '+fmt(task.sp)+' SP · '+percent(task.pct)+'"><span class="kb-board-task-id">#'+esc(task.id)+'</span><strong class="kb-board-task-title">'+esc(task.title)+'</strong><span class="kb-board-task-path" title="'+esc(path)+'">'+esc(path)+'</span><span class="kb-board-task-person">'+esc(task.ba||'Без аналитика')+'</span><span class="kb-board-task-footer"><b>'+fmt(task.sp)+' <small>SP</small></b><span title="Текущая готовность задачи">'+percent(task.pct)+'</span></span></button>';
 }
 function list(c,report,limit){
  return c.tasks.length?c.tasks.slice(0,limit).map(t=>card(t,report.model)).join('')+(c.count>limit?'<button type="button" class="more kb-board-more" data-board-more="'+esc(c.id)+'">Ещё '+Math.min(pageSize,c.count-limit)+' · осталось '+(c.count-limit)+'</button>':''):'<div class="kb-board-empty">Нет задач</div>';
 }
 function render(report,limits=new Map()){
  if(!report.count)return '<div class="empty-state" role="status">Нет задач по выбранным фильтрам.</div>';
  return '<div class="kb-board" aria-label="Задачи по текущим статусам">'+report.columns.map(c=>'<section class="kb-board-column" style="--status-color:'+c.color+'" aria-label="'+esc(c.title)+'" data-board-column="'+esc(c.id)+'"><header class="kb-board-head"><div class="kb-board-title"><h2>'+esc(c.title)+'</h2><span title="Количество задач">'+c.count+'</span></div><div class="kb-board-sp" title="'+(c.missingSp?'Сумма известных SP; без оценки: '+c.missingSp:'Суммарные нормализованные SP задач по фильтрам')+'"><strong>'+fmt(c.sp)+(c.missingSp?' *':'')+'</strong><span>SP</span></div>'+readiness(c)+'</header><div class="kb-board-list" tabindex="0" aria-label="'+esc(c.title)+': список задач">'+list(c,report,limits.get(c.id)||pageSize)+'</div></section>').join('')+'</div>';
 }
 const css=[
 '.app-panel[data-view="kanban"] #project-year,.app-panel[data-view="kanban"] #story-period{display:none}',
 '#kanban-view{padding:3px 16px 12px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain}',
 '.kb-board{height:100%;min-height:0;display:flex;gap:12px;width:max-content;min-width:100%;padding-bottom:3px}',
 '.kb-board-column{width:270px;flex:0 0 270px;min-height:0;display:flex;flex-direction:column;border:1px solid var(--line);border-top:3px solid var(--status-color);border-radius:8px;background:var(--paper);overflow:hidden}',
 '.kb-board-head{flex-shrink:0;padding:12px;border-bottom:1px solid var(--line);background:var(--paper)}',
 '.kb-board-title{display:flex;align-items:center;gap:8px;min-width:0}.kb-board-title h2{font-size:13px;font-weight:650;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kb-board-title>span{margin-left:auto;border-radius:4px;background:var(--bg);padding:2px 6px;font-size:11px;color:var(--sub);font-variant-numeric:tabular-nums}',
 '.kb-board-sp{display:flex;align-items:baseline;gap:5px;margin:8px 0 5px;font-variant-numeric:tabular-nums}.kb-board-sp strong{font-size:23px;font-weight:650;line-height:1.2}.kb-board-sp>span{color:var(--sub);font-size:11px}',
 '.kb-board-readiness{display:flex;align-items:center;gap:9px;font-size:11px;font-variant-numeric:tabular-nums}.kb-board-readiness>span{min-width:42px;text-align:right}.kb-board-track{height:4px;flex:1;border-radius:3px;background:var(--track);overflow:hidden}.kb-board-track i{display:block;height:100%;border-radius:3px;background:var(--status-color)}',
 '.kb-board-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior-y:contain;padding:9px;background:var(--bg);scrollbar-gutter:stable;display:flex;flex-direction:column;gap:8px}.kb-board-list:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}',
 '.kb-board-task{display:flex;flex-direction:column;gap:6px;flex-shrink:0;min-width:0;width:100%;padding:11px;border:1px solid var(--line);border-radius:6px;background:var(--paper);text-align:left;cursor:pointer}.kb-board-task:hover{border-color:var(--accent)}.kb-board-task-id{font-size:10px;color:var(--sub);font-variant-numeric:tabular-nums}.kb-board-task-title{font-size:12px;line-height:1.4;font-weight:600;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.kb-board-task-path{font-size:10px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kb-board-task-person{font-size:11px;color:var(--sub);margin-top:2px;overflow-wrap:anywhere}.kb-board-task-footer{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-variant-numeric:tabular-nums;border-top:1px solid var(--line);padding-top:7px;margin-top:2px}.kb-board-task-footer b{font-weight:600}.kb-board-task-footer small{font-size:10px;font-weight:400;color:var(--sub)}.kb-board-task-footer>span{color:var(--sub)}.kb-board-empty{padding:22px 8px;text-align:center;color:var(--sub);font-size:11px}.kb-board-more{width:100%;min-height:32px}',
 '@media(max-width:600px){#kanban-view{padding:3px 8px 8px}.kb-board{gap:8px}.kb-board-column{width:250px;flex-basis:250px}}'
 ].join('\n');
 let cachedModel=null,cachedKey='',report=null;
 const limits=new Map();
 function ensureStyle(){if(document.getElementById('kanban-board-style'))return;const s=document.createElement('style');s.id='kanban-board-style';s.textContent=css;document.head.append(s);}
 function mount(root,model,filters,{openStory=()=>{}}={}){
  ensureStyle();
  const key=JSON.stringify([filters.search,filters.matchMode,...['stakeholder','direction','stream','department','ba','project'].map(k=>[filters[k],!!filters.exclude?.[k]])]);
  if(cachedModel!==model||cachedKey!==key){report=calculate(model,filters);cachedModel=model;cachedKey=key;limits.clear();}
  root._boardOpen=openStory;
  if(root._boardReport!==report){root.innerHTML=render(report,limits);root._boardReport=report;root.scrollLeft=0;}
  if(!root._boardBound){root._boardBound=true;root.addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button)return;
   if(button.dataset.boardTask){root._boardOpen(button.dataset.boardTask);return;}
   if(button.dataset.boardMore){const id=button.dataset.boardMore,c=report.columns.find(c=>c.id===id);if(!c)return;
    const limit=limits.get(id)||pageSize,next=limit+pageSize;limits.set(id,next);
    const container=button.closest('.kb-board-list'),top=container.scrollTop;
    container.innerHTML=list(c,report,next);container.scrollTop=top;
    container.querySelectorAll('[data-board-task]')[limit]?.focus({preventScroll:true});
   }
  });}
  return report;
 }
 function reset(){cachedModel=null;cachedKey='';limits.clear();}
 return {calculate,totals,statusOf,render,mount,reset,pageSize};
})();
