/* AP5.2 v65.42.154 — início da Etapa 6: biblioteca e organização das evidências.
   Somente SELECT/UPDATE de metadados existentes. Upload/Drive ficam para a Etapa 7. */
'use strict';
const DEM52E_TIPOS={antes:'Antes',durante:'Durante',depois:'Depois',vistoria:'Vistoria',detalhe:'Detalhe',bds:'BDS',documento:'Documento'};
const DEM52E_COLUNAS='id,caso_id,gerencia,tipo,legenda,data_evidencia,ordem,drive_file_id,drive_folder_id,hash_arquivo,nome_arquivo,mime_type,tamanho_bytes,uploaded_at,uploaded_by,updated_at,updated_by';
const DEM52E_PAGINA=12;
let dem52e={caso:null,aberta:false,tipo:'',pagina:0,total:0,itens:[],estado:'inicio',consulta:0,controle:null,editor:null};
function dem52eEl(k){return document.getElementById('dem52e-'+k);}
function dem52eEscopo(c){return !!c&&dem52Pode()&&DEM52_UNIDADES.includes(c.gerencia)&&(dem52Global()||c.gerencia===acesso28?.user?.gerencia);}
function dem52ePodeEditar(){return dem52eEscopo(dem52e.caso)&&pode28('demandas','editar');}
function dem52eContexto(c=dem52e.caso){const generation=ac28Generation,user=acesso28?.user?.user_id;return ()=>generation===ac28Generation&&user===acesso28?.user?.user_id&&dem52e.caso?.id===c?.id&&dem52eEscopo(c);}
function dem52eUrl(id){return /^[A-Za-z0-9_-]{10,200}$/.test(String(id||''))?'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view':null;}
function dem52eTamanho(n){if(n===null||!Number.isFinite(Number(n)))return '';const v=Number(n);return v<1024?v+' B':v<1048576?(v/1024).toLocaleString('pt-BR',{maximumFractionDigits:1})+' KB':(v/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB';}
function dem52eDataLocal(v){if(!v)return '';const date=new Date(v);if(!Number.isFinite(date.getTime()))return '';const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
function dem52eDataISO(v){
 if(!v)return null;const m=v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);if(!m)throw Error('Informe uma data e horário válidos.');
 const target=Date.UTC(...[+m[1],+m[2]-1,+m[3],+m[4],+m[5]]);let t=target;
 for(let i=0;i<3;i++){const p=dem52eDataLocal(new Date(t).toISOString()).match(/\d+/g).map(Number);const asUTC=Date.UTC(p[0],p[1]-1,p[2],p[3],p[4]);t+=target-asUTC;}
 const iso=new Date(t).toISOString();if(dem52eDataLocal(iso)!==v)throw Error('Informe uma data e horário válidos.');return iso;
}
function dem52eValidar(row,c){if(!row||typeof row.id!=='string'||row.caso_id!==c.id||row.gerencia!==c.gerencia||!Object.hasOwn(DEM52E_TIPOS,row.tipo)||!Number.isInteger(row.ordem)||row.ordem<0||typeof row.nome_arquivo!=='string'||typeof row.mime_type!=='string'||typeof row.updated_at!=='string'||!Number.isFinite(new Date(row.updated_at).getTime()))throw Error('Resposta incompleta.');return row;}

function dem52eMontarCaso(c){
 const parent=document.querySelector('#dem52c-trabalho .dem52c-det-corpo');if(!parent||!dem52eEscopo(c))return;
 if(dem52e.caso?.id!==c.id){limparEvidenciasAP52();dem52e.caso={id:c.id,gerencia:c.gerencia,codigo:c.codigo};}
 let section=dem52eEl('area');if(!section){section=document.createElement('section');section.id='dem52e-area';section.className='dem52c-bloco dem52e-area';parent.insertBefore(section,parent.children[2]||null);}
 dem52eRender();
}
function dem52eRender(){
 const area=dem52eEl('area');if(!area||!dem52e.caso)return;
 const e=dem52e,busy=e.estado==='carregando';
 area.innerHTML=`<header class="dem52e-head"><div><div class="dem52-eyebrow">Fotos e documentos do serviço</div><h3>Biblioteca de evidências</h3><p>Os arquivos pertencem ao caso e podem apoiar todos os protocolos vinculados.</p></div><button type="button" class="btn ${e.aberta?'btn-ghost':'btn-primary'}" id="dem52e-abrir" ${busy?'disabled':''}>${e.aberta?'Atualizar arquivos':'Ver arquivos'}</button></header>${e.aberta?`<div class="dem52e-toolbar"><label>Mostrar categoria<select id="dem52e-tipo" ${busy?'disabled':''}><option value="">Todas as categorias</option>${Object.entries(DEM52E_TIPOS).map(([k,v])=>`<option value="${k}" ${e.tipo===k?'selected':''}>${v}</option>`).join('')}</select></label><p id="dem52e-contagem" role="status">${busy?'Carregando arquivos…':e.estado==='erro'?'Consulta indisponível':e.total?`${e.pagina*DEM52E_PAGINA+1}–${e.pagina*DEM52E_PAGINA+e.itens.length} de ${e.total} ${e.total===1?'arquivo':'arquivos'}`:'Nenhum arquivo nesta consulta'}</p></div><div id="dem52e-conteudo" aria-busy="${busy}">${busy?'<div class="dem52e-empty">Consultando arquivos do caso…</div>':e.estado==='erro'?'<div class="dem52e-empty dem52-error" role="alert"><strong>Não foi possível consultar os arquivos.</strong><p>Confira a conexão e use Atualizar arquivos para tentar novamente.</p></div>':e.itens.length?`<div class="dem52e-grid">${e.itens.map(dem52eCard).join('')}</div>`:`<div class="dem52e-empty"><span class="dem52e-empty-icon" aria-hidden="true">▧</span><strong>${e.tipo?'Nenhum arquivo nesta categoria':'Este caso ainda não tem evidências'}</strong><p>${e.tipo?'Escolha outra categoria ou consulte todos os arquivos.':'Fotos de antes, durante e depois, vistorias, BDS e documentos ficarão reunidos aqui.'}</p><small>O envio de novos arquivos ainda não está disponível.</small></div>`}</div>${e.total>DEM52E_PAGINA&&e.estado==='ok'?`<nav class="dem52e-pagination" aria-label="Páginas de evidências"><button type="button" id="dem52e-anterior" class="btn btn-ghost" ${e.pagina===0?'disabled':''}>← Anterior</button><span>Página ${e.pagina+1} de ${Math.ceil(e.total/DEM52E_PAGINA)}</span><button type="button" id="dem52e-proxima" class="btn btn-ghost" ${(e.pagina+1)*DEM52E_PAGINA>=e.total?'disabled':''}>Próxima →</button></nav>`:''}`:'<p class="dem52e-intro">Consulte e organize os arquivos já vinculados a este caso. O envio de novos arquivos ainda não está disponível.</p>'}`;
 dem52eEl('abrir').onclick=()=>{e.aberta=true;dem52eCarregar();};
 dem52eEl('tipo')?.addEventListener('change',event=>{e.tipo=event.target.value;e.pagina=0;dem52eCarregar();});
 dem52eEl('anterior')?.addEventListener('click',()=>{if(e.pagina>0){e.pagina--;dem52eCarregar();}});
 dem52eEl('proxima')?.addEventListener('click',()=>{if((e.pagina+1)*DEM52E_PAGINA<e.total){e.pagina++;dem52eCarregar();}});
 area.querySelectorAll('[data-e-editar]').forEach(b=>b.onclick=()=>dem52eEditar(b.dataset.eEditar));
 if(typeof dem52uMontar==='function')dem52uMontar();
}
function dem52eCard(row){
 const url=dem52eUrl(row.drive_file_id),foto=row.mime_type.startsWith('image/'),kind=foto?'Imagem':row.mime_type==='application/pdf'?'PDF':'Arquivo';
 return `<article class="dem52e-card"><div class="dem52e-card-top"><span class="dem52e-category" data-tipo="${row.tipo}">${DEM52E_TIPOS[row.tipo]}</span><span class="dem52e-kind">${kind}</span></div><h4>${dem52Texto(row.nome_arquivo)}</h4><p class="dem52e-caption${row.legenda?'':' is-empty'}">${dem52Texto(row.legenda||'Sem legenda')}</p><dl><div><dt>Data da evidência</dt><dd>${row.data_evidencia?dem52Texto(dem52cDataHora(row.data_evidencia)):'Não informada'}</dd></div><div><dt>Ordem</dt><dd>${row.ordem}</dd></div></dl><p class="dem52e-file-meta">${dem52Texto([dem52eTamanho(row.tamanho_bytes),'Incluído em '+dem52cDia(row.uploaded_at)].filter(Boolean).join(' · '))}</p><footer>${url?`<a class="btn btn-ghost" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${dem52Texto(row.nome_arquivo)} no Drive em outra aba">Abrir arquivo ↗</a>`:'<span class="dem52e-unavailable">Arquivo sem referência válida</span>'}${dem52ePodeEditar()?`<button type="button" class="btn btn-ghost" data-e-editar="${dem52Texto(row.id)}">Editar informações</button>`:''}</footer></article>`;
}
async function dem52eCarregar(){
 if(!dem52eEscopo(dem52e.caso))return;
 const e=dem52e,c={...e.caso},valid=dem52eContexto(c),request=++e.consulta;e.controle?.abort();const ctl=new AbortController();e.controle=ctl;
 const timer=setTimeout(()=>ctl.abort(),20000);e.estado='carregando';e.itens=[];dem52eRender();
 try{
  let q=sb.from('caso_evidencias').select(DEM52E_COLUNAS,{count:'exact'}).eq('caso_id',c.id).eq('gerencia',c.gerencia).is('deleted_at',null);
  if(e.tipo)q=q.eq('tipo',e.tipo);
  const {data,error,count}=await q.order('ordem').order('uploaded_at').order('id').range(e.pagina*DEM52E_PAGINA,(e.pagina+1)*DEM52E_PAGINA-1).abortSignal(ctl.signal);
  if(!valid()||request!==e.consulta)return;if(error)throw error;
  if(!Array.isArray(data)||!Number.isSafeInteger(count)||count<0||new Set(data.map(x=>x.id)).size!==data.length)throw Error('Resposta incompleta.');
  data.forEach(row=>dem52eValidar(row,c));
  if(data.some(row=>e.tipo&&row.tipo!==e.tipo))throw Error('Resposta de categoria incorreta.');
  if(e.pagina>0&&!data.length){const ultima=Math.max(0,Math.ceil(count/DEM52E_PAGINA)-1);if(ultima>=e.pagina)throw Error('Resposta incompleta.');e.pagina=ultima;return await dem52eCarregar();}
  if(data.length!==Math.min(DEM52E_PAGINA,Math.max(0,count-e.pagina*DEM52E_PAGINA)))throw Error('Resposta incompleta.');
  e.itens=data;e.total=count;e.estado='ok';
 }catch{if(valid()&&request===e.consulta){e.itens=[];e.total=0;e.estado='erro';}}
 finally{clearTimeout(timer);if(valid()&&request===e.consulta){e.controle=null;dem52eRender();}}
}

function dem52eDialogo(){
 if(dem52eEl('dialogo'))return dem52eEl('dialogo');
 const d=document.createElement('dialog');d.id='dem52e-dialogo';d.className='dem52e-dialog';d.setAttribute('aria-labelledby','dem52e-editor-titulo');document.body.append(d);
 d.addEventListener('cancel',event=>{event.preventDefault();dem52eFecharEditor();});return d;
}
async function dem52eEditar(id){
 if(!dem52ePodeEditar()||dem52e.editor)return;
 const row=dem52e.itens.find(x=>x.id===id);if(!row)return;
 dem52e.editor={row:{...row},ocupado:false,incerto:false,conflito:false,sujo:false,payload:null,controle:null};dem52eRenderEditor();dem52eDialogo().showModal();dem52eEl('categoria').focus();
}
function dem52eRenderEditor(){
 const f=dem52e.editor;if(!f)return;const r=f.row,d=dem52eDialogo();
 d.innerHTML=`<header><div class="dem52-eyebrow">${dem52Texto(dem52e.caso.codigo)}</div><h2 id="dem52e-editor-titulo">Informações da evidência</h2><p>${dem52Texto(r.nome_arquivo)}</p></header><form id="dem52e-form"><label>Categoria<select id="dem52e-categoria" required>${Object.entries(DEM52E_TIPOS).map(([k,v])=>`<option value="${k}" ${k===r.tipo?'selected':''}>${v}</option>`).join('')}</select></label><label>Legenda<textarea id="dem52e-legenda" rows="3" maxlength="4000" placeholder="Descreva o que este arquivo mostra">${dem52Texto(r.legenda||'')}</textarea></label><div class="dem52e-editor-grid"><label>Data e horário da evidência<input id="dem52e-data" type="datetime-local" value="${dem52eDataLocal(r.data_evidencia)}"><small>Horário de Brasília. Pode ficar em branco.</small></label><label>Ordem de exibição<input id="dem52e-ordem" type="number" min="0" max="2147483647" step="1" required value="${r.ordem}"><small>Números menores aparecem primeiro; empates seguem a data de inclusão.</small></label></div><p class="dem52e-editor-note">O arquivo original permanece o mesmo. Estas informações organizam a biblioteca do caso.</p><p id="dem52e-erro" class="dem52-cad-message dem52-cad-error" role="alert" hidden></p><button id="dem52e-recarregar" type="button" class="btn btn-ghost" hidden>Recarregar informações</button><footer><button id="dem52e-cancelar" type="button" class="btn btn-ghost">Cancelar</button><button id="dem52e-salvar" class="btn btn-primary" type="submit">Salvar informações</button></footer></form>`;
 dem52eEl('form').addEventListener('input',()=>{f.sujo=true;dem52eEl('erro').hidden=true;});
 dem52eEl('form').onsubmit=event=>{event.preventDefault();dem52eSalvar();};dem52eEl('cancelar').onclick=dem52eFecharEditor;dem52eEl('recarregar').onclick=dem52eRecarregarEditor;dem52eEstadoEditor();
}
function dem52eEstadoEditor(){
 const f=dem52e.editor;if(!f)return;const block=f.ocupado||f.incerto||f.conflito;
 for(const id of ['categoria','legenda','data','ordem'])dem52eEl(id).disabled=block;
 dem52eEl('salvar').disabled=f.ocupado||f.conflito;dem52eEl('salvar').textContent=f.ocupado?'Conferindo…':f.incerto?'Verificar salvamento':'Salvar informações';
 dem52eEl('cancelar').disabled=f.ocupado||f.incerto;dem52eEl('recarregar').hidden=!f.conflito;dem52eEl('recarregar').disabled=f.ocupado;dem52eEl('form').setAttribute('aria-busy',String(f.ocupado));
}
function dem52eMensagem(m){if(dem52eEl('erro')){dem52eEl('erro').textContent=m;dem52eEl('erro').hidden=false;}}
async function dem52eFecharEditor(){
 const f=dem52e.editor;if(!f||f.ocupado||f.incerto||f.confirmando)return;
 if(f.sujo){const valid=dem52eContexto();if(!await dem52eConfirmar(f,'Descartar as alterações desta evidência?',{title:'Sair da edição?',confirmText:'Descartar alterações',variant:'warning'})||!valid()||dem52e.editor!==f)return;}
 dem52eEncerrarEditor();
}
async function dem52eConfirmar(f,texto,opcoes){
 const d=dem52eDialogo(),valid=dem52eContexto();f.confirmando=true;d.close();
 try{return await ap52Confirm(texto,opcoes);}
 finally{f.confirmando=false;if(valid()&&dem52e.editor===f&&!d.open)d.showModal();}
}
function dem52eEncerrarEditor(){dem52e.editor?.controle?.abort();dem52e.editor=null;const d=dem52eEl('dialogo');if(d){if(d.open)d.close();d.replaceChildren();}}
function dem52eMesmoConteudo(row,p){return row.tipo===p.tipo&&(row.legenda||null)===p.legenda&&row.ordem===p.ordem&&(row.data_evidencia?new Date(row.data_evidencia).getTime():null)===(p.data_evidencia?new Date(p.data_evidencia).getTime():null);}
async function dem52eLerAtual(f,signal){const {data,error}=await sb.from('caso_evidencias').select(DEM52E_COLUNAS).eq('id',f.row.id).eq('caso_id',f.row.caso_id).eq('gerencia',f.row.gerencia).is('deleted_at',null).abortSignal(signal).maybeSingle();if(error)throw error;if(data&&data.id!==f.row.id)throw Error('Resposta incompleta.');return data?dem52eValidar(data,dem52e.caso):null;}
async function dem52eRecarregarEditor(){
 const f=dem52e.editor;if(!f||f.ocupado)return;const valid=dem52eContexto();
 if(!await dem52eConfirmar(f,'Recarregar vai substituir seu preenchimento pelas informações atuais. Continuar?',{title:'Recarregar evidência?',confirmText:'Recarregar',variant:'warning'})||!valid()||dem52e.editor!==f)return;
 f.ocupado=true;dem52eEstadoEditor();const ctl=new AbortController();f.controle=ctl;const timer=setTimeout(()=>ctl.abort(),20000);
 try{const row=await dem52eLerAtual(f,ctl.signal);if(!valid()||dem52e.editor!==f)return;if(!row){dem52eEncerrarEditor();ap52Notify('A evidência não está mais disponível.',{variant:'warning'});dem52eCarregar();return;}f.row=row;f.payload=null;f.sujo=false;f.conflito=false;f.incerto=false;dem52eRenderEditor();}
 catch{if(valid()&&dem52e.editor===f)dem52eMensagem('Não foi possível recarregar. Seu preenchimento foi mantido.');}
 finally{clearTimeout(timer);if(valid()&&dem52e.editor===f){f.ocupado=false;dem52eEstadoEditor();}}
}
async function dem52eSalvar(){
 const f=dem52e.editor;if(!f||f.ocupado||f.conflito)return;if(!dem52ePodeEditar()){dem52eMensagem('Seu perfil não permite alterar esta evidência.');return;}
 if(!f.payload){
  if(!dem52eEl('form').reportValidity())return;
  try{const tipo=dem52eEl('categoria').value,legenda=dem52eEl('legenda').value.trim()||null,ordem=Number(dem52eEl('ordem').value),date=dem52eEl('data').value;
   if(!Object.hasOwn(DEM52E_TIPOS,tipo)||!Number.isInteger(ordem)||ordem<0||ordem>2147483647)throw Error('Confira a categoria e a ordem de exibição.');
   f.payload=Object.freeze({tipo,legenda,ordem,data_evidencia:date===dem52eDataLocal(f.row.data_evidencia)?f.row.data_evidencia:dem52eDataISO(date)});
  }catch(err){dem52eMensagem(err.message);return;}
 }
 const valid=dem52eContexto(),ctl=new AbortController();f.controle=ctl;const timer=setTimeout(()=>ctl.abort(),20000);f.ocupado=true;dem52eEstadoEditor();
 const conflict=()=>{f.incerto=false;f.conflito=true;dem52eMensagem('Esta evidência mudou ou deixou de estar disponível. Seu preenchimento foi mantido. Recarregue as informações antes de continuar.');};
 try{
  let row=null;
  if(f.incerto){row=await dem52eLerAtual(f,ctl.signal);if(!valid()||dem52e.editor!==f)return;if(!row){conflict();return;}if(!dem52eMesmoConteudo(row,f.payload)&&row.updated_at!==f.row.updated_at){conflict();return;}if(!dem52eMesmoConteudo(row,f.payload))row=null;}
  if(!row){
   const res=await sb.from('caso_evidencias').update({...f.payload}).eq('id',f.row.id).eq('caso_id',f.row.caso_id).eq('gerencia',f.row.gerencia).eq('updated_at',f.row.updated_at).is('deleted_at',null).select(DEM52E_COLUNAS).abortSignal(ctl.signal).maybeSingle();
   if(!valid()||dem52e.editor!==f)return;
   if(res.error)throw res.error;
   row=res.data;if(!row){conflict();return;}
  }
  dem52eValidar(row,dem52e.caso);if(row.id!==f.row.id||!dem52eMesmoConteudo(row,f.payload))throw Error('Confirmação incompleta.');
  dem52eEncerrarEditor();ap52Notify('Informações da evidência salvas.');await dem52eCarregar();
 }catch(err){
  if(!valid()||dem52e.editor!==f)return;
  if(['42501','23503','23514','22007','22008','22P02','P0001'].includes(err?.code)){f.incerto=false;f.payload=null;dem52eMensagem(err.code==='42501'?'Seu acesso não permite alterar esta evidência.':'Não foi possível salvar. Confira os campos e se o caso continua disponível.');}
  else{f.incerto=true;dem52eMensagem('Não foi possível confirmar o salvamento. Use Verificar salvamento para conferir antes de tentar outra alteração.');}
 }finally{clearTimeout(timer);if(valid()&&dem52e.editor===f){f.ocupado=false;dem52eEstadoEditor();}}
}
function limparEvidenciasAP52(){if(typeof limparEnviosDriveAP52==='function')limparEnviosDriveAP52();dem52e.controle?.abort();dem52eEncerrarEditor();dem52e={caso:null,aberta:false,tipo:'',pagina:0,total:0,itens:[],estado:'inicio',consulta:dem52e.consulta+1,controle:null,editor:null};dem52eEl('area')?.remove();}
