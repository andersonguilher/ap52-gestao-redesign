/* AP5.2 — Etapa Origem R1. Catálogo já existente: demanda_origens.
   Nenhum dado é gravado ao carregar a tela. Alterações requerem clique,
   confirmação individual, perfil com aprovar e escopo global, além da RLS. */
'use strict';
const dem52OrigensGestao={aberto:false,ocupado:false,confirmando:false,carregando:false,itens:[],revisao:0};
const DEM52_ORIGENS_SUGESTOES=['SUB03/CONSERVAÇÃO','CONSERVAÇÃO + SUB.Z.O II'];
function dem52PodeGerenciarOrigens(){
 return typeof dem52Global==='function'&&dem52Global()&&
  typeof pode28==='function'&&pode28('demandas','aprovar')&&dem52PodeCadastrar()&&
  !!dem52Cadastro?.aberto&&!dem52Cadastro.incerto&&!dem52Cadastro.ocupado;
}
function dem52AtualizarGerenciaOrigens(){
 const botao=document.getElementById('dem52-orig-gerenciar');
 if(botao)botao.hidden=!dem52PodeGerenciarOrigens()||!dem52Cadastro.aberto;
 if(dem52OrigensGestao.aberto&&!dem52PodeGerenciarOrigens())dem52FecharGerenciaOrigens();
}
function dem52OrigNomeNormalizado(s){
 return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
}
function dem52OrigCodigo(nome,itens){
 const base=dem52OrigNomeNormalizado(nome).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,65)||'nova';
 const prefixo='origem_'+base;
 if(!itens.some(x=>x.code===prefixo))return prefixo;
 return prefixo+'_'+crypto.randomUUID().replace(/-/g,'').slice(0,10);
}
function dem52OrigElement(id){return document.getElementById('dem52-orig-'+id);}
function dem52OrigAviso(texto,erro=false){const el=dem52OrigElement('aviso');el.textContent=texto;el.hidden=!texto;el.dataset.erro=erro?'1':'0';}
function dem52OrigBusy(valor){
 dem52OrigensGestao.ocupado=valor;
 for(const el of dem52OrigElement('dialogo').querySelectorAll('button,input'))el.disabled=valor;
 dem52OrigElement('dialogo').setAttribute('aria-busy',String(valor));
}
function dem52OrigDesenhar(){
 const permit=dem52PodeGerenciarOrigens();
 const ativos=dem52OrigensGestao.itens.filter(i=>i.ativo),inativos=dem52OrigensGestao.itens.filter(i=>!i.ativo);
 dem52OrigElement('contagem').textContent=`${ativos.length} ativas · ${inativos.length} inativas`;
 const render=itens=>itens.map(x=>`<li class="dem52-orig-item"><span><strong>${dem52Texto(x.nome)}</strong><small>${x.ativo?'Disponível para novos cadastros':'Preservada para histórico'}</small></span><button type="button" data-orig-id="${dem52Texto(x.id)}" data-orig-acao="${x.ativo?'desativar':'reativar'}" ${permit?'':'disabled'}>${x.ativo?'Excluir da lista':'Reativar'}</button></li>`).join('');
 dem52OrigElement('lista').innerHTML=render(ativos)+render(inativos);
 const opcoes=DEM52_ORIGENS_SUGESTOES.filter(x=>!dem52OrigensGestao.itens.some(i=>dem52OrigNomeNormalizado(i.nome)===dem52OrigNomeNormalizado(x)));
 dem52OrigElement('sugestoes').innerHTML=opcoes.map((n,i)=>`<button type="button" data-orig-sugestao="${i}">${dem52Texto(n)}</button>`).join('');
 dem52OrigElement('sugestoes').querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{dem52OrigElement('nome').value=opcoes[i];dem52OrigElement('nome').focus();dem52OrigAviso('');}));
}
async function dem52OrigCarregar(){
 if(!dem52PodeGerenciarOrigens())return;
 const rev=++dem52OrigensGestao.revisao,generation=ac28Generation;
 dem52OrigensGestao.carregando=true;
 dem52OrigAviso('Consultando as origens existentes…');
 try{
  const {data,error}=await sb.from('demanda_origens').select('id,code,nome,ativo,ordem').is('deleted_at',null).order('ordem').order('nome');
  if(rev!==dem52OrigensGestao.revisao||generation!==ac28Generation||!dem52OrigensGestao.aberto)return;
  if(error||!Array.isArray(data))throw Error('Consulta indisponível.');
  dem52OrigensGestao.itens=data;dem52OrigDesenhar();dem52OrigAviso('');
 }catch{if(rev===dem52OrigensGestao.revisao)dem52OrigAviso('Não foi possível carregar a lista. Tente novamente.',true);}
 finally{if(rev===dem52OrigensGestao.revisao)dem52OrigensGestao.carregando=false;}
}
function dem52FecharGerenciaOrigens(){
 if(dem52OrigensGestao.ocupado||dem52OrigensGestao.confirmando)return;
 dem52OrigensGestao.aberto=false;dem52OrigensGestao.revisao++;
 dem52OrigElement('dialogo').hidden=true;
 dem52OrigElement('nome').value='';dem52OrigAviso('');
 dem52OrigElement('gerenciar')?.focus({preventScroll:true});
}
async function dem52AbrirGerenciaOrigens(){
 if(!dem52PodeGerenciarOrigens()||dem52OrigensGestao.ocupado)return;
 dem52OrigensGestao.aberto=true;
 dem52OrigElement('dialogo').hidden=false;
 dem52OrigElement('nome').value='';
 dem52OrigElement('fechar').focus({preventScroll:true});
 await dem52OrigCarregar();
}
async function dem52OrigSincronizar(){
 await dem52OrigCarregar();
 if(!dem52Cadastro.incerto&&dem52Cadastro.aberto)await dem52CarregarCatalogosCadastro();
 // O filtro histórico conserva as origens inativas; nenhuma demanda é alterada.
 if(typeof carregarDemandasAP52==='function'&&dem52Pode())await carregarDemandasAP52(true,false);
}
async function dem52OrigAdicionar(){
 if(!dem52PodeGerenciarOrigens()||dem52OrigensGestao.ocupado||dem52OrigensGestao.confirmando||dem52OrigensGestao.carregando)return;
 const nome=dem52OrigElement('nome').value.replace(/\s+/g,' ').trim();
 if(nome.length<3||nome.length>120){dem52OrigAviso('Informe um nome entre 3 e 120 caracteres.',true);return;}
 const igual=dem52OrigensGestao.itens.find(x=>dem52OrigNomeNormalizado(x.nome)===dem52OrigNomeNormalizado(nome));
 if(igual){dem52OrigAviso(igual.ativo?'Esta origem já existe.':'Esta origem já existe e está inativa. Use Reativar.',true);return;}
 dem52OrigensGestao.confirmando=true;
 let autorizado=false;try{autorizado=await ap52Confirm(`Adicionar “${nome}” às origens disponíveis? Esta é uma alteração no banco e exige autorização individual do Daniel.`,{title:'Adicionar origem',confirmText:'Adicionar'});}finally{dem52OrigensGestao.confirmando=false;}
 if(!autorizado||!dem52PodeGerenciarOrigens())return;
 const generation=ac28Generation,usuario=acesso28.user.user_id;
 const seguro=()=>generation===ac28Generation&&acesso28?.user?.user_id===usuario&&dem52PodeGerenciarOrigens();
 const code=dem52OrigCodigo(nome,dem52OrigensGestao.itens);
 const ordem=Math.max(90,...dem52OrigensGestao.itens.filter(x=>x.ativo&&Number(x.ordem)<900).map(x=>Number(x.ordem)||0))+1;
 dem52OrigBusy(true);
 try{
  const {data,error}=await sb.from('demanda_origens').insert({code,nome,ativo:true,ordem}).select('id,code,nome,ativo,ordem').single();
  if(!seguro())return;
  if(error||!data)throw Error('O catálogo não confirmou a inclusão. Recarregue a lista antes de tentar novamente.');
  dem52OrigElement('nome').value='';await dem52OrigSincronizar();
  dem52OrigAviso('Origem adicionada. Já está disponível para novas demandas.');
 }catch(e){if(seguro())dem52OrigAviso(e.message||'Falha ao adicionar origem.',true);}
 finally{dem52OrigBusy(false);}
}
async function dem52OrigAlterar(id,acao){
 if(!dem52PodeGerenciarOrigens()||dem52OrigensGestao.ocupado||dem52OrigensGestao.confirmando||dem52OrigensGestao.carregando)return;
 const item=dem52OrigensGestao.itens.find(x=>x.id===id);
 if(!item||!['desativar','reativar'].includes(acao)||item.ativo!==(acao==='desativar'))return;
 const ativo=acao==='reativar';
 dem52OrigensGestao.confirmando=true;
 let autorizado=false;try{autorizado=await ap52Confirm(`${ativo?'Reativar':'Excluir da lista'} “${item.nome}”? ${ativo?'Voltará a aparecer em novos cadastros.':'Os registros antigos continuarão preservados; nenhuma demanda será excluída.'} Esta alteração exige autorização individual do Daniel.`,{title:ativo?'Reativar origem':'Excluir origem da lista',confirmText:ativo?'Reativar':'Excluir da lista',variant:ativo?'info':'warning'});}finally{dem52OrigensGestao.confirmando=false;}
 if(!autorizado||!dem52PodeGerenciarOrigens())return;
 const generation=ac28Generation,usuario=acesso28.user.user_id;
 const seguro=()=>generation===ac28Generation&&acesso28?.user?.user_id===usuario&&dem52PodeGerenciarOrigens();
 dem52OrigBusy(true);
 try{
  const {data,error}=await sb.from('demanda_origens').update({ativo}).eq('id',item.id).eq('ativo',item.ativo).is('deleted_at',null).select('id,ativo').maybeSingle();
  if(!seguro())return;
  if(error||!data)throw Error('Alteração não confirmada. Recarregue a lista antes de tentar novamente.');
  await dem52OrigSincronizar();dem52OrigAviso(ativo?'Origem reativada.':'Origem retirada dos novos cadastros; o histórico foi preservado.');
 }catch(e){if(seguro())dem52OrigAviso(e.message||'Não foi possível alterar a origem.',true);}
 finally{dem52OrigBusy(false);}
}
(function dem52MontarGerenciaOrigens(){
 const gatilho=document.getElementById('dem52-orig-gerenciar');
 if(!gatilho)return;
 const caixa=document.createElement('div');caixa.id='dem52-orig-dialogo';caixa.className='dem52-orig-dialogo';caixa.hidden=true;
 caixa.innerHTML=`<div class="dem52-orig-fundo" data-orig-fechar="1"></div><section class="dem52-orig-painel" role="dialog" aria-modal="true" aria-labelledby="dem52-orig-titulo"><header><div><span>Central de Demandas</span><h2 id="dem52-orig-titulo">Gerenciar origens</h2><p>Adicionar e retirar opções do cadastro, sem apagar demandas anteriores.</p></div><button type="button" id="dem52-orig-fechar" aria-label="Fechar gerenciamento">×</button></header><div class="dem52-orig-corpo"><p id="dem52-orig-aviso" role="status" hidden></p><div class="dem52-orig-add"><label for="dem52-orig-nome">Nova origem</label><div><input id="dem52-orig-nome" type="text" maxlength="120" placeholder="Ex.: grupo de WhatsApp da Subprefeitura"><button type="button" id="dem52-orig-adicionar">Adicionar</button></div><p>Grupos citados pela Coordenação (clique para preencher):</p><div id="dem52-orig-sugestoes" class="dem52-orig-sugestoes"></div></div><div class="dem52-orig-lista-titulo"><h3>Origens existentes</h3><span id="dem52-orig-contagem"></span></div><ul id="dem52-orig-lista"></ul><footer><small>“Excluir da lista” apenas desativa a opção. A origem permanece nos históricos e filtros. Cada alteração exige autorização específica.</small></footer></div></section>`;
 document.body.appendChild(caixa);
 gatilho.addEventListener('click',dem52AbrirGerenciaOrigens);
 dem52OrigElement('fechar').addEventListener('click',dem52FecharGerenciaOrigens);
 caixa.querySelector('[data-orig-fechar]').addEventListener('click',dem52FecharGerenciaOrigens);
 dem52OrigElement('adicionar').addEventListener('click',dem52OrigAdicionar);
 dem52OrigElement('lista').addEventListener('click',e=>{const btn=e.target.closest('button[data-orig-id]');if(btn)dem52OrigAlterar(btn.dataset.origId,btn.dataset.origAcao);});
 caixa.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dem52FecharGerenciaOrigens();}});
})();
