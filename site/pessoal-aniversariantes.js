(()=>{
'use strict';

const MESES_ANIV=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const estado={itens:[],carregado:false,carregando:false,erro:'',podeEditar:false,escopo:'',gerenciaUsuario:'',todos:false};

function esc(v){
  if(typeof escapar==='function') return escapar(v==null?'':String(v));
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function hojeRio(){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return {ano:Number(o.year),mes:Number(o.month),dia:Number(o.day)};
}
function diasNoMes(ano,mes){return new Date(Date.UTC(ano,mes,0)).getUTCDate();}
function deltaAniv(dia,mes,hoje){
  if(!dia||!mes)return 9999;
  const base=Date.UTC(hoje.ano,hoje.mes-1,hoje.dia);
  let d=mes===2&&dia===29?Math.min(29,diasNoMes(hoje.ano,2)):dia;
  let alvo=Date.UTC(hoje.ano,mes-1,d);
  if(alvo<base){const a=hoje.ano+1;d=mes===2&&dia===29?Math.min(29,diasNoMes(a,2)):dia;alvo=Date.UTC(a,mes-1,d);}
  return Math.round((alvo-base)/86400000);
}
function dataValida(dia,mes){
  dia=Number(dia);mes=Number(mes);
  if(!Number.isInteger(dia)||!Number.isInteger(mes)||mes<1||mes>12||dia<1)return false;
  return dia<=[31,29,31,30,31,30,31,31,30,31,30,31][mes-1];
}
function funcionarioPorId(id){return (typeof funcionarios!=='undefined'?funcionarios:[]).find(f=>Number(f.id)===Number(id));}
function itensAtuais(){
  const base=estado.itens.map(x=>({...x}));
  const vinculados=new Set(base.filter(x=>x.funcionario_id!=null).map(x=>Number(x.funcionario_id)));
  const atuais=typeof funcionariosEfetivoAtual==='function'?funcionariosEfetivoAtual():[];
  for(const f of atuais){
    const dia=Number(f.aniversario_dia),mes=Number(f.aniversario_mes);
    if(!dataValida(dia,mes))continue;
    if(vinculados.has(Number(f.id))){
      const i=base.findIndex(x=>Number(x.funcionario_id)===Number(f.id));
      if(i>=0){base[i].dia=dia;base[i].mes=mes;base[i].nome=f.nome||base[i].nome;base[i].funcao=base[i].funcao||f.cargo||'';base[i].lotacao=base[i].lotacao||f.gerencia||'';}
      continue;
    }
    base.push({id:null,_virtual:true,nome:f.nome,dia,mes,funcao:f.cargo||'',lotacao:f.gerencia||'',vinculo:'',funcionario_id:Number(f.id),origem:'funcionario'});
  }
  return base.filter(x=>dataValida(Number(x.dia),Number(x.mes)));
}
function rotuloPessoa(x,delta){
  const partes=[];
  if(delta===0)partes.push('Hoje');
  else if(delta===1)partes.push('Amanhã');
  else partes.push(`${String(x.dia).padStart(2,'0')} de ${MESES_ANIV[Number(x.mes)-1].toLowerCase()}`);
  if(x.funcao)partes.push(x.funcao);
  if(x.lotacao)partes.push(x.lotacao==='Coordenação AP5.2'?'AP5.2':x.lotacao);
  return partes.join(' · ');
}
function chipVinculo(x){return x.vinculo?`<span class="aniv-vinculo">${esc(x.vinculo)}</span>`:'';}

// v65.42.119.1: a agenda geral vem de RPC exclusiva de contas individuais com acesso à Gestão de Pessoal.
// Contas antigas (compartilhadas) mostram só os aniversários já carregados dos funcionários, sem consultar o banco.
function agendaSomenteLocal(){return typeof acesso28!=='undefined'&&!!acesso28?.legacy;}
function podeVerAgenda(){return typeof pode28!=='function'||!!pode28('pessoal','visualizar');}

async function carregar(force=false){
  if(estado.carregando||(!force&&estado.carregado))return;
  if(typeof sessaoAtual==='undefined'||!sessaoAtual?.user?.id||typeof sb==='undefined')return;
  if(agendaSomenteLocal()||!podeVerAgenda())return;
  estado.carregando=true;estado.erro='';
  try{
    const {data,error}=await sb.rpc('ap52_pessoal_aniversariantes_listar');
    if(error)throw error;
    estado.itens=Array.isArray(data?.itens)?data.itens:[];
    estado.podeEditar=!!data?.pode_editar;
    estado.escopo=String(data?.escopo||'');
    estado.gerenciaUsuario=String(data?.gerencia_usuario||'');
    estado.carregado=true;
  }catch(e){
    console.error('Aniversariantes:',e);estado.erro=e?.message||String(e);estado.carregado=false;
  }finally{
    estado.carregando=false;
    if(typeof renderPainelContextualPessoal==='function')renderPainelContextualPessoal();
  }
}

function renderPainel(){
  if(!podeVerAgenda())return '';
  const local=agendaSomenteLocal();
  // Carga automática só uma vez. Depois de uma falha, nova tentativa apenas pelo botão "Tentar novamente":
  // a falha re-renderiza o painel, e repetir a consulta aqui criava um laço contínuo de requisições.
  if(!local&&!estado.carregado&&!estado.carregando&&!estado.erro)queueMicrotask(()=>carregar(false));
  if(!local&&estado.carregando&&!estado.carregado)return '<section class="ps15-secao ps15-aniversarios"><div class="ps15-secao-titulo"><h3>Aniversariantes</h3><span>Carregando…</span></div><p class="ps15-vazio">Atualizando a agenda de aniversários.</p></section>';
  if(!local&&estado.erro&&!estado.carregado)return `<section class="ps15-secao ps15-aniversarios"><div class="ps15-secao-titulo"><h3>Aniversariantes</h3><span>Indisponível</span></div><p class="ps15-vazio">Não foi possível carregar os aniversariantes.</p><button type="button" class="ps15-link" onclick="pessoalAniversariantesRecarregar()">Tentar novamente</button></section>`;

  const hoje=hojeRio();
  const lista=itensAtuais().map(x=>({...x,_delta:deltaAniv(Number(x.dia),Number(x.mes),hoje)}))
    .sort((a,b)=>a._delta-b._delta||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  const qtdHoje=lista.filter(x=>x._delta===0).length;
  const qtd7=lista.filter(x=>x._delta>0&&x._delta<=7).length;
  const qtdMes=lista.filter(x=>Number(x.mes)===hoje.mes).length;
  const exibidos=estado.todos?lista:lista.slice(0,4);
  const linha=x=>{
    const corpo=`<time aria-label="Aniversário em ${String(x.dia).padStart(2,'0')} de ${MESES_ANIV[Number(x.mes)-1]}"><b>${String(x.dia).padStart(2,'0')}</b><span>${esc(MESES_ANIV[Number(x.mes)-1].slice(0,3))}</span></time><span><strong>${esc(x.nome)}</strong><small>${esc(rotuloPessoa(x,x._delta))}</small>${chipVinculo(x)}</span>`;
    if(x.funcionario_id)return `<button type="button" class="${x._delta===0?'aniv-hoje':''}" onclick="selecionarFuncionarioPessoal(${Number(x.funcionario_id)})">${corpo}<span class="ps15-seta" aria-hidden="true">›</span></button>`;
    if(estado.podeEditar&&x.id)return `<button type="button" class="${x._delta===0?'aniv-hoje':''}" onclick="pessoalAniversariantesAbrir(${Number(x.id)})">${corpo}<span class="ps15-seta" aria-hidden="true">›</span></button>`;
    return `<div class="aniv-linha-estatica ${x._delta===0?'aniv-hoje':''}">${corpo}</div>`;
  };
  const gerir=estado.podeEditar?`<button type="button" class="ps15-link aniv-gerenciar" onclick="pessoalAniversariantesAbrir()">Gerenciar aniversariantes <span aria-hidden="true">↗</span></button>`:'';
  return `<section class="ps15-secao ps15-aniversarios"><div class="ps15-secao-titulo"><h3>Aniversariantes</h3><span>${lista.length} cadastrado${lista.length===1?'':'s'}</span></div><div class="ps15-aniv-contagens"><span class="${qtdHoje?'hoje':''}">Hoje <b>${qtdHoje}</b></span><span>Próx. 7 dias <b>${qtd7}</b></span><span>Este mês <b>${qtdMes}</b></span></div>${lista.length?`<div class="ps15-agenda ps15-aniv-lista">${exibidos.map(linha).join('')}</div>${lista.length>4?`<button id="pessoal-aniversarios-toggle" type="button" class="ps15-link" aria-expanded="${estado.todos}" onclick="pessoalAniversariantesAlternar()">${estado.todos?'Mostrar próximos':'Ver todos os aniversariantes'} <span aria-hidden="true">${estado.todos?'↑':'→'}</span></button>`:''}`:'<p class="ps15-vazio ps15-tranquilo">Nenhum aniversário cadastrado para este escopo.</p>'}${gerir}</section>`;
}

function criarModal(){
  if(document.getElementById('aniv-modal'))return;
  const el=document.createElement('div');
  el.id='aniv-modal';el.className='aniv-modal';el.hidden=true;
  el.innerHTML=`<div class="aniv-modal-backdrop" data-fechar="1"></div><section class="aniv-dialog" role="dialog" aria-modal="true" aria-labelledby="aniv-modal-titulo"><header><div><span>Gestão de Pessoal</span><h2 id="aniv-modal-titulo">Aniversariantes da AP5.2</h2><p>Cadastre somente o necessário: nome, dia e mês. Vínculo com funcionário é opcional.</p></div><button type="button" class="aniv-fechar" aria-label="Fechar">×</button></header><div class="aniv-layout"><aside><div class="aniv-lista-topo"><input id="aniv-busca" type="search" placeholder="Buscar nome, função ou lotação" autocomplete="off"><button type="button" class="btn btn-primary" id="aniv-novo">+ Novo</button></div><div id="aniv-lista" class="aniv-lista"></div></aside><main><form id="aniv-form"><input type="hidden" id="aniv-id"><div class="aniv-form-head"><div><span id="aniv-form-eyebrow">Novo cadastro</span><h3 id="aniv-form-titulo">Adicionar aniversariante</h3></div></div><div class="aniv-grid"><label class="aniv-full">Funcionário vinculado <select id="aniv-funcionario"><option value="">Sem vínculo com cadastro de funcionário</option></select><small>Use somente quando a pessoa já existir em Gestão de Pessoal.</small></label><label class="aniv-full">Nome <input id="aniv-nome" maxlength="160" required></label><label>Dia <select id="aniv-dia" required></select></label><label>Mês <select id="aniv-mes" required></select></label><label>Função / cargo <input id="aniv-funcao" maxlength="160" placeholder="Ex.: Gerente, Advogada, Técnico"></label><label>Lotação / Gerência <select id="aniv-lotacao"><option value="">Não informada</option><option>Coordenação AP5.2</option><option>21ª GC</option><option>22ª GC</option><option>23ª GC</option><option>24ª GC</option><option>25ª GC</option></select></label><label class="aniv-full">Vínculo / categoria <input id="aniv-vinculo" maxlength="120" list="aniv-vinculos" placeholder="Opcional"><datalist id="aniv-vinculos"><option value="Concursado"><option value="Terceirizado"><option value="Comissionado"><option value="Servidor"><option value="Outro"></datalist></label></div><div id="aniv-erro" class="aniv-erro" role="alert"></div><footer><button type="button" class="btn btn-ghost aniv-arquivar" id="aniv-arquivar" hidden>Remover da agenda</button><span></span><button type="button" class="btn btn-ghost" id="aniv-cancelar">Limpar</button><button type="submit" class="btn btn-primary">Salvar</button></footer></form></main></div></section>`;
  document.body.appendChild(el);
  el.querySelector('.aniv-fechar').addEventListener('click',fecharModal);
  el.querySelector('[data-fechar="1"]').addEventListener('click',fecharModal);
  el.querySelector('#aniv-novo').addEventListener('click',()=>editar(null));
  el.querySelector('#aniv-cancelar').addEventListener('click',()=>editar(null));
  el.querySelector('#aniv-busca').addEventListener('input',renderListaModal);
  el.querySelector('#aniv-form').addEventListener('submit',salvar);
  el.querySelector('#aniv-arquivar').addEventListener('click',arquivarAtual);
  el.querySelector('#aniv-funcionario').addEventListener('change',preencherPorFuncionario);
  const dia=el.querySelector('#aniv-dia'),mes=el.querySelector('#aniv-mes');
  dia.innerHTML='<option value="">Dia</option>'+Array.from({length:31},(_,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')}</option>`).join('');
  mes.innerHTML='<option value="">Mês</option>'+MESES_ANIV.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
}
function preencherFuncionarios(){
  const sel=document.getElementById('aniv-funcionario');if(!sel)return;
  const atual=sel.value;
  const lista=(typeof funcionariosEfetivoAtual==='function'?funcionariosEfetivoAtual():[]).slice().sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  sel.innerHTML='<option value="">Sem vínculo com cadastro de funcionário</option>'+lista.map(f=>`<option value="${Number(f.id)}">${esc(f.nome)}${f.gerencia?` — ${esc(f.gerencia)}`:''}</option>`).join('');
  if([...sel.options].some(o=>o.value===atual))sel.value=atual;
}
function preencherPorFuncionario(){
  const id=Number(document.getElementById('aniv-funcionario')?.value||0);if(!id)return;
  const f=funcionarioPorId(id);if(!f)return;
  document.getElementById('aniv-nome').value=f.nome||'';
  if(f.cargo&&!document.getElementById('aniv-funcao').value)document.getElementById('aniv-funcao').value=f.cargo;
  if(f.gerencia)document.getElementById('aniv-lotacao').value=[...document.getElementById('aniv-lotacao').options].some(o=>o.value===f.gerencia)?f.gerencia:'';
  if(dataValida(Number(f.aniversario_dia),Number(f.aniversario_mes))){document.getElementById('aniv-dia').value=String(f.aniversario_dia);document.getElementById('aniv-mes').value=String(f.aniversario_mes);}
}
function itemPorId(id){return estado.itens.find(x=>Number(x.id)===Number(id));}
function editar(id){
  const x=id?itemPorId(id):null;
  const q=s=>document.querySelector(s);
  q('#aniv-id').value=x?.id||'';q('#aniv-nome').value=x?.nome||'';q('#aniv-dia').value=x?.dia||'';q('#aniv-mes').value=x?.mes||'';q('#aniv-funcao').value=x?.funcao||'';q('#aniv-lotacao').value=x?.lotacao||'';q('#aniv-vinculo').value=x?.vinculo||'';q('#aniv-funcionario').value=x?.funcionario_id||'';
  q('#aniv-form-eyebrow').textContent=x?'Editar cadastro':'Novo cadastro';q('#aniv-form-titulo').textContent=x?x.nome:'Adicionar aniversariante';q('#aniv-arquivar').hidden=!x;q('#aniv-erro').textContent='';
  if(x?.funcionario_id)q('#aniv-nome').readOnly=true;else q('#aniv-nome').readOnly=false;
  q('#aniv-nome').focus({preventScroll:true});
}
function renderListaModal(){
  const box=document.getElementById('aniv-lista');if(!box)return;
  const termo=String(document.getElementById('aniv-busca')?.value||'').trim().toLocaleLowerCase('pt-BR');
  const lista=estado.itens.filter(x=>!termo||[x.nome,x.funcao,x.lotacao,x.vinculo].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(termo)))
    .sort((a,b)=>Number(a.mes)-Number(b.mes)||Number(a.dia)-Number(b.dia)||String(a.nome).localeCompare(String(b.nome),'pt-BR'));
  box.innerHTML=lista.length?lista.map(x=>`<button type="button" onclick="pessoalAniversariantesEditar(${Number(x.id)})"><time>${String(x.dia).padStart(2,'0')}/${String(x.mes).padStart(2,'0')}</time><span><strong>${esc(x.nome)}</strong><small>${esc([x.funcao,x.lotacao,x.vinculo].filter(Boolean).join(' · ')||'Sem detalhes adicionais')}</small></span><span>›</span></button>`).join(''):'<p>Nenhum aniversariante encontrado.</p>';
}
async function abrir(id){
  criarModal();
  await carregar(true);
  if(!estado.podeEditar){ap52Notify?.('Sua conta pode consultar aniversários, mas não pode alterar o cadastro.');return;}
  preencherFuncionarios();renderListaModal();editar(id||null);
  const m=document.getElementById('aniv-modal');m.hidden=false;document.body.classList.add('aniv-modal-aberto');
}
function fecharModal(){const m=document.getElementById('aniv-modal');if(m)m.hidden=true;document.body.classList.remove('aniv-modal-aberto');}
async function salvar(ev){
  ev.preventDefault();const q=id=>document.getElementById(id),erro=q('aniv-erro');erro.textContent='';
  const dia=Number(q('aniv-dia').value),mes=Number(q('aniv-mes').value);
  if(!dataValida(dia,mes)){erro.textContent='Informe um dia e um mês válidos.';return;}
  const args={p_id:q('aniv-id').value?Number(q('aniv-id').value):null,p_nome:q('aniv-nome').value,p_dia:dia,p_mes:mes,p_funcao:q('aniv-funcao').value||null,p_lotacao:q('aniv-lotacao').value||null,p_vinculo:q('aniv-vinculo').value||null,p_funcionario_id:q('aniv-funcionario').value?Number(q('aniv-funcionario').value):null};
  try{
    const {data,error}=await sb.rpc('ap52_pessoal_aniversariante_salvar',args);if(error)throw error;
    if(args.p_funcionario_id){const f=funcionarioPorId(args.p_funcionario_id);if(f){f.aniversario_dia=dia;f.aniversario_mes=mes;}}
    await carregar(true);renderListaModal();editar(Number(data?.id)||null);ap52Notify?.('Aniversariante salvo.');
  }catch(e){console.error(e);erro.textContent=e?.message||'Não foi possível salvar.';}
}
async function arquivarAtual(){
  const id=Number(document.getElementById('aniv-id')?.value||0),x=itemPorId(id);if(!id||!x)return;
  const ok=await ap52Confirm?.(`Remover ${x.nome} da agenda de aniversariantes?\n\nO cadastro de funcionário, se existir, não será excluído.`,{title:'Remover aniversariante',variant:'warning',confirmText:'Remover'});if(!ok)return;
  try{const {error}=await sb.rpc('ap52_pessoal_aniversariante_arquivar',{p_id:id});if(error)throw error;await carregar(true);renderListaModal();editar(null);ap52Notify?.('Aniversariante removido da agenda.');}catch(e){ap52Notify?.(e?.message||'Não foi possível remover.');}
}

window.pessoalRefinoAniversarios=renderPainel;
window.pessoalAniversariantesRecarregar=()=>carregar(true);
window.pessoalAniversariantesAlternar=()=>{estado.todos=!estado.todos;if(typeof renderPainelContextualPessoal==='function')renderPainelContextualPessoal();document.getElementById('pessoal-aniversarios-toggle')?.focus({preventScroll:true});};
window.pessoalAniversariantesAbrir=abrir;
window.pessoalAniversariantesEditar=editar;
window.pessoalAniversariantesEstado=estado;

// Atualiza silenciosamente quando a sessão já estiver pronta.
setTimeout(()=>{if(typeof sessaoAtual!=='undefined'&&sessaoAtual?.user?.id)carregar(false);},0);
})();
