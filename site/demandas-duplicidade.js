/* AP5.2 v65.42.151 — Etapa 4: conferência de possíveis correspondências.
   Consulta autenticada sob RLS. Registros existentes nunca são unidos ou alterados. */
'use strict';
const DEM52_CASO_STATUS={novo:'Novo',a_vistoriar:'A vistoriar',vistoriado:'Vistoriado',a_programar:'A programar',programado:'Programado',em_execucao:'Em execução',aguardando_terceiro:'Aguardando terceiro',concluido:'Concluído',sem_possibilidade_de_atendimento:'Sem possibilidade de atendimento',cancelado:'Cancelado'};
const DEM52_DUP_CAMPOS=['gerencia','origem','protocolo','logradouro','numero','trecho','servico','recebimento','coordenadas'];
let dem52Duplicidade={resultado:null,dados:null,assinatura:null,verificando:false,consulta:0,controle:null};
function dem52DupEl(k){return document.getElementById('dem52-dup-'+k);}
function dem52MontarDuplicidade(){
 const painel=document.createElement('section');painel.id='dem52-dup-painel';painel.className='dem52-dup-panel';painel.setAttribute('aria-labelledby','dem52-dup-titulo');
 painel.innerHTML=`<header class="dem52-dup-head"><div><h3 id="dem52-dup-titulo" tabindex="-1">Conferir registros existentes</h3><p>Antes de salvar, vamos procurar protocolos e locais semelhantes nesta Gerência.</p></div><button type="button" class="btn btn-ghost" id="dem52-dup-verificar">Verificar agora</button></header>
 <p id="dem52-dup-mensagem" class="dem52-dup-message" role="status" hidden></p><div id="dem52-dup-resultados"></div>
 <label id="dem52-dup-confirmacao" class="dem52-dup-confirmacao" hidden><input type="checkbox" id="dem52-dup-conferido"><span>Conferi os registros apresentados e quero cadastrar esta solicitação como uma demanda independente.</span></label>`;
 document.querySelector('#dem52-cadastro .dem52-cad-note').before(painel);
 dem52DupEl('verificar').addEventListener('click',()=>dem52VerificarDuplicidade());
 dem52DupEl('conferido').addEventListener('change',dem52AtualizarAcoesDuplicidade);
 for(const campo of DEM52_DUP_CAMPOS){const el=dem52FormEl(campo);el.addEventListener('input',dem52InvalidarDuplicidade);el.addEventListener('change',dem52InvalidarDuplicidade);}
}
function dem52DadosDuplicidade(payload){
 if(payload)return {gerencia:payload.gerencia,origem_id:payload.origem_id,protocolo:payload.protocolo,logradouro:payload.logradouro,numero:payload.numero,trecho_referencia:payload.trecho_referencia,tipo_servico_id:payload.tipo_servico_id,data_recebimento:payload.data_recebimento,latitude:payload.latitude,longitude:payload.longitude};
 const valor=k=>dem52FormEl(k).value.trim(),gc=dem52Global()?valor('gerencia'):acesso28?.user?.gerencia;
 if(!DEM52_UNIDADES.includes(gc))throw Error('Escolha a Gerência para conferir os registros.');
 // Mesma validação e mesma ordem de coordenadas usadas pelo salvamento do cadastro.
 // Mantém latitude e longitude separados somente no payload enviado à RPC existente.
 const parCoordenadas=dem52LerParCoordenadasCadastro(valor('coordenadas'));
 const latitude=parCoordenadas?.latitude??null,longitude=parCoordenadas?.longitude??null;
 if(!valor('logradouro')&&!(valor('protocolo')&&valor('origem'))&&latitude===null)throw Error('Informe o logradouro ou o protocolo com a origem para iniciar a conferência.');
 return {gerencia:gc,origem_id:valor('origem')||null,protocolo:valor('protocolo')||null,logradouro:valor('logradouro')||null,numero:valor('numero')||null,trecho_referencia:valor('trecho')||null,tipo_servico_id:valor('servico')||null,data_recebimento:valor('recebimento')||null,latitude,longitude};
}
function dem52ValidarDuplicidade(data,gc){
 if(!data||data.versao!==1||data.gerencia!==gc||data.limite_por_tipo!==10||data.raio_metros!==80)throw Error('Resultado de conferência incompleto.');
 for(const tipo of ['demandas','casos']){
  const grupo=data[tipo];if(!grupo||!Number.isSafeInteger(grupo.total)||grupo.total<0||!Array.isArray(grupo.itens)||grupo.itens.length!==Math.min(grupo.total,10))throw Error('Resultado de conferência incompleto.');
  const ids=new Set();for(const item of grupo.itens){if(typeof item.id!=='string'||!item.id||item.gerencia!==gc||!Array.isArray(item.motivos)||!item.motivos.length||ids.has(item.id))throw Error('Resultado de conferência inválido.');ids.add(item.id);}
 }
 return data;
}
function dem52AssinaturaDuplicidade(dados,data){
 return JSON.stringify([dados,...['demandas','casos'].map(tipo=>[data[tipo].total,data[tipo].itens.map(x=>[x.id,x.updated_at,x.status,x.motivos])])]);
}
function dem52TemCorrespondencias(){const r=dem52Duplicidade.resultado;return !!r&&(r.demandas.total+r.casos.total)>0;}
function dem52AtualizarAcoesDuplicidade(){
 if(!dem52DupEl('verificar'))return;
 const indisponivel=dem52Cadastro.ocupado||dem52Cadastro.carregando||dem52Cadastro.incerto||!dem52PodeCadastrar();
 dem52DupEl('verificar').disabled=indisponivel;dem52DupEl('verificar').textContent=dem52Duplicidade.verificando?'Verificando…':'Verificar agora';
 dem52DupEl('conferido').disabled=indisponivel;
 const salvar=dem52FormEl('salvar');
 if(dem52Duplicidade.verificando){salvar.textContent='Verificando…';return;}
 if(!dem52Cadastro.ocupado&&!dem52Cadastro.incerto){
  const precisaConferir=dem52TemCorrespondencias()&&!dem52DupEl('conferido').checked;
  salvar.disabled=indisponivel||!dem52Cadastro.catalogos||precisaConferir;
  salvar.textContent=dem52TemCorrespondencias()?'Salvar demanda independente':'Salvar demanda';
 }
}
function dem52InvalidarDuplicidade(){
 if(dem52Cadastro.ocupado||dem52Cadastro.incerto)return;
 dem52Duplicidade.resultado=null;dem52Duplicidade.dados=null;dem52Duplicidade.assinatura=null;
 dem52DupEl('resultados').replaceChildren();dem52DupEl('confirmacao').hidden=true;dem52DupEl('conferido').checked=false;
 dem52DupEl('mensagem').hidden=false;dem52DupEl('mensagem').dataset.estado='pendente';dem52DupEl('mensagem').textContent='Os dados da busca mudaram. Vamos conferir novamente antes de salvar.';dem52AtualizarAcoesDuplicidade();
}
async function dem52VerificarDuplicidade(payload){
 if(dem52Cadastro.ocupado||dem52Cadastro.carregando||dem52Cadastro.incerto||!dem52PodeCadastrar()||!dem52Cadastro.aberto)return null;
 let dados;
 try{dados=dem52DadosDuplicidade(payload);}catch(e){dem52DupEl('mensagem').hidden=false;dem52DupEl('mensagem').dataset.estado='erro';dem52DupEl('mensagem').textContent=e.message;return null;}
 const anterior=dem52Duplicidade.assinatura,conferido=dem52DupEl('conferido').checked;
 const consulta=++dem52Duplicidade.consulta,generation=ac28Generation,usuario=acesso28.user.user_id;
 const valido=()=>consulta===dem52Duplicidade.consulta&&generation===ac28Generation&&acesso28?.user?.user_id===usuario&&dem52PodeCadastrar()&&dem52Cadastro.aberto;
 const controle=new AbortController();dem52Duplicidade.controle=controle;dem52Duplicidade.verificando=true;
 const timeout=setTimeout(()=>controle.abort(),15000);dem52BloquearCadastro(true);
 dem52DupEl('mensagem').hidden=false;dem52DupEl('mensagem').dataset.estado='carregando';dem52DupEl('mensagem').textContent='Conferindo protocolos, endereços e casos abertos…';
 try{
  const {data,error}=await sb.rpc('ap52_demandas_buscar_semelhantes',{p_dados:dados}).abortSignal(controle.signal);
  if(!valido())return null;if(error)throw error;
  const resultado=dem52ValidarDuplicidade(data,dados.gerencia),assinatura=dem52AssinaturaDuplicidade(dados,resultado);
  dem52Duplicidade.resultado=resultado;dem52Duplicidade.dados=dados;dem52Duplicidade.assinatura=assinatura;
  dem52RenderDuplicidade();dem52DupEl('conferido').checked=conferido&&anterior===assinatura;
  return resultado;
 }catch(e){
  if(!valido())return null;
  dem52Duplicidade.resultado=null;dem52Duplicidade.dados=null;dem52Duplicidade.assinatura=null;
  dem52DupEl('resultados').replaceChildren();dem52DupEl('confirmacao').hidden=true;dem52DupEl('conferido').checked=false;
  dem52DupEl('mensagem').hidden=false;dem52DupEl('mensagem').dataset.estado='erro';dem52DupEl('mensagem').textContent=e?.code==='42501'?'Seu acesso não permite conferir esta Gerência. Atualize a página e confira sua conta.':'Não foi possível conferir os registros. Seus dados continuam preenchidos. Use Verificar agora para tentar novamente.';
  return null;
 }finally{clearTimeout(timeout);if(valido()){dem52Duplicidade.verificando=false;dem52Duplicidade.controle=null;dem52BloquearCadastro(false);}}
}
async function dem52VerificarAntesDeSalvar(payload){
 const resultado=await dem52VerificarDuplicidade(payload);if(!resultado)return false;
 if(!dem52TemCorrespondencias()||dem52DupEl('conferido').checked)return true;
 dem52DupEl('titulo').focus({preventScroll:true});dem52DupEl('painel').scrollIntoView({block:'start'});return false;
}
function dem52RenderDuplicidade(){
 const r=dem52Duplicidade.resultado,total=r.demandas.total+r.casos.total;
 dem52DupEl('mensagem').dataset.estado=total?'atencao':'ok';dem52DupEl('mensagem').textContent=total?'Encontramos registros que podem tratar desta solicitação. Confira os dados antes de cadastrar outra demanda.':'Nenhuma correspondência encontrada nesta conferência. A verificação será repetida ao salvar.';
 dem52DupEl('confirmacao').hidden=!total;dem52DupEl('conferido').checked=false;
 const linha=(nome,valor)=>`<div><dt>${nome}</dt><dd>${dem52Texto(valor||'Não informado')}</dd></div>`;
 const card=(d,tipo)=>{
  const demanda=tipo==='demandas',motivos=[];
  if(d.motivos.includes('mesmo_protocolo'))motivos.push('Mesmo protocolo e origem');
  if(d.motivos.includes('mesmo_logradouro'))motivos.push(d.motivos.includes('mesmo_numero')?'Mesmo logradouro e número':d.motivos.includes('mesmo_trecho')?'Mesmo logradouro e trecho':'Mesmo logradouro: confira o trecho');
  if(d.motivos.includes('local_proximo'))motivos.push(`Local a cerca de ${d.distancia_m??'80'} m`);
  if(d.motivos.includes('mesmo_servico'))motivos.push('Mesmo tipo de serviço');
  return `<article class="dem52-dup-card"><div class="dem52-dup-card-top"><strong>${dem52Texto(demanda?(d.protocolo||'Sem protocolo'):d.codigo)}</strong><span class="dem52-tag" data-status="${dem52Texto(d.status)}">${dem52Texto((demanda?DEM52_STATUS:DEM52_CASO_STATUS)[d.status]||'Situação não informada')}</span></div><h4>${dem52Texto(d.titulo)}</h4><p>${dem52Texto(dem52Endereco(d))}</p><p class="dem52-dup-resumo">${dem52Texto(d.gerencia)} · ${dem52Texto(d.servico?.nome||'Serviço não definido')} · ${demanda?'Recebida':'Aberto'} em ${dem52Data(d.data_recebimento)}</p><ul class="dem52-dup-motivos">${motivos.map(m=>`<li>${dem52Texto(m)}</li>`).join('')}</ul><details><summary>Conferir ${demanda?'demanda':'caso'}</summary><dl class="dem52-meta">${demanda?linha('Origem',d.origem?.nome)+linha('Solicitante',d.solicitante)+linha('Prazo',dem52Data(d.prazo)):linha('Vistoria',d.data_vistoria?dem52Data(d.data_vistoria):null)+linha('Programação',d.data_programacao?dem52Data(d.data_programacao):null)}${linha('Bairro / sub-bairro',[d.bairro,d.sub_bairro].filter(Boolean).join(' / '))}</dl>${d.observacao?`<p class="dem52-observacao">${dem52Texto(d.observacao)}</p>`:''}${d.diagnostico?`<p class="dem52-observacao">${dem52Texto(d.diagnostico)}</p>`:''}</details></article>`;
 };
 dem52DupEl('resultados').innerHTML=['demandas','casos'].filter(t=>r[t].total).map(tipo=>`<section class="dem52-dup-grupo"><h4>${tipo==='demandas'?'Demandas registradas':'Casos operacionais abertos'} <span>${r[tipo].total}</span></h4>${r[tipo].total>r[tipo].itens.length?`<p class="dem52-dup-limite">Mostrando ${r[tipo].itens.length} de ${r[tipo].total}. Informe número, trecho ou tipo de serviço para tornar a busca mais específica.</p>`:''}<div class="dem52-dup-cards">${r[tipo].itens.map(d=>card(d,tipo)).join('')}</div></section>`).join('');
}
function limparDuplicidadeDemandaAP52(){
 dem52Duplicidade.controle?.abort();dem52Duplicidade.consulta++;dem52Duplicidade.verificando=false;dem52Duplicidade.controle=null;dem52Duplicidade.resultado=null;dem52Duplicidade.dados=null;dem52Duplicidade.assinatura=null;
 if(dem52DupEl('resultados')){dem52DupEl('resultados').replaceChildren();dem52DupEl('confirmacao').hidden=true;dem52DupEl('conferido').checked=false;dem52DupEl('mensagem').hidden=true;dem52DupEl('mensagem').textContent='';}
}
dem52MontarDuplicidade();
