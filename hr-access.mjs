// HR record-level authorization. Never take a role, department or employee ID
// from query parameters, browser state, or an editable app_users role field.
const fault=(status,message)=>Object.assign(new Error(message),{status});
export const nameKey=value=>typeof value==='string'?value.normalize('NFC').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' '):'';
export function managementLevel(value){
  if(!['string','number'].includes(typeof value))return null;
  const key=String(value).trim().toUpperCase().replace(/[−–]/g,'-');
  if(['0','-0','L-0'].includes(key))return 0;
  if(['-1','L-1'].includes(key))return -1;
  if(['-2','L-2'].includes(key))return -2;
  return null;
}
const isReference=card=>nameKey(card.unit.status)==='эталон';
const isProtected=card=>nameKey(card.unit.position)==='начальник'&&nameKey(card.unit.team)==='управление';
const newest=values=>values.filter(v=>typeof v==='string'&&Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]??null;

export function authorizeHr(payload,account){
  if(payload?.schema_version!==1||payload.dataset!=='hr'||payload.api_revision!==1||payload.source_form_id!==405691||!Array.isArray(payload.cards))throw fault(502,'Неверный ответ HR: требуется полный штатный реестр.');
  const ids=new Set();
  for(const card of payload.cards){
    const id=card?.unit?.task_id;
    if(typeof id!=='string'||!/^\d+$/.test(id)||ids.has(id)||!Array.isArray(card.kpi)||!Array.isArray(card.skills))throw fault(502,'Неверный ответ HR: некорректные карточки сотрудников.');
    ids.add(id);
    for(const rows of [card.kpi,card.skills])for(const row of rows){
      if(!row||typeof row!=='object'||(row.task_id!==undefined&&String(row.task_id)!==id))throw fault(502,'Неверный ответ HR: строки относятся к другой карточке.');
    }
    for(const key of ['check','skills_employee','skills_boss']){
      const block=card[key];
      if(block?.task_id!==undefined&&String(block.task_id)!==id)throw fault(502,'Неверный ответ HR: блок относится к другой карточке.');
    }
  }
  const name=nameKey(account?.full_name);
  const matches=name?payload.cards.filter(c=>!isReference(c)&&nameKey(c.unit.staff)===name):[];
  if(matches.length!==1)throw fault(403,matches.length?'HR недоступен: ФИО аккаунта соответствует нескольким карточкам штатки. Обратитесь к администратору.':'HR недоступен: ФИО аккаунта не сопоставлено с сотрудником штатки. Обратитесь к администратору.');
  const own=matches[0],level=managementLevel(own.unit.level),team=nameKey(own.unit.team);
  if(level===null)throw fault(403,'HR недоступен: в штатке не указан корректный уровень сотрудника (0, -1 или -2).');
  if(level===-1&&!team)throw fault(403,'HR недоступен: у руководителя L-1 не указан отдел в штатке.');
  const visible=payload.cards.filter(card=>{
    if(card===own)return true;
    // The head-of-division exception takes precedence even over references/L-0.
    if(isProtected(card))return false;
    if(isReference(card))return true;
    if(level===0)return true;
    return level===-1&&managementLevel(card.unit.level)===-2&&nameKey(card.unit.team)===team;
  });
  const hiddenHeads=payload.cards.filter(c=>c!==own&&isProtected(c));
  const cards=visible.map(card=>{
    const unit={...card.unit,is_reference:isReference(card),status:isReference(card)?'Эталон':card.unit.status};
    // A forbidden head's name/email can also be embedded in another card's chief fields.
    if(hiddenHeads.some(h=>(unit.chief_id&&h.unit.staff_id&&String(unit.chief_id)===String(h.unit.staff_id))||
      (nameKey(unit.chief)&&nameKey(unit.chief)===nameKey(h.unit.staff))||
      (nameKey(unit.chief_email)&&nameKey(unit.chief_email)===nameKey(h.unit.staff_email)))){
      unit.chief=null;unit.chief_id=null;unit.chief_email=null;
    }
    // Do not spread unknown top-level data/metadata from the unrestricted snapshot.
    return {unit,check:card.check??null,skills_employee:card.skills_employee??null,skills_boss:card.skills_boss??null,
      kpi:card.kpi,skills:card.skills,missing_blocks:Array.isArray(card.missing_blocks)?card.missing_blocks:[]};
  });
  const references=cards.filter(isReference);
  return {schema_version:1,dataset:'hr',api_revision:1,source_form_id:405691,generated_at:payload.generated_at,
    access:{policy_version:1,level:'L-'+Math.abs(level),scope:level===0?'all':level===-1?'department':'self',employee_task_id:own.unit.task_id,department:own.unit.team??null},
    meta:{card_count:cards.length,employee_card_count:cards.length-references.length,reference_card_count:references.length,
      kpi_row_count:cards.reduce((n,c)=>n+c.kpi.length,0),ipr_row_count:cards.reduce((n,c)=>n+c.skills.length,0),
      last_source_update:newest(cards.map(c=>c.unit.last_modified_date)),last_database_update:newest(cards.map(c=>c.unit.loaded_at)),
      department_source:'unit.team',reference_rule:'unit.status = Эталон',counts_scope:'authorized_cards'},cards};
}
