// Only the private Node gateway knows this per-start secret. /api/ubait/* is never proxied.
routerAdd('GET','/api/ubait/compensation',(e)=>{
 const secret=$os.getenv('UBAIT_INTERNAL_KEY');
 if(!secret||e.request.header.get('X-UBAIT-Internal')!==secret)throw new ForbiddenError();
 const record=e.app.findRecordById('hr_compensation','hrcompmodel0001');
 return e.json(200,JSON.parse(record.getString('document')));
});
routerAdd('PUT','/api/ubait/compensation',(e)=>{
 const secret=$os.getenv('UBAIT_INTERNAL_KEY');
 if(!secret||e.request.header.get('X-UBAIT-Internal')!==secret)throw new ForbiddenError();
 const body=e.requestInfo().body,model=body.model;
 if(!Number.isInteger(body.expected_revision)||body.expected_revision<0||typeof body.actor_id!=='string'||!model||typeof model.management_base_multiplier!=='number'||!Number.isFinite(model.management_base_multiplier)||model.management_base_multiplier<=0||!model.growth)return e.json(400,{code:'invalid_model'});
 for(const kind of ['employee','boss'])if(!Array.isArray(model.growth[kind])||model.growth[kind].length!==3||model.growth[kind].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0))return e.json(400,{code:'invalid_model'});
 let result,conflict=false;
 e.app.runInTransaction((tx)=>{
  const actor=tx.findRecordById('app_users',body.actor_id);if(actor.getBool('disabled'))throw new ForbiddenError();
  const record=tx.findRecordById('hr_compensation','hrcompmodel0001'),previous=JSON.parse(record.getString('document'));
  if(previous.revision!==body.expected_revision){conflict=true;return;}
  result={key:'hr_compensation_v1',schema_version:1,formula_version:'grade-step-score-v2',revision:previous.revision+1,
   model:{management_base_multiplier:model.management_base_multiplier,growth:{employee:model.growth.employee,boss:model.growth.boss}},
   updated_at:new Date().toISOString(),updated_by:{id:actor.id,full_name:actor.getString('full_name')}};
  record.set('document',JSON.stringify(result));tx.save(record);
 });
 return e.json(conflict?409:200,conflict?{code:'revision_conflict'}:result);
},$apis.bodyLimit(8192));
