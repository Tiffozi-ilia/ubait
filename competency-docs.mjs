// One competency per request. No retained results, cooldown or shared pending calls.
const WEBHOOK='https://n8n.ubait.ru/webhook/get_confluence_tree_storage_matrix';
export const isCompetencyId=value=>typeof value==='string'&&/^03\.01\.(?:01|02)\.\d{2}\.\d{2}$/.test(value);
const MAX_BYTES=8*1024*1024;
const invalid=()=>new Error('Invalid competency reference response');
const sourceLink=id=>'https://confluence.sovcombank.ru/pages/viewpage.action?pageId='+id;

function xmlText(value){
  return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,entity=>{
    const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
    if(named[entity])return named[entity];
    const n=entity[2]?.toLowerCase()==='x'?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1));
    return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):entity;
  });
}

export function markdownFromStorage(storage){
  if(typeof storage!=='string'||storage.length>200000)throw invalid();
  const parts=[];
  // Extract only the markdown macro, never render Confluence storage as HTML.
  for(const macro of storage.matchAll(/<ac:structured-macro\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ac:structured-macro\s*>)/g)){
    if(!/\bac:name\s*=\s*(["'])markdown\1/.test(macro[1]))continue;
    if(!macro[2])continue;
    const body=macro[2].match(/<ac:plain-text-body\s*>([\s\S]*?)<\/ac:plain-text-body\s*>/);
    if(!body)continue;
    let text='';
    for(const token of body[1].matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+)|(<)/g)){
      // CDATA is already literal Markdown: do not decode its entities a second time.
      if(token[1]!==undefined)text+=token[1];
      else if(token[2])text+=xmlText(token[2]);
      else throw invalid();
    }
    if(text.trim())parts.push(text.trim());
  }
  return parts.join('\n\n');
}

export function extractCompetencyDocs(payload,matrixId,loadedAt=Date.now()){
  if(!isCompetencyId(matrixId))throw invalid();
  if(Array.isArray(payload)&&payload.length!==1)throw invalid();
  const source=Array.isArray(payload)?payload[0]:payload;
  if(!source?.tree||source.tree.matrix_id!==matrixId||String(source.page_id)!==String(source.tree.id)||!Number.isInteger(source.total_pages))throw invalid();
  if(source.matrix_id!==undefined&&source.matrix_id!==matrixId)throw invalid();
  const stack=[{node:source.tree,depth:0}],pages=[],ids=new Set(),codes=new Set();
  while(stack.length){
    const {node,depth}=stack.pop();
    if(depth>20||pages.length>=2000||!node||!/^\d{1,20}$/.test(String(node.id))||ids.has(String(node.id))||!Array.isArray(node.children))throw invalid();
    ids.add(String(node.id));pages.push(node);
    if(node.matrix_id!==null&&node.matrix_id!==undefined){
      if(typeof node.matrix_id!=='string'||!/^\d{2}(?:\.\d{2}){1,8}$/.test(node.matrix_id)||codes.has(node.matrix_id))throw invalid();
      if(node.matrix_id!==matrixId&&!node.matrix_id.startsWith(matrixId+'.'))throw invalid();
      codes.add(node.matrix_id);
    }
    for(const child of node.children)stack.push({node:child,depth:depth+1});
  }
  if(pages.length!==source.total_pages||(source.descendant_pages!==undefined&&source.descendant_pages!==pages.length-1))throw invalid();
  const section=node=>{
    if(!node)return null;
    const markdown=markdownFromStorage(node.body?.storage?.value);
    return markdown?{markdown,page_id:String(node.id),url:sourceLink(node.id)}:null;
  };
  const page=source.tree,criteria=page.children.find(c=>c.matrix_id===matrixId+'.01');
  // Match the requested root and exact child codes; grade calculations stay in HR.
  const competency={description:section(page),criteria:section(criteria),
    positive:section(criteria?.children.find(c=>c.matrix_id===matrixId+'.01.01')),
    negative:section(criteria?.children.find(c=>c.matrix_id===matrixId+'.01.02'))};
  return {schema_version:2,matrix_id:matrixId,source_page_id:String(page.id),loaded_at:new Date(loadedAt).toISOString(),competency};
}

export function createCompetencyDocs({fetchImpl=fetch,now=Date.now,timeoutMs=60000}={}){
  const unavailable=()=>Object.assign(new Error('Описания компетенций временно недоступны.'),{status:503});
  return async function getDocs(matrixId){
    if(!isCompetencyId(matrixId))throw Object.assign(new Error('Неверный matrix_id компетенции.'),{status:400});
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        // Fixed destination and body. Never forward user cookies, PB tokens or the HR webhook secret.
        const response=await fetchImpl(new URL(WEBHOOK),{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','Cache-Control':'no-cache'},
          body:JSON.stringify({matrix_id:matrixId}),cache:'no-store',signal:controller.signal,redirect:'error'});
        if(!response.ok||!response.body||Number(response.headers.get('content-length'))>MAX_BYTES)throw invalid();
        const reader=response.body.getReader(),chunks=[];let size=0;
        try{
          for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw invalid();chunks.push(Buffer.from(value));}
        }catch(error){await reader.cancel().catch(()=>{});throw error;}
        return extractCompetencyDocs(JSON.parse(Buffer.concat(chunks).toString('utf8')),matrixId,now());
      }catch{throw unavailable();}
      finally{clearTimeout(timer);controller.abort();}
  };
}
