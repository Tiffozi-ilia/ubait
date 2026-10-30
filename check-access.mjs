// Run during container startup. Refuse to serve the site if either data webhook
// can still be reached anonymously. Never print response bodies or credentials.
import {hrWebhookAddress} from './server.mjs';
import {fileURLToPath} from 'node:url';
export async function checkWebhookProtection(mapUrl,{fetchImpl=fetch}={}){
  for(const [name,address]of [['Story Map',mapUrl],['HR',hrWebhookAddress(mapUrl)]]){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetchImpl(address,{method:'GET',redirect:'manual',headers:{Accept:'application/json'},signal:controller.signal});
      await response.body?.cancel();
      if(![401,403].includes(response.status))throw new Error(`${name}: anonymous webhook returned ${response.status}; enable Header Auth and publish the existing workflow. Expected 401/403.`);
    }finally{clearTimeout(timer);}
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 await checkWebhookProtection(process.env.STORY_MAP_WEBHOOK_URL);
 console.log('Both n8n data webhooks reject anonymous access.');
}
