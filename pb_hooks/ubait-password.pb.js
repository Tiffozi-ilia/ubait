// Private loopback endpoint: the Node gateway does NOT proxy /api/ubait/*.
// Collection CRUD rules stay locked. No superuser credentials are needed.
routerAdd('POST', '/api/ubait/change-password', (e) => {
  if(e.auth.getBool('disabled'))throw new UnauthorizedError('Access disabled.');
  const body=e.requestInfo().body,keys=['currentPassword','newPassword','confirmPassword'];
  if(Object.keys(body).some(k=>keys.indexOf(k)<0)||keys.some(k=>typeof body[k]!=='string'||!body[k].length||body[k].length>1024))return e.json(400,{code:'invalid_request'});
  if(body.newPassword!==body.confirmPassword)return e.json(400,{code:'password_mismatch'});
  if(body.newPassword===body.currentPassword)return e.json(400,{code:'same_password'});
  let result={ok:true};
  e.app.runInTransaction((txApp)=>{
    // Re-read within the write transaction: no stale identity/disable state or
    // concurrent old-password changes can overwrite a newly changed password.
    const record=txApp.findRecordById('app_users',e.auth.id);
    if(record.getBool('disabled')||record.tokenKey()!==e.auth.tokenKey())throw new UnauthorizedError('Session ended.');
    if(!record.validatePassword(body.currentPassword)){result={code:'invalid_current_password'};return;}
    record.setPassword(body.newPassword);
    record.refreshTokenKey();
    // Respect the current admin-configured password policy, not a hardcoded 12.
    try{txApp.validate(record);}catch{result={code:'password_policy',minLength:record.collection().fields.getByName('password').min};return;}
    txApp.save(record);
  });
  return e.json(result.ok?200:400,result);
}, $apis.requireAuth('app_users'), $apis.bodyLimit(8192));
