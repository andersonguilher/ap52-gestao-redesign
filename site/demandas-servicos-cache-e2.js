/* AP5.2 E1+E2 R1 — cache de servicos_executados, sem dados pessoais de demandas.
 * Supabase e RLS continuam sendo a autoridade. IndexedDB pode falhar: ler sempre segue online.
 * Validacao na entrada: COUNT exact (HEAD) + ultimo criado_em; recarga total a cada 24h.
 * Chave: uid / gerencia / papel / escopo global / geracao local. Nunca reaproveitar entre identidades.
 * Ao ALTERAR linhas existentes em uma carga futura, aumentar DATA_V e publicar juntos.
 */
'use strict';
(function(){
 const DB='ap52-servicos-executados-e2',STORE='snapshots',DBV=1,DATA_V=3;
 const TTL=24*60*60*1000,MAX=40000,PAGE=450;
 // Somente colunas operacionais: jamais incluir solicitante, documentos, contatos ou dados_origem.
 const COLS='id,logradouro,bairro,sub_bairro,gerencia,gerencia_territorial,territorio_cl,territorio_criterio,data_execucao,servico_apresentacao,servico_original,numero,criado_em';
 let openPromise=null,unavailable=false,memory=null,identitySeen=null,epoch=0;
 const pending=new Map();
 const stats={redeCompleta:0,redeIncremental:0,cacheValidado:0,fallbackSemIndexedDB:0,ultimaOrigem:null,ultimaQuantidade:0};
 const pode=()=>typeof dem52Pode==='function'&&dem52Pode();
 function context(){
  const u=typeof acesso28!=='undefined'?acesso28?.user:null;
  if(!pode()||!u?.user_id)return null;
  const gc=String(u.gerencia||''),role=String(u.role_code||''),global=typeof dem52Global==='function'&&dem52Global();
  if(!global&&!gc)return null;
  const generation=typeof ac28Generation!=='undefined'?ac28Generation:null;
  if(!Number.isSafeInteger(generation))return null;
  const key=JSON.stringify([DATA_V,String(u.user_id),gc,role,global,generation]);
  return {key,uid:u.user_id,gc,role,global,generation};
 }
 function alive(ctx,startEpoch,valid){return !!ctx&&epoch===startEpoch&&context()?.key===ctx.key&&(!valid||valid());}
 function ensure(ctx,startEpoch,valid){if(!alive(ctx,startEpoch,valid))throw Error('Consulta cancelada: sessão ou escopo alterado.');}
 function scope(q,ctx){return ctx.global?q:q.or('gerencia.eq."'+ctx.gc+'",gerencia_territorial.eq."'+ctx.gc+'"');}
 function db(){
  if(unavailable||typeof indexedDB==='undefined')return Promise.resolve(null);
  if(openPromise)return openPromise;
  openPromise=new Promise(resolve=>{
   let finished=false;const done=(x)=>{if(!finished){finished=true;resolve(x);}};
   try{const req=indexedDB.open(DB,DBV);
    req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'key'});};
    req.onsuccess=()=>{const d=req.result;d.onversionchange=()=>d.close();done(d);};
    req.onerror=()=>{unavailable=true;done(null);};req.onblocked=()=>{unavailable=true;done(null);};
   }catch(_){unavailable=true;done(null);}
  });
  return openPromise;
 }
 async function fromDb(key){
  try{const d=await db();if(!d)return null;
   return await new Promise(resolve=>{let req;try{req=d.transaction(STORE,'readonly').objectStore(STORE).get(key);}catch(_){resolve(null);return;}
    req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);
   });
  }catch(_){return null;}
 }
 async function toDb(data,ctx,startEpoch,valid){
  if(!alive(ctx,startEpoch,valid))return;
  try{const d=await db();if(!d||!alive(ctx,startEpoch,valid))return;
   await new Promise(resolve=>{let tx;try{tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(data);}catch(_){resolve();return;}
    tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();
   });
  }catch(_){}
 }
 function limpar(){
  epoch++;memory=null;identitySeen=null;pending.clear();
  // Limpeza de todo o store (inclusive outras contas); nenhuma informação é reutilizada.
  return (async()=>{try{const d=await db();if(!d)return;
   await new Promise(resolve=>{let tx;try{tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();}catch(_){resolve();return;}
    tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();
   });
  }catch(_){}})();
 }
 async function metadata(ctx,valid,startEpoch){
  const q0=scope(sb.from('servicos_executados').select('id',{head:true,count:'exact'}),ctx);
  const q1=scope(sb.from('servicos_executados').select('criado_em'),ctx).order('criado_em',{ascending:false}).limit(1);
  const [c,m]=await Promise.all([q0,q1]);ensure(ctx,startEpoch,valid);
  if(c.error)throw c.error;if(m.error)throw m.error;
  if(!Number.isSafeInteger(c.count)||c.count<0||c.count>MAX)throw Error('Contagem de serviços fora do limite E2');
  const max=c.count?m.data?.[0]?.criado_em:null;
  if(c.count&&(!max||!Number.isFinite(Date.parse(max))))throw Error('criado_em indisponível ou inválido');
  return {count:c.count,max:max||null};
 }
 async function pages(ctx,startEpoch,valid,after=null){
  const items=new Map();let offset=0,expected=null;
  for(;offset<=MAX;){ensure(ctx,startEpoch,valid);
   let q=scope(sb.from('servicos_executados').select(COLS,{count:offset===0?'exact':undefined}),ctx);
   if(after!==null)q=q.gt('criado_em',after);
   const resp=await q.order('id').range(offset,offset+PAGE-1);
   ensure(ctx,startEpoch,valid);if(resp.error)throw resp.error;
   const data=resp.data||[];for(const x of data){if(!x?.id||!x.criado_em)throw Error('Linha de serviço sem identificador/criado_em');items.set(x.id,x);}
   if(offset===0){if(!Number.isSafeInteger(resp.count)||resp.count<0||resp.count>MAX)throw Error('Contagem incompleta');expected=resp.count;}
   if(items.size>=expected)return [...items.values()];
   if(!data.length)throw Error('Página vazia antes de completar serviços');
   offset+=data.length;
  }
  throw Error('Serviços excedem limite de leitura segura');
 }
 const same=(a,b)=>a&&b&&a.count===b.count&&a.max===b.max;
 async function run(ctx,force,valid,startEpoch){
  ensure(ctx,startEpoch,valid);
  const meta=force?null:await metadata(ctx,valid,startEpoch);
  ensure(ctx,startEpoch,valid);
  let prev=null;
  if(!force){prev=memory?.key===ctx.key?memory:await fromDb(ctx.key);ensure(ctx,startEpoch,valid);}
  const now=Date.now(),fresh=prev&&prev.v===DATA_V&&prev.key===ctx.key&&Array.isArray(prev.rows)
   &&Number.isFinite(prev.fullAt)&&now>=prev.fullAt&&now-prev.fullAt<TTL;
  if(fresh&&prev.rows.length===prev.count&&same({count:prev.count,max:prev.max},meta)){
   stats.cacheValidado++;stats.ultimaOrigem='cache_validado';stats.ultimaQuantidade=prev.count;
   memory=prev;return prev.rows.slice();
  }
  if(fresh&&prev.max&&meta.count>=prev.count&&meta.max&&Date.parse(meta.max)>Date.parse(prev.max)){
   try{
    const add=await pages(ctx,startEpoch,valid,prev.max);ensure(ctx,startEpoch,valid);
    const m=new Map(prev.rows.map(x=>[x.id,x]));for(const x of add)m.set(x.id,x);
    if(m.size===meta.count&&add.length&&add.every(x=>Date.parse(x.criado_em)>Date.parse(prev.max))){
     const rows=[...m.values()];const next={v:DATA_V,key:ctx.key,rows,count:meta.count,max:meta.max,fullAt:prev.fullAt,savedAt:now};
     ensure(ctx,startEpoch,valid);memory=next;await toDb(next,ctx,startEpoch,valid);
     stats.redeIncremental++;stats.ultimaOrigem='incremental';stats.ultimaQuantidade=rows.length;return rows.slice();
    }
   }catch(err){if(!alive(ctx,startEpoch,valid))throw err;/* Carga incremental instável: reler completo. */}
  }
  const rows=await pages(ctx,startEpoch,valid);ensure(ctx,startEpoch,valid);
  const max=rows.reduce((m,x)=>!m||Date.parse(x.criado_em)>Date.parse(m)?x.criado_em:m,null);
  const next={v:DATA_V,key:ctx.key,rows,count:rows.length,max,fullAt:Date.now(),savedAt:Date.now()};
  memory=next;await toDb(next,ctx,startEpoch,valid);
  stats.redeCompleta++;stats.ultimaOrigem='consulta_completa';stats.ultimaQuantidade=rows.length;
  if(unavailable||typeof indexedDB==='undefined')stats.fallbackSemIndexedDB++;
  return rows.slice();
 }
 async function ler({forcar=false,valido=null}={}){
  const ctx=context();if(!ctx)throw Error('Sem permissão para serviços executados.');
  if(identitySeen!==null&&identitySeen!==ctx.key)await limpar();
  identitySeen=ctx.key;const startEpoch=epoch;
  const flightKey=ctx.key+'|'+(forcar?'forcar':'normal');
  if(pending.has(flightKey)&&!forcar){
   try{return (await pending.get(flightKey)).slice();}
   catch(err){
    // Um voo iniciado pelo mapa pode perder validade ao trocar o filtro,
    // enquanto o Consolidado continua válido. Repetir apenas uma vez para
    // este segundo chamador; nunca reexecutar erros de rede nem após logout.
    const cancelado=String(err?.message||err).startsWith('Consulta cancelada:');
    if(!cancelado||!alive(ctx,startEpoch,valido))throw err;
    return (await run(ctx,false,valido,startEpoch)).slice();
   }
  }
  const task=run(ctx,!!forcar,valido,startEpoch);pending.set(flightKey,task);
  try{return (await task).slice();}finally{if(pending.get(flightKey)===task)pending.delete(flightKey);}
 }
 window.AP52ServicosCacheE2={ler,limpar,diagnostico:()=>({...stats,disponivel:!unavailable&&typeof indexedDB!=='undefined',validadeHoras:24})};
})();
