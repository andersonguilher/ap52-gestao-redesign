/* AP5.2 v65.42.153 — Cadastro de Demanda, com conferência da Etapa 4.
   INSERT autenticado, RLS e auditoria existentes. O caso é criado/vinculado depois, por ação explícita (Etapa 5). */
'use strict';
let dem52Cadastro={aberto:false,sujo:false,ocupado:false,carregando:false,catalogos:null,id:null,envio:null,incerto:false,revisao:0,controle:null};
const DEM52_FORM_CAMPOS=['gerencia','origem','protocolo','recebimento','solicitante','servico','logradouro','numero','trecho','bairro','sub-bairro','prazo','observacao','coordenadas'];
function dem52FormEl(k){return document.getElementById('dem52-cad-'+k);}
function dem52PodeCadastrar(){return dem52Pode()&&pode28('demandas','cadastrar');}
function dem52Hoje(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`;}
// Reutiliza a fonte do Mapa das Gerências; não mantém uma segunda lista de localidades.
function dem52PopularSubBairrosCadastro(){
 const select=dem52FormEl('sub-bairro');
 if(!select)return;
 const atual=select.value;
 select.replaceChildren(new Option('Selecione, se houver', ''));
 if(typeof MAPA_SUBBAIRROS_AP52==='undefined'||!Array.isArray(MAPA_SUBBAIRROS_AP52))return;
 for(const grupo of MAPA_SUBBAIRROS_AP52){
  const optgroup=document.createElement('optgroup');optgroup.label=String(grupo.grupo||'');
  const categorias=[['Bairros associados',grupo.bairros||[]],['Sub-bairros e localidades',grupo.itens||[]]];
  for(const [titulo,entradas] of categorias){
   if(!entradas.length)continue;
   if((grupo.bairros||[]).length&&(grupo.itens||[]).length){
    const separador=new Option('— '+titulo+' —','');separador.disabled=true;optgroup.append(separador);
   }
   for(const [nome,bairro] of entradas){
    const option=new Option(String(nome),String(nome));
    option.dataset.bairro=String(bairro||'');
    option.dataset.tipo=titulo==='Bairros associados'?'bairro':'subbairro';
    optgroup.append(option);
   }
  }
  if(optgroup.children.length)select.append(optgroup);
 }
 // Mantém seleção quando a lista é reconstruída, sem escolher automaticamente outra rua/localidade.
 if([...select.options].some(opt=>!opt.disabled&&opt.value===atual))select.value=atual;
}
function dem52MontarCadastro(){
 const escopo=dem52El('escopo'),acoes=document.createElement('div');acoes.className='dem52-head-actions';escopo.before(acoes);acoes.append(escopo);
 const novo=document.createElement('button');novo.id='dem52-nova';novo.type='button';novo.className='btn btn-primary';novo.hidden=true;novo.textContent='+ Nova demanda';novo.addEventListener('click',abrirCadastroDemandaAP52);acoes.append(novo);
 const painel=document.createElement('section');painel.id='dem52-cadastro-painel';painel.className='dem52-panel dem52-cadastro-panel';painel.hidden=true;
 painel.innerHTML=`<header class="dem52-list-head"><div><div class="dem52-eyebrow">Registrar solicitação</div><h2 id="dem52-cad-titulo" tabindex="-1">Nova demanda</h2><p>Campos com * são obrigatórios.</p></div><span class="dem52-tag" data-status="recebida">Recebida</span></header>
 <form id="dem52-cadastro" class="dem52-cadastro" novalidate>
 <p id="dem52-cad-carga" class="dem52-cad-message" role="status" hidden></p><button type="button" id="dem52-cad-recarregar" class="btn btn-ghost" hidden>Carregar opções novamente</button>
 <fieldset><legend><span>1</span> Identificação da solicitação</legend><div class="dem52-cad-grid">
 <label>Gerência *<select id="dem52-cad-gerencia" required></select></label><div class="dem52-orig-control"><label>Origem *<select id="dem52-cad-origem" required><option value="">Selecione a origem</option></select></label><button type="button" id="dem52-orig-gerenciar" class="dem52-orig-abrir" hidden>Gerenciar origens</button></div>
 <label>Protocolo<input id="dem52-cad-protocolo" maxlength="150" placeholder="Número do SEI, 1746 ou ofício"><small>Preencha quando a solicitação tiver um número de referência.</small></label><label>Data de recebimento *<input type="date" id="dem52-cad-recebimento" required></label>
 <label class="dem52-cad-full">Solicitante<input id="dem52-cad-solicitante" maxlength="200" placeholder="Pessoa, órgão ou parlamentar que enviou a solicitação"></label>
 <label class="dem52-cad-full">Tipo de serviço *<select id="dem52-cad-servico" required><option value="">Selecione o tipo de serviço</option></select><small>Detalhes adicionais podem ser registrados em Observações.</small></label></div></fieldset>
 <fieldset><legend><span>2</span> Local do serviço</legend><div class="dem52-cad-grid">
 <label class="dem52-cad-full">Logradouro *<input id="dem52-cad-logradouro" required maxlength="250" placeholder="Nome da rua, avenida ou estrada" autocomplete="off"></label><label>Número<input id="dem52-cad-numero" maxlength="50" placeholder="Ex.: 123 ou s/n"></label><label>Bairro<input id="dem52-cad-bairro" maxlength="150" placeholder="Ex.: Campo Grande"></label>
 <label class="dem52-cad-full">Trecho ou ponto de referência<input id="dem52-cad-trecho" maxlength="300" placeholder="Ex.: entre duas ruas, próximo à escola ou à praça"></label><label class="dem52-cad-full">Sub-bairro / localidade<select id="dem52-cad-sub-bairro"><option value="">Selecione, se houver</option></select><small>Mesma lista do Mapa das Gerências. Se a localidade não aparecer, detalhe em Trecho ou Observações.</small></label>
 </div><details class="dem52-cad-coordenadas"><summary>Coordenadas</summary><label class="dem52-cad-full" for="dem52-cad-coordenadas">Latitude e longitude<input id="dem52-cad-coordenadas" inputmode="text" autocomplete="off" spellcheck="false" maxlength="65" placeholder="Ex.: -22.9064938, -43.5583592" aria-describedby="dem52-cad-coordenadas-ajuda"></label><p id="dem52-cad-coordenadas-ajuda">Informe os dois números, separados por vírgula, ponto e vírgula ou espaço. Pode deixar em branco se não souber a localização exata.</p></details></fieldset>
 <fieldset><legend><span>3</span> Informações complementares</legend><div class="dem52-cad-grid"><label>Prazo para resposta<input type="date" id="dem52-cad-prazo"></label><label class="dem52-cad-full">Observações<textarea id="dem52-cad-observacao" maxlength="4000" rows="4" placeholder="Detalhes que ajudem a entender ou localizar a solicitação"></textarea></label></div></fieldset>
 <p class="dem52-cad-note">Ao salvar, a demanda entra como <b>Recebida</b>, pronta para triagem.</p>
 <p id="dem52-cad-erro" class="dem52-cad-message dem52-cad-error" role="alert" hidden></p>
 <footer class="dem52-cad-footer"><button type="button" id="dem52-cad-cancelar" class="btn btn-ghost">Cancelar</button><button type="submit" id="dem52-cad-salvar" class="btn btn-primary">Salvar demanda</button></footer></form>`;
 const principal=document.querySelector('#view-demandas .dem52-principal');principal.prepend(painel);
 dem52PopularSubBairrosCadastro();
 const sucesso=document.createElement('div');sucesso.id='dem52-sucesso';sucesso.className='dem52-cad-success';sucesso.hidden=true;sucesso.setAttribute('role','status');principal.prepend(sucesso);
 dem52El('lista').closest('section').id='dem52-lista-painel';
 dem52El('cadastro').addEventListener('submit',e=>{e.preventDefault();salvarDemandaAP52();});
 dem52El('cadastro').addEventListener('input',e=>{dem52Cadastro.sujo=true;e.target.setCustomValidity?.('');dem52FormEl('erro').hidden=true;});
 dem52FormEl('cancelar').addEventListener('click',cancelarCadastroDemandaAP52);
 dem52FormEl('recarregar').addEventListener('click',dem52CarregarCatalogosCadastro);
}
function atualizarCadastroDemandasAP52(){
 dem52El('nova').hidden=!dem52PodeCadastrar()||dem52Cadastro.aberto;
 dem52El('nova').disabled=dem52Cadastro.ocupado||dem52Cadastro.carregando;
 dem52El('nova').textContent=dem52Cadastro.sujo||dem52Cadastro.incerto?'Continuar cadastro':'+ Nova demanda';
}
function dem52MostrarCadastro(abrir){
 dem52Cadastro.aberto=abrir;dem52El('cadastro-painel').hidden=!abrir;dem52El('filtros').hidden=abrir;dem52El('lista-painel').hidden=abrir;atualizarCadastroDemandasAP52();dem52RenderContexto();
}
async function abrirCadastroDemandaAP52(){
 if(dem52Cadastro.ocupado)return;
 if(!dem52PodeCadastrar()){aviso28('Seu perfil não permite cadastrar demandas.');return;}
 if(!dem52Cadastro.id){
  dem52El('cadastro').reset();dem52Cadastro.id=crypto.randomUUID();dem52Cadastro.sujo=false;
  const gc=dem52FormEl('gerencia');gc.innerHTML=dem52Global()?'<option value="">Selecione a Gerência</option>'+DEM52_UNIDADES.map(g=>`<option value="${g}">${g}</option>`).join(''):`<option value="${dem52Texto(acesso28.user.gerencia)}">${dem52Texto(acesso28.user.gerencia)}</option>`;
  gc.disabled=!dem52Global();if(dem52Global()&&DEM52_UNIDADES.includes(dem52El('gerencia').value))gc.value=dem52El('gerencia').value;
  dem52FormEl('recebimento').value=dem52Hoje();dem52FormEl('erro').hidden=true;
 }
 dem52El('sucesso').hidden=true;dem52MostrarCadastro(true);if(typeof dem52AtualizarGerenciaOrigens==='function')dem52AtualizarGerenciaOrigens();dem52FormEl('titulo').focus({preventScroll:true});dem52FormEl('titulo').scrollIntoView({block:'start'});
 if(!dem52Cadastro.incerto)await dem52CarregarCatalogosCadastro();else dem52BloquearCadastro(false);
}
async function dem52CarregarCatalogosCadastro(){
 if(!dem52PodeCadastrar()||dem52Cadastro.ocupado||dem52Cadastro.incerto)return;
 const revisao=++dem52Cadastro.revisao,generation=ac28Generation;dem52Cadastro.carregando=true;dem52BloquearCadastro(false);
 dem52FormEl('carga').hidden=false;dem52FormEl('carga').textContent='Carregando origens e tipos de serviço…';dem52FormEl('recarregar').hidden=true;
 try{
  const [o,s]=await Promise.all(['demanda_origens','demanda_tipos_servico'].map(t=>sb.from(t).select('id,nome').is('deleted_at',null).eq('ativo',true).order('ordem').order('nome')));
  if(revisao!==dem52Cadastro.revisao||generation!==ac28Generation)return;
  if(o.error||s.error||!Array.isArray(o.data)||!Array.isArray(s.data)||!o.data.length)throw Error('Catálogos indisponíveis.');
  dem52Cadastro.catalogos={origens:o.data,servicos:s.data};
  for(const [campo,itens,vazio]of [['origem',o.data,'Selecione a origem'],['servico',s.data,'Selecione o tipo de serviço']]){const el=dem52FormEl(campo),atual=el.value;el.innerHTML=`<option value="">${vazio}</option>`+itens.map(x=>`<option value="${dem52Texto(x.id)}">${dem52Texto(x.nome)}</option>`).join('');el.value=itens.some(x=>x.id===atual)?atual:'';}
  dem52FormEl('carga').hidden=true;
 }catch{if(revisao!==dem52Cadastro.revisao||generation!==ac28Generation)return;dem52Cadastro.catalogos=null;dem52FormEl('carga').hidden=false;dem52FormEl('carga').textContent='Não foi possível carregar as opções do cadastro. Verifique a conexão e tente novamente.';dem52FormEl('recarregar').hidden=false;}
 finally{if(revisao===dem52Cadastro.revisao&&generation===ac28Generation){dem52Cadastro.carregando=false;dem52BloquearCadastro(false);}}
}
function dem52BloquearCadastro(ocupado){
 dem52Cadastro.ocupado=ocupado;
 for(const k of DEM52_FORM_CAMPOS)dem52FormEl(k).disabled=ocupado||dem52Cadastro.carregando||dem52Cadastro.incerto||(k==='gerencia'&&!dem52Global());
 dem52FormEl('salvar').disabled=ocupado||dem52Cadastro.carregando||(!dem52Cadastro.catalogos&&!dem52Cadastro.incerto);
 dem52FormEl('salvar').textContent=ocupado?(dem52Cadastro.incerto?'Verificando…':'Salvando…'):(dem52Cadastro.incerto?'Verificar salvamento':'Salvar demanda');
 dem52FormEl('cancelar').disabled=ocupado;dem52FormEl('cancelar').textContent=dem52Cadastro.incerto?'Voltar à lista':'Cancelar';
 dem52El('cadastro').setAttribute('aria-busy',String(ocupado||dem52Cadastro.carregando));
 atualizarCadastroDemandasAP52();
 if(typeof dem52AtualizarAcoesDuplicidade==='function')dem52AtualizarAcoesDuplicidade();
}
function dem52ErroCampo(k,mensagem){const el=dem52FormEl(k);el.setCustomValidity(mensagem);el.reportValidity();el.focus();throw Error(mensagem);}
// Par único exibido ao usuário; mantém as colunas latitude e longitude existentes no Supabase.
function dem52LerParCoordenadasCadastro(texto){
 const entrada=String(texto||'').trim();
 if(!entrada)return null;
 // Aceita separação por vírgula, ponto e vírgula ou espaço, e decimal com ponto ou vírgula.
 // Não tenta adivinhar latitudes ou trocar a ordem dos números.
 const par=entrada.match(/^([+-]?\d{1,3}(?:[.,]\d+)?)(?:\s*[;,]\s*|\s+)([+-]?\d{1,3}(?:[.,]\d+)?)$/);
 if(!par)dem52ErroCampo('coordenadas','Informe latitude e longitude, nesta ordem. Ex.: -22.9064938, -43.5583592.');
 const latitude=Number(par[1].replace(',','.')),longitude=Number(par[2].replace(',','.'));
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){
  dem52ErroCampo('coordenadas','Coordenadas fora dos limites válidos. Latitude até 90° e longitude até 180°.');
 }
 return {latitude,longitude};
}
function dem52LerCadastro(){
 for(const k of DEM52_FORM_CAMPOS)dem52FormEl(k).setCustomValidity('');
 if(!dem52El('cadastro').reportValidity())return null;
 const valor=k=>dem52FormEl(k).value.trim();
 const gc=dem52Global()?valor('gerencia'):acesso28.user.gerencia;
 if(!DEM52_UNIDADES.includes(gc))dem52ErroCampo('gerencia','Selecione uma Gerência válida.');
 if(!valor('logradouro'))dem52ErroCampo('logradouro','Preencha este campo.');
 if(!dem52Cadastro.catalogos?.origens.some(x=>x.id===valor('origem')))dem52ErroCampo('origem','Selecione uma origem disponível.');
 const tipo=dem52Cadastro.catalogos?.servicos.find(x=>x.id===valor('servico'));
 if(!tipo)dem52ErroCampo('servico','Selecione um tipo de serviço disponível.');
 // Campo assunto continua obrigatório no banco: resumo derivado de dados digitados, sem cadastro extra.
 const assuntoGerado=`${tipo.nome.trim()} — ${valor('logradouro')}`.slice(0,300);
 const parCoordenadas=dem52LerParCoordenadasCadastro(valor('coordenadas'));
 const latitude=parCoordenadas?.latitude??null,longitude=parCoordenadas?.longitude??null;
 return {id:dem52Cadastro.id,gerencia:gc,origem_id:valor('origem'),protocolo:valor('protocolo')||null,data_recebimento:valor('recebimento'),solicitante:valor('solicitante')||null,assunto:assuntoGerado,tipo_servico_id:tipo.id,logradouro:valor('logradouro'),numero:valor('numero')||null,trecho_referencia:valor('trecho')||null,bairro:valor('bairro')||null,sub_bairro:valor('sub-bairro')||null,prazo:valor('prazo')||null,observacao:valor('observacao')||null,latitude,longitude,status:'recebida'};
}
async function salvarDemandaAP52(){
 if(dem52Cadastro.ocupado||dem52Cadastro.carregando)return;
 if(!dem52PodeCadastrar()){dem52FormEl('erro').textContent='Seu perfil não permite cadastrar demandas.';dem52FormEl('erro').hidden=false;return;}
 if(!dem52Cadastro.aberto||!dem52Cadastro.id)return;
 dem52FormEl('erro').hidden=true;
 try{if(!dem52Cadastro.envio){
  const p=dem52LerCadastro();if(!p)return;
  const generation=ac28Generation,usuario=acesso28.user.user_id;
  if(typeof dem52VerificarAntesDeSalvar!=='function')throw Error('Não foi possível carregar a conferência dos registros. Atualize a página para continuar.');
  if(!await dem52VerificarAntesDeSalvar(p))return;
  if(generation!==ac28Generation||acesso28?.user?.user_id!==usuario||!dem52PodeCadastrar())return;
  dem52Cadastro.envio=Object.freeze(p);
 }}catch(e){dem52FormEl('erro').textContent=e.message;dem52FormEl('erro').hidden=false;return;}
 const payload=dem52Cadastro.envio,generation=ac28Generation,usuario=acesso28.user.user_id;
 const valido=()=>generation===ac28Generation&&acesso28?.user?.user_id===usuario&&dem52Pode();
 const controle=new AbortController();dem52Cadastro.controle=controle;const timeout=setTimeout(()=>controle.abort(),25000);dem52BloquearCadastro(true);
 const confirma=d=>d?.id===payload.id&&d.gerencia===payload.gerencia&&d.created_by===usuario;
 const recuperar=async()=>{const r=await sb.from('demandas').select(DEM52_COLUNAS).eq('id',payload.id).eq('gerencia',payload.gerencia).is('deleted_at',null).abortSignal(controle.signal).maybeSingle();if(r.error)throw r.error;return r.data;};
 try{
  let registro=null;
  if(dem52Cadastro.incerto){registro=await recuperar();if(!valido())return;if(registro&&!confirma(registro))throw Error('Confirmação indisponível.');}
  if(!registro){
   const {data,error}=await sb.from('demandas').insert({...payload}).select(DEM52_COLUNAS).abortSignal(controle.signal).single();
   if(!valido())return;
   if(error){
    if(['42501','23503','23514','22007','22008','22P02','P0001'].includes(error.code))throw error;
    dem52Cadastro.incerto=true;registro=await recuperar();if(!registro)throw error;
   }else registro=data;
  }
  if(!valido())return;
  if(!confirma(registro)){dem52Cadastro.incerto=true;throw Error('Não foi possível confirmar o registro.');}
  dem52ConfirmarCadastro(registro);await carregarDemandasAP52(false,true);
  if(!valido())return;dem52SelecionarSalva(registro);
 }catch(e){
  if(!valido())return;
  const definitivo=['42501','23503','23514','22007','22008','22P02','P0001'].includes(e?.code);
  if(!definitivo)dem52Cadastro.incerto=true;
  if(!dem52Cadastro.incerto)dem52Cadastro.envio=null;
  const mensagem=dem52Cadastro.incerto?'Não foi possível confirmar o salvamento. Use Verificar salvamento antes de iniciar outro cadastro.':e.code==='42501'?'Seu acesso não permite cadastrar nesta Gerência. Atualize a página e confira sua conta.':['23503','P0001'].includes(e.code)?'Uma opção do cadastro mudou. Carregue as opções novamente e confira a origem e o serviço.':'Confira os campos preenchidos e tente salvar novamente.';
  dem52FormEl('erro').textContent=mensagem;dem52FormEl('erro').hidden=false;
  if(['23503','P0001'].includes(e.code)&&!dem52Cadastro.incerto)dem52FormEl('recarregar').hidden=false;
 }finally{clearTimeout(timeout);if(valido()){dem52Cadastro.controle=null;dem52BloquearCadastro(false);}}
}
function dem52ConfirmarCadastro(registro){
 if(typeof limparDuplicidadeDemandaAP52==='function')limparDuplicidadeDemandaAP52();
 dem52.confirmado=registro;dem52Cadastro.id=null;dem52Cadastro.envio=null;dem52Cadastro.incerto=false;dem52Cadastro.sujo=false;dem52MostrarCadastro(false);dem52El('cadastro').reset();
 dem52El('filtros').reset();dem52PrepararEscopo();if(dem52Global())dem52El('gerencia').value=registro.gerencia;dem52El('campo').dispatchEvent(new Event('change'));
 const sucesso=dem52El('sucesso');sucesso.hidden=false;sucesso.innerHTML=`<div><strong>Demanda cadastrada com sucesso.</strong><p>${dem52Texto(registro.protocolo||registro.assunto)} · ${dem52Texto(registro.gerencia)} · Recebida</p></div><button type="button" class="btn btn-ghost" id="dem52-ver-salva">Ver detalhes</button>`;
 document.getElementById('dem52-ver-salva').addEventListener('click',()=>{dem52SelecionarSalva(registro);dem52El('contexto-titulo').focus({preventScroll:true});if(matchMedia('(max-width:1100px)').matches)dem52El('contexto-titulo').scrollIntoView({block:'start'});});
 if(typeof dem52CasosAposCadastro==='function')dem52CasosAposCadastro(registro,sucesso);
 if(document.getElementById('view-demandas').style.display!=='none')sucesso.scrollIntoView({block:'start'});
}
function dem52SelecionarSalva(registro){
 dem52.selecionada=registro.id;
 dem52El('lista').querySelectorAll('[data-dem52-id]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.dem52Id===registro.id)));
 dem52RenderContexto();
}
async function cancelarCadastroDemandaAP52(){
 if(dem52Cadastro.ocupado)return;
 if(dem52Cadastro.incerto){dem52MostrarCadastro(false);return;}
 const generation=ac28Generation;
 if(dem52Cadastro.sujo&&!await ap52Confirm('Os dados deste cadastro ainda não foram salvos. Deseja descartar?',{title:'Cancelar cadastro?',confirmText:'Descartar cadastro',variant:'warning'}))return;
 if(generation!==ac28Generation)return;
 limparCadastroDemandaAP52();dem52MostrarCadastro(false);dem52El('nova').focus({preventScroll:true});
}
function dem52RenderContextoCadastro(){
 if(!dem52Cadastro.aberto)return false;
 dem52El('fechar').hidden=true;dem52El('contexto-titulo').textContent='Cadastro da demanda';
 dem52El('contexto').innerHTML=`<div class="dem52-context-intro"><div class="dem52-eyebrow">${dem52Texto(dem52Escopo())}</div><h3>Uma solicitação por cadastro</h3><p>Registre o documento ou pedido recebido. Use o protocolo para identificar a solicitação.</p></div><div class="dem52-help"><h3>Endereço com referência</h3><p>Informe o logradouro e, quando possível, número ou trecho. Isso ajuda a localizar o serviço.</p></div><div class="dem52-help"><h3>O que acontece ao salvar</h3><p>A demanda fica registrada como Recebida para triagem. Os processos administrativos continuam no SEI.</p></div>`;return true;
}
function limparCadastroDemandaAP52(){
 if(typeof limparDuplicidadeDemandaAP52==='function')limparDuplicidadeDemandaAP52();
 dem52Cadastro.controle?.abort();dem52Cadastro.revisao++;dem52Cadastro.aberto=false;dem52Cadastro.sujo=false;dem52Cadastro.ocupado=false;dem52Cadastro.carregando=false;dem52Cadastro.catalogos=null;dem52Cadastro.id=null;dem52Cadastro.envio=null;dem52Cadastro.incerto=false;dem52Cadastro.controle=null;
 dem52El('cadastro').reset();dem52El('cadastro-painel').hidden=true;dem52El('filtros').hidden=false;dem52El('lista-painel').hidden=false;dem52El('sucesso').hidden=true;dem52El('sucesso').replaceChildren();
 for(const k of ['gerencia','origem','servico'])dem52FormEl(k).replaceChildren();dem52FormEl('erro').textContent='';dem52FormEl('erro').hidden=true;dem52FormEl('carga').hidden=true;dem52FormEl('recarregar').hidden=true;dem52El('nova').hidden=true;
}
dem52MontarCadastro();
