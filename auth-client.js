globalThis.UbaitAuth=(()=>{
  const enter=changed=>location.replace(changed?'/login?password=changed':'/login');
  const channel=new BroadcastChannel('ubait-auth');
  async function checked(response){if(response.status===401){enter();throw new Error('Сеанс завершён. Войдите снова.');}return response;}
  const user=fetch('/auth/me',{cache:'no-store'}).then(checked).then(async r=>{if(!r.ok)throw new Error('Не удалось проверить вход.');return r.json();});
  user.then(u=>{const button=document.getElementById('logout');if(button)button.title='Выйти · '+u.full_name;const username=document.getElementById('password-username');if(username)username.value=u.username;}).catch(()=>{});
  document.getElementById('logout')?.addEventListener('click',async()=>{
    const button=document.getElementById('logout');button.disabled=true;
    try{const r=await fetch('/auth/logout',{method:'POST'});if(!r.ok)throw new Error();channel.postMessage('logout');enter();}
    catch{button.disabled=false;button.textContent='Повторить выход';}
  });
  channel.onmessage=e=>{if(e.data==='logout'||e.data==='password-changed')enter(e.data==='password-changed');};
  const dialog=document.getElementById('password-dialog'),form=document.getElementById('password-form');
  let changing=false;
  if(dialog&&form){
    const message=document.getElementById('password-error'),fields=document.getElementById('password-fields'),cancel=document.getElementById('password-cancel'),submit=document.getElementById('password-submit');
    const clear=()=>{for(const key of ['currentPassword','newPassword','confirmPassword'])form.elements[key].value='';message.textContent='';message.hidden=true;};
    document.getElementById('change-password')?.addEventListener('click',()=>{clear();dialog.showModal();form.elements.currentPassword.focus();});
    cancel.addEventListener('click',()=>{if(!changing)dialog.close();});
    dialog.addEventListener('close',clear);
    dialog.addEventListener('cancel',e=>{if(changing)e.preventDefault();});
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(changing)return;message.hidden=true;
      const body=Object.fromEntries(['currentPassword','newPassword','confirmPassword'].map(key=>[key,form.elements[key].value]));
      if(body.newPassword!==body.confirmPassword){message.textContent='Новый пароль и повтор не совпадают.';message.hidden=false;form.elements.confirmPassword.focus();return;}
      if(body.newPassword===body.currentPassword){message.textContent='Новый пароль должен отличаться от текущего.';message.hidden=false;form.elements.newPassword.focus();return;}
      changing=true;fields.disabled=true;cancel.disabled=true;submit.textContent='Сохраняем…';
      try{
        const response=await checked(await fetch('/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)}));
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось сменить пароль.');
        clear();channel.postMessage('password-changed');enter(true);
      }catch(error){message.textContent=error.name==='TimeoutError'?'Не удалось подтвердить смену пароля. Войдите снова; если новый пароль не подходит, используйте прежний.':error.message;message.hidden=false;}
      finally{changing=false;fields.disabled=false;cancel.disabled=false;submit.textContent='Сохранить пароль';}
    });
  }
  // Check on return to a tab and periodically: disabled users do not retain an unattended open screen.
  const recheck=()=>{if(!changing)return fetch('/auth/me',{cache:'no-store'}).then(checked).catch(()=>{});};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void recheck();});
  setInterval(()=>{if(!document.hidden)void recheck();},60000);
  return {checked,user};
})();
