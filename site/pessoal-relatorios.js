/* AP5.2 v65.42.112 — Gestão de Pessoal · Relatórios de Efetivo + Snapshot + Excel + Comparação + Modelos rápidos + Favoritos · compatibilidade de modelos */
(function(){
  let dados=null;
  let carregando=false;
  let historico=null;
  let historicoCarregando=false;
  let snapshotAtual=null;
  let snapshotAtualChave=null;
  let snapshotAtualEm=0;
  // v65.42.111: PDF e Excel da mesma relação reutilizam o snapshot só por alguns minutos; depois disso um novo é gravado com a hora atual.
  const SNAPSHOT_REUSO_MS=10*60*1000;
  // v65.42.111: marca gravada dentro da lista de empresas de um MODELO para indicar "todas as empresas do efetivo atual".
  // O banco guarda só as chaves conhecidas do modelo, então a marca viaja na própria lista. Nunca entra em snapshots.
  const MARCA_TODAS_EMPRESAS='(todas as empresas)';
  // v65.42.112: na v110 estas eram todas as empresas existentes. Modelos antigos que gravaram exatamente esse conjunto
  // são interpretados como "Todas as empresas", preservando a intenção original quando surgir uma empresa nova.
  const EMPRESAS_TODAS_LEGADO_V110=['ASM','Enimont','Hapiacá','Lytorânea'];
  // Só configs realmente salvas antes da v112 entram na compatibilidade; uma seleção nova dessas quatro empresas continua sendo uma seleção fixa.
  const CORTE_MODELO_LEGADO_V112=Date.parse('2026-10-05T22:45:00Z');
  let favoritoExportando=false;
  const snapshotCache=new Map();
  let comparacaoCarregando=false;
  let comparacaoAtual=null;
  let modelos=null;
  let modelosCarregando=false;
  let favoritosPainel=null;
  let favoritosPainelCarregando=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const dt=v=>{if(!v)return '—';const s=String(v).slice(0,10).split('-');return s.length===3?`${s[2]}/${s[1]}/${s[0]}`:String(v)};
  const dataHora=v=>{try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(v));}catch(_){return dt(v)}};
  // v65.42.111: data (AAAA-MM-DD) no horário de Brasília para nomes de arquivo; a data UTC virava o dia seguinte à noite.
  const dataArquivo=v=>{const s=String(v||'');if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;try{const d=v?new Date(v):new Date();if(Number.isNaN(d.getTime()))throw new Error('data');const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}catch(_){return s.slice(0,10)||new Date().toISOString().slice(0,10);}};
  const opcaoAusente=v=>`<option value="${esc(v)}">${esc(v)} (sem efetivo hoje)</option>`;
  const ordenar=(a,b)=>String(a||'').localeCompare(String(b||''),'pt-BR',{sensitivity:'base'});
  const labelsSituacao={efetivo:'Todo o efetivo atual',aviso:'Em aviso prévio',sem_aviso:'Sem aviso prévio','Ativo':'Ativos','Férias':'Em férias','Afastado':'Afastados'};
  const labelsAgrupar={empresa:'Empresa',empresa_gerencia:'Empresa → Gerência',gerencia:'Gerência',nenhum:'Sem agrupamento'};
  const labelsOrdem={nome:'Alfabética',gerencia:'Gerência e nome',empresa:'Empresa e nome'};

  function podeVer(){try{return typeof pode28==='function'?pode28('pessoal','visualizar'):true;}catch(_){return true;}}
  function lista(){return Array.isArray(dados?.itens)?dados.itens:[];}
  function unico(campo){return [...new Set(lista().map(x=>String(x?.[campo]||'').trim()).filter(Boolean))].sort(ordenar);}
  function valor(id){return document.getElementById(id)?.value||'';}
  function marcado(id){return !!document.getElementById(id)?.checked;}
  function empresasSelecionadas(){return new Set([...document.querySelectorAll('#pessoal-relatorio-empresas input:checked')].map(i=>i.value));}

  function garantirUI(){
    if(document.getElementById('pessoal-relatorio-overlay'))return;
    const overlay=document.createElement('div');overlay.id='pessoal-relatorio-overlay';overlay.hidden=true;
    overlay.innerHTML=`<div class="pessoal-relatorio-modal" role="dialog" aria-modal="true" aria-labelledby="pessoal-relatorio-titulo">
      <div class="pessoal-relatorio-head"><div><div class="eyebrow">Gestão de Pessoal</div><h2 id="pessoal-relatorio-titulo">Relatórios de Efetivo</h2><p>Gere relações do efetivo e consulte snapshots históricos exatamente como foram emitidos.</p></div><button type="button" class="pessoal-relatorio-fechar" aria-label="Fechar" onclick="pessoalRelatorioEfetivoFechar()">×</button></div>
      <div class="pessoal-relatorio-tabs" role="tablist"><button type="button" id="pessoal-relatorio-tab-gerar" class="ativo" onclick="pessoalRelatorioEfetivoModo('gerar')">Gerar relatório</button><button type="button" id="pessoal-relatorio-tab-modelos" onclick="pessoalRelatorioEfetivoModo('modelos')">Modelos rápidos</button><button type="button" id="pessoal-relatorio-tab-historico" onclick="pessoalRelatorioEfetivoModo('historico')">Histórico</button><button type="button" id="pessoal-relatorio-tab-comparar" onclick="pessoalRelatorioEfetivoModo('comparar')">Comparar snapshots</button></div>
      <div class="pessoal-relatorio-body">
        <div id="pessoal-relatorio-gerador">
          <section class="pessoal-relatorio-filtros" aria-label="Filtros do relatório">
            <div class="pessoal-relatorio-field pessoal-relatorio-empresas-field"><span>Empresas</span><div class="pessoal-relatorio-empresas-box"><div id="pessoal-relatorio-empresas" class="pessoal-relatorio-empresas"></div><div class="pessoal-relatorio-empresas-acoes"><button type="button" onclick="pessoalRelatorioEfetivoEmpresasTodas(true)">Todas</button><button type="button" onclick="pessoalRelatorioEfetivoEmpresasTodas(false)">Limpar</button></div></div></div>
            <label class="pessoal-relatorio-field"><span>Gerência</span><select id="pessoal-relatorio-gerencia" onchange="pessoalRelatorioEfetivoRender()"><option value="">Todas as Gerências</option></select></label>
            <label class="pessoal-relatorio-field"><span>Contrato</span><select id="pessoal-relatorio-contrato" onchange="pessoalRelatorioEfetivoRender()"><option value="">Todos os contratos</option></select></label>
            <label class="pessoal-relatorio-field"><span>Situação</span><select id="pessoal-relatorio-situacao" onchange="pessoalRelatorioEfetivoRender()"><option value="efetivo">Todo o efetivo atual</option><option value="aviso">Em aviso prévio</option><option value="sem_aviso">Sem aviso prévio</option><option value="Ativo">Ativos</option><option value="Férias">Em férias</option><option value="Afastado">Afastados</option></select></label>
            <label class="pessoal-relatorio-field"><span>Agrupar por</span><select id="pessoal-relatorio-agrupar" onchange="pessoalRelatorioEfetivoRender()"><option value="empresa">Empresa</option><option value="empresa_gerencia">Empresa → Gerência</option><option value="gerencia">Gerência</option><option value="nenhum">Sem agrupamento</option></select></label>
            <label class="pessoal-relatorio-field"><span>Ordenar nomes</span><select id="pessoal-relatorio-ordem" onchange="pessoalRelatorioEfetivoRender()"><option value="nome">Alfabética</option><option value="gerencia">Gerência e nome</option><option value="empresa">Empresa e nome</option></select></label>
            <div class="pessoal-relatorio-opcoes"><label class="pessoal-relatorio-check"><input type="checkbox" id="pessoal-relatorio-destacar" checked onchange="pessoalRelatorioEfetivoRender()"> Destacar quem está em aviso prévio</label><button type="button" class="pessoal-relatorio-atualizar" onclick="pessoalRelatorioEfetivoCarregar(true)">Atualizar dados</button></div>
          </section>
          <div id="pessoal-relatorio-status" class="pessoal-relatorio-status" role="status" aria-live="polite"></div>
          <section class="pessoal-relatorio-kpis" aria-label="Resumo do relatório"><article class="pessoal-relatorio-kpi"><span>Nomes</span><strong id="pessoal-relatorio-kpi-total">0</strong></article><article class="pessoal-relatorio-kpi aviso"><span>Em aviso prévio</span><strong id="pessoal-relatorio-kpi-aviso">0</strong></article><article class="pessoal-relatorio-kpi"><span>Empresas</span><strong id="pessoal-relatorio-kpi-empresas">0</strong></article><article class="pessoal-relatorio-kpi"><span>Gerências</span><strong id="pessoal-relatorio-kpi-gerencias">0</strong></article></section>
          <section class="pessoal-relatorio-preview"><div class="pessoal-relatorio-preview-head"><strong>Pré-visualização</strong><span id="pessoal-relatorio-preview-meta">—</span></div><div id="pessoal-relatorio-grupos" class="pessoal-relatorio-grupos"><p class="pessoal-relatorio-vazio">Carregando dados…</p></div></section>
        </div>
        <section id="pessoal-relatorio-modelos" class="pessoal-relatorio-modelos" hidden>
          <div class="pessoal-relatorio-modelos-head"><div><strong>Meus modelos rápidos</strong><p>Salve os filtros que você usa com frequência e reaplique a configuração com um clique. Os modelos são pessoais e não alteram os de outros usuários.</p></div><button type="button" class="pessoal-relatorio-atualizar" onclick="pessoalRelatorioEfetivoModelosCarregar(true)">Atualizar modelos</button></div>
          <div class="pessoal-relatorio-modelo-salvar"><div><strong>Salvar configuração atual</strong><span id="pessoal-relatorio-modelo-config-atual">Use os filtros da aba Gerar relatório e dê um nome para reutilizá-los depois.</span></div><div class="pessoal-relatorio-modelo-salvar-acoes"><label class="pessoal-relatorio-field"><span>Nome do modelo</span><input id="pessoal-relatorio-modelo-nome" type="text" maxlength="80" autocomplete="off" placeholder="Ex.: Hapiacá + Enimont" onkeydown="if(event.key==='Enter'){event.preventDefault();pessoalRelatorioEfetivoModeloSalvar()}"></label><button type="button" id="pessoal-relatorio-modelo-salvar-btn" class="btn btn-primary" onclick="pessoalRelatorioEfetivoModeloSalvar()">Salvar modelo</button></div></div>
          <div id="pessoal-relatorio-modelos-status" class="pessoal-relatorio-status" role="status" aria-live="polite"></div>
          <div id="pessoal-relatorio-modelos-lista" class="pessoal-relatorio-modelos-lista"><p class="pessoal-relatorio-vazio">Carregando modelos…</p></div>
        </section>
        <section id="pessoal-relatorio-historico" class="pessoal-relatorio-historico" hidden>
          <div id="pessoal-relatorio-historico-lista-wrap"><div class="pessoal-relatorio-historico-head"><div><strong>Histórico de relatórios</strong><p>Cada item é um snapshot imutável do efetivo no momento em que o relatório foi gerado.</p></div><button type="button" class="pessoal-relatorio-atualizar" onclick="pessoalRelatorioEfetivoHistoricoCarregar(true)">Atualizar histórico</button></div><div id="pessoal-relatorio-historico-status" class="pessoal-relatorio-status" role="status" aria-live="polite"></div><div id="pessoal-relatorio-historico-lista" class="pessoal-relatorio-historico-lista"><p class="pessoal-relatorio-vazio">Carregando histórico…</p></div></div>
          <div id="pessoal-relatorio-historico-detalhe" hidden></div>
        </section>
        <section id="pessoal-relatorio-comparar" class="pessoal-relatorio-comparar" hidden>
          <div class="pessoal-relatorio-comparar-head"><div><strong>Comparar snapshots</strong><p>Compare dois quadros históricos para identificar quem entrou ou saiu da relação e quais dados mudaram.</p></div><button type="button" class="pessoal-relatorio-atualizar" onclick="pessoalRelatorioEfetivoCompararPreparar(true)">Atualizar histórico</button></div>
          <div class="pessoal-relatorio-comparar-selecao">
            <label class="pessoal-relatorio-field"><span>Relatório anterior</span><select id="pessoal-relatorio-comparar-anterior"></select></label>
            <button type="button" class="pessoal-relatorio-trocar" title="Trocar os relatórios" aria-label="Trocar os relatórios" onclick="pessoalRelatorioEfetivoCompararTrocar()">⇄</button>
            <label class="pessoal-relatorio-field"><span>Relatório mais recente</span><select id="pessoal-relatorio-comparar-atual"></select></label>
            <button type="button" id="pessoal-relatorio-comparar-btn" class="btn btn-primary" onclick="pessoalRelatorioEfetivoCompararExecutar()">Comparar</button>
          </div>
          <div id="pessoal-relatorio-comparar-status" class="pessoal-relatorio-status" role="status" aria-live="polite"></div>
          <div id="pessoal-relatorio-comparar-resultado" class="pessoal-relatorio-comparar-resultado"><p class="pessoal-relatorio-vazio">Escolha dois snapshots para comparar.</p></div>
        </section>
      </div>
      <div class="pessoal-relatorio-footer"><p id="pessoal-relatorio-footer-texto">Ao exportar, uma cópia imutável da relação é salva no histórico antes de gerar o arquivo.</p><div class="pessoal-relatorio-footer-acoes"><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioEfetivoFechar()">Fechar</button><button type="button" id="pessoal-relatorio-excel" class="btn btn-ghost" onclick="pessoalRelatorioEfetivoExcel()">Exportar Excel</button><button type="button" id="pessoal-relatorio-imprimir" class="btn btn-primary" onclick="pessoalRelatorioEfetivoImprimir()">Gerar / salvar PDF</button></div></div>
    </div>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)window.pessoalRelatorioEfetivoFechar();});document.body.appendChild(overlay);
  }

  function instalarBotao(){
    const view=document.getElementById('view-funcionarios'),actions=view?.querySelector('.pessoal-page-actions');if(!view||!actions||document.getElementById('pessoal-relatorio-btn'))return;
    const b=document.createElement('button');b.type='button';b.id='pessoal-relatorio-btn';b.className='btn btn-ghost';b.textContent='Relatórios de efetivo';b.onclick=window.pessoalRelatorioEfetivoAbrir;b.hidden=!podeVer();actions.insertBefore(b,actions.firstChild);
    // v65.42.111: as permissões chegam do banco depois que a página carrega; reavalia quando o app é liberado e quando a tela é aberta.
    const reavaliar=()=>{const x=document.getElementById('pessoal-relatorio-btn');if(x)x.hidden=!podeVer();};
    const shell=document.getElementById('app-shell');
    if(shell)new MutationObserver(reavaliar).observe(shell,{attributes:true,attributeFilter:['style']});
    new MutationObserver(reavaliar).observe(view,{attributes:true,attributeFilter:['class','style']});
  }

  function preencherSelect(id,valores,rotulo){const el=document.getElementById(id);if(!el)return;const atual=el.value;el.innerHTML=`<option value="">${esc(rotulo)}</option>`+valores.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(atual&&!valores.includes(atual))el.insertAdjacentHTML('beforeend',opcaoAusente(atual));if([...el.options].some(o=>o.value===atual))el.value=atual;}
  function preencherEmpresas(){const box=document.getElementById('pessoal-relatorio-empresas');if(!box)return;const anteriores=new Set([...box.querySelectorAll('input:checked')].map(i=>i.value));const primeira=!box.querySelector('input');box.innerHTML=unico('empresa').map(v=>`<label><input type="checkbox" value="${esc(v)}" ${primeira||anteriores.has(v)?'checked':''} onchange="pessoalRelatorioEfetivoRender()"><span>${esc(v)}</span></label>`).join('');}
  window.pessoalRelatorioEfetivoEmpresasTodas=function(marcar){document.querySelectorAll('#pessoal-relatorio-empresas input').forEach(i=>i.checked=!!marcar);window.pessoalRelatorioEfetivoRender();};
  function preencherFiltros(){preencherEmpresas();preencherSelect('pessoal-relatorio-gerencia',unico('gerencia'),'Todas as Gerências');preencherSelect('pessoal-relatorio-contrato',unico('contrato'),'Todos os contratos');}

  function configAtual(){return {empresas:[...empresasSelecionadas()],gerencia:valor('pessoal-relatorio-gerencia'),contrato:valor('pessoal-relatorio-contrato'),situacao:valor('pessoal-relatorio-situacao')||'efetivo',agrupar:valor('pessoal-relatorio-agrupar')||'empresa',ordem:valor('pessoal-relatorio-ordem')||'nome',destacar_aviso:marcado('pessoal-relatorio-destacar')};}

  function ordenarItens(itens,ordem){const a=[...(itens||[])];a.sort((x,y)=>{if(ordem==='gerencia')return ordenar(x.gerencia,y.gerencia)||ordenar(x.nome,y.nome);if(ordem==='empresa')return ordenar(x.empresa,y.empresa)||ordenar(x.nome,y.nome);return ordenar(x.nome,y.nome);});return a;}
  function filtrados(){
    const cfg=configAtual(),empresas=new Set(cfg.empresas);
    return ordenarItens(lista().filter(x=>{if(!empresas.has(String(x.empresa||'')))return false;if(cfg.gerencia&&x.gerencia!==cfg.gerencia)return false;if(cfg.contrato&&x.contrato!==cfg.contrato)return false;if(cfg.situacao==='aviso'&&!x.aviso_previo)return false;if(cfg.situacao==='sem_aviso'&&x.aviso_previo)return false;if(!['efetivo','aviso','sem_aviso'].includes(cfg.situacao)&&String(x.situacao||'')!==cfg.situacao)return false;return true;}),cfg.ordem);
  }
  function statusHtml(x){const base=esc(x.situacao||'Ativo');if(!x.aviso_previo)return base;const prazo=Number(x.aviso_dias_restantes);const texto=prazo<0?`Prazo encerrado em ${dt(x.aviso_fim)}`:`Aviso até ${dt(x.aviso_fim)}`;return `${base}<br><span class="pessoal-relatorio-chip-aviso">${esc(texto)}</span>`;}
  function gruposPorConfig(itens,cfg){const modo=cfg?.agrupar||'empresa',m=new Map();(itens||[]).forEach(x=>{let chave='Efetivo selecionado';if(modo==='empresa')chave=x.empresa||'Empresa não informada';else if(modo==='gerencia')chave=x.gerencia||'Gerência não informada';else if(modo==='empresa_gerencia')chave=`${x.empresa||'Empresa não informada'} · ${x.gerencia||'Gerência não informada'}`;if(!m.has(chave))m.set(chave,[]);m.get(chave).push(x);});return [...m.entries()].sort((a,b)=>ordenar(a[0],b[0]));}
  function linha(x,i,destacar){return `<tr class="${destacar&&x.aviso_previo?'em-aviso':''}"><td class="num">${i+1}</td><td class="nome">${esc(x.nome)}</td><td class="empresa">${esc(x.empresa)}</td><td class="gerencia">${esc(x.gerencia)}</td><td class="cargo">${esc(x.cargo)}</td><td class="situacao">${statusHtml(x)}</td></tr>`;}

  window.pessoalRelatorioEfetivoRender=function(){
    if(!dados)return;const cfg=configAtual(),itens=filtrados(),destacar=cfg.destacar_aviso,gs=gruposPorConfig(itens,cfg),box=document.getElementById('pessoal-relatorio-grupos');
    document.getElementById('pessoal-relatorio-kpi-total').textContent=String(itens.length);document.getElementById('pessoal-relatorio-kpi-aviso').textContent=String(itens.filter(x=>x.aviso_previo).length);document.getElementById('pessoal-relatorio-kpi-empresas').textContent=String(new Set(itens.map(x=>x.empresa)).size);document.getElementById('pessoal-relatorio-kpi-gerencias').textContent=String(new Set(itens.map(x=>x.gerencia)).size);document.getElementById('pessoal-relatorio-preview-meta').textContent=`${itens.length} nome${itens.length===1?'':'s'} · ${gs.length} grupo${gs.length===1?'':'s'}`;
    const b=document.getElementById('pessoal-relatorio-imprimir'),bx=document.getElementById('pessoal-relatorio-excel');if(b)b.disabled=!itens.length;if(bx)bx.disabled=!itens.length;
    if(!box)return;if(!itens.length){box.innerHTML='<p class="pessoal-relatorio-vazio">Nenhum funcionário corresponde aos filtros selecionados.</p>';return;}
    box.innerHTML=gs.map(([nome,arr])=>`<article class="pessoal-relatorio-grupo"><header><strong>${esc(nome)}</strong><span>${arr.length} nome${arr.length===1?'':'s'}</span></header><table class="pessoal-relatorio-tabela"><thead><tr><th class="num">#</th><th class="nome">Nome</th><th class="empresa">Empresa</th><th class="gerencia">Gerência</th><th class="cargo">Função</th><th class="situacao">Situação</th></tr></thead><tbody>${arr.map((x,i)=>linha(x,i,destacar)).join('')}</tbody></table></article>`).join('');
  };

  window.pessoalRelatorioEfetivoCarregar=async function(force=false){
    garantirUI();const status=document.getElementById('pessoal-relatorio-status');if(carregando)return;if(dados&&!force){preencherFiltros();window.pessoalRelatorioEfetivoRender();return;}carregando=true;if(status){status.className='pessoal-relatorio-status';status.textContent='Atualizando o efetivo atual…';}
    try{const {data:resp,error}=await sb.rpc('ap52_relatorio_efetivo_dados');if(error)throw error;dados=resp||{itens:[]};preencherFiltros();if(status)status.textContent=`Dados atualizados em ${dataHora(dados.gerado_em)} · ${Number(dados.total||0)} pessoa${Number(dados.total||0)===1?'':'s'} no efetivo acessível.`;window.pessoalRelatorioEfetivoRender();atualizarResumoModeloAtual();}
    catch(e){console.error('Falha ao carregar relatório de efetivo:',e);dados=null;if(status){status.className='pessoal-relatorio-status erro';status.textContent=e?.message||'Não foi possível carregar o efetivo.';}const box=document.getElementById('pessoal-relatorio-grupos');if(box)box.innerHTML='<p class="pessoal-relatorio-vazio">Não foi possível carregar os dados do relatório.</p>';}
    finally{carregando=false;}
  };

  window.pessoalRelatorioEfetivoModo=function(modo){
    garantirUI();const hist=modo==='historico',comp=modo==='comparar',mods=modo==='modelos',gerar=!hist&&!comp&&!mods;document.getElementById('pessoal-relatorio-gerador').hidden=!gerar;document.getElementById('pessoal-relatorio-modelos').hidden=!mods;document.getElementById('pessoal-relatorio-historico').hidden=!hist;document.getElementById('pessoal-relatorio-comparar').hidden=!comp;document.getElementById('pessoal-relatorio-tab-gerar').classList.toggle('ativo',gerar);document.getElementById('pessoal-relatorio-tab-modelos').classList.toggle('ativo',mods);document.getElementById('pessoal-relatorio-tab-historico').classList.toggle('ativo',hist);document.getElementById('pessoal-relatorio-tab-comparar').classList.toggle('ativo',comp);const print=document.getElementById('pessoal-relatorio-imprimir'),excel=document.getElementById('pessoal-relatorio-excel');if(print)print.hidden=!gerar;if(excel)excel.hidden=!gerar;const foot=document.getElementById('pessoal-relatorio-footer-texto');if(foot)foot.textContent=hist?'Os relatórios históricos permanecem exatamente como foram gerados e podem ser reexportados em PDF ou Excel.':comp?'Entradas e saídas significam entrada ou saída da relação comparada; não representam, por si só, admissão ou desligamento.':mods?'Os modelos salvam somente os filtros do relatório. Gerar PDF ou Excel continua criando o snapshot histórico normalmente.':'Ao exportar, uma cópia imutável da relação é salva no histórico antes de gerar o arquivo.';if(hist)window.pessoalRelatorioEfetivoHistoricoCarregar(false);else if(comp)window.pessoalRelatorioEfetivoCompararPreparar(false);else if(mods){atualizarResumoModeloAtual();window.pessoalRelatorioEfetivoModelosCarregar(false);}else window.pessoalRelatorioEfetivoCarregar(false);
  };

  window.pessoalRelatorioEfetivoAbrir=function(){if(!podeVer()){if(typeof ap52Notify==='function')ap52Notify('Seu perfil não permite visualizar Gestão de Pessoal.');return;}garantirUI();const o=document.getElementById('pessoal-relatorio-overlay');o.hidden=false;document.body.style.overflow='hidden';window.pessoalRelatorioEfetivoModo('gerar');setTimeout(()=>document.querySelector('#pessoal-relatorio-empresas input')?.focus(),60);};
  window.pessoalRelatorioEfetivoAbrirModelos=function(){if(!podeVer()){if(typeof ap52Notify==='function')ap52Notify('Seu perfil não permite visualizar Gestão de Pessoal.');return;}garantirUI();const o=document.getElementById('pessoal-relatorio-overlay');o.hidden=false;document.body.style.overflow='hidden';window.pessoalRelatorioEfetivoModo('modelos');};
  window.pessoalRelatorioEfetivoFechar=function(){const o=document.getElementById('pessoal-relatorio-overlay');if(o)o.hidden=true;document.body.style.overflow='';};

  const normalizaEmpresaModelo=v=>String(v||'').trim().toLocaleLowerCase('pt-BR');
  const modeloEmpresas=cfg=>(Array.isArray(cfg?.empresas)?cfg.empresas:[]).filter(e=>e!==MARCA_TODAS_EMPRESAS);
  function modeloLegadoTodasEmpresas(modeloOuCfg){
    const m=modeloOuCfg&&modeloOuCfg.config?modeloOuCfg:null;if(!m)return false;const quando=Date.parse(m.updated_at||m.created_at||'');if(!Number.isFinite(quando)||quando>=CORTE_MODELO_LEGADO_V112)return false;const cfg=m.config||{},emp=modeloEmpresas(cfg),set=new Set(emp.map(normalizaEmpresaModelo));
    if(!emp.length)return false;
    const nome=String(m.nome||'').trim();
    if(/^(efetivo\s*(completo|geral|total)|todas?\s+as\s+empresas|todos?\s+os\s+funcion[aá]rios)$/i.test(nome))return true;
    const legado=EMPRESAS_TODAS_LEGADO_V110.map(normalizaEmpresaModelo);
    return set.size===legado.length&&legado.every(x=>set.has(x));
  }
  const modeloTodasEmpresas=modeloOuCfg=>{const cfg=modeloOuCfg&&modeloOuCfg.config?modeloOuCfg.config:modeloOuCfg;return Array.isArray(cfg?.empresas)&&cfg.empresas.includes(MARCA_TODAS_EMPRESAS)||modeloLegadoTodasEmpresas(modeloOuCfg);};
  function configModeloCompativel(modeloOuCfg){const m=modeloOuCfg&&modeloOuCfg.config?modeloOuCfg:null,cfg=m?.config||modeloOuCfg||{};if(!modeloTodasEmpresas(modeloOuCfg)||Array.isArray(cfg.empresas)&&cfg.empresas.includes(MARCA_TODAS_EMPRESAS))return cfg;return {...cfg,empresas:[MARCA_TODAS_EMPRESAS,...modeloEmpresas(cfg)]};}
  // Configuração gravada no modelo: igual à do relatório, com a marca de "todas" quando todas as empresas do efetivo estão marcadas.
  function configModeloAtual(){const cfg=configAtual(),todas=unico('empresa');if(todas.length&&cfg.empresas.length===todas.length)cfg.empresas=[MARCA_TODAS_EMPRESAS,...cfg.empresas];return cfg;}
  function resumoModeloConfig(modeloOuCfg){
    const m=modeloOuCfg&&modeloOuCfg.config?modeloOuCfg:null,cfg=configModeloCompativel(modeloOuCfg),emp=modeloEmpresas(cfg);const partes=[`Empresas: ${modeloTodasEmpresas(modeloOuCfg)?'Todas (inclui empresas novas)':emp.length?emp.join(', '):'nenhuma selecionada'}`];if(cfg?.gerencia)partes.push(`Gerência: ${cfg.gerencia}`);if(cfg?.contrato)partes.push(`Contrato: ${cfg.contrato}`);partes.push(`Situação: ${labelsSituacao[cfg?.situacao]||'Todo o efetivo atual'}`);partes.push(`Agrupar: ${labelsAgrupar[cfg?.agrupar]||'Empresa'}`);partes.push(`Ordem: ${labelsOrdem[cfg?.ordem]||'Alfabética'}`);return partes.join(' · ');
  }
  function atualizarResumoModeloAtual(){const el=document.getElementById('pessoal-relatorio-modelo-config-atual');if(el)el.textContent=resumoModeloConfig(configModeloAtual());}
  function cardModelo(m){const fav=!!m?.favorito;return `<article class="pessoal-relatorio-modelo-card${fav?' favorito':''}"><div class="pessoal-relatorio-modelo-card-top"><div><strong>${esc(m.nome||'Modelo')}</strong><span>Atualizado em ${esc(dataHora(m.updated_at||m.created_at))}</span></div><div class="pessoal-relatorio-modelo-card-meta"><button type="button" class="pessoal-relatorio-modelo-favorito${fav?' ativo':''}" onclick="pessoalRelatorioEfetivoModeloFavoritar('${esc(m.id)}',${fav?'false':'true'})" aria-label="${fav?'Remover dos favoritos':'Adicionar aos favoritos'}" title="${fav?'Remover dos favoritos':'Mostrar no Painel'}">${fav?'★':'☆'}</button><span class="pessoal-relatorio-modelo-chip">${fav?'Favorito':'Meu modelo'}</span></div></div><p>${esc(resumoModeloConfig(m))}</p><div class="pessoal-relatorio-modelo-card-acoes"><button type="button" class="btn btn-primary" onclick="pessoalRelatorioEfetivoModeloAplicar('${esc(m.id)}')">Aplicar filtros</button><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioEfetivoModeloExcluir('${esc(m.id)}')">Excluir</button></div></article>`;}
  function renderModelos(){const box=document.getElementById('pessoal-relatorio-modelos-lista');if(!box)return;const a=Array.isArray(modelos)?modelos:[];box.innerHTML=a.length?a.map(cardModelo).join(''):'<p class="pessoal-relatorio-vazio">Você ainda não salvou nenhum modelo. Configure um relatório e salve o primeiro atalho.</p>';}

  window.pessoalRelatorioEfetivoModelosCarregar=async function(force=false){
    garantirUI();const status=document.getElementById('pessoal-relatorio-modelos-status');if(modelosCarregando)return;if(modelos&&!force){renderModelos();return;}modelosCarregando=true;if(status){status.className='pessoal-relatorio-status';status.textContent='Carregando seus modelos…';}
    try{const {data:resp,error}=await sb.rpc('ap52_relatorio_efetivo_modelos');if(error)throw error;modelos=Array.isArray(resp?.itens)?resp.itens:[];if(status)status.textContent=modelos.length?`${modelos.length} modelo${modelos.length===1?'':'s'} salvo${modelos.length===1?'':'s'} na sua conta.`:'Nenhum modelo salvo ainda.';renderModelos();}
    catch(e){console.error('Falha ao carregar modelos de relatório:',e);modelos=[];if(status){status.className='pessoal-relatorio-status erro';status.textContent=e?.message||'Não foi possível carregar os modelos.';}renderModelos();}
    finally{modelosCarregando=false;}
  };

  window.pessoalRelatorioEfetivoModeloFavoritar=async function(id,favorito){
    const m=(Array.isArray(modelos)?modelos:[]).find(x=>String(x.id)===String(id));if(!m){if(typeof ap52Notify==='function')ap52Notify('Modelo não encontrado. Atualize a lista.');return;}
    try{const {data:resp,error}=await sb.rpc('ap52_relatorio_efetivo_modelo_favoritar',{p_id:id,p_favorito:!!favorito});if(error)throw error;m.favorito=!!resp?.favorito;m.favoritado_at=m.favorito?new Date().toISOString():null;m.updated_at=new Date().toISOString();favoritosPainel=null;renderModelos();await window.pessoalRelatorioFavoritosPainelCarregar(true);if(typeof ap52Notify==='function')ap52Notify(m.favorito?'Modelo adicionado aos favoritos do Painel.':'Modelo removido dos favoritos.');}
    catch(e){console.error('Falha ao alterar favorito de relatório:',e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível alterar o favorito.');}
  };

  window.pessoalRelatorioEfetivoModeloSalvar=async function(){
    const nome=document.getElementById('pessoal-relatorio-modelo-nome')?.value?.trim()||'',btn=document.getElementById('pessoal-relatorio-modelo-salvar-btn');if(nome.length<3){if(typeof ap52Notify==='function')ap52Notify('Digite um nome com pelo menos 3 caracteres para o modelo.');return;}if(!await aguardarDadosRelatorio()){if(typeof ap52Notify==='function')ap52Notify('Aguarde o carregamento do efetivo antes de salvar o modelo.');return;}const original=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Conferindo…';}
    try{
      const {data:listResp,error:listError}=await sb.rpc('ap52_relatorio_efetivo_modelos');if(listError)throw listError;const listaServidor=Array.isArray(listResp?.itens)?listResp.itens:[];const chave=nome.toLocaleLowerCase('pt-BR');const existente=listaServidor.find(x=>String(x?.nome||'').trim().toLocaleLowerCase('pt-BR')===chave);
      if(existente){let ok=true;const msg=`Já existe um modelo chamado “${existente.nome}”.\n\nDeseja substituir os filtros salvos por esta configuração?`;if(typeof ap52Confirm==='function')ok=await ap52Confirm(msg,{title:'Atualizar modelo de relatório',variant:'warning',confirmText:'Atualizar modelo'});else ok=window.confirm(msg);if(!ok)return;}
      if(btn)btn.textContent='Salvando…';const {data:resp,error}=await sb.rpc('ap52_relatorio_efetivo_modelo_salvar',{p_nome:nome,p_config:configModeloAtual()});if(error)throw error;modelos=null;favoritosPainel=null;const input=document.getElementById('pessoal-relatorio-modelo-nome');if(input)input.value='';await window.pessoalRelatorioEfetivoModelosCarregar(true);window.pessoalRelatorioFavoritosPainelCarregar(true);if(typeof ap52Notify==='function')ap52Notify(resp?.novo===false?'Modelo atualizado com os filtros atuais.':'Modelo salvo.');
    }
    catch(e){console.error('Falha ao salvar modelo:',e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível salvar o modelo.');}
    finally{if(btn){btn.disabled=false;btn.textContent=original||'Salvar modelo';}}
  };

  async function aguardarDadosRelatorio(){if(dados)return true;window.pessoalRelatorioEfetivoCarregar(false);for(let i=0;i<100&&!dados;i++){if(!carregando&&i>1)break;await new Promise(r=>setTimeout(r,50));}return !!dados;}
  // v65.42.111: recarrega o efetivo do banco (atalhos do Painel não podem usar a lista guardada na sessão).
  async function recarregarDadosRelatorio(){for(let i=0;i<200&&carregando;i++)await new Promise(r=>setTimeout(r,50));await window.pessoalRelatorioEfetivoCarregar(true);return !!dados;}
  // Aplica o modelo e devolve avisos sobre filtros do modelo que hoje não têm ninguém.
  // v65.42.111: Gerência/contrato inexistentes permanecem selecionados (resultado vazio) em vez de virar "todos".
  function aplicarConfigModelo(cfg){
    const avisos=[];['pessoal-relatorio-gerencia','pessoal-relatorio-contrato'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    preencherFiltros();const todas=modeloTodasEmpresas(cfg),lista=modeloEmpresas(cfg),emp=new Set(lista),atuais=unico('empresa');document.querySelectorAll('#pessoal-relatorio-empresas input').forEach(i=>i.checked=todas||emp.has(i.value));
    if(!todas){const faltam=lista.filter(e=>!atuais.includes(e));if(faltam.length)avisos.push(faltam.length===1?`A empresa “${faltam[0]}” não está mais no efetivo atual.`:`${faltam.length} empresas do modelo não estão mais no efetivo atual.`);}
    const setSelect=(id,v,fallback='')=>{const el=document.getElementById(id);if(!el)return;const val=String(v??'');el.value=[...el.options].some(o=>o.value===val)?val:fallback;};
    const setFiltro=(id,v,rotulo)=>{const el=document.getElementById(id);if(!el)return;const val=String(v??'');if(val&&![...el.options].some(o=>o.value===val)){el.insertAdjacentHTML('beforeend',opcaoAusente(val));avisos.push(`${rotulo} “${val}” não tem ninguém no efetivo atual.`);}el.value=val;};
    setFiltro('pessoal-relatorio-gerencia',cfg?.gerencia||'','A Gerência');setFiltro('pessoal-relatorio-contrato',cfg?.contrato||'','O contrato');setSelect('pessoal-relatorio-situacao',cfg?.situacao||'efetivo','efetivo');setSelect('pessoal-relatorio-agrupar',cfg?.agrupar||'empresa','empresa');setSelect('pessoal-relatorio-ordem',cfg?.ordem||'nome','nome');const d=document.getElementById('pessoal-relatorio-destacar');if(d)d.checked=cfg?.destacar_aviso!==false;window.pessoalRelatorioEfetivoRender();return avisos;
  }
  window.pessoalRelatorioEfetivoModeloAplicar=async function(id){
    const m=(Array.isArray(modelos)?modelos:[]).find(x=>String(x.id)===String(id));if(!m){if(typeof ap52Notify==='function')ap52Notify('Modelo não encontrado. Atualize a lista.');return;}window.pessoalRelatorioEfetivoModo('gerar');if(!await aguardarDadosRelatorio()){if(typeof ap52Notify==='function')ap52Notify('Não foi possível carregar o efetivo para aplicar o modelo.');return;}const avisos=aplicarConfigModelo(configModeloCompativel(m));if(typeof ap52Notify==='function')ap52Notify([`Modelo “${m.nome}” aplicado.`,...avisos].join(' '));
  };
  window.pessoalRelatorioEfetivoModeloExcluir=async function(id){
    const m=(Array.isArray(modelos)?modelos:[]).find(x=>String(x.id)===String(id));if(!m)return;let ok=true;if(typeof ap52Confirm==='function')ok=await ap52Confirm(`Excluir o modelo “${m.nome}”?\n\nIsso remove somente o atalho de filtros. Nenhum relatório histórico será apagado.`,{title:'Excluir modelo de relatório',variant:'danger',confirmText:'Excluir'});else ok=window.confirm(`Excluir o modelo “${m.nome}”?`);if(!ok)return;
    try{const {error}=await sb.rpc('ap52_relatorio_efetivo_modelo_excluir',{p_id:id});if(error)throw error;modelos=(modelos||[]).filter(x=>String(x.id)!==String(id));favoritosPainel=null;renderModelos();window.pessoalRelatorioFavoritosPainelCarregar(true);const status=document.getElementById('pessoal-relatorio-modelos-status');if(status)status.textContent=modelos.length?`${modelos.length} modelo${modelos.length===1?'':'s'} salvo${modelos.length===1?'':'s'} na sua conta.`:'Nenhum modelo salvo ainda.';if(typeof ap52Notify==='function')ap52Notify('Modelo excluído.');}
    catch(e){console.error('Falha ao excluir modelo:',e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível excluir o modelo.');}
  };

  function resumoFavoritoPainel(modeloOuCfg){const cfg=configModeloCompativel(modeloOuCfg),emp=modeloEmpresas(cfg);const partes=[];if(modeloTodasEmpresas(modeloOuCfg))partes.push('Todas as empresas');else if(emp.length===1)partes.push(emp[0]);else if(emp.length===2)partes.push(emp.join(' + '));else if(emp.length>2)partes.push(`${emp.length} empresas`);else partes.push('Nenhuma empresa');if(cfg?.gerencia)partes.push(cfg.gerencia);if(cfg?.contrato)partes.push(cfg.contrato);partes.push(labelsSituacao[cfg?.situacao]||'Todo o efetivo atual');return partes.join(' · ');}
  function cardFavoritoPainel(m){return `<article class="pessoal-relatorios-rapidos-card"><div class="pessoal-relatorios-rapidos-card-top"><span class="pessoal-relatorios-rapidos-estrela" aria-hidden="true">★</span><div><strong>${esc(m.nome||'Modelo favorito')}</strong><span>${esc(resumoFavoritoPainel(m))}</span></div></div><div class="pessoal-relatorios-rapidos-card-acoes"><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioFavoritoAbrir('${esc(m.id)}')">Abrir</button><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioFavoritoExportar('${esc(m.id)}','excel')">Excel</button><button type="button" class="btn btn-primary" onclick="pessoalRelatorioFavoritoExportar('${esc(m.id)}','pdf')">PDF</button></div></article>`;}
  function renderFavoritosPainel(){const box=document.getElementById('pessoal-relatorios-rapidos-lista'),status=document.getElementById('pessoal-relatorios-rapidos-status');if(!box)return;const a=Array.isArray(favoritosPainel)?favoritosPainel:[];if(status)status.textContent=a.length?`${a.length} de 4 favorito${a.length===1?'':'s'} no Painel`:'Nenhum favorito';box.innerHTML=a.length?a.map(cardFavoritoPainel).join(''):`<div class="pessoal-relatorios-rapidos-vazio"><div><strong>Nenhum relatório favorito ainda</strong><span>Abra Modelos rápidos e marque com ★ os relatórios que você usa com mais frequência.</span></div><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioEfetivoAbrirModelos()">Escolher favoritos</button></div>`;}
  window.pessoalRelatorioFavoritosPainelCarregar=async function(force=false){const box=document.getElementById('pessoal-relatorios-rapidos-lista');if(!box||!podeVer()||!sb)return;if(favoritosPainelCarregando)return;if(favoritosPainel&&!force){renderFavoritosPainel();return;}favoritosPainelCarregando=true;box.innerHTML='<p class="pessoal-relatorios-rapidos-loading">Carregando atalhos…</p>';try{const {data:resp,error}=await sb.rpc('ap52_relatorio_efetivo_modelos_favoritos');if(error)throw error;favoritosPainel=Array.isArray(resp?.itens)?resp.itens:[];renderFavoritosPainel();}catch(e){console.error('Falha ao carregar favoritos de relatório:',e);favoritosPainel=[];const status=document.getElementById('pessoal-relatorios-rapidos-status');if(status)status.textContent='Indisponível';box.innerHTML='<p class="pessoal-relatorios-rapidos-loading">Não foi possível carregar os relatórios favoritos agora.</p>';}finally{favoritosPainelCarregando=false;}};
  async function modeloFavoritoPorId(id){if(!Array.isArray(favoritosPainel))await window.pessoalRelatorioFavoritosPainelCarregar(false);return (favoritosPainel||[]).find(x=>String(x.id)===String(id))||(modelos||[]).find(x=>String(x.id)===String(id));}
  window.pessoalRelatorioFavoritoAbrir=async function(id){const m=await modeloFavoritoPorId(id);if(!m){if(typeof ap52Notify==='function')ap52Notify('Modelo favorito não encontrado. Atualize o Painel.');return;}window.pessoalRelatorioEfetivoAbrir();if(!await aguardarDadosRelatorio()){if(typeof ap52Notify==='function')ap52Notify('Não foi possível carregar o efetivo para aplicar o modelo.');return;}const avisos=aplicarConfigModelo(configModeloCompativel(m));if(typeof ap52Notify==='function')ap52Notify([`Modelo “${m.nome}” aplicado.`,...avisos].join(' '));};
  window.pessoalRelatorioFavoritoExportar=async function(id,tipo){if(favoritoExportando)return;favoritoExportando=true;try{await favoritoExportar(id,tipo);}finally{favoritoExportando=false;}};
  async function favoritoExportar(id,tipo){const m=await modeloFavoritoPorId(id);if(!m){if(typeof ap52Notify==='function')ap52Notify('Modelo favorito não encontrado. Atualize o Painel.');return;}const status=document.getElementById('pessoal-relatorios-rapidos-status'),antes=status?.textContent;if(status)status.textContent=tipo==='excel'?'Preparando Excel…':'Preparando PDF…';try{garantirUI();if(!await recarregarDadosRelatorio())throw new Error('Não foi possível carregar o efetivo atual.');const avisos=aplicarConfigModelo(configModeloCompativel(m));const itens=filtrados(),cfg=configAtual();if(!itens.length)throw new Error(['Nenhum funcionário corresponde hoje aos filtros desse modelo.',...avisos].join(' '));const {rel}=await salvarSnapshotAtual(itens,cfg);if(tipo==='excel')baixarExcelRelatorio(rel);else abrirImpressao(rel);if(typeof ap52Notify==='function')ap52Notify([`${tipo==='excel'?'Excel':'PDF'} preparado a partir do modelo “${m.nome}”.`,...avisos].join(' '));}catch(e){console.error('Falha na exportação rápida do relatório:',e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível gerar o relatório rápido.');}finally{if(status)status.textContent=antes||`${(favoritosPainel||[]).length} de 4 favoritos no Painel`;}}

  function resumoFiltrosCfg(cfg,itens){const partes=[];const emp=Array.isArray(cfg?.empresas)?cfg.empresas:[];partes.push(`Empresas: ${emp.join(', ')||'Não informadas'}`);if(cfg?.gerencia)partes.push(`Gerência: ${cfg.gerencia}`);if(cfg?.contrato)partes.push(`Contrato: ${cfg.contrato}`);partes.push(`Situação: ${labelsSituacao[cfg?.situacao]||'Todo o efetivo atual'}`);return partes.join(' · ');}

  function chaveSnapshot(itens,cfg){
    const quadro=(itens||[]).map(x=>[Number(x.id)||0,x.nome||'',x.empresa||'',x.contrato||'',x.gerencia||'',x.cargo||'',x.area||'',x.situacao||'',!!x.aviso_previo,x.aviso_inicio||'',x.aviso_fim||'',x.aviso_tipo||'',Number(x.aviso_dias_restantes)]).sort((a,b)=>a[0]-b[0]);
    return JSON.stringify({quadro,cfg:{empresas:[...(cfg?.empresas||[])].sort(ordenar),gerencia:cfg?.gerencia||'',contrato:cfg?.contrato||'',situacao:cfg?.situacao||'efetivo',agrupar:cfg?.agrupar||'empresa',ordem:cfg?.ordem||'nome',destacar_aviso:cfg?.destacar_aviso!==false}});
  }

  async function salvarSnapshotAtual(itens,cfg){
    const chave=chaveSnapshot(itens,cfg);
    if(snapshotAtual&&snapshotAtualChave===chave&&Date.now()-snapshotAtualEm<SNAPSHOT_REUSO_MS)return {rel:snapshotAtual,novo:false};
    const ids=(itens||[]).map(x=>Number(x.id)).filter(Number.isFinite);
    const {data:resp,error}=await sb.rpc('ap52_relatorio_efetivo_salvar',{p_funcionario_ids:ids,p_filtros:cfg});
    if(error)throw error;
    historico=null;snapshotAtual=resp;snapshotAtualChave=chave;snapshotAtualEm=Date.now();
    return {rel:resp,novo:true};
  }

  const xmlExcel=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  function excelColuna(n){let s='';for(let x=n+1;x;x=Math.floor((x-1)/26))s=String.fromCharCode(65+((x-1)%26))+s;return s;}
  function excelCelula(l,c,v,estilo=5,tipo='s'){
    const r=`${excelColuna(c)}${l}`;
    if(tipo==='n'&&Number.isFinite(Number(v)))return `<c r="${r}" s="${estilo}"><v>${Number(v)}</v></c>`;
    return `<c r="${r}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${xmlExcel(v)}</t></is></c>`;
  }
  function excelLinha(n,valores,estilo=5){return `<row r="${n}">${valores.map((v,i)=>excelCelula(n,i,v?.v??v,v?.s??estilo,v?.t||'s')).join('')}</row>`;}
  function grupoExcel(x,cfg){const m=cfg?.agrupar||'empresa';if(m==='empresa')return x.empresa||'Empresa não informada';if(m==='gerencia')return x.gerencia||'Gerência não informada';if(m==='empresa_gerencia')return `${x.empresa||'Empresa não informada'} · ${x.gerencia||'Gerência não informada'}`;return 'Efetivo selecionado';}
  function excelSheetResumo(rel){
    const cfg=rel?.filtros||{},itens=rel?.itens||[],emp=Array.isArray(cfg.empresas)?cfg.empresas.join(', '):'';
    const linhas=[
      [{v:'RELAÇÃO DE EFETIVO — AP5.2',s:1},{v:'',s:1}],
      [{v:'Snapshot histórico',s:3},{v:'Dados preservados no momento da geração',s:5}],
      [],
      [{v:'Data de referência',s:3},{v:dataHora(rel?.data_referencia||rel?.created_at||new Date()),s:5}],
      [{v:'Gerado por',s:3},{v:rel?.gerado_por||'Usuário AP5.2',s:5}],
      [{v:'Registro',s:3},{v:String(rel?.id||'').toUpperCase(),s:5}],
      [{v:'Total de nomes',s:3},{v:Number(rel?.total||itens.length),s:5,t:'n'}],
      [{v:'Em aviso prévio',s:3},{v:Number(rel?.total_aviso||itens.filter(x=>x.aviso_previo).length),s:5,t:'n'}],
      [{v:'Empresas',s:3},{v:Number(rel?.empresas||new Set(itens.map(x=>x.empresa)).size),s:5,t:'n'}],
      [{v:'Gerências',s:3},{v:Number(rel?.gerencias||new Set(itens.map(x=>x.gerencia)).size),s:5,t:'n'}],
      [],
      [{v:'FILTROS UTILIZADOS',s:2},{v:'',s:2}],
      [{v:'Empresas',s:3},{v:emp||'Não informadas',s:5}],
      [{v:'Gerência',s:3},{v:cfg.gerencia||'Todas',s:5}],
      [{v:'Contrato',s:3},{v:cfg.contrato||'Todos',s:5}],
      [{v:'Situação',s:3},{v:labelsSituacao[cfg.situacao]||'Todo o efetivo atual',s:5}],
      [{v:'Agrupamento',s:3},{v:({empresa:'Empresa',empresa_gerencia:'Empresa → Gerência',gerencia:'Gerência',nenhum:'Sem agrupamento'})[cfg.agrupar]||'Empresa',s:5}],
      [{v:'Ordenação',s:3},{v:({nome:'Alfabética',gerencia:'Gerência e nome',empresa:'Empresa e nome'})[cfg.ordem]||'Alfabética',s:5}],
      [{v:'Destacar aviso prévio',s:3},{v:cfg.destacar_aviso===false?'Não':'Sim',s:5}],
      [],
      [{v:'Observação',s:3},{v:'Este arquivo foi gerado a partir de um snapshot imutável do sistema AP5.2. Alterações posteriores no cadastro não modificam esta relação.',s:5}]
    ];
    const rows=linhas.map((r,i)=>r.length?excelLinha(i+1,r,5):`<row r="${i+1}"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B${linhas.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="72" customWidth="1"/></cols><sheetData>${rows}</sheetData><mergeCells count="2"><mergeCell ref="A1:B1"/><mergeCell ref="A12:B12"/></mergeCells></worksheet>`;
  }
  function excelSheetEfetivo(rel){
    const cfg=rel?.filtros||{},itens=ordenarItens(rel?.itens||[],cfg.ordem||'nome');
    const headers=['#','Grupo','Nome','Empresa','Contrato','Gerência','Função','Área','Situação','Aviso prévio','Início aviso','Término aviso','Tipo aviso'];
    const rows=[excelLinha(1,headers.map(v=>({v,s:2})),2)];
    itens.forEach((x,i)=>{const aviso=!!x.aviso_previo,st=aviso&&cfg.destacar_aviso!==false?4:5;rows.push(excelLinha(i+2,[{v:i+1,s:st,t:'n'},grupoExcel(x,cfg),x.nome||'',x.empresa||'',x.contrato||'',x.gerencia||'',x.cargo||'',x.area||'',x.situacao||'Ativo',aviso?(Number(x.aviso_dias_restantes)<0?'Prazo encerrado':'Em aviso prévio'):'Não',aviso?dt(x.aviso_inicio):'',aviso?dt(x.aviso_fim):'',aviso?(x.aviso_tipo||''):'' ].map(v=>typeof v==='object'?v:{v,s:st}),st));});
    const last=Math.max(1,itens.length+1);
    const widths=[5,28,34,18,23,18,24,18,16,17,14,14,16].map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:M${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:M${last}"/></worksheet>`;
  }
  function excelStyles(){return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF244A40"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF7B1F2B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDF3F0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4D8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD9E4DF"/></left><right style="thin"><color rgb="FFD9E4DF"/></right><top style="thin"><color rgb="FFD9E4DF"/></top><bottom style="thin"><color rgb="FFD9E4DF"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;}
  function excelU16(n){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n&65535,true);return b;}
  function excelU32(n){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n>>>0,true);return b;}
  function excelConcat(partes){let len=0;partes.forEach(p=>len+=p.length);const out=new Uint8Array(len);let o=0;partes.forEach(p=>{out.set(p,o);o+=p.length;});return out;}
  let excelCrcTabela=null;
  function excelCrc32(bytes){if(!excelCrcTabela){excelCrcTabela=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);excelCrcTabela[n]=c>>>0;}}let c=0xFFFFFFFF;for(const b of bytes)c=excelCrcTabela[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
  function excelDosData(d=new Date()){const y=Math.max(1980,d.getFullYear()),data=((y-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate(),hora=(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2);return {data,hora};}
  function excelZip(arquivos){
    const enc=new TextEncoder(),locais=[],centrais=[];let off=0;const dh=excelDosData();
    arquivos.forEach(a=>{const nb=enc.encode(a.nome),db=a.dados instanceof Uint8Array?a.dados:enc.encode(a.dados),crc=excelCrc32(db),flags=0x0800;
      const local=excelConcat([excelU32(0x04034b50),excelU16(20),excelU16(flags),excelU16(0),excelU16(dh.hora),excelU16(dh.data),excelU32(crc),excelU32(db.length),excelU32(db.length),excelU16(nb.length),excelU16(0),nb,db]);locais.push(local);
      const central=excelConcat([excelU32(0x02014b50),excelU16(20),excelU16(20),excelU16(flags),excelU16(0),excelU16(dh.hora),excelU16(dh.data),excelU32(crc),excelU32(db.length),excelU32(db.length),excelU16(nb.length),excelU16(0),excelU16(0),excelU16(0),excelU16(0),excelU32(0),excelU32(off),nb]);centrais.push(central);off+=local.length;});
    const cd=excelConcat(centrais),fim=excelConcat([excelU32(0x06054b50),excelU16(0),excelU16(0),excelU16(arquivos.length),excelU16(arquivos.length),excelU32(cd.length),excelU32(off),excelU16(0)]);return excelConcat([...locais,cd,fim]);
  }
  function excelBlobRelatorio(rel){
    const agora=new Date(rel?.data_referencia||rel?.created_at||Date.now()),iso=agora.toISOString();
    const arquivos=[
      {nome:'[Content_Types].xml',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`},
      {nome:'_rels/.rels',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
      {nome:'docProps/core.xml',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Relação de Efetivo AP5.2</dc:title><dc:creator>${xmlExcel(rel?.gerado_por||'AP5.2')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`},
      {nome:'docProps/app.xml',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>AP5.2</Application><AppVersion>65.42.112</AppVersion></Properties>`},
      {nome:'xl/workbook.xml',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Resumo" sheetId="1" r:id="rId1"/><sheet name="Efetivo" sheetId="2" r:id="rId2"/></sheets></workbook>`},
      {nome:'xl/_rels/workbook.xml.rels',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {nome:'xl/styles.xml',dados:excelStyles()},
      {nome:'xl/worksheets/sheet1.xml',dados:excelSheetResumo(rel)},
      {nome:'xl/worksheets/sheet2.xml',dados:excelSheetEfetivo(rel)}
    ];
    return new Blob([excelZip(arquivos)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function baixarExcelRelatorio(rel){
    const blob=excelBlobRelatorio(rel),url=URL.createObjectURL(blob),a=document.createElement('a'),dia=dataArquivo(rel?.data_referencia||rel?.created_at),ref=rel?.id?`_${String(rel.id).slice(0,8).toUpperCase()}`:'';
    a.href=url;a.download=`Relacao_Efetivo_AP52_${dia}${ref}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
  }

  function docImpressaoRelatorio(rel){
    const cfg=rel?.filtros||{},itens=ordenarItens(rel?.itens||[],cfg.ordem||'nome'),gs=gruposPorConfig(itens,cfg),destacar=cfg.destacar_aviso!==false,dataRef=dataHora(rel?.data_referencia||rel?.created_at||new Date()),geradoPor=String(rel?.gerado_por||'Usuário AP5.2'),titulo=`Relacao_Efetivo_AP52_${dataArquivo(rel?.data_referencia||rel?.created_at)}`;
    const gruposHtml=gs.map(([nome,arr])=>`<section class="grupo"><div class="grupo-head"><h2>${esc(nome)}</h2><span>${arr.length} nome${arr.length===1?'':'s'}</span></div><table><thead><tr><th class="n">#</th><th>Nome</th><th>Empresa</th><th>Gerência</th><th>Função</th><th>Situação</th></tr></thead><tbody>${arr.map((x,i)=>`<tr class="${destacar&&x.aviso_previo?'aviso':''}"><td class="n">${i+1}</td><td class="nome">${esc(x.nome)}</td><td>${esc(x.empresa)}</td><td>${esc(x.gerencia)}</td><td>${esc(x.cargo)}</td><td>${esc(x.situacao||'Ativo')}${x.aviso_previo?`<br><b class="aviso-txt">${Number(x.aviso_dias_restantes)<0?'Prazo encerrado':'Aviso prévio'} · ${esc(dt(x.aviso_fim))}</b>`:''}</td></tr>`).join('')}</tbody></table></section>`).join('');
    const ref=rel?.id?`<p><b>Registro:</b> ${esc(String(rel.id).slice(0,8).toUpperCase())}</p>`:'';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>@page{size:A4 landscape;margin:11mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#102845;margin:0;font-size:9.2pt}.topo{border-bottom:2px solid #7b1f2b;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end}.topo h1{font-size:18pt;margin:0 0 3px;color:#5f1721}.topo p{margin:0;color:#65756f;font-size:8.8pt}.meta{text-align:right}.resumo{display:flex;gap:18px;align-items:center;background:#f5f8f6;border:1px solid #dce5e1;padding:7px 9px;margin-bottom:10px}.resumo b{font-size:11pt}.filtros{margin-left:auto;color:#586c65}.grupo{break-inside:avoid;margin:0 0 10px}.grupo-head{display:flex;justify-content:space-between;align-items:center;background:#edf3f0;border:1px solid #d9e4df;border-bottom:0;padding:6px 8px}.grupo-head h2{font-size:11pt;margin:0}.grupo-head span{font-size:8.5pt;font-weight:bold;color:#65776f}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #dfe6e3;padding:5px 6px;vertical-align:top;overflow-wrap:anywhere}th{background:#f8faf9;text-transform:uppercase;font-size:7.7pt;color:#697a74;text-align:left}.n{width:4%;text-align:center}.nome{font-weight:bold;width:23%}th:nth-child(3){width:14%}th:nth-child(4){width:13%}th:nth-child(5){width:20%}th:nth-child(6){width:20%}tr.aviso td{background:#fff9ed}.aviso-txt{color:#8b5a10;font-size:7.8pt}.rodape{margin-top:8px;padding-top:6px;border-top:1px solid #dfe6e3;color:#74837d;font-size:7.8pt}.grupo{page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}</style></head><body><header class="topo"><div><h1>RELAÇÃO DE EFETIVO — AP5.2</h1><p>Coordenação AP5.2 · Gestão de Pessoal</p></div><div class="meta"><p><b>Data de referência:</b> ${esc(dataRef)}</p><p><b>Gerado por:</b> ${esc(geradoPor)}</p>${ref}</div></header><div class="resumo"><span><b>${itens.length}</b> nomes</span><span><b>${itens.filter(x=>x.aviso_previo).length}</b> em aviso prévio</span><span class="filtros">${esc(resumoFiltrosCfg(cfg,itens))}</span></div>${gruposHtml}<footer class="rodape">Snapshot histórico do sistema AP5.2. Este documento preserva os dados do momento da geração; alterações posteriores no cadastro não modificam esta relação. Aviso prévio não representa desligamento automático.</footer></body></html>`;
  }

  function abrirImpressao(rel){abrirImpressaoHtml(docImpressaoRelatorio(rel));}

  window.pessoalRelatorioEfetivoImprimir=async function(){
    const itens=filtrados();if(!itens.length){if(typeof ap52Notify==='function')ap52Notify('Não há nomes para gerar o relatório.');return;}
    const btn=document.getElementById('pessoal-relatorio-imprimir'),texto=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Preparando PDF…';}
    try{const cfg=configAtual(),salvo=await salvarSnapshotAtual(itens,cfg);if(salvo.novo&&typeof ap52Notify==='function')ap52Notify('Relatório salvo no histórico.');abrirImpressao(salvo.rel);}
    catch(e){console.error('Falha ao salvar snapshot do relatório:',e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível salvar o relatório. Atualize os dados e tente novamente.');}
    finally{if(btn){btn.disabled=false;btn.textContent=texto||'Gerar / salvar PDF';}window.pessoalRelatorioEfetivoRender();}
  };

  window.pessoalRelatorioEfetivoExcel=async function(){
    const itens=filtrados();if(!itens.length){if(typeof ap52Notify==='function')ap52Notify('Não há nomes para exportar.');return;}
    const btn=document.getElementById('pessoal-relatorio-excel'),texto=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Preparando Excel…';}
    try{const cfg=configAtual(),salvo=await salvarSnapshotAtual(itens,cfg);if(salvo.novo&&typeof ap52Notify==='function')ap52Notify('Relatório salvo no histórico.');baixarExcelRelatorio(salvo.rel);}
    catch(e){console.error('Falha ao exportar Excel:',e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível exportar o Excel. Atualize os dados e tente novamente.');}
    finally{if(btn){btn.disabled=false;btn.textContent=texto||'Exportar Excel';}window.pessoalRelatorioEfetivoRender();}
  };

  function cardHistorico(x){const cfg=x.filtros||{};return `<article class="pessoal-relatorio-historico-card"><div class="pessoal-relatorio-historico-card-top"><div><strong>${esc(dataHora(x.data_referencia))}</strong><span>Gerado por ${esc(x.gerado_por||'Usuário AP5.2')}</span></div><span class="pessoal-relatorio-snapshot-chip">Snapshot</span></div><div class="pessoal-relatorio-historico-numeros"><span><b>${Number(x.total||0)}</b> nomes</span><span><b>${Number(x.total_aviso||0)}</b> em aviso</span><span><b>${Number(x.empresas||0)}</b> empresas</span><span><b>${Number(x.gerencias||0)}</b> Gerências</span></div><p>${esc(resumoFiltrosCfg(cfg,[]))}</p><div class="pessoal-relatorio-historico-card-acoes"><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioEfetivoHistoricoDetalhe('${esc(x.id)}')">Ver snapshot</button><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioEfetivoHistoricoImprimir('${esc(x.id)}')">PDF</button><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioEfetivoHistoricoExcel('${esc(x.id)}')">Excel</button></div></article>`;}

  window.pessoalRelatorioEfetivoHistoricoCarregar=async function(force=false){
    const box=document.getElementById('pessoal-relatorio-historico-lista'),status=document.getElementById('pessoal-relatorio-historico-status');if(historicoCarregando)return;if(historico&&!force){renderHistorico();return;}historicoCarregando=true;if(status){status.className='pessoal-relatorio-status';status.textContent='Carregando snapshots…';}
    try{if(force)snapshotCache.clear();const {data:resp,error}=await sb.rpc('ap52_relatorio_efetivo_historico',{p_limit:50});if(error)throw error;historico=Array.isArray(resp?.itens)?resp.itens:[];if(status)status.textContent=historico.length?`${historico.length} relatório${historico.length===1?'':'s'} no histórico acessível.`:'Nenhum relatório foi gerado ainda.';renderHistorico();}
    catch(e){console.error('Falha ao carregar histórico de relatórios:',e);historico=[];if(status){status.className='pessoal-relatorio-status erro';status.textContent=e?.message||'Não foi possível carregar o histórico.';}if(box)box.innerHTML='<p class="pessoal-relatorio-vazio">Não foi possível carregar o histórico.</p>';}
    finally{historicoCarregando=false;}
  };
  function renderHistorico(){const box=document.getElementById('pessoal-relatorio-historico-lista');if(!box)return;const a=Array.isArray(historico)?historico:[];box.innerHTML=a.length?a.map(cardHistorico).join(''):'<p class="pessoal-relatorio-vazio">Nenhum relatório foi gerado ainda.</p>';document.getElementById('pessoal-relatorio-historico-lista-wrap').hidden=false;document.getElementById('pessoal-relatorio-historico-detalhe').hidden=true;}

  async function buscarSnapshot(id){if(snapshotAtual?.id===id)return snapshotAtual;if(snapshotCache.has(id))return snapshotCache.get(id);const {data:resp,error}=await sb.rpc('ap52_relatorio_efetivo_detalhe',{p_id:id});if(error)throw error;snapshotCache.set(id,resp);return resp;}


  function comparacaoRotuloHistorico(x){return `${dataHora(x.data_referencia)} · ${Number(x.total||0)} nomes · ${x.gerado_por||'Usuário AP5.2'}`;}
  function comparacaoPreencherSeletores(){
    const ant=document.getElementById('pessoal-relatorio-comparar-anterior'),atu=document.getElementById('pessoal-relatorio-comparar-atual');if(!ant||!atu)return;
    const a=Array.isArray(historico)?historico:[],antV=ant.value,atuV=atu.value,opts=a.map(x=>`<option value="${esc(x.id)}">${esc(comparacaoRotuloHistorico(x))}</option>`).join('');ant.innerHTML=opts;atu.innerHTML=opts;
    if(a.length){ant.value=a.some(x=>x.id===antV)?antV:(a[1]?.id||a[0].id);atu.value=a.some(x=>x.id===atuV)?atuV:a[0].id;}
  }
  window.pessoalRelatorioEfetivoCompararPreparar=async function(force=false){
    garantirUI();const status=document.getElementById('pessoal-relatorio-comparar-status'),res=document.getElementById('pessoal-relatorio-comparar-resultado');
    if(force){historico=null;snapshotCache.clear();comparacaoAtual=null;if(res)res.innerHTML='<p class="pessoal-relatorio-vazio">Escolha dois snapshots para comparar.</p>';}
    if(!historico){if(status){status.className='pessoal-relatorio-status';status.textContent='Carregando snapshots disponíveis…';}await window.pessoalRelatorioEfetivoHistoricoCarregar(false);}
    comparacaoPreencherSeletores();const n=Array.isArray(historico)?historico.length:0;
    if(status){status.className='pessoal-relatorio-status';status.textContent=n<2?'É necessário ter pelo menos dois snapshots para comparar.':`${n} snapshots disponíveis para comparação.`;}
    if(res&&n<2){comparacaoAtual=null;res.innerHTML='<p class="pessoal-relatorio-vazio">Gere pelo menos dois relatórios para habilitar a comparação.</p>';}
  };
  window.pessoalRelatorioEfetivoCompararTrocar=function(){const a=document.getElementById('pessoal-relatorio-comparar-anterior'),b=document.getElementById('pessoal-relatorio-comparar-atual');if(!a||!b)return;const v=a.value;a.value=b.value;b.value=v;};

  function cfgRecorte(cfg){return JSON.stringify({empresas:[...(cfg?.empresas||[])].sort(ordenar),gerencia:cfg?.gerencia||'',contrato:cfg?.contrato||'',situacao:cfg?.situacao||'efetivo'});}
  function mesmoValor(a,b){return String(a??'')===String(b??'');}
  function textoAviso(x){if(!x?.aviso_previo)return 'Sem aviso prévio';return `Em aviso${x.aviso_fim?` até ${dt(x.aviso_fim)}`:''}${x.aviso_tipo?` · ${x.aviso_tipo}`:''}`;}
  function calcularComparacao(anterior,atual){
    const antes=Array.isArray(anterior?.itens)?anterior.itens:[],depois=Array.isArray(atual?.itens)?atual.itens:[],ma=new Map(antes.map(x=>[String(x.id),x])),mb=new Map(depois.map(x=>[String(x.id),x]));
    const entradas=depois.filter(x=>!ma.has(String(x.id))).sort((a,b)=>ordenar(a.nome,b.nome));
    const saidas=antes.filter(x=>!mb.has(String(x.id))).sort((a,b)=>ordenar(a.nome,b.nome));
    const alterados=[],avisos=[];
    const campos=[['empresa','Empresa'],['contrato','Contrato'],['gerencia','Gerência'],['cargo','Função'],['area','Área'],['situacao','Situação']];
    for(const [id,a] of ma){const b=mb.get(id);if(!b)continue;const mud=[];for(const [k,label] of campos)if(!mesmoValor(a[k],b[k]))mud.push({campo:k,label,antes:a[k]||'—',depois:b[k]||'—'});if(mud.length)alterados.push({id,nome:b.nome||a.nome,antes:a,depois:b,mudancas:mud});
      const maAviso=[];if(!!a.aviso_previo!==!!b.aviso_previo)maAviso.push({label:'Aviso prévio',antes:textoAviso(a),depois:textoAviso(b)});else if(a.aviso_previo&&b.aviso_previo){if(!mesmoValor(a.aviso_fim,b.aviso_fim))maAviso.push({label:'Término previsto',antes:dt(a.aviso_fim),depois:dt(b.aviso_fim)});if(!mesmoValor(a.aviso_tipo,b.aviso_tipo))maAviso.push({label:'Tipo de aviso',antes:a.aviso_tipo||'—',depois:b.aviso_tipo||'—'});}if(maAviso.length)avisos.push({id,nome:b.nome||a.nome,antes:a,depois:b,mudancas:maAviso});
    }
    alterados.sort((a,b)=>ordenar(a.nome,b.nome));avisos.sort((a,b)=>ordenar(a.nome,b.nome));
    return {entradas,saidas,alterados,avisos,delta:depois.length-antes.length,filtrosIguais:cfgRecorte(anterior?.filtros)===cfgRecorte(atual?.filtros)};
  }
  function pessoaResumoComp(x){return `<div class="pessoal-relatorio-comp-pessoa"><strong>${esc(x.nome||'—')}</strong><span>${esc(x.empresa||'—')} · ${esc(x.gerencia||'—')} · ${esc(x.cargo||'—')}</span>${x.aviso_previo?`<small>${esc(textoAviso(x))}</small>`:''}</div>`;}
  function mudancasComp(item){return `<div class="pessoal-relatorio-comp-pessoa"><strong>${esc(item.nome||'—')}</strong><div class="pessoal-relatorio-comp-mudancas">${item.mudancas.map(m=>`<span><b>${esc(m.label)}:</b> ${esc(m.antes)} <i>→</i> ${esc(m.depois)}</span>`).join('')}</div></div>`;}
  function blocoComp(titulo,classe,itens,render,vazio){return `<section class="pessoal-relatorio-comp-bloco ${classe}"><header><strong>${esc(titulo)}</strong><span>${itens.length}</span></header><div class="pessoal-relatorio-comp-lista">${itens.length?itens.map(render).join(''):`<p>${esc(vazio)}</p>`}</div></section>`;}
  function renderComparacao(anterior,atual,c,ajustada){
    const res=document.getElementById('pessoal-relatorio-comparar-resultado');if(!res)return;
    comparacaoAtual={anterior,atual,c,ajustada:!!ajustada};
    const alerta=!c.filtrosIguais?'<div class="pessoal-relatorio-comp-alerta">Os filtros de recorte dos dois relatórios são diferentes. Entradas e saídas podem refletir também a mudança de filtro, e não apenas alterações no efetivo.</div>':'';
    const ordem=ajustada?'<div class="pessoal-relatorio-comp-nota">A ordem foi ajustada automaticamente pela data: o snapshot mais antigo foi usado como base.</div>':'';
    res.innerHTML=`<div class="pessoal-relatorio-comp-cabecalho"><div><span>Anterior</span><strong>${esc(dataHora(anterior.data_referencia))}</strong><small>${Number(anterior.total||anterior.itens?.length||0)} nomes</small></div><div class="pessoal-relatorio-comp-seta">→</div><div><span>Mais recente</span><strong>${esc(dataHora(atual.data_referencia))}</strong><small>${Number(atual.total||atual.itens?.length||0)} nomes</small></div></div>${ordem}${alerta}<section class="pessoal-relatorio-comp-kpis"><article><span>Entraram na relação</span><strong>${c.entradas.length}</strong></article><article><span>Saíram da relação</span><strong>${c.saidas.length}</strong></article><article><span>Dados alterados</span><strong>${c.alterados.length}</strong></article><article class="aviso"><span>Mudança em aviso</span><strong>${c.avisos.length}</strong></article></section><div class="pessoal-relatorio-comp-saldo">Variação do total: <b>${c.delta>0?'+':''}${c.delta}</b> nome${Math.abs(c.delta)===1?'':'s'}.</div><div class="pessoal-relatorio-comp-exportar"><div><strong>Exportar comparação</strong><span>Documento baseado nos dois snapshots imutáveis selecionados.</span></div><div class="pessoal-relatorio-comp-exportar-acoes"><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioEfetivoComparacaoExcel()">Exportar Excel</button><button type="button" class="btn btn-primary" onclick="pessoalRelatorioEfetivoComparacaoPDF()">Gerar / salvar PDF</button></div></div><div class="pessoal-relatorio-comp-grid">${blocoComp('Entraram na relação','entrada',c.entradas,pessoaResumoComp,'Nenhum nome entrou na relação.')}${blocoComp('Saíram da relação','saida',c.saidas,pessoaResumoComp,'Nenhum nome saiu da relação.')}${blocoComp('Dados alterados','alteracao',c.alterados,mudancasComp,'Nenhuma mudança de empresa, contrato, Gerência, função, área ou situação.')}${blocoComp('Aviso prévio','aviso',c.avisos,mudancasComp,'Nenhuma mudança de aviso prévio entre os snapshots.')}</div>`;
  }
  window.pessoalRelatorioEfetivoCompararExecutar=async function(){
    const antId=valor('pessoal-relatorio-comparar-anterior'),atuId=valor('pessoal-relatorio-comparar-atual'),status=document.getElementById('pessoal-relatorio-comparar-status'),btn=document.getElementById('pessoal-relatorio-comparar-btn');if(comparacaoCarregando)return;if(!antId||!atuId){if(typeof ap52Notify==='function')ap52Notify('Escolha os dois snapshots.');return;}if(antId===atuId){if(typeof ap52Notify==='function')ap52Notify('Escolha dois snapshots diferentes.');return;}
    comparacaoCarregando=true;const tx=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Comparando…';}if(status){status.className='pessoal-relatorio-status';status.textContent='Abrindo os dois snapshots…';}
    try{let [a,b]=await Promise.all([buscarSnapshot(antId),buscarSnapshot(atuId)]),ajustada=false;if(new Date(a.data_referencia)>new Date(b.data_referencia)){[a,b]=[b,a];ajustada=true;}const c=calcularComparacao(a,b);renderComparacao(a,b,c,ajustada);if(status)status.textContent=c.filtrosIguais?'Comparação concluída com o mesmo recorte de filtros.':'Comparação concluída; atenção aos filtros diferentes.';}
    catch(e){console.error('Falha ao comparar snapshots:',e);if(status){status.className='pessoal-relatorio-status erro';status.textContent=e?.message||'Não foi possível comparar os snapshots.';}const res=document.getElementById('pessoal-relatorio-comparar-resultado');if(res)res.innerHTML='<p class="pessoal-relatorio-vazio">Não foi possível concluir a comparação.</p>';}
    finally{comparacaoCarregando=false;if(btn){btn.disabled=false;btn.textContent=tx||'Comparar';}}
  };


  function comparacaoDataArquivo(v){return dataArquivo(v);}
  function comparacaoMudancasLinhas(itens){const out=[];(itens||[]).forEach(item=>(item.mudancas||[]).forEach(m=>out.push({nome:item.nome||'—',campo:m.label||'Alteração',antes:m.antes??'—',depois:m.depois??'—',empresa:item.depois?.empresa||item.antes?.empresa||'',gerencia:item.depois?.gerencia||item.antes?.gerencia||'',cargo:item.depois?.cargo||item.antes?.cargo||''})));return out;}
  function excelSheetComparacaoResumo(comp){
    const a=comp.anterior,b=comp.atual,c=comp.c,linhas=[
      [{v:'COMPARAÇÃO DE EFETIVO — AP5.2',s:1},{v:'',s:1}],
      [{v:'Fonte',s:3},{v:'Comparação entre dois snapshots imutáveis do histórico de Relatórios de Efetivo',s:5}],[],
      [{v:'Snapshot anterior',s:3},{v:dataHora(a.data_referencia),s:5}],
      [{v:'Registro anterior',s:3},{v:String(a.id||'').toUpperCase(),s:5}],
      [{v:'Total anterior',s:3},{v:Number(a.total||a.itens?.length||0),s:5,t:'n'}],
      [{v:'Snapshot mais recente',s:3},{v:dataHora(b.data_referencia),s:5}],
      [{v:'Registro mais recente',s:3},{v:String(b.id||'').toUpperCase(),s:5}],
      [{v:'Total mais recente',s:3},{v:Number(b.total||b.itens?.length||0),s:5,t:'n'}],
      [{v:'Variação do total',s:3},{v:Number(c.delta||0),s:5,t:'n'}],[],
      [{v:'RESULTADO DA COMPARAÇÃO',s:2},{v:'',s:2}],
      [{v:'Entraram na relação',s:3},{v:c.entradas.length,s:5,t:'n'}],
      [{v:'Saíram da relação',s:3},{v:c.saidas.length,s:5,t:'n'}],
      [{v:'Pessoas com dados alterados',s:3},{v:c.alterados.length,s:5,t:'n'}],
      [{v:'Pessoas com mudança em aviso prévio',s:3},{v:c.avisos.length,s:5,t:'n'}],
      [{v:'Mesmo recorte de filtros',s:3},{v:c.filtrosIguais?'Sim':'Não',s:c.filtrosIguais?5:4}],[],
      [{v:'Filtro do snapshot anterior',s:3},{v:resumoFiltrosCfg(a.filtros||{},a.itens||[]),s:5}],
      [{v:'Filtro do snapshot mais recente',s:3},{v:resumoFiltrosCfg(b.filtros||{},b.itens||[]),s:5}],[],
      [{v:'Interpretação',s:3},{v:'Entradas e saídas indicam presença ou ausência na relação comparada. Não significam automaticamente admissão ou desligamento. Se os filtros forem diferentes, parte da variação pode resultar da mudança de recorte.',s:5}]
    ];
    const rows=linhas.map((r,i)=>r.length?excelLinha(i+1,r,5):`<row r="${i+1}"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B${linhas.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="29" customWidth="1"/><col min="2" max="2" width="86" customWidth="1"/></cols><sheetData>${rows}</sheetData><mergeCells count="2"><mergeCell ref="A1:B1"/><mergeCell ref="A12:B12"/></mergeCells></worksheet>`;
  }
  function excelSheetComparacaoPessoas(itens){
    const headers=['#','Nome','Empresa','Contrato','Gerência','Função','Área','Situação','Aviso prévio','Término aviso'];
    const rows=[excelLinha(1,headers.map(v=>({v,s:2})),2)];
    (itens||[]).forEach((x,i)=>{const av=!!x.aviso_previo,st=av?4:5;rows.push(excelLinha(i+2,[{v:i+1,s:st,t:'n'},x.nome||'',x.empresa||'',x.contrato||'',x.gerencia||'',x.cargo||'',x.area||'',x.situacao||'Ativo',av?textoAviso(x):'Não',av?dt(x.aviso_fim):''].map(v=>typeof v==='object'?v:{v,s:st}),st));});
    const last=Math.max(1,(itens||[]).length+1),widths=[5,34,18,23,18,24,18,16,25,15].map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:J${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:J${last}"/></worksheet>`;
  }
  function excelSheetComparacaoMudancas(itens){
    const linhas=comparacaoMudancasLinhas(itens),headers=['#','Nome','Campo','Antes','Depois','Empresa atual','Gerência atual','Função atual'];
    const rows=[excelLinha(1,headers.map(v=>({v,s:2})),2)];
    linhas.forEach((x,i)=>rows.push(excelLinha(i+2,[{v:i+1,s:5,t:'n'},x.nome,x.campo,x.antes,x.depois,x.empresa,x.gerencia,x.cargo].map(v=>typeof v==='object'?v:{v,s:5}),5)));
    const last=Math.max(1,linhas.length+1),widths=[5,32,21,35,35,18,18,24].map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:H${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:H${last}"/></worksheet>`;
  }
  function excelBlobComparacao(comp){
    const agora=new Date(),iso=agora.toISOString(),sheets=[
      ['Resumo',excelSheetComparacaoResumo(comp)],
      ['Entraram',excelSheetComparacaoPessoas(comp.c.entradas)],
      ['Saíram',excelSheetComparacaoPessoas(comp.c.saidas)],
      ['Alterações',excelSheetComparacaoMudancas(comp.c.alterados)],
      ['Aviso prévio',excelSheetComparacaoMudancas(comp.c.avisos)]
    ];
    const overrides=sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const wbSheets=sheets.map(([n],i)=>`<sheet name="${xmlExcel(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('');
    const rels=sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('');
    const files=[
      {nome:'[Content_Types].xml',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`},
      {nome:'_rels/.rels',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
      {nome:'docProps/core.xml',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Comparação de Efetivo AP5.2</dc:title><dc:creator>AP5.2</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`},
      {nome:'docProps/app.xml',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>AP5.2</Application><AppVersion>65.42.112</AppVersion></Properties>`},
      {nome:'xl/workbook.xml',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${wbSheets}</sheets></workbook>`},
      {nome:'xl/_rels/workbook.xml.rels',dados:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {nome:'xl/styles.xml',dados:excelStyles()}
    ];
    sheets.forEach((sh,i)=>files.push({nome:`xl/worksheets/sheet${i+1}.xml`,dados:sh[1]}));
    return new Blob([excelZip(files)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function baixarExcelComparacao(comp){
    const blob=excelBlobComparacao(comp),url=URL.createObjectURL(blob),a=document.createElement('a'),ini=comparacaoDataArquivo(comp.anterior.data_referencia),fim=comparacaoDataArquivo(comp.atual.data_referencia);
    a.href=url;a.download=`Comparacao_Efetivo_AP52_${ini}_a_${fim}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
  }
  function compPessoasPdf(itens){if(!(itens||[]).length)return '<p class="vazio">Nenhum registro.</p>';return `<table><thead><tr><th class="n">#</th><th>Nome</th><th>Empresa</th><th>Gerência</th><th>Função</th><th>Situação / aviso</th></tr></thead><tbody>${itens.map((x,i)=>`<tr><td class="n">${i+1}</td><td class="nome">${esc(x.nome||'—')}</td><td>${esc(x.empresa||'—')}</td><td>${esc(x.gerencia||'—')}</td><td>${esc(x.cargo||'—')}</td><td>${esc(x.situacao||'Ativo')}${x.aviso_previo?`<br><b class="aviso-txt">${esc(textoAviso(x))}</b>`:''}</td></tr>`).join('')}</tbody></table>`;}
  function compMudancasPdf(itens){if(!(itens||[]).length)return '<p class="vazio">Nenhuma alteração.</p>';return `<table><thead><tr><th class="n">#</th><th>Nome</th><th>Alterações identificadas</th></tr></thead><tbody>${itens.map((x,i)=>`<tr><td class="n">${i+1}</td><td class="nome">${esc(x.nome||'—')}</td><td>${(x.mudancas||[]).map(m=>`<div class="mud"><b>${esc(m.label)}:</b> ${esc(m.antes)} <span>&rarr;</span> ${esc(m.depois)}</div>`).join('')}</td></tr>`).join('')}</tbody></table>`;}
  function docImpressaoComparacao(comp){
    const a=comp.anterior,b=comp.atual,c=comp.c,ini=comparacaoDataArquivo(a.data_referencia),fim=comparacaoDataArquivo(b.data_referencia),alerta=!c.filtrosIguais?'<div class="alerta"><b>Atenção:</b> os filtros dos snapshots são diferentes. Entradas e saídas podem refletir também a mudança de recorte.</div>':'';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comparacao_Efetivo_AP52_${esc(ini)}_a_${esc(fim)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#102845;margin:0;font-size:8.6pt}.topo{border-bottom:2px solid #7b1f2b;padding-bottom:7px;margin-bottom:9px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end}.topo h1{font-size:17pt;margin:0 0 2px;color:#5f1721}.topo p,.meta p{margin:1px 0;color:#65756f}.meta{text-align:right}.fontes{display:grid;grid-template-columns:1fr 36px 1fr;align-items:center;gap:8px;padding:9px 12px;border:1px solid #dce7e2;background:#f8fbf9;margin-bottom:8px}.fonte{text-align:center}.fonte b{display:block;font-size:11pt}.fonte small{color:#71817b}.seta{text-align:center;color:#7b1f2b;font-size:18pt}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:8px 0}.kpi{border:1px solid #dfe8e4;padding:7px;text-align:center}.kpi span{display:block;text-transform:uppercase;color:#74857f;font-size:7pt;font-weight:bold}.kpi b{display:block;font-size:14pt;color:#255444}.kpi.aviso b{color:#9a6618}.alerta{border:1px solid #e7cfa0;background:#fff8e8;color:#795516;padding:7px 9px;margin:8px 0}.sec{margin:9px 0 12px;page-break-inside:auto}.sec h2{font-size:11pt;margin:0;padding:6px 8px;background:#edf3f0;border:1px solid #d9e4df;border-bottom:0;color:#173a64}.sec.saida h2{background:#fbf4f4}.sec.aviso h2{background:#fff8e9}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #dfe6e3;padding:4px 5px;vertical-align:top;overflow-wrap:anywhere}th{background:#f8faf9;text-transform:uppercase;font-size:7pt;color:#697a74;text-align:left}.n{width:4%;text-align:center}.nome{font-weight:bold;width:22%}.aviso-txt{color:#8b5a10;font-size:7.5pt}.mud{margin:0 0 2px}.mud span{color:#7b1f2b;font-weight:bold}.vazio{padding:10px;border:1px solid #dfe6e3;margin:0;color:#75857f}.rodape{margin-top:7px;padding-top:6px;border-top:1px solid #dfe6e3;color:#74837d;font-size:7.4pt}thead{display:table-header-group}tr{page-break-inside:avoid}</style></head><body><header class="topo"><div><h1>COMPARAÇÃO DE EFETIVO — AP5.2</h1><p>Gestão de Pessoal · comparação entre snapshots históricos</p></div><div class="meta"><p><b>Gerado em:</b> ${esc(dataHora(new Date()))}</p><p><b>Registros:</b> ${esc(String(a.id||'').slice(0,8).toUpperCase())} / ${esc(String(b.id||'').slice(0,8).toUpperCase())}</p></div></header><div class="fontes"><div class="fonte"><span>Anterior</span><b>${esc(dataHora(a.data_referencia))}</b><small>${Number(a.total||a.itens?.length||0)} nomes</small></div><div class="seta">&rarr;</div><div class="fonte"><span>Mais recente</span><b>${esc(dataHora(b.data_referencia))}</b><small>${Number(b.total||b.itens?.length||0)} nomes</small></div></div>${alerta}<div class="kpis"><div class="kpi"><span>Entraram na relação</span><b>${c.entradas.length}</b></div><div class="kpi"><span>Saíram da relação</span><b>${c.saidas.length}</b></div><div class="kpi"><span>Dados alterados</span><b>${c.alterados.length}</b></div><div class="kpi aviso"><span>Mudança em aviso</span><b>${c.avisos.length}</b></div><div class="kpi"><span>Variação total</span><b>${c.delta>0?'+':''}${c.delta}</b></div></div><section class="sec"><h2>Entraram na relação (${c.entradas.length})</h2>${compPessoasPdf(c.entradas)}</section><section class="sec saida"><h2>Saíram da relação (${c.saidas.length})</h2>${compPessoasPdf(c.saidas)}</section><section class="sec"><h2>Dados alterados (${c.alterados.length})</h2>${compMudancasPdf(c.alterados)}</section><section class="sec aviso"><h2>Mudanças de aviso prévio (${c.avisos.length})</h2>${compMudancasPdf(c.avisos)}</section><footer class="rodape">Comparação baseada em snapshots imutáveis do sistema AP5.2. "Entrou" e "saiu" significam entrada ou saída da relação comparada e não representam automaticamente admissão ou desligamento.</footer></body></html>`;
  }
  function abrirImpressaoHtml(html){const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';document.body.appendChild(frame);const doc=frame.contentDocument;doc.open();doc.write(html);doc.close();const imprimir=()=>{try{frame.contentWindow.focus();frame.contentWindow.print();}catch(e){if(typeof ap52Notify==='function')ap52Notify('Não foi possível abrir a impressão.');}setTimeout(()=>frame.remove(),60000)};setTimeout(imprimir,180);}
  window.pessoalRelatorioEfetivoComparacaoPDF=function(){if(!comparacaoAtual){if(typeof ap52Notify==='function')ap52Notify('Faça uma comparação antes de exportar.');return;}abrirImpressaoHtml(docImpressaoComparacao(comparacaoAtual));};
  window.pessoalRelatorioEfetivoComparacaoExcel=function(){if(!comparacaoAtual){if(typeof ap52Notify==='function')ap52Notify('Faça uma comparação antes de exportar.');return;}baixarExcelComparacao(comparacaoAtual);};

  window.pessoalRelatorioEfetivoHistoricoDetalhe=async function(id){
    const dest=document.getElementById('pessoal-relatorio-historico-detalhe'),wrap=document.getElementById('pessoal-relatorio-historico-lista-wrap');if(!dest||!wrap)return;wrap.hidden=true;dest.hidden=false;dest.innerHTML='<p class="pessoal-relatorio-vazio">Abrindo snapshot…</p>';
    try{const rel=await buscarSnapshot(id),cfg=rel.filtros||{},itens=ordenarItens(rel.itens||[],cfg.ordem||'nome'),gs=gruposPorConfig(itens,cfg);dest.innerHTML=`<div class="pessoal-relatorio-detalhe-head"><div><button type="button" class="pessoal-relatorio-voltar" onclick="pessoalRelatorioEfetivoHistoricoVoltar()">← Voltar ao histórico</button><h3>Snapshot de ${esc(dataHora(rel.data_referencia))}</h3><p>${esc(resumoFiltrosCfg(cfg,itens))}</p></div><div class="pessoal-relatorio-detalhe-acoes"><button type="button" class="btn btn-ghost" onclick="pessoalRelatorioEfetivoHistoricoExcel('${esc(rel.id)}')">Exportar Excel</button><button type="button" class="btn btn-primary" onclick="pessoalRelatorioEfetivoHistoricoImprimir('${esc(rel.id)}')">Imprimir novamente</button></div></div><section class="pessoal-relatorio-kpis"><article class="pessoal-relatorio-kpi"><span>Nomes</span><strong>${Number(rel.total||itens.length)}</strong></article><article class="pessoal-relatorio-kpi aviso"><span>Em aviso prévio</span><strong>${Number(rel.total_aviso||0)}</strong></article><article class="pessoal-relatorio-kpi"><span>Empresas</span><strong>${Number(rel.empresas||0)}</strong></article><article class="pessoal-relatorio-kpi"><span>Gerências</span><strong>${Number(rel.gerencias||0)}</strong></article></section><div class="pessoal-relatorio-snapshot-nota">Snapshot imutável · gerado por <b>${esc(rel.gerado_por||'Usuário AP5.2')}</b> · registro ${esc(String(rel.id||'').slice(0,8).toUpperCase())}</div><div class="pessoal-relatorio-grupos">${gs.map(([nome,arr])=>`<article class="pessoal-relatorio-grupo"><header><strong>${esc(nome)}</strong><span>${arr.length} nome${arr.length===1?'':'s'}</span></header><table class="pessoal-relatorio-tabela"><thead><tr><th class="num">#</th><th class="nome">Nome</th><th class="empresa">Empresa</th><th class="gerencia">Gerência</th><th class="cargo">Função</th><th class="situacao">Situação</th></tr></thead><tbody>${arr.map((x,i)=>linha(x,i,cfg.destacar_aviso!==false)).join('')}</tbody></table></article>`).join('')}</div>`;}
    catch(e){console.error('Falha ao abrir snapshot:',e);dest.innerHTML=`<div class="pessoal-relatorio-detalhe-head"><button type="button" class="pessoal-relatorio-voltar" onclick="pessoalRelatorioEfetivoHistoricoVoltar()">← Voltar ao histórico</button></div><p class="pessoal-relatorio-vazio">${esc(e?.message||'Não foi possível abrir o snapshot.')}</p>`;}
  };
  window.pessoalRelatorioEfetivoHistoricoVoltar=function(){renderHistorico();};
  window.pessoalRelatorioEfetivoHistoricoImprimir=async function(id){try{const rel=await buscarSnapshot(id);abrirImpressao(rel);}catch(e){console.error(e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível abrir o relatório histórico.');}};
  window.pessoalRelatorioEfetivoHistoricoExcel=async function(id){try{const rel=await buscarSnapshot(id);baixarExcelRelatorio(rel);}catch(e){console.error(e);if(typeof ap52Notify==='function')ap52Notify(e?.message||'Não foi possível exportar o Excel histórico.');}};

  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('pessoal-relatorio-overlay')?.hidden)window.pessoalRelatorioEfetivoFechar();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{garantirUI();instalarBotao();},{once:true});else queueMicrotask(()=>{garantirUI();instalarBotao();});
})();
