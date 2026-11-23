/* AP5.2 v65.42.98 · Central de Ação · Comunicados com vigência */
let centralAcaoCache={itens:[],podePublicar:false,carregado:false,historico:[],historicoCarregado:false};

function abrirCentralAcao(){
  const painel=document.getElementById("central-acao");
  const backdrop=document.getElementById("central-acao-backdrop");
  const toggle=document.getElementById("central-acao-toggle");
  if(!painel)return;
  painel.classList.add("central-acao-aberta");
  backdrop?.classList.add("central-acao-aberta");
  document.body.classList.add("central-acao-aberta");
  toggle?.setAttribute("aria-expanded","true");
  if(!centralAcaoCache.carregado) carregarComunicadosCentral();
  renderAtencaoCentralPessoal();
  renderProximosEventosCentralPessoal();
  renderAcoesRapidasCentral();
}
function fecharCentralAcao(){
  document.getElementById("central-acao")?.classList.remove("central-acao-aberta");
  document.getElementById("central-acao-backdrop")?.classList.remove("central-acao-aberta");
  document.body.classList.remove("central-acao-aberta");
  document.getElementById("central-acao-toggle")?.setAttribute("aria-expanded","false");
}
function centralAgoraLocalInput(){
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function centralHojeLocalInput(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function centralComunicadoAtualizarCampos(){
  const modo=document.getElementById('central-comunicado-inicio-modo')?.value||'agora';
  const duracao=document.getElementById('central-comunicado-duracao')?.value||'7';
  const agendado=document.getElementById('central-comunicado-inicio-campo');
  const fim=document.getElementById('central-comunicado-fim-campo');
  const inicioInput=document.getElementById('central-comunicado-inicio');
  const fimInput=document.getElementById('central-comunicado-fim');
  if(agendado)agendado.hidden=modo!=='agendado';
  if(fim)fim.hidden=duracao!=='data';
  if(inicioInput){
    inicioInput.min=centralAgoraLocalInput();
    if(modo==='agendado'&&!inicioInput.value)inicioInput.value=centralAgoraLocalInput();
  }
  if(fimInput){
    const baseData=modo==='agendado'&&inicioInput?.value?String(inicioInput.value).slice(0,10):centralHojeLocalInput();
    fimInput.min=baseData;
    if(fimInput.value&&fimInput.value<baseData)fimInput.value=baseData;
  }
}
function centralResetFormComunicado(){
  const form=document.getElementById('central-comunicado-form');
  if(form)form.reset();
  const destino=document.getElementById('central-comunicado-destino');if(destino)destino.value='TODAS';
  const inicioModo=document.getElementById('central-comunicado-inicio-modo');if(inicioModo)inicioModo.value='agora';
  const duracao=document.getElementById('central-comunicado-duracao');if(duracao)duracao.value='7';
  const inicio=document.getElementById('central-comunicado-inicio');if(inicio)inicio.value='';
  const fim=document.getElementById('central-comunicado-fim');if(fim)fim.value='';
  centralComunicadoAtualizarCampos();
}
function alternarFormComunicado(forcar){
  const form=document.getElementById("central-comunicado-form");
  if(!form)return;
  const abrir=typeof forcar==="boolean"?forcar:form.hidden;
  if(abrir&& !document.getElementById('central-comunicados-historico-painel')?.hidden) alternarHistoricoComunicados(false);
  form.hidden=!abrir;
  const erro=document.getElementById("central-comunicado-erro");
  if(erro)erro.textContent="";
  if(abrir){centralComunicadoAtualizarCampos();setTimeout(()=>document.getElementById("central-comunicado-mensagem")?.focus(),30);}
}
function centralDestinoRotulo(destino){
  return destino==="TODAS"?"Todas as Gerências":String(destino||"Gerência");
}
function centralDataHora(iso){
  if(!iso)return "";
  try{return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(iso)).replace(",","");}catch(_){return "";}
}
function centralDataCurta(iso){
  if(!iso)return "";
  try{return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit"}).format(new Date(iso));}catch(_){return "";}
}
function centralDataChave(iso){
  if(!iso)return '';
  try{
    const partes=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));
    const o=Object.fromEntries(partes.map(x=>[x.type,x.value]));return `${o.year}-${o.month}-${o.day}`;
  }catch(_){return '';}
}
function centralEhRecente(iso){
  const t=Date.parse(iso||"");
  return Number.isFinite(t)&&(Date.now()-t)>=0&&(Date.now()-t)<24*60*60*1000;
}
function centralValidadeRotulo(item){
  if(!item?.expires_at)return 'Até encerrar manualmente';
  const hoje=centralDataChave(new Date().toISOString());
  const fim=centralDataChave(item.expires_at);
  if(fim===hoje)return 'Encerra hoje';
  return `Válido até ${centralDataCurta(item.expires_at)}`;
}
function centralStatusRotulo(status){return status==='agendado'?'Agendado':status==='ativo'?'Ativo':'Encerrado';}
function renderComunicadosCentral(){
  const lista=document.getElementById("central-comunicados-lista");
  if(!lista)return;
  const itens=(Array.isArray(centralAcaoCache.itens)?centralAcaoCache.itens:[]).filter(x=>!x.expires_at||Date.parse(x.expires_at)>Date.now());
  const novo=document.getElementById("central-comunicado-novo");
  const historicoBtn=document.getElementById('central-comunicado-historico');
  if(novo)novo.hidden=!centralAcaoCache.podePublicar;
  if(historicoBtn)historicoBtn.hidden=!centralAcaoCache.podePublicar;
  const toggle=document.getElementById("central-acao-toggle");
  const badge=document.getElementById("central-acao-toggle-badge");
  const recentes=itens.filter(x=>centralEhRecente(x.created_at)).length;
  if(toggle)toggle.classList.toggle("tem-itens",recentes>0);
  if(badge)badge.textContent=String(Math.min(recentes,99));
  if(centralAcaoCache.legado){
    lista.innerHTML='<div class="central-acao-vazio">Os comunicados aparecem nas contas individuais.</div>';
    return;
  }
  if(!itens.length){
    lista.innerHTML='<div class="central-acao-vazio">Nenhum comunicado ativo para esta unidade.</div>';
    return;
  }
  lista.innerHTML=itens.map(item=>{
    const recente=centralEhRecente(item.created_at)?'<span class="central-comunicado-recente">Recente</span>':"";
    return `<article class="central-comunicado">
      <div class="central-comunicado-meta">
        <span><span class="central-comunicado-destino">${escapar(centralDestinoRotulo(item.destino))}</span>${recente}</span>
        <time datetime="${escapar(item.created_at||"")}">${escapar(centralDataHora(item.created_at))}</time>
      </div>
      <p>${escapar(item.mensagem||"")}</p>
      <div class="central-comunicado-vigencia">${escapar(centralValidadeRotulo(item))}</div>
      <footer>${escapar(item.autor_nome||"Coordenação AP5.2")}</footer>
    </article>`;
  }).join("");
}
async function carregarComunicadosCentral(forcar=false){
  if(centralAcaoCache.carregado&&!forcar){renderComunicadosCentral();return true;}
  // v65.42.119.1: a consulta de comunicados exige conta individual; contas antigas não consultam o banco.
  centralAcaoCache.legado=typeof acesso28!=='undefined'&&!!acesso28?.legacy;
  if(centralAcaoCache.legado){
    centralAcaoCache.itens=[];centralAcaoCache.podePublicar=false;centralAcaoCache.carregado=true;
    renderComunicadosCentral();
    return false;
  }
  const lista=document.getElementById("central-comunicados-lista");
  if(lista)lista.innerHTML='<div class="central-acao-carregando">Carregando comunicados…</div>';
  try{
    const {data,error}=await sb.rpc("ap52_comunicados_listar",{p_limit:6});
    if(error)throw error;
    centralAcaoCache.itens=Array.isArray(data?.itens)?data.itens:[];
    centralAcaoCache.podePublicar=!!data?.pode_publicar;
    centralAcaoCache.carregado=true;
    renderComunicadosCentral();
    return true;
  }catch(e){
    console.error("Falha ao carregar comunicados:",e);
    centralAcaoCache.itens=[];centralAcaoCache.podePublicar=false;centralAcaoCache.carregado=false;
    if(lista)lista.innerHTML='<div class="central-acao-vazio">Não foi possível carregar os comunicados agora.</div>';
    return false;
  }
}
function renderHistoricoComunicadosCentral(){
  const lista=document.getElementById('central-comunicados-historico-lista');
  if(!lista)return;
  const itens=Array.isArray(centralAcaoCache.historico)?centralAcaoCache.historico:[];
  if(!itens.length){lista.innerHTML='<div class="central-acao-vazio">Nenhum comunicado registrado ainda.</div>';return;}
  lista.innerHTML=itens.map(item=>{
    const status=String(item.status||'encerrado');
    const podeEncerrar=status==='ativo'||status==='agendado';
    const quando=status==='agendado'?`Começa ${centralDataHora(item.starts_at)}`:centralValidadeRotulo(item);
    const motivo=status==='encerrado'?(item.motivo_encerramento==='manual'?'Encerrado manualmente':'Prazo encerrado'):quando;
    return `<article class="central-historico-item">
      <div class="central-historico-meta"><span class="central-historico-status ${escapar(status)}">${escapar(centralStatusRotulo(status))}</span><time>${escapar(centralDataHora(item.created_at))}</time></div>
      <div class="central-historico-destino">${escapar(centralDestinoRotulo(item.destino))}</div>
      <p>${escapar(item.mensagem||'')}</p>
      <div class="central-historico-vigencia">${escapar(motivo)}</div>
      <footer><span>${escapar(item.autor_nome||'Coordenação AP5.2')}</span>${podeEncerrar?`<button type="button" onclick="encerrarComunicadoCentral(${Number(item.id)})">Encerrar agora</button>`:''}</footer>
    </article>`;
  }).join('');
}
async function carregarHistoricoComunicadosCentral(forcar=false){
  if(centralAcaoCache.historicoCarregado&&!forcar){renderHistoricoComunicadosCentral();return true;}
  const lista=document.getElementById('central-comunicados-historico-lista');
  if(lista)lista.innerHTML='<div class="central-acao-carregando">Carregando histórico…</div>';
  try{
    const {data,error}=await sb.rpc('ap52_comunicados_historico',{p_limit:30});
    if(error)throw error;
    centralAcaoCache.historico=Array.isArray(data?.itens)?data.itens:[];
    centralAcaoCache.historicoCarregado=true;
    renderHistoricoComunicadosCentral();
    return true;
  }catch(e){
    console.error('Falha ao carregar histórico de comunicados:',e);
    if(lista)lista.innerHTML='<div class="central-acao-vazio">Não foi possível carregar o histórico agora.</div>';
    return false;
  }
}
async function alternarHistoricoComunicados(forcar){
  const painel=document.getElementById('central-comunicados-historico-painel');
  const lista=document.getElementById('central-comunicados-lista');
  const rodape=document.getElementById('central-comunicados-rodape');
  const form=document.getElementById('central-comunicado-form');
  if(!painel)return;
  const abrir=typeof forcar==='boolean'?forcar:painel.hidden;
  painel.hidden=!abrir;
  if(lista)lista.hidden=abrir;
  if(rodape)rodape.hidden=abrir;
  if(form&&abrir)form.hidden=true;
  if(abrir)await carregarHistoricoComunicadosCentral();
}
async function encerrarComunicadoCentral(id){
  if(!Number.isFinite(Number(id)))return;
  if(typeof ap52Confirm==='function'){
    const ok=await ap52Confirm('Encerrar este comunicado agora?\n\nEle sairá imediatamente da Central de Ação e continuará disponível no histórico.',{title:'Encerrar comunicado',variant:'warning',confirmText:'Encerrar'});
    if(!ok)return;
  }
  try{
    const {error}=await sb.rpc('ap52_comunicado_encerrar',{p_id:Number(id)});
    if(error)throw error;
    centralAcaoCache.carregado=false;centralAcaoCache.historicoCarregado=false;
    await Promise.all([carregarComunicadosCentral(true),carregarHistoricoComunicadosCentral(true)]);
    ap52Notify('Comunicado encerrado.');
  }catch(e){
    console.error('Falha ao encerrar comunicado:',e);
    ap52Notify('Não foi possível encerrar o comunicado: '+(e?.message||'tente novamente.'));
  }
}
async function publicarComunicadoCentral(event){
  event?.preventDefault?.();
  const mensagem=document.getElementById("central-comunicado-mensagem")?.value.trim()||"";
  const destino=document.getElementById("central-comunicado-destino")?.value||"TODAS";
  const inicioModo=document.getElementById('central-comunicado-inicio-modo')?.value||'agora';
  const inicioValor=document.getElementById('central-comunicado-inicio')?.value||'';
  const duracao=document.getElementById('central-comunicado-duracao')?.value||'7';
  const fimData=document.getElementById('central-comunicado-fim')?.value||'';
  const erro=document.getElementById("central-comunicado-erro");
  const btn=document.getElementById("central-comunicado-enviar");
  if(erro)erro.textContent="";
  if(mensagem.length<3){if(erro)erro.textContent="Digite uma mensagem com pelo menos 3 caracteres.";return;}
  let pInicio=null;
  if(inicioModo==='agendado'){
    if(!inicioValor){if(erro)erro.textContent='Informe quando o comunicado deve começar.';return;}
    const d=new Date(inicioValor);if(!Number.isFinite(d.getTime())){if(erro)erro.textContent='Informe uma data e hora de início válidas.';return;}
    if(d.getTime()<Date.now()-60000){if(erro)erro.textContent='O início agendado precisa ser agora ou no futuro.';return;}
    pInicio=d.toISOString();
  }
  if(duracao==='data'&&!fimData){if(erro)erro.textContent='Informe a data de término do comunicado.';return;}
  const semPrazo=duracao==='manual';
  const dias=/^\d+$/.test(duracao)?Number(duracao):7;
  if(btn){btn.disabled=true;btn.textContent=inicioModo==='agendado'?"Agendando…":"Publicando…";}
  try{
    const {data,error}=await sb.rpc("ap52_comunicado_publicar",{
      p_mensagem:mensagem,p_destino:destino,p_inicio:pInicio,p_duracao_dias:dias,p_fim_data:duracao==='data'?fimData:null,p_sem_prazo:semPrazo
    });
    if(error)throw error;
    centralResetFormComunicado();
    alternarFormComunicado(false);
    centralAcaoCache.carregado=false;centralAcaoCache.historicoCarregado=false;
    await carregarComunicadosCentral(true);
    ap52Notify(data?.status==='agendado'?'Comunicado agendado.':'Comunicado publicado.');
  }catch(e){
    console.error("Falha ao publicar comunicado:",e);
    if(erro)erro.textContent=e?.message||"Não foi possível publicar o comunicado.";
  }finally{
    if(btn){btn.disabled=false;btn.textContent="Publicar";}
  }
}
window.addEventListener("keydown",ev=>{if(ev.key==="Escape")fecharCentralAcao();});
setInterval(()=>{if(centralAcaoCache.carregado)renderComunicadosCentral();},60000);

/* ---------- CENTRAL DE AÇÃO · ETAPA 2 · ATENÇÃO HOJE ---------- */
function centralAtencaoDadosPessoal(){
  try{
    if(typeof funcionarios==='undefined' || !Array.isArray(funcionarios)) return {disponivel:false,itens:[],pessoas:0};
    if(typeof funcionariosEfetivoAtual!=='function') return {disponivel:false,itens:[],pessoas:0};
    const listaBase=funcionarios;
    const listaEfetivo=funcionariosEfetivoAtual(listaBase);
    const feriasOk=typeof estadoCarregamento!=='undefined' && !!estadoCarregamento.ferias;
    const contratosOk=typeof estadoCarregamento!=='undefined' && !!estadoCarregamento.contratosResumo;
    const avisosEstado=typeof pessoalAvisoPrevioResumoEstado==='function'?pessoalAvisoPrevioResumoEstado():{carregado:false,itens:[]};
    const avisosPreviosOk=!!avisosEstado?.carregado;
    const defs=[];

    if(avisosPreviosOk && typeof pessoalPainelAvisoVencido==='function'){
      defs.push({
        tipo:'aviso-previo-vencido',titulo:'Prazo do aviso encerrado',detalhe:'Término previsto já passou',nivel:'urgente',icone:'!',
        lista:listaEfetivo.filter(pessoalPainelAvisoVencido)
      });
    }
    if(feriasOk && typeof pessoalPainelFeriasVencidas==='function'){
      defs.push({
        tipo:'ferias-vencidas',titulo:'Férias vencidas',detalhe:'Prazo de gozo ultrapassado',nivel:'urgente',icone:'!',
        lista:listaEfetivo.filter(pessoalPainelFeriasVencidas)
      });
    }
    if(contratosOk && typeof pessoalPainelContratoTerminando==='function'){
      const lista=listaEfetivo.filter(f=>pessoalPainelContratoTerminando(f,60));
      const critico=typeof pessoalPainelContratoTerminandoInfo==='function' && lista.some(f=>{
        const info=pessoalPainelContratoTerminandoInfo(f,60);return info && Number(info.dias)<=15;
      });
      defs.push({
        tipo:'contrato-terminando',titulo:'Contrato próximo do fim',detalhe:'Vigência em até 60 dias',nivel:critico?'urgente':'atencao',icone:'⌛',lista
      });
    }
    if(typeof pessoalPainelSemVinculo==='function'){
      defs.push({
        tipo:'sem-vinculo',titulo:'Sem vínculo ativo',detalhe:'Cadastro fora do efetivo atual',nivel:'urgente',icone:'↔',
        lista:listaBase.filter(pessoalPainelSemVinculo)
      });
    }
    if(typeof pessoalPainelCadastroIncompleto==='function'){
      defs.push({
        tipo:'cadastro-incompleto',titulo:'Cadastro incompleto',detalhe:'Dados essenciais a conferir',nivel:'atencao',icone:'…',
        lista:listaEfetivo.filter(pessoalPainelCadastroIncompleto)
      });
    }
    if(avisosPreviosOk && typeof pessoalPainelAvisoTerminando==='function'){
      defs.push({
        tipo:'aviso-previo-terminando',titulo:'Aviso prévio próximo do fim',detalhe:'Término previsto em até 7 dias',nivel:'atencao',icone:'◷',
        lista:listaEfetivo.filter(f=>pessoalPainelAvisoTerminando(f,7))
      });
    }
    if(feriasOk && typeof pessoalPainelAfastamentoTerminando==='function'){
      defs.push({
        tipo:'afastamento-terminando',titulo:'Retorno de afastamento',detalhe:'Término previsto em até 7 dias',nivel:'informativo',icone:'↩',
        lista:listaEfetivo.filter(f=>pessoalPainelAfastamentoTerminando(f,7))
      });
    }

    const peso={urgente:0,atencao:1,informativo:2};
    const itens=defs
      .map(d=>({...d,qtd:Array.isArray(d.lista)?d.lista.length:0}))
      .filter(d=>d.qtd>0)
      .sort((a,b)=>(peso[a.nivel]??9)-(peso[b.nivel]??9)||b.qtd-a.qtd||a.titulo.localeCompare(b.titulo,'pt-BR'));
    const ids=new Set();
    itens.forEach(d=>d.lista.forEach(f=>{const id=Number(f?.id);if(Number.isFinite(id))ids.add(id);}));
    return {disponivel:true,itens,pessoas:ids.size,feriasOk,contratosOk,avisosPreviosOk,avisosPreviosErro:String(avisosEstado?.erro||'')};
  }catch(e){
    console.warn('Falha ao calcular Atenção hoje:',e);
    return {disponivel:false,itens:[],pessoas:0,avisosPreviosOk:false};
  }
}
function centralAtencaoNivelRotulo(nivel){
  return nivel==='urgente'?'Urgente':nivel==='atencao'?'Atenção':'Informativo';
}
function renderAtencaoCentralPessoal(){
  const lista=document.getElementById('central-atencao-lista');
  const resumo=document.getElementById('central-atencao-resumo');
  const nota=document.getElementById('central-atencao-nota');
  const bloco=document.getElementById('central-atencao-bloco');
  if(!lista||!resumo||!bloco)return;
  const dados=centralAtencaoDadosPessoal();
  if(!dados.disponivel){
    bloco.hidden=true;
    return;
  }
  bloco.hidden=false;
  resumo.textContent=dados.pessoas?String(Math.min(dados.pessoas,99)):'0';
  resumo.classList.toggle('tem-alerta',dados.pessoas>0);
  if(!dados.itens.length){
    lista.innerHTML='<div class="central-atencao-tranquilo"><strong>Tudo regular por aqui.</strong><span>Nenhuma situação prioritária foi identificada agora.</span></div>';
  }else{
    lista.innerHTML=dados.itens.slice(0,5).map(item=>{
      const nivel=centralAtencaoNivelRotulo(item.nivel);
      const pessoas=`${item.qtd} ${item.qtd===1?'pessoa':'pessoas'}`;
      return `<button type="button" class="central-atencao-item ${item.nivel}" onclick="centralAbrirAtencaoPessoal('${item.tipo}')" aria-label="${escapar(item.titulo)}: ${item.qtd} pessoa(s). Abrir relação"><span class="central-atencao-icone" aria-hidden="true">${item.icone}</span><span class="central-atencao-texto"><span class="central-atencao-linha"><strong>${escapar(item.titulo)}</strong><span class="central-atencao-nivel">${nivel}</span></span><small>${escapar(item.detalhe)}</small></span><span class="central-atencao-qtd">${escapar(pessoas)}</span></button>`;
    }).join('');
  }
  const avisos=[];
  if(!dados.feriasOk)avisos.push('Férias e afastamentos ainda não estão disponíveis.');
  if(!dados.avisosPreviosOk)avisos.push(dados.avisosPreviosErro?'Avisos prévios não estão disponíveis agora.':'Avisos prévios ainda estão sendo carregados.');
  if(!dados.contratosOk)avisos.push('Prazos contratuais ainda não estão disponíveis.');
  if(nota){nota.hidden=!avisos.length;nota.textContent=avisos.join(' ');}
}
async function centralAbrirAtencaoPessoal(tipo){
  if(typeof pessoalPainelAbrirRecorte!=='function')return;
  if(window.matchMedia?.('(min-width:1px)').matches)fecharCentralAcao();
  try{await pessoalPainelAbrirRecorte(tipo);}catch(e){console.error('Falha ao abrir recorte da Central de Ação:',e);}
}

/* ---------- CENTRAL DE AÇÃO · ETAPA 3 · PRÓXIMOS EVENTOS ---------- */
function centralEventosDataCurta(dataIso){
  if(!dataIso)return '';
  try{
    const [a,m,d]=String(dataIso).slice(0,10).split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'America/Sao_Paulo'}).format(new Date(a,m-1,d,12)).replace('.','');
  }catch(_){return '';}
}
function centralEventosProximosPessoal(){
  try{
    if(typeof funcionarios==='undefined' || !Array.isArray(funcionarios) || typeof funcionariosEfetivoAtual!=='function'){
      return {disponivel:false,itens:[],feriasOk:false,contratosOk:false,avisosPreviosOk:false};
    }
    const efetivo=funcionariosEfetivoAtual(funcionarios);
    const porId=new Map(efetivo.map(f=>[Number(f?.id),f]));
    const feriasOk=typeof estadoCarregamento!=='undefined' && !!estadoCarregamento.ferias;
    const contratosOk=typeof estadoCarregamento!=='undefined' && !!estadoCarregamento.contratosResumo;
    const avisosEstado=typeof pessoalAvisoPrevioResumoEstado==='function'?pessoalAvisoPrevioResumoEstado():{carregado:false,itens:[]};
    const avisosPreviosOk=!!avisosEstado?.carregado;
    const hoje=typeof pessoalPainelHoje==='function'?pessoalPainelHoje():new Date().toISOString().slice(0,10);
    const itens=[];

    if(feriasOk && typeof ferias!=='undefined' && Array.isArray(ferias) && typeof pessoalPainelDiasAte==='function'){
      ferias.forEach(reg=>{
        const emp=porId.get(Number(reg?.funcionario_id));
        if(!emp)return;
        const inicio=String(reg?.inicio||'').slice(0,10);
        const fim=String(reg?.fim||'').slice(0,10);
        const tipo=String(reg?.tipo||'');
        const ehFerias=/f[ée]rias/i.test(tipo);
        const ateInicio=inicio?pessoalPainelDiasAte(inicio):null;
        if(Number.isFinite(ateInicio) && ateInicio>=1 && ateInicio<=30){
          itens.push({
            chave:`inicio-${reg.id||emp.id}-${inicio}`,
            data:inicio,
            dias:ateInicio,
            classe:ehFerias?'ferias':'afastamento',
            icone:ehFerias?'☀':'＋',
            titulo:ehFerias?'Início de férias':'Início de afastamento',
            detalhe:`${emp.nome} · ${ateInicio===1?'amanhã':`em ${ateInicio} dias`}`,
            funcionarioId:Number(emp.id),
            ordem:ehFerias?10:20
          });
        }
        const ateFim=fim?pessoalPainelDiasAte(fim):null;
        const jaComecou=inicio && inicio<=hoje;
        if(!ehFerias && jaComecou && Number.isFinite(ateFim) && ateFim>=8 && ateFim<=30){
          itens.push({
            chave:`retorno-${reg.id||emp.id}-${fim}`,
            data:fim,
            dias:ateFim,
            classe:'retorno',
            icone:'↩',
            titulo:'Retorno de afastamento',
            detalhe:`${emp.nome} · em ${ateFim} dias`,
            funcionarioId:Number(emp.id),
            ordem:30
          });
        }
      });
    }

    if(avisosPreviosOk){
      // v65.42.148.4 — avisos com o mesmo término e a mesma empresa (aviso coletivo) viram um
      // único evento com a quantidade de pessoas, em vez de uma linha por pessoa.
      const gruposAviso=new Map();
      (Array.isArray(avisosEstado.itens)?avisosEstado.itens:[]).forEach(aviso=>{
        const emp=porId.get(Number(aviso?.funcionario_id));if(!emp)return;
        const dias=Number(aviso?.dias_restantes),fim=String(aviso?.fim_previsto||'').slice(0,10);
        // Até 7 dias já entra em “Atenção hoje”; prazos vencidos também ficam lá.
        if(!Number.isFinite(dias)||dias<8||dias>30||!fim)return;
        const empresa=String(aviso?.empresa||emp?.empresa||'').trim();
        const chave=`${fim}|${empresa.toLocaleLowerCase('pt-BR')}`;
        if(!gruposAviso.has(chave))gruposAviso.set(chave,{fim,dias,empresa,avisos:[]});
        gruposAviso.get(chave).avisos.push({aviso,emp});
      });
      gruposAviso.forEach(g=>{
        if(g.avisos.length===1){
          const {aviso,emp}=g.avisos[0];
          itens.push({
            chave:`aviso-${aviso.id||emp.id}-${g.fim}`,data:g.fim,dias:g.dias,classe:'aviso-previo',icone:'◷',
            titulo:'Término de aviso prévio',detalhe:`${emp.nome} · em ${g.dias} dias`,
            funcionarioId:Number(emp.id),ordem:25
          });
          return;
        }
        const n=g.avisos.length;
        itens.push({
          chave:`aviso-grupo-${g.fim}-${g.empresa}`,data:g.fim,dias:g.dias,classe:'aviso-previo',icone:'◷',
          titulo:'Término de aviso prévio',detalhe:`${g.empresa?g.empresa+' · ':''}${n} pessoas`,
          avisoGrupo:true,empresa:g.empresa,ordem:25
        });
      });
    }

    if(contratosOk && typeof contratoResumoPorNomeBase==='function' && typeof pessoalPainelDiasAte==='function'){
      const grupos=new Map();
      efetivo.forEach(emp=>{
        const nome=String(emp?.contrato||'').trim();
        if(!nome)return;
        const contrato=contratoResumoPorNomeBase(nome);
        if(!contrato || !contrato.vigencia_fim)return;
        if(typeof normalizarTextoContrato==='function' && normalizarTextoContrato(contrato.situacao)==='encerrado')return;
        const fim=String(contrato.vigencia_fim).slice(0,10);
        const dias=pessoalPainelDiasAte(fim);
        // Até 60 dias já aparece em “Atenção hoje”. Aqui entram os próximos prazos ainda não críticos.
        if(!Number.isFinite(dias) || dias<61 || dias>90)return;
        const rotulo=(typeof nomeContratoPadrao==='function' && nomeContratoPadrao(nome)) || contrato.apelido || contrato.titulo || nome;
        const chave=String(contrato.id||rotulo);
        if(!grupos.has(chave))grupos.set(chave,{contrato,rotulo,fim,dias,pessoas:[]});
        grupos.get(chave).pessoas.push(emp);
      });
      grupos.forEach(g=>{
        itens.push({
          chave:`contrato-${g.contrato.id||g.rotulo}`,
          data:g.fim,
          dias:g.dias,
          classe:'contrato',
          icone:'⌛',
          titulo:'Prazo contratual',
          detalhe:`${g.rotulo} · ${g.pessoas.length} ${g.pessoas.length===1?'pessoa':'pessoas'}`,
          contratoNome:g.rotulo,
          ordem:40
        });
      });
    }

    itens.sort((a,b)=>String(a.data).localeCompare(String(b.data))||a.ordem-b.ordem||String(a.detalhe).localeCompare(String(b.detalhe),'pt-BR'));
    return {disponivel:true,itens:itens.slice(0,6),total:itens.length,feriasOk,contratosOk,avisosPreviosOk,avisosPreviosErro:String(avisosEstado?.erro||'')};
  }catch(e){
    console.warn('Falha ao calcular Próximos eventos:',e);
    return {disponivel:false,itens:[],feriasOk:false,contratosOk:false,avisosPreviosOk:false};
  }
}
function renderProximosEventosCentralPessoal(){
  const bloco=document.getElementById('central-eventos-bloco');
  const lista=document.getElementById('central-eventos-lista');
  const resumo=document.getElementById('central-eventos-resumo');
  const nota=document.getElementById('central-eventos-nota');
  if(!bloco||!lista||!resumo)return;
  const dados=centralEventosProximosPessoal();
  if(!dados.disponivel){bloco.hidden=true;return;}
  bloco.hidden=false;
  resumo.textContent=String(Math.min(Number(dados.total||0),99));
  resumo.classList.toggle('tem-evento',Number(dados.total||0)>0);
  if(!dados.itens.length){
    lista.innerHTML='<div class="central-eventos-vazio"><strong>Sem eventos próximos.</strong><span>Nenhuma data nova foi identificada na janela acompanhada.</span></div>';
  }else{
    lista.innerHTML=dados.itens.map(item=>{
      const acao=item.funcionarioId?`data-funcionario-id="${Number(item.funcionarioId)}" onclick="centralAbrirEventoFuncionario(Number(this.dataset.funcionarioId))"`
        :item.avisoGrupo?`data-empresa="${escapar(String(item.empresa||''))}" onclick="centralAbrirEventoAvisoGrupo(this.dataset.empresa)"`
        :`data-contrato="${escapar(String(item.contratoNome||''))}" onclick="centralAbrirEventoContrato(this.dataset.contrato)"`;
      const dias=item.dias===1?'amanhã':`em ${item.dias} dias`;
      return `<button type="button" class="central-evento-item ${item.classe}" ${acao} aria-label="${escapar(item.titulo)}: ${escapar(item.detalhe)}"><span class="central-evento-data"><strong>${escapar(centralEventosDataCurta(item.data))}</strong><small>${escapar(dias)}</small></span><span class="central-evento-corpo"><span class="central-evento-linha"><span class="central-evento-icone" aria-hidden="true">${item.icone}</span><strong>${escapar(item.titulo)}</strong></span><small>${escapar(item.detalhe)}</small></span></button>`;
    }).join('');
  }
  const avisos=[];
  if(!dados.feriasOk)avisos.push('Férias e afastamentos ainda não estão disponíveis.');
  if(!dados.avisosPreviosOk)avisos.push(dados.avisosPreviosErro?'Avisos prévios não estão disponíveis agora.':'Avisos prévios ainda estão sendo carregados.');
  if(!dados.contratosOk)avisos.push('Prazos contratuais ainda não estão disponíveis.');
  if(Number(dados.total||0)>dados.itens.length)avisos.push(`Exibindo os ${dados.itens.length} eventos mais próximos.`);
  if(nota){nota.hidden=!avisos.length;nota.textContent=avisos.join(' ');}
}
async function centralAbrirEventoFuncionario(id){
  if(typeof pessoalPainelAbrirFuncionario!=='function')return;
  if(window.matchMedia?.('(min-width:1px)').matches)fecharCentralAcao();
  try{await pessoalPainelAbrirFuncionario(Number(id));}catch(e){console.error('Falha ao abrir funcionário pela Central de Ação:',e);}
}
// v65.42.148.4 — evento agrupado de aviso prévio: abre a lista de Pessoal no recorte
// “Em aviso prévio”, já filtrada pela empresa do grupo.
async function centralAbrirEventoAvisoGrupo(empresa){
  if(typeof pessoalPainelAbrirRecorte!=='function')return;
  if(window.matchMedia?.('(min-width:1px)').matches)fecharCentralAcao();
  try{
    await pessoalPainelAbrirRecorte('aviso-previo');
    const filtro=document.getElementById('f-empresa');
    const alvo=String(empresa||'').trim();
    if(filtro && alvo){
      const op=[...filtro.options].find(o=>String(o.value).trim().toLocaleLowerCase('pt-BR')===alvo.toLocaleLowerCase('pt-BR'));
      if(op){
        filtro.value=op.value;
        if(typeof pessoalPagina!=='undefined')pessoalPagina=1;
        if(typeof renderFuncionarios==='function')renderFuncionarios();
      }
    }
  }catch(e){console.error('Falha ao abrir avisos prévios pela Central de Ação:',e);}
}
async function centralAbrirEventoContrato(nome){
  if(typeof mudarView!=='function' || typeof pessoalPainelResetarFiltrosLista!=='function')return;
  if(window.matchMedia?.('(min-width:1px)').matches)fecharCentralAcao();
  try{
    if(typeof pessoalPainelRecorte!=='undefined')pessoalPainelRecorte='efetivo';
    pessoalPainelResetarFiltrosLista();
    await mudarView('funcionarios');
    const filtro=document.getElementById('f-contrato');
    if(filtro)filtro.value=(typeof nomeContratoPadrao==='function'&&nomeContratoPadrao(nome))||String(nome||'');
    if(typeof pessoalPagina!=='undefined')pessoalPagina=1;
    if(typeof renderFuncionarios==='function')renderFuncionarios();
  }catch(e){console.error('Falha ao abrir contrato pela Central de Ação:',e);}
}



/* ---------- CENTRAL DE AÇÃO · ETAPA 4 · AÇÕES RÁPIDAS ---------- */
function centralAcaoPode(module,action='visualizar'){
  try{
    if(typeof pode28==='function')return !!pode28(module,action);
  }catch(_){ }
  return false;
}
function centralAcaoEstaSobreposta(){
  const painel=document.getElementById('central-acao');
  if(!painel)return false;
  try{return getComputedStyle(painel).position==='fixed';}catch(_){return false;}
}
function centralAcaoFecharSeSobreposta(){
  if(centralAcaoEstaSobreposta())fecharCentralAcao();
}
function renderAcoesRapidasCentral(){
  const bloco=document.getElementById('central-acoes-bloco');
  const grade=document.getElementById('central-acoes-grade');
  if(!bloco||!grade)return;

  const podeVerPessoal=centralAcaoPode('pessoal','visualizar');
  const podeCadastrarPessoal=centralAcaoPode('pessoal','cadastrar');
  const podeCadastrarFerias=centralAcaoPode('ferias','cadastrar');
  const acoes=[];

  if(podeCadastrarPessoal){
    acoes.push({
      id:'novo-funcionario',icone:'＋',titulo:'Novo funcionário',detalhe:'Cadastrar pessoa',classe:'primaria',acao:'centralAcaoNovoFuncionario()'
    });
  }
  if(podeCadastrarFerias){
    acoes.push({
      id:'novo-periodo',icone:'☀',titulo:'Férias / afastamento',detalhe:'Registrar período',classe:'ferias',acao:'centralAcaoNovoPeriodo()'
    });
  }
  if(podeVerPessoal){
    acoes.push({
      id:'buscar-funcionario',icone:'⌕',titulo:'Buscar funcionário',detalhe:'Localizar cadastro',classe:'busca',acao:'centralAcaoBuscarFuncionario()'
    });
  }
  acoes.push({
    id:'atualizar-dados',icone:'↻',titulo:'Atualizar dados',detalhe:'Recarregar o sistema',classe:'atualizar',acao:'centralAcaoAtualizarDados()'
  });

  bloco.hidden=!acoes.length;
  grade.innerHTML=acoes.map(a=>`<button type="button" class="central-acao-atalho ${a.classe}" data-atalho="${a.id}" onclick="${a.acao}"><span class="central-acao-atalho-icone" aria-hidden="true">${a.icone}</span><span class="central-acao-atalho-texto"><strong>${a.titulo}</strong><small>${a.detalhe}</small></span><span class="central-acao-atalho-seta" aria-hidden="true">›</span></button>`).join('');
}
async function centralAcaoNovoFuncionario(){
  if(!centralAcaoPode('pessoal','cadastrar')){if(typeof aviso28==='function')aviso28('Seu perfil não permite cadastrar funcionários.');return;}
  centralAcaoFecharSeSobreposta();
  try{
    if(typeof mudarView==='function')await mudarView('funcionarios');
    if(typeof abrirModalFuncionario==='function')abrirModalFuncionario();
  }catch(e){console.error('Falha ao abrir novo funcionário pela Central de Ação:',e);}
}
async function centralAcaoNovoPeriodo(){
  if(!centralAcaoPode('ferias','cadastrar')){if(typeof aviso28==='function')aviso28('Seu perfil não permite registrar férias ou afastamentos.');return;}
  centralAcaoFecharSeSobreposta();
  try{
    if(typeof mudarView==='function')await mudarView('ferias');
    if(typeof abrirModalFerias==='function')abrirModalFerias();
  }catch(e){console.error('Falha ao abrir férias e afastamentos pela Central de Ação:',e);}
}
async function centralAcaoBuscarFuncionario(){
  if(!centralAcaoPode('pessoal','visualizar')){if(typeof aviso28==='function')aviso28('Seu perfil não permite consultar Gestão de Pessoal.');return;}
  centralAcaoFecharSeSobreposta();
  try{
    if(typeof mudarView==='function')await mudarView('overview');
    requestAnimationFrame(()=>{
      const busca=document.getElementById('pessoal-overview-busca');
      if(!busca)return;
      busca.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>busca.focus({preventScroll:true}),220);
    });
  }catch(e){console.error('Falha ao abrir busca de funcionário pela Central de Ação:',e);}
}
function centralAcaoAtualizarDados(){
  centralAcaoFecharSeSobreposta();
  location.reload();
}
