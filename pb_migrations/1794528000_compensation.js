// One shared model, locked to public CRUD. Applied by the existing startup migration.
migrate((app)=>{
 const collection=new Collection({name:'hr_compensation',type:'base',listRule:null,viewRule:null,createRule:null,updateRule:null,deleteRule:null,
  fields:[{name:'document',type:'text',required:true,max:20000}]});
 app.save(collection);
 const record=new Record(collection);record.set('id','hrcompmodel0001');
 record.set('document',JSON.stringify({key:'hr_compensation_v1',schema_version:1,formula_version:'piecewise-score-v1',revision:0,model:null,updated_at:null,updated_by:null}));
 app.save(record);
});
