// Keep the shared coefficients; change their application to the agreed grade transitions.
// Increment a published model revision so an already open old draft cannot overwrite it.
migrate((app)=>{
 const record=app.findRecordById('hr_compensation','hrcompmodel0001');
 const value=JSON.parse(record.getString('document'));
 if(value.formula_version==='grade-step-score-v2')return;
 if(value.formula_version!=='piecewise-score-v1')throw new Error('Unknown compensation formula version');
 value.formula_version='grade-step-score-v2';
 if(value.model)value.revision+=1;
 record.set('document',JSON.stringify(value));app.save(record);
});
