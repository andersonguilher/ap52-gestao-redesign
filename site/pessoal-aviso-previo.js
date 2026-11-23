/* AP5.2 v65.42.103 — Gestão de Pessoal · Aviso prévio + integração com Painel/Central */
(function(){
  const cache=new Map();
  let funcionarioModalId=null;
  let resumoAtivos=[];
  let resumoCarregado=false;
  let resumoCarregando=false;
  let resumoErro='';

  function atualizarIntegracoesResumo(){
    try{
      const overview=document.getElementById('view-overview'),lista=document.getElementById('view-funcionarios');
      if(typeof renderOverview==='function'&&overview&&getComputedStyle(overview).display!=='none')renderOverview();
      if(typeof renderFuncionarios==='function'&&lista&&getComputedStyle(lista).display!=='none')renderFuncionarios();
      if(typeof renderAtencaoCentralPessoal==='function')renderAtencaoCentralPessoal();
      if(typeof renderProximosEventosCentralPessoal==='function')renderProximosEventosCentralPessoal();
    }catch(e){console.warn('Falha ao atualizar integrações do aviso prévio:',e);}
  }
  async function carregarResumoAtivos(force=false){
    if(!sb)return {carregado:false,carregando:false,erro:'Supabase indisponível',itens:[]};
    if(resumoCarregando)return {carregado:resumoCarregado,carregando:true,erro:resumoErro,itens:resumoAtivos};
    if(resumoCarregado&&!force)return {carregado:true,carregando:false,erro:resumoErro,itens:resumoAtivos};
    if(resumoErro&&!force)return {carregado:false,carregando:false,erro:resumoErro,itens:resumoAtivos};
    resumoCarregando=true;resumoErro='';
    try{
      const {data:resp,error}=await sb.rpc('ap52_aviso_previo_resumo_ativos',{p_limit:500});
      if(error)throw error;
      resumoAtivos=Array.isArray(resp?.itens)?resp.itens:[];resumoCarregado=true;
    }catch(e){
      console.error('Falha ao carregar resumo de avisos prévios:',e);resumoErro=e?.message||'Não foi possível consultar os avisos prévios.';resumoAtivos=[];resumoCarregado=false;
    }finally{resumoCarregando=false;atualizarIntegracoesResumo();}
    return {carregado:resumoCarregado,carregando:false,erro:resumoErro,itens:resumoAtivos};
  }
  function invalidarResumoAtivos(recarregar=true){
    resumoCarregado=false;resumoErro='';
    if(recarregar)queueMicrotask(()=>carregarResumoAtivos(true));
  }
  window.pessoalAvisoPrevioCarregarResumo=carregarResumoAtivos;
  window.pessoalAvisoPrevioResumoEstado=function(){return {carregado:resumoCarregado,carregando:resumoCarregando,erro:resumoErro,itens:resumoAtivos};};
  window.pessoalAvisoPrevioResumoInfo=function(id){id=Number(id);return resumoAtivos.find(x=>Number(x.funcionario_id)===id)||null;};

  function esc(v){
    if(typeof escapar==='function') return escapar(v==null?'':String(v));
    return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function data(v){
    if(!v)return '—';
    if(typeof fmtDate==='function')return fmtDate(v);
    const [a,m,d]=String(v).slice(0,10).split('-');return a&&m&&d?`${d}/${m}/${a}`:String(v);
  }
  function origem(v){return v==='coletivo'?'Coletivo por empresa':v==='lote'?'Em lote':'Individual';}
  function funcionario(id){return (window.funcionarios||[]).find(f=>Number(f.id)===Number(id)) || (typeof funcionarios!=='undefined'?funcionarios.find(f=>Number(f.id)===Number(id)):null);}
  function podeEditarFallback(){try{return typeof pode28==='function'&&pode28('pessoal','editar');}catch(_){return false;}}

  function historicoHtml(itens,atualId){
    const lista=(Array.isArray(itens)?itens:[]).filter(x=>String(x.id)!==String(atualId||''));
    if(!lista.length)return '';
    return `<details class="ps15-aviso-previo-historico"><summary>Histórico de avisos <span>(${lista.length})</span></summary><div class="ps15-aviso-previo-historico-lista">${lista.map(x=>`<article class="ps15-aviso-previo-historico-item"><div><strong>${esc(data(x.inicio))} → ${esc(data(x.fim_previsto))}</strong><span>${esc(x.status||'—')}</span></div><small>${esc(x.tipo||'Tipo não informado')} · ${esc(origem(x.origem))}${x.motivo?` · ${esc(x.motivo)}`:''}</small>${x.status_registro==='Cancelado'&&x.motivo_cancelamento?`<small><b>Cancelado:</b> ${esc(x.motivo_cancelamento)}</small>`:''}</article>`).join('')}</div></details>`;
  }

  function secaoHtml(emp,estado){
    const id=Number(emp?.id||0);
    if(!id)return '';
    if(!estado||estado.loading){
      return `<section id="pessoal-aviso-previo-${id}" class="ps15-secao ps15-aviso-previo"><div class="ps15-secao-titulo"><h3>Aviso prévio</h3></div><div class="ps15-aviso-previo-carregando">Consultando situação do aviso prévio…</div></section>`;
    }
    if(estado.error){
      return `<section id="pessoal-aviso-previo-${id}" class="ps15-secao ps15-aviso-previo"><div class="ps15-secao-titulo"><h3>Aviso prévio</h3></div><p class="ps15-vazio">Não foi possível consultar o aviso prévio.</p><button type="button" class="ps15-link" onclick="pessoalAvisoPrevioRecarregar(${id})">Tentar novamente</button></section>`;
    }
    const d=estado.data||{},a=d.atual||null,pode=!!d.pode_editar||podeEditarFallback();
    let corpo='';
    if(a){
      const encerrado=a.status==='Prazo encerrado';
      const dias=Number(a.dias_restantes);
      let contagem='';
      if(Number.isFinite(dias)){
        if(dias<0)contagem=`Prazo terminou há ${Math.abs(dias)} dia${Math.abs(dias)===1?'':'s'}. O funcionário permanece ativo até o desligamento ser confirmado.`;
        else if(dias===0)contagem='Término previsto para hoje. O sistema não realiza desligamento automático.';
        else contagem=`${dias} dia${dias===1?'':'s'} até o término previsto.`;
      }
      corpo=`<article class="ps15-aviso-previo-card${encerrado?' prazo-encerrado':''}"><div class="ps15-aviso-previo-topo"><strong>${encerrado?'Prazo do aviso encerrado':'Em aviso prévio'}</strong><span class="ps15-aviso-previo-status">${esc(a.status)}</span></div><div class="ps15-aviso-previo-meta"><div><small>Período</small><b>${esc(data(a.inicio))} → ${esc(data(a.fim_previsto))}</b></div><div><small>Tipo</small><b>${esc(a.tipo||'Não informado')}</b></div><div><small>Motivo</small><b>${esc(a.motivo||'Não informado')}</b></div><div><small>Origem</small><b>${esc(origem(a.origem))}</b></div></div>${contagem?`<p class="ps15-aviso-previo-contagem${encerrado?' atrasado':''}">${esc(contagem)}</p>`:''}${a.observacao?`<p class="ps15-aviso-previo-obs">${esc(a.observacao)}</p>`:''}<p class="ps15-legenda">Registrado por ${esc(a.registrado_por||'Usuário AP5.2')}.</p>${pode?`<div class="ps15-aviso-previo-acoes"><button type="button" class="cancelar" onclick="pessoalAvisoPrevioCancelar(${Number(a.id)},${id})">Cancelar aviso prévio</button></div>`:''}</article>`;
    }else{
      corpo=`<p class="ps15-vazio">Nenhum aviso prévio ativo para este funcionário.</p>${pode&&d.elegivel!==false?`<button type="button" class="ps15-aviso-previo-novo" onclick="pessoalAvisoPrevioAbrir(${id})">Registrar aviso prévio</button>`:''}`;
    }
    return `<section id="pessoal-aviso-previo-${id}" class="ps15-secao ps15-aviso-previo"><div class="ps15-secao-titulo"><h3>Aviso prévio</h3>${a?'<span class="ps15-recente">Vínculo atual</span>':''}</div>${corpo}${historicoHtml(d.historico,a?.id)}</section>`;
  }

  function atualizarSecao(id){
    const emp=funcionario(id),el=document.getElementById(`pessoal-aviso-previo-${Number(id)}`);
    if(emp&&el)el.outerHTML=secaoHtml(emp,cache.get(Number(id)));
  }

  async function carregar(id,force=false){
    id=Number(id);if(!id)return;
    const atual=cache.get(id);
    if(atual?.loading)return;
    if(atual?.data&&!force){atualizarSecao(id);return;}
    cache.set(id,{loading:true});atualizarSecao(id);
    try{
      const {data,error}=await sb.rpc('ap52_aviso_previo_dossie',{p_funcionario_id:id});
      if(error)throw error;
      cache.set(id,{loading:false,data:data||{}});
    }catch(e){
      console.error('Falha ao carregar aviso prévio:',e);
      cache.set(id,{loading:false,error:e});
    }
    atualizarSecao(id);
  }

  window.pessoalAvisoPrevioHtml=function(emp){
    const id=Number(emp?.id||0),estado=cache.get(id);
    if(id&&(!estado||(!estado.loading&&!estado.data&&!estado.error)))queueMicrotask(()=>carregar(id,false));
    return secaoHtml(emp,estado||{loading:true});
  };
  window.pessoalAvisoPrevioRecarregar=function(id){cache.delete(Number(id));return carregar(Number(id),true);};

  function garantirModal(){
    let overlay=document.getElementById('pessoal-aviso-overlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='pessoal-aviso-overlay';overlay.className='pessoal-aviso-overlay';overlay.innerHTML=`<div class="pessoal-aviso-modal" role="dialog" aria-modal="true" aria-labelledby="pessoal-aviso-titulo"><div class="pessoal-aviso-modal-head"><div><h2 id="pessoal-aviso-titulo">Registrar aviso prévio</h2><p>O funcionário continua ativo até que um desligamento seja confirmado.</p></div><button type="button" class="pessoal-aviso-modal-fechar" onclick="pessoalAvisoPrevioFechar()" aria-label="Fechar">×</button></div><form id="pessoal-aviso-form" onsubmit="pessoalAvisoPrevioSalvar(event)"><div class="pessoal-aviso-modal-body"><div id="pessoal-aviso-identidade" class="pessoal-aviso-identidade"></div><div class="pessoal-aviso-grid"><div class="pessoal-aviso-field"><label for="pessoal-aviso-inicio">Início do aviso</label><input type="date" id="pessoal-aviso-inicio" required></div><div class="pessoal-aviso-field"><label for="pessoal-aviso-fim">Término previsto</label><input type="date" id="pessoal-aviso-fim" required><small>Informe a data fornecida pela empresa. O sistema não calcula prazo trabalhista automaticamente.</small></div><div class="pessoal-aviso-field"><label for="pessoal-aviso-tipo">Tipo</label><select id="pessoal-aviso-tipo" required><option value="Trabalhado">Trabalhado</option><option value="Indenizado">Indenizado</option><option value="Misto">Misto</option><option value="Outro">Outro</option></select></div><div class="pessoal-aviso-field"><label for="pessoal-aviso-motivo">Motivo / origem</label><select id="pessoal-aviso-motivo" onchange="pessoalAvisoPrevioMotivoOutro()"><option value="Encerramento de contrato">Encerramento de contrato</option><option value="Redução de efetivo">Redução de efetivo</option><option value="Determinação da empresa">Determinação da empresa</option><option value="Outro">Outro</option></select></div><div id="pessoal-aviso-motivo-outro-box" class="pessoal-aviso-field span2" hidden><label for="pessoal-aviso-motivo-outro">Informe o motivo</label><input type="text" id="pessoal-aviso-motivo-outro" maxlength="180"></div><div class="pessoal-aviso-field span2"><label for="pessoal-aviso-observacao">Observação</label><textarea id="pessoal-aviso-observacao" maxlength="600" placeholder="Opcional"></textarea></div></div><div id="pessoal-aviso-erro" class="pessoal-aviso-erro" role="alert"></div></div><div class="pessoal-aviso-modal-actions"><button type="button" onclick="pessoalAvisoPrevioFechar()">Cancelar</button><button type="submit" id="pessoal-aviso-salvar" class="primario">Registrar aviso</button></div></form></div>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)pessoalAvisoPrevioFechar();});document.body.appendChild(overlay);return overlay;
  }

  window.pessoalAvisoPrevioMotivoOutro=function(){
    const outro=document.getElementById('pessoal-aviso-motivo')?.value==='Outro',box=document.getElementById('pessoal-aviso-motivo-outro-box'),input=document.getElementById('pessoal-aviso-motivo-outro');
    if(box)box.hidden=!outro;if(input)input.required=outro;
  };
  window.pessoalAvisoPrevioAbrir=function(id){
    const f=funcionario(id);if(!f)return;
    const overlay=garantirModal();funcionarioModalId=Number(id);
    document.getElementById('pessoal-aviso-identidade').innerHTML=`<strong>${esc(f.nome)}</strong><small>${esc(String(f.empresa||'Empresa não informada').toUpperCase())} · ${esc(f.contrato||'Contrato não informado')} · ${esc(f.gerencia||'Gerência não informada')}</small>`;
    document.getElementById('pessoal-aviso-inicio').value=typeof dataRio==='function'?dataRio():new Date().toISOString().slice(0,10);
    document.getElementById('pessoal-aviso-fim').value='';document.getElementById('pessoal-aviso-tipo').value='Trabalhado';document.getElementById('pessoal-aviso-motivo').value='Encerramento de contrato';document.getElementById('pessoal-aviso-motivo-outro').value='';document.getElementById('pessoal-aviso-observacao').value='';document.getElementById('pessoal-aviso-erro').textContent='';pessoalAvisoPrevioMotivoOutro();overlay.classList.add('open');document.getElementById('pessoal-aviso-inicio').focus();
  };
  window.pessoalAvisoPrevioFechar=function(){const o=document.getElementById('pessoal-aviso-overlay');if(o)o.classList.remove('open');funcionarioModalId=null;};

  window.pessoalAvisoPrevioSalvar=async function(event){
    event.preventDefault();const id=Number(funcionarioModalId);if(!id)return;
    const inicio=document.getElementById('pessoal-aviso-inicio').value,fim=document.getElementById('pessoal-aviso-fim').value,tipo=document.getElementById('pessoal-aviso-tipo').value,motivoSel=document.getElementById('pessoal-aviso-motivo').value,motivoOutro=document.getElementById('pessoal-aviso-motivo-outro').value.trim(),obs=document.getElementById('pessoal-aviso-observacao').value.trim(),erro=document.getElementById('pessoal-aviso-erro'),botao=document.getElementById('pessoal-aviso-salvar');
    const motivo=motivoSel==='Outro'?(motivoOutro?`Outro — ${motivoOutro}`:'Outro'):motivoSel;
    erro.textContent='';if(!inicio||!fim){erro.textContent='Informe as datas de início e término previsto.';return;}if(fim<inicio){erro.textContent='O término previsto não pode ser anterior ao início.';return;}if(motivoSel==='Outro'&&!motivoOutro){erro.textContent='Informe o motivo do aviso prévio.';return;}
    botao.disabled=true;botao.textContent='Registrando…';
    try{
      const {error}=await sb.rpc('ap52_aviso_previo_registrar',{p_funcionario_id:id,p_inicio:inicio,p_fim_previsto:fim,p_tipo:tipo,p_motivo:motivo,p_observacao:obs||null});if(error)throw error;
      cache.delete(id);invalidarResumoAtivos(true);pessoalAvisoPrevioFechar();await carregar(id,true);if(typeof ap52Notify==='function')ap52Notify('Aviso prévio registrado. O funcionário continua no efetivo até o desligamento ser confirmado.');
    }catch(e){console.error('Falha ao registrar aviso prévio:',e);erro.textContent=e?.message||'Não foi possível registrar o aviso prévio.';}
    finally{botao.disabled=false;botao.textContent='Registrar aviso';}
  };

  window.pessoalAvisoPrevioCancelar=async function(avisoId,funcionarioId){
    const motivo=typeof ap52Prompt==='function'?await ap52Prompt('Informe por que este aviso prévio está sendo cancelado. O registro continuará preservado no histórico.','',{title:'Cancelar aviso prévio',confirmText:'Cancelar aviso',label:'Motivo do cancelamento',multiline:true,maxLength:500}):null;
    if(motivo===null||motivo===undefined)return;const txt=String(motivo).trim();if(txt.length<3){if(typeof ap52Notify==='function')ap52Notify('Informe o motivo do cancelamento.');return;}
    try{const {error}=await sb.rpc('ap52_aviso_previo_cancelar',{p_id:Number(avisoId),p_motivo_cancelamento:txt});if(error)throw error;cache.delete(Number(funcionarioId));invalidarResumoAtivos(true);await carregar(Number(funcionarioId),true);if(typeof ap52Notify==='function')ap52Notify('Aviso prévio cancelado e preservado no histórico.');}
    catch(e){console.error('Falha ao cancelar aviso prévio:',e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível cancelar o aviso prévio.');}
  };

  /* Etapa 2 — aviso prévio em lote */
  let loteModo=false;
  const loteSelecionados=new Set();
  let loteElegiveis=[];
  let loteImpedidos=[];

  function listaFuncionariosLote(){
    try{if(typeof funcionarios!=='undefined'&&Array.isArray(funcionarios))return funcionarios;}catch(_){ }
    return Array.isArray(window.funcionarios)?window.funcionarios:[];
  }
  function funcionarioLote(id){return listaFuncionariosLote().find(f=>Number(f.id)===Number(id))||null;}
  function podeEditarLote(){try{return typeof pode28==='function'&&pode28('pessoal','editar');}catch(_){return false;}}
  function podeVerOperacoesColetivas(){try{return typeof acesso28!=='undefined'&&!acesso28?.legacy&&acesso28?.user?.scope==='global';}catch(_){return false;}}
  function podeColetivoEmpresa(){try{return podeEditarLote()&&podeVerOperacoesColetivas();}catch(_){return false;}}
  function elegivelClienteLote(f){
    if(!f||String(f.status||'').toLowerCase()==='desligado')return false;
    try{if(typeof funcionarioNoEfetivoAtual==='function'&&!funcionarioNoEfetivoAtual(f))return false;}catch(_){ }
    try{if(typeof funcionarioSemVinculoAtual==='function'&&funcionarioSemVinculoAtual(f))return false;}catch(_){ }
    return true;
  }
  function nomeEmpresaLote(f){return String(f?.empresa||'Empresa não informada').toUpperCase();}

  window.pessoalAvisoPrevioInvalidar=function(ids){
    const lista=Array.isArray(ids)?ids:[ids];
    lista.forEach(v=>{const id=Number(v);if(id)cache.delete(id);});
    invalidarResumoAtivos(true);
    lista.forEach(v=>{const id=Number(v);if(id&&document.getElementById(`pessoal-aviso-previo-${id}`))carregar(id,true);});
  };

  function atualizarBotaoLote(){
    const b=document.getElementById('pessoal-aviso-lote-iniciar'),c=document.getElementById('pessoal-aviso-coletivo-iniciar'),o=document.getElementById('pessoal-aviso-operacoes-iniciar');
    if(b)b.hidden=!podeEditarLote();
    if(c)c.hidden=!podeColetivoEmpresa()||loteModo;
    if(o)o.hidden=!podeVerOperacoesColetivas()||loteModo;
  }
  function atualizarBarraLote(){
    const view=document.getElementById('view-funcionarios'),bar=document.getElementById('pessoal-aviso-lote-bar'),count=document.getElementById('pessoal-aviso-lote-count'),continuar=document.getElementById('pessoal-aviso-lote-continuar');
    if(view)view.classList.toggle('pessoal-aviso-lote-ativo',loteModo);
    if(bar)bar.hidden=!loteModo;
    if(count)count.textContent=`${loteSelecionados.size} selecionado${loteSelecionados.size===1?'':'s'}`;
    if(continuar)continuar.disabled=loteSelecionados.size===0;
    document.querySelectorAll('#view-funcionarios .emp-card[data-funcionario]').forEach(card=>{
      const id=Number(card.dataset.funcionario),sel=loteSelecionados.has(id),btn=card.querySelector('.ps15-lote-check');
      card.classList.toggle('ps15-lote-selecionado',sel);
      if(btn){btn.setAttribute('aria-pressed',String(sel));btn.innerHTML=sel?'✓':'+';}
    });
  }
  function decorarCardsLote(){
    document.querySelectorAll('#view-funcionarios .emp-card[data-funcionario]').forEach(card=>{
      const id=Number(card.dataset.funcionario),f=funcionarioLote(id),ok=elegivelClienteLote(f);
      let btn=card.querySelector('.ps15-lote-check');
      if(!btn){
        btn=document.createElement('button');btn.type='button';btn.className='ps15-lote-check';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.pessoalAvisoPrevioLoteAlternar(id);});card.appendChild(btn);
      }
      btn.disabled=!ok;btn.title=ok?'Selecionar para aviso prévio em lote':'Disponível apenas para funcionários do efetivo atual';btn.setAttribute('aria-label',ok?`Selecionar ${f?.nome||'funcionário'} para aviso prévio em lote`:'Funcionário indisponível para o lote');
      card.classList.toggle('ps15-lote-indisponivel',!ok);
    });
    atualizarBarraLote();atualizarBotaoLote();
  }
  function instalarLoteUI(){
    const view=document.getElementById('view-funcionarios');if(!view||view.dataset.avisoLoteInstalado==='1')return;
    view.dataset.avisoLoteInstalado='1';
    const actions=view.querySelector('.pessoal-page-actions');
    if(actions&&!document.getElementById('pessoal-aviso-lote-iniciar')){
      const b=document.createElement('button');b.type='button';b.id='pessoal-aviso-lote-iniciar';b.className='btn btn-ghost ps15-aviso-lote-btn';b.innerHTML='Aviso prévio em lote';b.onclick=window.pessoalAvisoPrevioLoteIniciar;actions.insertBefore(b,actions.firstChild);
    }
    if(actions&&!document.getElementById('pessoal-aviso-coletivo-iniciar')){
      const c=document.createElement('button');c.type='button';c.id='pessoal-aviso-coletivo-iniciar';c.className='btn btn-ghost ps15-aviso-coletivo-btn';c.innerHTML='Aviso coletivo por empresa';c.onclick=window.pessoalAvisoPrevioColetivoAbrir;const loteBtn=document.getElementById('pessoal-aviso-lote-iniciar');if(loteBtn?.nextSibling)actions.insertBefore(c,loteBtn.nextSibling);else actions.appendChild(c);
    }
    if(actions&&!document.getElementById('pessoal-aviso-operacoes-iniciar')){
      const o=document.createElement('button');o.type='button';o.id='pessoal-aviso-operacoes-iniciar';o.className='btn btn-ghost ps15-aviso-operacoes-btn';o.innerHTML='Operações coletivas';o.onclick=window.pessoalAvisoPrevioOperacoesAbrir;const cBtn=document.getElementById('pessoal-aviso-coletivo-iniciar');if(cBtn?.nextSibling)actions.insertBefore(o,cBtn.nextSibling);else actions.appendChild(o);
    }
    const filtros=view.querySelector('.pessoal-filtros-card');
    if(filtros&&!document.getElementById('pessoal-aviso-lote-bar')){
      const bar=document.createElement('section');bar.id='pessoal-aviso-lote-bar';bar.className='ps15-aviso-lote-bar';bar.hidden=true;bar.innerHTML=`<div><strong>Seleção para aviso prévio</strong><span id="pessoal-aviso-lote-count">0 selecionados</span><small>Marque manualmente as pessoas que entrarão no lote.</small></div><div class="ps15-aviso-lote-bar-acoes"><button type="button" class="btn btn-ghost" onclick="pessoalAvisoPrevioLoteCancelarSelecao()">Cancelar seleção</button><button type="button" id="pessoal-aviso-lote-continuar" class="btn btn-primary" onclick="pessoalAvisoPrevioLoteContinuar()" disabled>Continuar</button></div>`;
      filtros.insertAdjacentElement('afterend',bar);
    }
    view.addEventListener('click',e=>{
      if(!loteModo)return;
      const cardBtn=e.target.closest('.ps15-card-selecionar');if(!cardBtn||!view.contains(cardBtn))return;
      const card=cardBtn.closest('.emp-card[data-funcionario]');if(!card)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();window.pessoalAvisoPrevioLoteAlternar(Number(card.dataset.funcionario));
    },true);
    const original=window.renderFuncionarios;
    if(typeof original==='function'&&!original.__avisoLoteWrapped){
      const wrapped=function(...args){const r=original.apply(this,args);queueMicrotask(decorarCardsLote);return r;};wrapped.__avisoLoteWrapped=true;window.renderFuncionarios=wrapped;
    }
    decorarCardsLote();
  }

  window.pessoalAvisoPrevioLoteIniciar=function(){
    if(!podeEditarLote()){if(typeof ap52Notify==='function')ap52Notify('Seu perfil não permite registrar aviso prévio.');return;}
    loteModo=true;loteSelecionados.clear();loteElegiveis=[];loteImpedidos=[];atualizarBarraLote();decorarCardsLote();
    document.getElementById('pessoal-aviso-lote-bar')?.scrollIntoView({behavior:'smooth',block:'center'});
  };
  window.pessoalAvisoPrevioLoteCancelarSelecao=function(){
    loteModo=false;loteSelecionados.clear();loteElegiveis=[];loteImpedidos=[];atualizarBarraLote();decorarCardsLote();window.pessoalAvisoPrevioLoteFechar?.();
  };
  window.pessoalAvisoPrevioLoteAlternar=function(id){
    if(!loteModo)return;id=Number(id);const f=funcionarioLote(id);
    if(!elegivelClienteLote(f)){if(typeof ap52Notify==='function')ap52Notify('Este funcionário não está disponível para aviso prévio em lote.');return;}
    if(loteSelecionados.has(id))loteSelecionados.delete(id);else{
      if(loteSelecionados.size>=200){if(typeof ap52Notify==='function')ap52Notify('O lote pode ter no máximo 200 funcionários.');return;}
      loteSelecionados.add(id);
    }
    atualizarBarraLote();
  };

  function garantirModalLote(){
    let overlay=document.getElementById('pessoal-aviso-lote-overlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='pessoal-aviso-lote-overlay';overlay.className='pessoal-aviso-overlay pessoal-aviso-lote-overlay';
    overlay.innerHTML=`<div class="pessoal-aviso-modal pessoal-aviso-lote-modal" role="dialog" aria-modal="true" aria-labelledby="pessoal-aviso-lote-titulo"><div class="pessoal-aviso-modal-head"><div><h2 id="pessoal-aviso-lote-titulo">Aviso prévio em lote</h2><p>Revise os nomes e aplique as mesmas condições a todos. Nenhum funcionário será desligado automaticamente.</p></div><button type="button" class="pessoal-aviso-modal-fechar" onclick="pessoalAvisoPrevioLoteFechar()" aria-label="Fechar">×</button></div><form id="pessoal-aviso-lote-form" onsubmit="pessoalAvisoPrevioLoteSalvar(event)"><div class="pessoal-aviso-modal-body"><div class="ps15-lote-resumo"><div><span>Selecionados</span><strong id="pessoal-aviso-lote-total">0</strong></div><div><span>Elegíveis</span><strong id="pessoal-aviso-lote-elegiveis">0</strong></div><div class="impedidos"><span>Impedidos</span><strong id="pessoal-aviso-lote-impedidos-total">0</strong></div></div><div class="ps15-lote-listas"><section><div class="ps15-lote-lista-head"><strong>Pessoas que receberão o aviso</strong><span id="pessoal-aviso-lote-lista-count"></span></div><div id="pessoal-aviso-lote-lista" class="ps15-lote-lista"></div></section><section id="pessoal-aviso-lote-impedidos-box" class="ps15-lote-impedidos-box" hidden><div class="ps15-lote-lista-head"><strong>Não entrarão no lote</strong><span>Revise os motivos abaixo</span></div><div id="pessoal-aviso-lote-impedidos" class="ps15-lote-lista impedidos"></div></section></div><div class="pessoal-aviso-grid ps15-lote-campos"><div class="pessoal-aviso-field"><label for="pessoal-aviso-lote-inicio">Início do aviso</label><input type="date" id="pessoal-aviso-lote-inicio" required></div><div class="pessoal-aviso-field"><label for="pessoal-aviso-lote-fim">Término previsto</label><input type="date" id="pessoal-aviso-lote-fim" required><small>Use a data informada pela empresa. O sistema não calcula o prazo trabalhista.</small></div><div class="pessoal-aviso-field"><label for="pessoal-aviso-lote-tipo">Tipo</label><select id="pessoal-aviso-lote-tipo" required><option value="Trabalhado">Trabalhado</option><option value="Indenizado">Indenizado</option><option value="Misto">Misto</option><option value="Outro">Outro</option></select></div><div class="pessoal-aviso-field"><label for="pessoal-aviso-lote-motivo">Motivo / origem</label><select id="pessoal-aviso-lote-motivo" onchange="pessoalAvisoPrevioLoteMotivoOutro()"><option value="Encerramento de contrato">Encerramento de contrato</option><option value="Redução de efetivo">Redução de efetivo</option><option value="Determinação da empresa">Determinação da empresa</option><option value="Outro">Outro</option></select></div><div id="pessoal-aviso-lote-motivo-outro-box" class="pessoal-aviso-field span2" hidden><label for="pessoal-aviso-lote-motivo-outro">Informe o motivo</label><input type="text" id="pessoal-aviso-lote-motivo-outro" maxlength="180"></div><div class="pessoal-aviso-field span2"><label for="pessoal-aviso-lote-observacao">Observação</label><textarea id="pessoal-aviso-lote-observacao" maxlength="600" placeholder="Opcional"></textarea></div></div><div class="ps15-lote-alerta"><strong>Importante</strong><span>Esta ação registra o aviso prévio individualmente para cada pessoa do lote. Todos continuam no efetivo até que o desligamento seja confirmado.</span></div><div id="pessoal-aviso-lote-erro" class="pessoal-aviso-erro" role="alert"></div></div><div class="pessoal-aviso-modal-actions"><button type="button" onclick="pessoalAvisoPrevioLoteFechar()">Voltar à seleção</button><button type="submit" id="pessoal-aviso-lote-salvar" class="primario">Registrar lote</button></div></form></div>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)window.pessoalAvisoPrevioLoteFechar();});document.body.appendChild(overlay);return overlay;
  }
  function renderModalLote(prep){
    const overlay=garantirModalLote();loteElegiveis=Array.isArray(prep?.elegiveis)?prep.elegiveis:[];loteImpedidos=Array.isArray(prep?.impedidos)?prep.impedidos:[];
    const elegiveisIds=new Set(loteElegiveis.map(x=>Number(x.id)));[...loteSelecionados].forEach(id=>{if(!elegiveisIds.has(Number(id)))loteSelecionados.delete(Number(id));});atualizarBarraLote();
    document.getElementById('pessoal-aviso-lote-total').textContent=String(prep?.total_solicitado??(loteElegiveis.length+loteImpedidos.length));
    document.getElementById('pessoal-aviso-lote-elegiveis').textContent=String(loteElegiveis.length);document.getElementById('pessoal-aviso-lote-impedidos-total').textContent=String(loteImpedidos.length);document.getElementById('pessoal-aviso-lote-lista-count').textContent=`${loteElegiveis.length} pessoa${loteElegiveis.length===1?'':'s'}`;
    document.getElementById('pessoal-aviso-lote-lista').innerHTML=loteElegiveis.length?loteElegiveis.map(x=>`<article><div><strong>${esc(x.nome)}</strong><small>${esc(String(x.empresa||'Empresa não informada').toUpperCase())} · ${esc(x.gerencia||'Gerência não informada')}</small></div><span>${esc(x.contrato||'Sem contrato')}</span></article>`).join(''):'<p class="ps15-vazio">Nenhum funcionário elegível.</p>';
    const impBox=document.getElementById('pessoal-aviso-lote-impedidos-box');impBox.hidden=!loteImpedidos.length;document.getElementById('pessoal-aviso-lote-impedidos').innerHTML=loteImpedidos.map(x=>`<article><div><strong>${esc(x.nome)}</strong><small>${esc(x.motivo||'Não disponível para o lote')}</small></div></article>`).join('');
    const hoje=typeof dataRio==='function'?dataRio():new Date().toISOString().slice(0,10);document.getElementById('pessoal-aviso-lote-inicio').value=hoje;document.getElementById('pessoal-aviso-lote-fim').value='';document.getElementById('pessoal-aviso-lote-tipo').value='Trabalhado';document.getElementById('pessoal-aviso-lote-motivo').value='Encerramento de contrato';document.getElementById('pessoal-aviso-lote-motivo-outro').value='';document.getElementById('pessoal-aviso-lote-observacao').value='';document.getElementById('pessoal-aviso-lote-erro').textContent='';window.pessoalAvisoPrevioLoteMotivoOutro();document.getElementById('pessoal-aviso-lote-salvar').disabled=!loteElegiveis.length;overlay.classList.add('open');document.getElementById('pessoal-aviso-lote-inicio').focus();
  }
  window.pessoalAvisoPrevioLoteContinuar=async function(){
    const ids=[...loteSelecionados];if(!ids.length)return;
    const b=document.getElementById('pessoal-aviso-lote-continuar'),texto=b?.textContent;if(b){b.disabled=true;b.textContent='Conferindo…';}
    try{const {data,error}=await sb.rpc('ap52_aviso_previo_lote_preparar',{p_funcionario_ids:ids});if(error)throw error;renderModalLote(data||{});}
    catch(e){console.error('Falha ao preparar aviso prévio em lote:',e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível conferir a seleção.');}
    finally{if(b){b.disabled=loteSelecionados.size===0;b.textContent=texto||'Continuar';}}
  };
  window.pessoalAvisoPrevioLoteFechar=function(){document.getElementById('pessoal-aviso-lote-overlay')?.classList.remove('open');};
  window.pessoalAvisoPrevioLoteMotivoOutro=function(){const outro=document.getElementById('pessoal-aviso-lote-motivo')?.value==='Outro',box=document.getElementById('pessoal-aviso-lote-motivo-outro-box'),input=document.getElementById('pessoal-aviso-lote-motivo-outro');if(box)box.hidden=!outro;if(input)input.required=outro;};
  window.pessoalAvisoPrevioLoteSalvar=async function(event){
    event.preventDefault();if(!loteElegiveis.length)return;
    const ids=loteElegiveis.map(x=>Number(x.id)),inicio=document.getElementById('pessoal-aviso-lote-inicio').value,fim=document.getElementById('pessoal-aviso-lote-fim').value,tipo=document.getElementById('pessoal-aviso-lote-tipo').value,motivoSel=document.getElementById('pessoal-aviso-lote-motivo').value,motivoOutro=document.getElementById('pessoal-aviso-lote-motivo-outro').value.trim(),obs=document.getElementById('pessoal-aviso-lote-observacao').value.trim(),erro=document.getElementById('pessoal-aviso-lote-erro'),botao=document.getElementById('pessoal-aviso-lote-salvar');
    const motivo=motivoSel==='Outro'?(motivoOutro?`Outro — ${motivoOutro}`:'Outro'):motivoSel;erro.textContent='';if(!inicio||!fim){erro.textContent='Informe as datas de início e término previsto.';return;}if(fim<inicio){erro.textContent='O término previsto não pode ser anterior ao início.';return;}if(motivoSel==='Outro'&&!motivoOutro){erro.textContent='Informe o motivo do aviso prévio.';return;}
    const mensagem=`Registrar aviso prévio para ${ids.length} funcionário${ids.length===1?'':'s'}?\n\nPeríodo: ${data(inicio)} a ${data(fim)}\nTipo: ${tipo}\n\nEsta ação não desliga nenhum funcionário.`;
    let confirmar=true;if(typeof ap52Confirm==='function')confirmar=await ap52Confirm(mensagem,{title:'Confirmar aviso prévio em lote',variant:'warning',confirmText:`Registrar ${ids.length} aviso${ids.length===1?'':'s'}`});else confirmar=window.confirm(mensagem);if(!confirmar)return;
    botao.disabled=true;botao.textContent='Registrando…';
    try{
      const {data:resp,error}=await sb.rpc('ap52_aviso_previo_registrar_lote',{p_funcionario_ids:ids,p_inicio:inicio,p_fim_previsto:fim,p_tipo:tipo,p_motivo:motivo,p_observacao:obs||null});if(error)throw error;
      window.pessoalAvisoPrevioInvalidar(ids);window.pessoalAvisoPrevioLoteFechar();loteModo=false;loteSelecionados.clear();loteElegiveis=[];loteImpedidos=[];if(typeof renderFuncionarios==='function')renderFuncionarios();else atualizarBarraLote();if(typeof ap52Notify==='function')ap52Notify(`${Number(resp?.registrados||ids.length)} avisos prévios registrados. Nenhum funcionário foi desligado.`);
    }catch(e){console.error('Falha ao registrar aviso prévio em lote:',e);erro.textContent=e?.message||'Não foi possível registrar o lote. Revise a seleção e tente novamente.';}
    finally{botao.disabled=false;botao.textContent='Registrar lote';}
  };


  /* Etapa 3 — aviso prévio coletivo por empresa */
  let coletivoEmpresa='';
  let coletivoBase=[];
  let coletivoImpedidos=[];
  const coletivoSelecionados=new Set();

  function empresasColetivoCliente(){
    const mapa=new Map();
    listaFuncionariosLote().forEach(f=>{
      if(!f||String(f.status||'').toLowerCase()==='desligado')return;
      const nome=String(f.empresa||'').trim();if(!nome)return;
      const chave=nome.toLocaleLowerCase('pt-BR');if(!mapa.has(chave))mapa.set(chave,nome);
    });
    return [...mapa.values()].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
  }
  function garantirModalColetivo(){
    let overlay=document.getElementById('pessoal-aviso-coletivo-overlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='pessoal-aviso-coletivo-overlay';overlay.className='pessoal-aviso-overlay pessoal-aviso-coletivo-overlay';
    overlay.innerHTML=`<div class="pessoal-aviso-modal pessoal-aviso-coletivo-modal" role="dialog" aria-modal="true" aria-labelledby="pessoal-aviso-coletivo-titulo"><div class="pessoal-aviso-modal-head"><div><h2 id="pessoal-aviso-coletivo-titulo">Aviso prévio coletivo por empresa</h2><p>Carregue o efetivo atual da empresa, retire as exceções e confirme uma única operação coletiva.</p></div><button type="button" class="pessoal-aviso-modal-fechar" onclick="pessoalAvisoPrevioColetivoFechar()" aria-label="Fechar">×</button></div><form id="pessoal-aviso-coletivo-form" onsubmit="pessoalAvisoPrevioColetivoSalvar(event)"><div class="pessoal-aviso-modal-body"><div class="ps15-coletivo-escolha"><div class="pessoal-aviso-field"><label for="pessoal-aviso-coletivo-empresa">Empresa</label><select id="pessoal-aviso-coletivo-empresa" required></select></div><button type="button" id="pessoal-aviso-coletivo-carregar" class="btn btn-primary" onclick="pessoalAvisoPrevioColetivoCarregar()">Carregar efetivo</button></div><div id="pessoal-aviso-coletivo-conteudo" hidden><div class="ps15-coletivo-resumo"><div><span>Efetivo atual</span><strong id="pessoal-aviso-coletivo-total">0</strong></div><div><span>Elegíveis</span><strong id="pessoal-aviso-coletivo-elegiveis">0</strong></div><div><span>Selecionados</span><strong id="pessoal-aviso-coletivo-selecionados">0</strong></div><div class="excecoes"><span>Exceções</span><strong id="pessoal-aviso-coletivo-excecoes">0</strong></div></div><div class="ps15-coletivo-selecao-head"><div><strong>Quem receberá o aviso</strong><small>Todos os elegíveis começam selecionados. Desmarque apenas as exceções.</small></div><div><button type="button" class="btn btn-ghost" onclick="pessoalAvisoPrevioColetivoSelecionarTodos()">Selecionar todos</button><button type="button" class="btn btn-ghost" onclick="pessoalAvisoPrevioColetivoLimpar()">Limpar</button></div></div><div id="pessoal-aviso-coletivo-lista" class="ps15-coletivo-lista"></div><section id="pessoal-aviso-coletivo-impedidos-box" class="ps15-lote-impedidos-box ps15-coletivo-impedidos" hidden><div class="ps15-lote-lista-head"><strong>Não podem entrar nesta operação</strong><span id="pessoal-aviso-coletivo-impedidos-count"></span></div><div id="pessoal-aviso-coletivo-impedidos" class="ps15-lote-lista impedidos"></div></section><div class="pessoal-aviso-grid ps15-coletivo-campos"><div class="pessoal-aviso-field"><label for="pessoal-aviso-coletivo-inicio">Início do aviso</label><input type="date" id="pessoal-aviso-coletivo-inicio" required></div><div class="pessoal-aviso-field"><label for="pessoal-aviso-coletivo-fim">Término previsto</label><input type="date" id="pessoal-aviso-coletivo-fim" required><small>Use a data informada pela empresa. O sistema não calcula prazo trabalhista automaticamente.</small></div><div class="pessoal-aviso-field"><label for="pessoal-aviso-coletivo-tipo">Tipo</label><select id="pessoal-aviso-coletivo-tipo" required><option value="Trabalhado">Trabalhado</option><option value="Indenizado">Indenizado</option><option value="Misto">Misto</option><option value="Outro">Outro</option></select></div><div class="pessoal-aviso-field"><label for="pessoal-aviso-coletivo-motivo">Motivo / origem</label><select id="pessoal-aviso-coletivo-motivo" onchange="pessoalAvisoPrevioColetivoMotivoOutro()"><option value="Encerramento de contrato">Encerramento de contrato</option><option value="Redução de efetivo">Redução de efetivo</option><option value="Determinação da empresa">Determinação da empresa</option><option value="Outro">Outro</option></select></div><div id="pessoal-aviso-coletivo-motivo-outro-box" class="pessoal-aviso-field span2" hidden><label for="pessoal-aviso-coletivo-motivo-outro">Informe o motivo</label><input type="text" id="pessoal-aviso-coletivo-motivo-outro" maxlength="180"></div><div class="pessoal-aviso-field span2"><label for="pessoal-aviso-coletivo-observacao">Observação</label><textarea id="pessoal-aviso-coletivo-observacao" maxlength="600" placeholder="Opcional"></textarea></div></div><div class="ps15-lote-alerta"><strong>Operação coletiva</strong><span>O sistema cria um aviso individual para cada selecionado, mas mantém todos vinculados à mesma operação. As pessoas desmarcadas ficam registradas como exceções. Ninguém é desligado automaticamente.</span></div></div><div id="pessoal-aviso-coletivo-erro" class="pessoal-aviso-erro" role="alert"></div></div><div class="pessoal-aviso-modal-actions"><button type="button" onclick="pessoalAvisoPrevioColetivoFechar()">Cancelar</button><button type="submit" id="pessoal-aviso-coletivo-salvar" class="primario" disabled>Registrar aviso coletivo</button></div></form></div>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)window.pessoalAvisoPrevioColetivoFechar();});document.body.appendChild(overlay);return overlay;
  }
  function atualizarResumoColetivo(){
    const sel=coletivoSelecionados.size,exc=Math.max(0,coletivoBase.length-sel);
    const s=document.getElementById('pessoal-aviso-coletivo-selecionados'),e=document.getElementById('pessoal-aviso-coletivo-excecoes'),b=document.getElementById('pessoal-aviso-coletivo-salvar');
    if(s)s.textContent=String(sel);if(e)e.textContent=String(exc);if(b)b.disabled=sel===0||coletivoBase.length===0;
  }
  function renderListaColetivo(itens){
    const el=document.getElementById('pessoal-aviso-coletivo-lista');if(!el)return;
    el.innerHTML=itens.length?itens.map(x=>`<label class="ps15-coletivo-pessoa"><input type="checkbox" value="${Number(x.id)}" checked onchange="pessoalAvisoPrevioColetivoAlternar(${Number(x.id)},this.checked)"><span><strong>${esc(x.nome)}</strong><small>${esc(String(x.gerencia||'Gerência não informada'))} · ${esc(x.contrato||'Sem contrato')} · ${esc(x.cargo||'Função não informada')}</small></span></label>`).join(''):'<p class="ps15-vazio">Nenhum funcionário elegível para aviso coletivo.</p>';
  }
  window.pessoalAvisoPrevioColetivoAbrir=function(){
    if(!podeColetivoEmpresa()){if(typeof ap52Notify==='function')ap52Notify('O aviso coletivo por empresa exige acesso global e permissão de edição.');return;}
    if(loteModo)window.pessoalAvisoPrevioLoteCancelarSelecao();
    const overlay=garantirModalColetivo(),select=document.getElementById('pessoal-aviso-coletivo-empresa'),empresas=empresasColetivoCliente();
    select.innerHTML='<option value="">Selecione a empresa</option>'+empresas.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    coletivoEmpresa='';coletivoBase=[];coletivoImpedidos=[];coletivoSelecionados.clear();document.getElementById('pessoal-aviso-coletivo-conteudo').hidden=true;document.getElementById('pessoal-aviso-coletivo-erro').textContent='';document.getElementById('pessoal-aviso-coletivo-salvar').disabled=true;overlay.classList.add('open');select.focus();
  };
  window.pessoalAvisoPrevioColetivoFechar=function(){document.getElementById('pessoal-aviso-coletivo-overlay')?.classList.remove('open');};
  window.pessoalAvisoPrevioColetivoCarregar=async function(){
    const empresa=document.getElementById('pessoal-aviso-coletivo-empresa')?.value?.trim(),erro=document.getElementById('pessoal-aviso-coletivo-erro'),btn=document.getElementById('pessoal-aviso-coletivo-carregar');if(!empresa){erro.textContent='Selecione uma empresa.';return;}
    erro.textContent='';btn.disabled=true;btn.textContent='Conferindo…';
    try{
      const {data:prep,error}=await sb.rpc('ap52_aviso_previo_coletivo_preparar',{p_empresa:empresa});if(error)throw error;
      coletivoEmpresa=String(prep?.empresa||empresa);coletivoBase=Array.isArray(prep?.elegiveis)?prep.elegiveis:[];coletivoImpedidos=Array.isArray(prep?.impedidos)?prep.impedidos:[];coletivoSelecionados.clear();coletivoBase.forEach(x=>coletivoSelecionados.add(Number(x.id)));
      document.getElementById('pessoal-aviso-coletivo-total').textContent=String(prep?.total_efetivo??(coletivoBase.length+coletivoImpedidos.length));document.getElementById('pessoal-aviso-coletivo-elegiveis').textContent=String(coletivoBase.length);renderListaColetivo(coletivoBase);
      const ib=document.getElementById('pessoal-aviso-coletivo-impedidos-box');ib.hidden=!coletivoImpedidos.length;document.getElementById('pessoal-aviso-coletivo-impedidos-count').textContent=`${coletivoImpedidos.length} pessoa${coletivoImpedidos.length===1?'':'s'}`;document.getElementById('pessoal-aviso-coletivo-impedidos').innerHTML=coletivoImpedidos.map(x=>`<article><div><strong>${esc(x.nome)}</strong><small>${esc(x.motivo||'Não disponível')}</small></div></article>`).join('');
      const hoje=typeof dataRio==='function'?dataRio():new Date().toISOString().slice(0,10);document.getElementById('pessoal-aviso-coletivo-inicio').value=hoje;document.getElementById('pessoal-aviso-coletivo-fim').value='';document.getElementById('pessoal-aviso-coletivo-tipo').value='Trabalhado';document.getElementById('pessoal-aviso-coletivo-motivo').value='Encerramento de contrato';document.getElementById('pessoal-aviso-coletivo-motivo-outro').value='';document.getElementById('pessoal-aviso-coletivo-observacao').value='';window.pessoalAvisoPrevioColetivoMotivoOutro();document.getElementById('pessoal-aviso-coletivo-conteudo').hidden=false;atualizarResumoColetivo();document.getElementById('pessoal-aviso-coletivo-conteudo').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){console.error('Falha ao preparar aviso coletivo:',e);erro.textContent=e?.message||'Não foi possível carregar o efetivo da empresa.';document.getElementById('pessoal-aviso-coletivo-conteudo').hidden=true;}
    finally{btn.disabled=false;btn.textContent='Carregar efetivo';}
  };
  window.pessoalAvisoPrevioColetivoAlternar=function(id,checked){id=Number(id);if(checked)coletivoSelecionados.add(id);else coletivoSelecionados.delete(id);atualizarResumoColetivo();};
  window.pessoalAvisoPrevioColetivoSelecionarTodos=function(){coletivoSelecionados.clear();coletivoBase.forEach(x=>coletivoSelecionados.add(Number(x.id)));document.querySelectorAll('#pessoal-aviso-coletivo-lista input[type="checkbox"]').forEach(x=>x.checked=true);atualizarResumoColetivo();};
  window.pessoalAvisoPrevioColetivoLimpar=function(){coletivoSelecionados.clear();document.querySelectorAll('#pessoal-aviso-coletivo-lista input[type="checkbox"]').forEach(x=>x.checked=false);atualizarResumoColetivo();};
  window.pessoalAvisoPrevioColetivoMotivoOutro=function(){const outro=document.getElementById('pessoal-aviso-coletivo-motivo')?.value==='Outro',box=document.getElementById('pessoal-aviso-coletivo-motivo-outro-box'),input=document.getElementById('pessoal-aviso-coletivo-motivo-outro');if(box)box.hidden=!outro;if(input)input.required=outro;};
  window.pessoalAvisoPrevioColetivoSalvar=async function(event){
    event.preventDefault();const erro=document.getElementById('pessoal-aviso-coletivo-erro'),botao=document.getElementById('pessoal-aviso-coletivo-salvar');erro.textContent='';
    if(!coletivoEmpresa||!coletivoBase.length){erro.textContent='Carregue o efetivo da empresa antes de continuar.';return;}
    const ids=[...coletivoSelecionados].sort((a,b)=>a-b),baseIds=coletivoBase.map(x=>Number(x.id)).sort((a,b)=>a-b);if(!ids.length){erro.textContent='Mantenha ao menos um funcionário selecionado.';return;}
    const inicio=document.getElementById('pessoal-aviso-coletivo-inicio').value,fim=document.getElementById('pessoal-aviso-coletivo-fim').value,tipo=document.getElementById('pessoal-aviso-coletivo-tipo').value,motivoSel=document.getElementById('pessoal-aviso-coletivo-motivo').value,motivoOutro=document.getElementById('pessoal-aviso-coletivo-motivo-outro').value.trim(),obs=document.getElementById('pessoal-aviso-coletivo-observacao').value.trim();const motivo=motivoSel==='Outro'?(motivoOutro?`Outro — ${motivoOutro}`:'Outro'):motivoSel;
    if(!inicio||!fim){erro.textContent='Informe as datas de início e término previsto.';return;}if(fim<inicio){erro.textContent='O término previsto não pode ser anterior ao início.';return;}if(motivoSel==='Outro'&&!motivoOutro){erro.textContent='Informe o motivo do aviso prévio.';return;}
    const excecoes=baseIds.length-ids.length,mensagem=`Registrar aviso prévio coletivo da ${coletivoEmpresa}?\n\nEfetivo elegível conferido: ${baseIds.length}\nReceberão o aviso: ${ids.length}\nExceções retiradas: ${excecoes}\nPeríodo: ${data(inicio)} a ${data(fim)}\nTipo: ${tipo}\n\nNenhum funcionário será desligado automaticamente.`;
    let confirmar=true;if(typeof ap52Confirm==='function')confirmar=await ap52Confirm(mensagem,{title:'Confirmar aviso coletivo',variant:'warning',confirmText:`Registrar ${ids.length} aviso${ids.length===1?'':'s'}`});else confirmar=window.confirm(mensagem);if(!confirmar)return;
    botao.disabled=true;botao.textContent='Registrando…';
    try{
      const {data:resp,error}=await sb.rpc('ap52_aviso_previo_registrar_coletivo',{p_empresa:coletivoEmpresa,p_funcionario_ids:ids,p_base_elegivel_ids:baseIds,p_inicio:inicio,p_fim_previsto:fim,p_tipo:tipo,p_motivo:motivo,p_observacao:obs||null});if(error)throw error;
      window.pessoalAvisoPrevioInvalidar(ids);window.pessoalAvisoPrevioColetivoFechar();if(typeof renderFuncionarios==='function')renderFuncionarios();if(typeof ap52Notify==='function')ap52Notify(`${Number(resp?.registrados||ids.length)} avisos coletivos registrados para ${coletivoEmpresa}. ${Number(resp?.excecoes||excecoes)} exceção${Number(resp?.excecoes||excecoes)===1?'':'ões'} preservada${Number(resp?.excecoes||excecoes)===1?'':'s'}.`);
    }catch(e){console.error('Falha ao registrar aviso coletivo:',e);erro.textContent=e?.message||'Não foi possível registrar o aviso coletivo. Recarregue o efetivo e tente novamente.';}
    finally{botao.disabled=false;botao.textContent='Registrar aviso coletivo';}
  };


  /* Etapa 4 — gestão das operações coletivas */
  let operacoesColetivas=[];
  let operacaoColetivaAtual=null;

  function dataHoraOperacao(v){
    if(!v)return '—';
    try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}catch(_){return String(v);}
  }
  function classeStatusOperacao(v){
    const x=String(v||'').toLowerCase();
    return x==='ativa'?'ativa':x==='cancelada'?'cancelada':x==='concluída'?'concluida':'encerrada';
  }
  function garantirModalOperacoes(){
    let overlay=document.getElementById('pessoal-aviso-operacoes-overlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='pessoal-aviso-operacoes-overlay';overlay.className='pessoal-aviso-overlay pessoal-aviso-operacoes-overlay';
    overlay.innerHTML=`<div class="pessoal-aviso-modal pessoal-aviso-operacoes-modal" role="dialog" aria-modal="true" aria-labelledby="pessoal-aviso-operacoes-titulo"><div class="pessoal-aviso-modal-head"><div><h2 id="pessoal-aviso-operacoes-titulo">Operações coletivas</h2><p>Consulte os avisos coletivos já registrados, participantes e exceções.</p></div><button type="button" class="pessoal-aviso-modal-fechar" onclick="pessoalAvisoPrevioOperacoesFechar()" aria-label="Fechar">×</button></div><div class="pessoal-aviso-modal-body"><section id="pessoal-aviso-operacoes-lista-view"><div class="ps15-operacoes-toolbar"><div><strong>Histórico de operações</strong><small>As operações permanecem registradas mesmo depois de canceladas ou concluídas.</small></div><button type="button" class="btn btn-ghost" onclick="pessoalAvisoPrevioOperacoesCarregar(true)">Atualizar</button></div><div id="pessoal-aviso-operacoes-lista" class="ps15-operacoes-lista"><p class="ps15-vazio">Carregando operações…</p></div></section><section id="pessoal-aviso-operacoes-detalhe-view" hidden><div class="ps15-operacoes-voltar"><button type="button" class="btn btn-ghost" onclick="pessoalAvisoPrevioOperacoesVoltar()">← Voltar às operações</button></div><div id="pessoal-aviso-operacoes-detalhe"></div></section><div id="pessoal-aviso-operacoes-erro" class="pessoal-aviso-erro" role="alert"></div></div><div class="pessoal-aviso-modal-actions"><button type="button" onclick="pessoalAvisoPrevioOperacoesFechar()">Fechar</button></div></div>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)window.pessoalAvisoPrevioOperacoesFechar();});document.body.appendChild(overlay);return overlay;
  }
  function renderOperacoesColetivas(){
    const el=document.getElementById('pessoal-aviso-operacoes-lista');if(!el)return;
    if(!operacoesColetivas.length){el.innerHTML='<div class="ps15-operacoes-vazio"><strong>Nenhuma operação coletiva registrada</strong><span>Quando um aviso coletivo por empresa for registrado, ele aparecerá aqui.</span></div>';return;}
    el.innerHTML=operacoesColetivas.map(o=>`<article class="ps15-operacao-card"><div class="ps15-operacao-card-topo"><div><strong>${esc(o.empresa||'Empresa não informada')}</strong><small>Registrada em ${esc(dataHoraOperacao(o.created_at))} por ${esc(o.criado_por||'Usuário AP5.2')}</small></div><span class="ps15-operacao-status ${classeStatusOperacao(o.status)}">${esc(o.status||'—')}</span></div><div class="ps15-operacao-card-resumo"><span><small>Período</small><b>${esc(data(o.inicio))} → ${esc(data(o.fim_previsto))}</b></span><span><small>Registrados</small><b>${Number(o.total_registrado||0)}</b></span><span><small>Ativos</small><b>${Number(o.avisos_ativos||0)}</b></span><span><small>Exceções</small><b>${Number(o.total_excecoes||0)}</b></span></div><div class="ps15-operacao-card-rodape"><span>${esc(o.tipo_aviso||'Tipo não informado')}${o.motivo?` · ${esc(o.motivo)}`:''}</span><button type="button" class="ps15-link" onclick="pessoalAvisoPrevioOperacoesDetalhe('${esc(o.id)}')">Ver detalhes ↗</button></div></article>`).join('');
  }
  window.pessoalAvisoPrevioOperacoesAbrir=function(){
    if(!podeVerOperacoesColetivas()){if(typeof ap52Notify==='function')ap52Notify('A gestão de operações coletivas exige acesso global.');return;}
    if(loteModo)window.pessoalAvisoPrevioLoteCancelarSelecao();
    const overlay=garantirModalOperacoes();overlay.classList.add('open');window.pessoalAvisoPrevioOperacoesVoltar();window.pessoalAvisoPrevioOperacoesCarregar(false);
  };
  window.pessoalAvisoPrevioOperacoesFechar=function(){document.getElementById('pessoal-aviso-operacoes-overlay')?.classList.remove('open');};
  window.pessoalAvisoPrevioOperacoesVoltar=function(){
    operacaoColetivaAtual=null;const l=document.getElementById('pessoal-aviso-operacoes-lista-view'),d=document.getElementById('pessoal-aviso-operacoes-detalhe-view'),e=document.getElementById('pessoal-aviso-operacoes-erro');if(l)l.hidden=false;if(d)d.hidden=true;if(e)e.textContent='';
  };
  window.pessoalAvisoPrevioOperacoesCarregar=async function(force=false){
    const el=document.getElementById('pessoal-aviso-operacoes-lista'),erro=document.getElementById('pessoal-aviso-operacoes-erro');if(erro)erro.textContent='';
    if(operacoesColetivas.length&&!force){renderOperacoesColetivas();return;}
    if(el)el.innerHTML='<p class="ps15-vazio">Carregando operações coletivas…</p>';
    try{const {data:resp,error}=await sb.rpc('ap52_aviso_previo_operacoes_coletivas',{p_limit:50});if(error)throw error;operacoesColetivas=Array.isArray(resp?.itens)?resp.itens:[];renderOperacoesColetivas();}
    catch(e){console.error('Falha ao carregar operações coletivas:',e);if(el)el.innerHTML='<p class="ps15-vazio">Não foi possível carregar as operações.</p>';if(erro)erro.textContent=e?.message||'Falha ao consultar operações coletivas.';}
  };
  function renderOperacaoDetalhe(resp){
    const el=document.getElementById('pessoal-aviso-operacoes-detalhe');if(!el)return;
    const o=resp?.operacao||{},p=Array.isArray(resp?.participantes)?resp.participantes:[],exc=Array.isArray(o.excecoes)?o.excecoes:[];
    const ativos=p.filter(x=>x.status==='Ativo'),cancelados=p.filter(x=>x.status==='Cancelado'),finalizados=p.filter(x=>x.status==='Finalizado');
    const pode=!!resp?.pode_editar&&!o.cancelado_at&&ativos.length>0;
    el.innerHTML=`<article class="ps15-operacao-detalhe-head"><div><span class="ps15-operacao-status ${o.cancelado_at?'cancelada':ativos.length?'ativa':finalizados.length?'concluida':'encerrada'}">${o.cancelado_at?'Cancelada':ativos.length?'Ativa':finalizados.length?'Concluída':'Encerrada'}</span><h3>${esc(o.empresa||'Empresa não informada')}</h3><p>${esc(data(o.inicio))} → ${esc(data(o.fim_previsto))} · ${esc(o.tipo_aviso||'Tipo não informado')}</p></div>${pode?`<button type="button" id="pessoal-aviso-operacao-cancelar" class="btn ps15-operacao-cancelar" onclick="pessoalAvisoPrevioOperacaoCancelar('${esc(o.id)}')">Cancelar avisos ativos</button>`:''}</article><div class="ps15-operacao-detalhe-resumo"><div><span>Base elegível</span><strong>${Number(o.total_base||0)}</strong></div><div><span>Registrados</span><strong>${Number(o.total_registrado||0)}</strong></div><div><span>Ativos</span><strong>${ativos.length}</strong></div><div><span>Cancelados</span><strong>${cancelados.length}</strong></div><div><span>Finalizados</span><strong>${finalizados.length}</strong></div><div><span>Exceções</span><strong>${exc.length}</strong></div></div><section class="ps15-operacao-info"><p><b>Motivo:</b> ${esc(o.motivo||'Não informado')}</p>${o.observacao?`<p><b>Observação:</b> ${esc(o.observacao)}</p>`:''}<p><b>Registrado por:</b> ${esc(o.criado_por||'Usuário AP5.2')} em ${esc(dataHoraOperacao(o.created_at))}</p>${o.cancelado_at?`<p class="cancelado"><b>Cancelada por:</b> ${esc(o.cancelado_por||'Usuário AP5.2')} em ${esc(dataHoraOperacao(o.cancelado_at))}${o.motivo_cancelamento?` · ${esc(o.motivo_cancelamento)}`:''}</p>`:''}</section><section class="ps15-operacao-lista-box"><div class="ps15-lote-lista-head"><strong>Participantes da operação</strong><span>${p.length} pessoa${p.length===1?'':'s'}</span></div><div class="ps15-operacao-participantes">${p.length?p.map(x=>`<article><button type="button" class="ps15-operacao-pessoa" onclick="pessoalAvisoPrevioOperacaoAbrirFuncionario(${Number(x.funcionario_id)})"><span><strong>${esc(x.nome)}</strong><small>${esc(x.gerencia||'Gerência não informada')} · ${esc(x.contrato||'Sem contrato')} · ${esc(x.cargo||'Função não informada')}</small></span><span class="ps15-operacao-pessoa-status ${String(x.status||'').toLowerCase()}">${esc(x.status||'—')}</span></button>${x.status==='Cancelado'&&x.motivo_cancelamento?`<small class="ps15-operacao-motivo-cancelamento">${esc(x.motivo_cancelamento)}</small>`:''}</article>`).join(''):'<p class="ps15-vazio">Nenhum participante registrado.</p>'}</div></section>${exc.length?`<section class="ps15-operacao-lista-box excecoes"><div class="ps15-lote-lista-head"><strong>Exceções preservadas</strong><span>${exc.length} pessoa${exc.length===1?'':'s'}</span></div><div class="ps15-operacao-excecoes">${exc.map(x=>`<article><strong>${esc(x.nome||('Funcionário #'+x.id))}</strong><small>${esc(x.gerencia||'Gerência não informada')} · ${esc(x.contrato||'Sem contrato')}</small></article>`).join('')}</div></section>`:''}`;
  }
  window.pessoalAvisoPrevioOperacoesDetalhe=async function(id){
    const lista=document.getElementById('pessoal-aviso-operacoes-lista-view'),det=document.getElementById('pessoal-aviso-operacoes-detalhe-view'),el=document.getElementById('pessoal-aviso-operacoes-detalhe'),erro=document.getElementById('pessoal-aviso-operacoes-erro');if(lista)lista.hidden=true;if(det)det.hidden=false;if(el)el.innerHTML='<p class="ps15-vazio">Carregando detalhes…</p>';if(erro)erro.textContent='';
    try{const {data:resp,error}=await sb.rpc('ap52_aviso_previo_operacao_coletiva_detalhe',{p_operacao_id:id});if(error)throw error;operacaoColetivaAtual=resp;renderOperacaoDetalhe(resp);}
    catch(e){console.error('Falha ao carregar operação coletiva:',e);if(el)el.innerHTML='<p class="ps15-vazio">Não foi possível carregar os detalhes.</p>';if(erro)erro.textContent=e?.message||'Falha ao consultar a operação.';}
  };
  window.pessoalAvisoPrevioOperacaoAbrirFuncionario=function(id){
    window.pessoalAvisoPrevioOperacoesFechar();if(typeof pessoalPainelAbrirFuncionario==='function')pessoalPainelAbrirFuncionario(Number(id));
  };
  window.pessoalAvisoPrevioOperacaoCancelar=async function(id){
    const resp=operacaoColetivaAtual;if(!resp||String(resp?.operacao?.id)!==String(id))return;
    const ativos=(resp.participantes||[]).filter(x=>x.status==='Ativo');if(!ativos.length){if(typeof ap52Notify==='function')ap52Notify('Esta operação não possui avisos ativos.');return;}
    let motivo='';if(typeof ap52Prompt==='function')motivo=await ap52Prompt('Informe por que o aviso coletivo está sendo cancelado.','',{title:'Cancelar aviso coletivo',confirmText:'Continuar',label:'Motivo do cancelamento',multiline:true,maxLength:300});else motivo=window.prompt('Motivo do cancelamento coletivo:')||'';if(motivo===null)return;motivo=String(motivo||'').trim();if(motivo.length<3){if(typeof ap52Notify==='function')ap52Notify('Informe o motivo do cancelamento.');return;}
    const empresa=resp.operacao?.empresa||'empresa',msg=`Cancelar os ${ativos.length} aviso${ativos.length===1?'':'s'} ainda ativo${ativos.length===1?'':'s'} da operação coletiva da ${empresa}?\n\nOs funcionários continuam no efetivo. O cancelamento ficará registrado no histórico individual e na operação coletiva.`;
    let ok=true;if(typeof ap52Confirm==='function')ok=await ap52Confirm(msg,{title:'Confirmar cancelamento coletivo',variant:'warning',confirmText:`Cancelar ${ativos.length} aviso${ativos.length===1?'':'s'}`});else ok=window.confirm(msg);if(!ok)return;
    const botao=document.getElementById('pessoal-aviso-operacao-cancelar');if(botao){botao.disabled=true;botao.textContent='Cancelando…';}
    const falhas=[];const ids=[];
    for(const item of ativos){
      try{const {error}=await sb.rpc('ap52_aviso_previo_cancelar',{p_id:Number(item.aviso_id),p_motivo_cancelamento:`Cancelamento coletivo — ${motivo}`});if(error)throw error;ids.push(Number(item.funcionario_id));}
      catch(e){console.error('Falha ao cancelar aviso da operação:',item,e);falhas.push({item,error:e});}
    }
    if(!falhas.length){
      try{const {error}=await sb.rpc('ap52_aviso_previo_operacao_marcar_cancelada',{p_operacao_id:id,p_motivo_cancelamento:motivo});if(error)throw error;}
      catch(e){console.error('Falha ao encerrar operação coletiva:',e);falhas.push({item:null,error:e});}
    }
    window.pessoalAvisoPrevioInvalidar(ids);operacoesColetivas=[];
    if(falhas.length){if(typeof ap52Notify==='function')ap52Notify(`${ids.length} aviso${ids.length===1?'':'s'} cancelado${ids.length===1?'':'s'}. ${falhas.length} etapa${falhas.length===1?'':'s'} precisa${falhas.length===1?'':'m'} ser revisada${falhas.length===1?'':'s'}.`);}
    else if(typeof ap52Notify==='function')ap52Notify(`${ids.length} aviso${ids.length===1?'':'s'} cancelado${ids.length===1?'':'s'} e operação coletiva preservada no histórico.`);
    await window.pessoalAvisoPrevioOperacoesDetalhe(id);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalarLoteUI,{once:true});else queueMicrotask(instalarLoteUI);

})();
