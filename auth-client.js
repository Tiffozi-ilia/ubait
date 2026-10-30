globalThis.UbaitAuth=(()=>{
  const enter=()=>location.replace('/login');
  async function checked(response){if(response.status===401){enter();throw new Error('Сеанс завершён. Войдите снова.');}return response;}
  const user=fetch('/auth/me',{cache:'no-store'}).then(checked).then(async r=>{if(!r.ok)throw new Error('Не удалось проверить вход.');return r.json();});
  user.then(u=>{const button=document.getElementById('logout');if(button)button.title='Выйти · '+u.full_name;}).catch(()=>{});
  document.getElementById('logout')?.addEventListener('click',async()=>{
    const button=document.getElementById('logout');button.disabled=true;
    try{const r=await fetch('/auth/logout',{method:'POST'});if(!r.ok)throw new Error();new BroadcastChannel('ubait-auth').postMessage('logout');enter();}
    catch{button.disabled=false;button.textContent='Повторить выход';}
  });
  const channel=new BroadcastChannel('ubait-auth');channel.onmessage=e=>{if(e.data==='logout')enter();};
  // Check on return to a tab and periodically: disabled users do not retain an unattended open screen.
  const recheck=()=>fetch('/auth/me',{cache:'no-store'}).then(checked).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void recheck();});
  setInterval(()=>{if(!document.hidden)void recheck();},60000);
  return {checked,user};
})();
