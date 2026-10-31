'use strict';
if(new URLSearchParams(location.search).get('password')==='changed')document.querySelector('.lead').textContent='Пароль изменён. Войдите с новым паролем.';
document.getElementById('login-form').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),message=document.getElementById('login-error');
  button.disabled=true;button.textContent='Входим…';message.hidden=true;
  try{
    const response=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.elements.username.value,password:form.elements.password.value}),signal:AbortSignal.timeout(15000)});
    if(!response.ok){const data=await response.json();throw new Error(data.error||'Не удалось войти.');}
    form.elements.password.value='';location.replace('/');
  }catch(error){message.textContent=error.name==='TimeoutError'?'Сервис входа не ответил. Попробуйте ещё раз.':error.message;message.hidden=false;}
  finally{button.disabled=false;button.textContent='Войти';}
});
