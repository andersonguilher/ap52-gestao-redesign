/* AP5.2 v65.42.155 — envio de evidências ao Drive pelo servidor do site.
   v65.42.156.1 — envio pendente sem o arquivo original pode ser descartado após conferência no servidor. */
'use strict';
let dem52u={form:null,download:null};
const DEM52U_MAX=10*1024*1024;
const DEM52U_TYPES=['image/jpeg','image/png','image/webp','application/pdf'];
function dem52uEl(k){return document.getElementById('dem52u-'+k);}
function dem52uPode(){return dem52eEscopo(dem52e.caso)&&pode28('demandas','cadastrar');}
function dem52uKey(){return 'ap52-evidencia-pendente-v1:'+acesso28.user.user_id+':'+dem52e.caso.id;}
function dem52uMontar(){
 const area=dem52eEl('area');if(!area)return;
 area.querySelectorAll('.dem52e-intro,.dem52e-empty small').forEach(el=>{el.textContent=el.classList.contains('dem52e-intro')?'Consulte os arquivos do caso ou adicione fotos e documentos pela biblioteca.':'Adicione fotos e documentos para registrar o serviço.';});
 if(dem52uPode()&&!dem52uEl('novo')){const b=document.createElement('button');b.id='dem52u-novo';b.type='button';b.className='btn btn-primary';b.textContent='Adicionar arquivo';b.onclick=dem52uAbrir;area.querySelector('.dem52e-head').append(b);}
 area.querySelectorAll('.dem52e-card').forEach((card,i)=>{const row=dem52e.itens[i];if(!row||!row.drive_folder_id||!/^[a-f0-9]{64}$/.test(row.hash_arquivo||'')||card.querySelector('[data-u-baixar]'))return;card.querySelector('footer a')?.remove();const b=document.createElement('button');b.type='button';b.className='btn btn-ghost';b.dataset.uBaixar=row.id;b.textContent='Baixar arquivo';b.onclick=()=>dem52uBaixar(row,b);card.querySelector('footer').append(b);});
}
async function dem52uRequest(route,data,signal,receipt){
 const s=await sb.auth.getSession(),token=s.data?.session?.access_token;if(!token)throw Error('Sua sessão expirou. Entre novamente.');
 const headers={authorization:'Bearer '+token,'content-type':receipt?data.type:'application/json'};if(receipt)headers['x-ap52-upload']=receipt;
 const response=await fetch('/api/demandas-drive/'+route,{method:'POST',headers,body:receipt?data:JSON.stringify(data||{}),signal,cache:'no-store'});
 if(route==='download'&&response.ok)return response;
 let r;try{r=await response.json();}catch{throw Error('O servidor não confirmou a operação. Use Verificar envio.');}
 if(!response.ok||r?.ok!==true)throw Object.assign(Error(r?.error||'Não foi possível confirmar a operação.'),{code:r?.code});return r;
}
function dem52uValid(f){return dem52u.form===f&&f.valid();}
function dem52uBusy(f,value){f.busy=value;if(dem52uValid(f))dem52uRender();}
async function dem52uAbrir(){
 if(!dem52uPode()||dem52u.form||dem52e.editor)return;
 const key=dem52uKey(),f={key,valid:dem52eContexto(),caso:{...dem52e.caso},busy:true,ready:false,file:null,pending:null,needsFile:false,message:'Conferindo disponibilidade do envio…',ctl:new AbortController(),draft:{tipo:'antes',legenda:'',data:'',ordem:0},preview:null};dem52u.form=f;
 try{const raw=localStorage.getItem(key);if(raw){const p=JSON.parse(raw);if(!p?.receipt||!p.meta||!p.id)throw Error();f.pending=p;}}catch{f.storageError=true;f.message='Não foi possível ler o envio pendente deste navegador. Avise a Coordenação.';f.busy=false;}
 let d=dem52uEl('dialogo');if(!d){d=document.createElement('dialog');d.id='dem52u-dialogo';d.className='dem52e-dialog dem52u-dialog';d.setAttribute('aria-labelledby','dem52u-title');document.body.append(d);d.addEventListener('cancel',e=>{e.preventDefault();dem52uFechar();});}dem52uRender();d.showModal();
 if(f.storageError)return;
 try{const r=await dem52uRequest('status',{},f.ctl.signal);if(!dem52uValid(f))return;f.ready=r.ready===true&&r.canUpload===true;f.message=!f.ready?'O envio aguarda a conexão com o Google Drive. Avise a Coordenação.':f.pending?'Há um envio pendente. Confira o resultado antes de selecionar outro arquivo.':'';}
 catch(e){if(dem52uValid(f))f.message=e.message;}
 finally{if(dem52uValid(f)){f.busy=false;dem52uRender();}}
}
function dem52uRender(){
 const f=dem52u.form,d=dem52uEl('dialogo');if(!f||!d)return;const p=f.pending,m=p?.meta,locked=f.busy||!!p||!f.ready;
 d.innerHTML=`<header><div class="dem52-eyebrow">${dem52Texto(f.caso.codigo)}</div><h2 id="dem52u-title">Adicionar evidência</h2><p>Envie uma foto ou um documento deste serviço.</p></header><form id="dem52u-form"><div class="dem52u-file"><label class="dem52u-picker">${f.file?'Trocar arquivo':p?'Selecionar novamente':'Escolher arquivo'}<input id="dem52u-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" ${f.busy||!f.ready||p&&!f.needsFile?'disabled':''}></label><small>JPG, PNG, WebP ou PDF · até 10 MB · um arquivo por vez.</small><p id="dem52u-name">${dem52Texto(f.file?.name||m?.nome_arquivo||'Nenhum arquivo selecionado')}</p>${f.preview?`<img src="${f.preview}" alt="Prévia da imagem selecionada">`:''}</div><label>Categoria<select id="dem52u-tipo" ${locked?'disabled':''}>${Object.entries(DEM52E_TIPOS).map(([k,v])=>`<option value="${k}" ${k===(m?.tipo||f.draft.tipo)?'selected':''}>${v}</option>`).join('')}</select></label><label>Legenda<textarea id="dem52u-legenda" maxlength="4000" rows="3" ${locked?'disabled':''}>${dem52Texto(m?.legenda||f.draft.legenda)}</textarea></label><div class="dem52e-editor-grid"><label>Data e horário da evidência<input id="dem52u-data" type="datetime-local" value="${m?dem52eDataLocal(m.data_evidencia):f.draft.data}" ${locked?'disabled':''}><small>Horário de Brasília. Pode ficar em branco.</small></label><label>Ordem de exibição<input id="dem52u-ordem" type="number" min="0" max="2147483647" value="${m?.ordem??f.draft.ordem}" ${locked?'disabled':''}></label></div><p class="dem52e-editor-note">O arquivo será guardado no Drive e vinculado a este caso. Não é necessário escolher pastas.</p><p id="dem52u-message" role="status" aria-live="polite" ${f.message?'':'hidden'}>${dem52Texto(f.message)}</p><footer><button type="button" id="dem52u-close" class="btn btn-ghost" ${f.busy?'disabled':''}>${p?'Fechar e continuar depois':'Cancelar'}</button>${!f.ready&&!f.busy&&!f.storageError?'<button type="button" id="dem52u-check" class="btn btn-ghost">Conferir conexão</button>':''}${p&&f.needsFile&&!f.busy?'<button type="button" id="dem52u-descartar" class="btn btn-ghost">Descartar este envio</button>':''}<button type="submit" id="dem52u-send" class="btn btn-primary" ${f.busy||!f.ready?'disabled':''}>${f.busy?'Aguarde…':p?(f.needsFile?'Continuar envio':'Verificar envio'):'Enviar arquivo'}</button></footer></form>`;
 dem52uEl('file').onchange=event=>dem52uSelecionar(event.target.files?.[0]);dem52uEl('close').onclick=dem52uFechar;dem52uEl('form').onsubmit=e=>{e.preventDefault();dem52uEnviar();};
 for(const [id,k]of [['tipo','tipo'],['legenda','legenda'],['data','data'],['ordem','ordem']])dem52uEl(id).oninput=e=>{f.draft[k]=e.target.value;};
 dem52uEl('check')?.addEventListener('click',()=>{dem52uEncerrar();dem52uAbrir();});
 dem52uEl('descartar')?.addEventListener('click',dem52uDescartar);
}
async function dem52uHash(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');}
async function dem52uSelecionar(file){
 const f=dem52u.form;if(!f||f.busy||!file)return;f.busy=true;f.message='Conferindo o arquivo…';dem52uRender();
 try{if(!DEM52U_TYPES.includes(file.type)||!file.size||file.size>DEM52U_MAX)throw Error('Escolha uma imagem JPG, PNG, WebP ou PDF de até 10 MB.');if(file.name.length>180||/[\x00-\x1f\x7f/\\]/.test(file.name))throw Error('Use um nome de arquivo com até 180 caracteres, sem barras.');
 const a=new Uint8Array(await file.slice(0,12).arrayBuffer()),s=new TextDecoder('latin1').decode(a),magic=file.type==='image/jpeg'?a[0]===255&&a[1]===216&&a[2]===255:file.type==='image/png'?a.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':file.type==='image/webp'?s.startsWith('RIFF')&&s.slice(8,12)==='WEBP':s.startsWith('%PDF-');if(!magic)throw Error('O conteúdo não corresponde ao formato informado. Escolha outro arquivo.');
 const hash=await dem52uHash(file);if(!dem52uValid(f))return;if(f.pending&&(hash!==f.pending.meta.hash_arquivo||file.size!==f.pending.meta.tamanho_bytes||file.type!==f.pending.meta.mime_type))throw Error('Selecione o mesmo arquivo usado neste envio pendente.');
 if(f.preview)URL.revokeObjectURL(f.preview);f.file=file;f.hash=hash;f.preview=file.type.startsWith('image/')?URL.createObjectURL(file):null;f.message='';
 }catch(e){if(dem52uValid(f)){f.file=null;f.hash=null;if(f.preview)URL.revokeObjectURL(f.preview);f.preview=null;f.message=e.message;}}
 finally{if(dem52uValid(f)){f.busy=false;dem52uRender();}}
}
async function dem52uEnviar(){
 const f=dem52u.form;if(!f||f.busy||!f.ready||!dem52uPode())return;f.busy=true;f.ctl=new AbortController();const timer=setTimeout(()=>f.ctl.abort(),110000);f.message=f.pending?'Conferindo o envio anterior…':'Preparando o envio…';dem52uRender();
 try{
  if(!f.pending){if(!f.file)throw Error('Escolha uma foto ou um documento.');const meta={caso_id:f.caso.id,nome_arquivo:f.file.name,mime_type:f.file.type,tamanho_bytes:f.file.size,hash_arquivo:f.hash,tipo:f.draft.tipo,legenda:String(f.draft.legenda).trim()||null,data_evidencia:dem52eDataISO(f.draft.data),ordem:Number(f.draft.ordem)};if(!Number.isInteger(meta.ordem)||meta.ordem<0||meta.ordem>2147483647)throw Error('Informe uma ordem válida.');
   const r=await dem52uRequest('prepare',meta,f.ctl.signal);if(!dem52uValid(f))return;if(typeof r.receipt!=='string'||!r.id||r.meta?.hash_arquivo!==f.hash)throw Error('Não foi possível preparar o envio. Nenhum arquivo foi enviado.');const pending={receipt:r.receipt,id:r.id,meta:r.meta};
   try{localStorage.setItem(f.key,JSON.stringify(pending));if(localStorage.getItem(f.key)!==JSON.stringify(pending))throw Error();}catch{throw Error('O navegador não conseguiu guardar a recuperação do envio. Libere o armazenamento do site e tente novamente.');}f.pending=pending;
  }
  let r=await dem52uRequest('recover',{receipt:f.pending.receipt},f.ctl.signal);if(!dem52uValid(f))return;
  if(r.state==='needs_file'){
   f.needsFile=true;if(!f.file){f.message='O arquivo ainda não chegou ao Drive. Selecione novamente o mesmo arquivo para continuar sem duplicar. Se você não tiver mais esse arquivo, use “Descartar este envio”.';return;}
   f.message='Enviando e conferindo o arquivo…';dem52uRender();r=await dem52uRequest('upload',f.file,f.ctl.signal,f.pending.receipt);if(!dem52uValid(f))return;
  }
  if(r.state!=='saved'||r.id!==f.pending.id)throw Error('O servidor ainda não confirmou o vínculo. Use Verificar envio.');
  try{localStorage.removeItem(f.key);}catch{throw Error('O arquivo foi salvo, mas o navegador não conseguiu limpar o comprovante. Use Verificar envio para conferir.');}
  dem52uEncerrar();ap52Notify('Arquivo adicionado à biblioteca.');dem52e.aberta=true;dem52e.tipo='';dem52e.pagina=0;await dem52eCarregar();
 }catch(e){if(dem52uValid(f)){f.needsFile=false;f.message=e.name==='AbortError'?'O envio demorou mais que o esperado. Use Verificar envio para conferir o resultado.':e.message;}}
 finally{clearTimeout(timer);if(dem52uValid(f)){f.busy=false;dem52uRender();}}
}
async function dem52uFechar(){const f=dem52u.form;if(!f||f.busy)return;if(f.file&&!f.pending){const d=dem52uEl('dialogo');d.close();const yes=await ap52Confirm('Sair sem enviar este arquivo?',{title:'Cancelar envio?',confirmText:'Sair sem enviar'});if(!dem52uValid(f))return;if(!yes){d.showModal();return;}}dem52uEncerrar();}
// Só aparece depois de o servidor responder needs_file (nenhum arquivo no Drive e nenhum registro).
// Antes de descartar, confere de novo: se o envio tiver sido concluído, trata como salvo.
async function dem52uDescartar(){
 const f=dem52u.form;if(!f||f.busy||!f.pending||!f.needsFile)return;const d=dem52uEl('dialogo');d.close();
 const yes=await ap52Confirm('O arquivo deste envio não chegou ao Drive. Descartar o envio pendente para poder escolher outro arquivo?',{title:'Descartar envio pendente?',confirmText:'Descartar envio',variant:'warning'});
 if(!dem52uValid(f))return;d.showModal();if(!yes)return;
 f.busy=true;f.ctl=new AbortController();const timer=setTimeout(()=>f.ctl.abort(),30000);f.message='Conferindo o envio antes de descartar…';dem52uRender();
 try{
  const r=await dem52uRequest('recover',{receipt:f.pending.receipt},f.ctl.signal);if(!dem52uValid(f))return;
  if(r.state==='saved'&&r.id===f.pending.id){try{localStorage.removeItem(f.key);}catch{}dem52uEncerrar();ap52Notify('O envio já tinha sido concluído. Arquivo adicionado à biblioteca.');dem52e.aberta=true;dem52e.tipo='';dem52e.pagina=0;await dem52eCarregar();return;}
  if(r.state!=='needs_file')throw Error('Não foi possível conferir o envio. Tente novamente.');
  try{localStorage.removeItem(f.key);}catch{throw Error('O navegador não conseguiu remover o envio pendente. Tente novamente.');}
  if(f.preview)URL.revokeObjectURL(f.preview);f.pending=null;f.needsFile=false;f.file=null;f.hash=null;f.preview=null;f.message='Envio pendente descartado. Escolha um novo arquivo.';
 }catch(e){if(dem52uValid(f))f.message=e.name==='AbortError'?'A conferência demorou mais que o esperado. Tente novamente.':e.message;}
 finally{clearTimeout(timer);if(dem52uValid(f)){f.busy=false;dem52uRender();}}
}
function dem52uEncerrar(){const f=dem52u.form;if(f){f.ctl?.abort();if(f.preview)URL.revokeObjectURL(f.preview);}dem52u.form=null;const d=dem52uEl('dialogo');if(d){if(d.open)d.close();d.replaceChildren();}}
async function dem52uBaixar(row,button){if(dem52u.download||!dem52eEscopo(dem52e.caso))return;const valid=dem52eContexto(),ctl=new AbortController();dem52u.download=ctl;button.disabled=true;button.textContent='Baixando…';const timer=setTimeout(()=>ctl.abort(),60000);try{const r=await dem52uRequest('download',{id:row.id},ctl.signal);const blob=await r.blob();if(!valid()||dem52u.download!==ctl)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=row.nome_arquivo;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){if(valid())ap52Notify(e.name==='AbortError'?'O download demorou mais que o esperado. Tente novamente.':e.message,{variant:'warning'});}finally{clearTimeout(timer);if(dem52u.download===ctl)dem52u.download=null;if(button.isConnected){button.disabled=false;button.textContent='Baixar arquivo';}}}
function limparEnviosDriveAP52(){dem52uEncerrar();dem52u.download?.abort();dem52u.download=null;}
