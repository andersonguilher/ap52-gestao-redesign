/* AP5.2 v65.42.152 — Hierarquia de Usuários e Acessos.
   Coordenação em três cargos equivalentes; Gestão da Gerência em dois cargos equivalentes.
   Avaliações e desligamentos seguem proteção adicional no servidor. */
'use strict';
const AC28_MODULES={pessoal:'Gestão de Pessoal',ponto:'Ponto e Frequência',ferias:'Férias e Afastamentos',equipamentos:'Equipamentos',escalas:'Escalas',almoxarifado:'Almoxarifado',contratos:'Contratos',mapa:'Mapa das Gerências',demandas:'Central de Demandas',acessos:'Usuários e Acessos',auditoria:'Auditoria'};
const AC28_ACTIONS=['visualizar','cadastrar','editar','excluir','exportar'];
const AC28_GERENCIAS=['21ª GC','22ª GC','23ª GC','24ª GC','25ª GC'];
const AC28_UNIDADES=['AP5.2',...AC28_GERENCIAS];
const AC28_TABLE_MODULE={funcionarios:'pessoal',avaliacoes:'pessoal',ferias:'ferias',ponto:'ponto',almox_materiais:'almoxarifado',almox_movimentacoes:'almoxarifado',equip_equipamentos:'equipamentos',equip_atendimentos:'equipamentos',equip_escalas:'escalas',gestao_contratos:'contratos',gestao_contrato_historico:'contratos',mapa_correcoes:'mapa',mapa_pendencias:'mapa',funcionario_vinculos:'pessoal'};
let acesso28=null,ac28ContextPromise=null,ac28UserCache=null,ac28Selected=null,ac28Tab='users',ac28Refs=null,ac28MfaFactor=null,ac28MfaResolve=null,ac28PasswordPending=window.AP52_RECOVERY_LINK===true;
let ac28Audit=[],ac28Trash=null,ac28Generation=0,ac28Activation=null,ac28PreviousFocus=null,ac28PreviousScroll=0;
const ac28PhotoCache=new Map();
// V50: assinatura/renovação de fotos não participa mais do caminho crítico de abertura.
let ac50PhotoWarmupPromise=null,ac50PhotoWarmupScheduled=false,ac50PhotoWarmupPending=false,ac50PrimeiraTelaPronta=false;
const ac28RawFrom=sb.from.bind(sb);
const AC28_COORD_ROLE_CODES=new Set(['coordenador_regional','assistente_coordenador','coordenacao']);
const AC28_GESTAO_GERENCIA_ROLE_CODES=new Set(['gerente','assistente_gerente']);
const AC28_ROLE_ORDER={administrador:1,coordenador_regional:2,assistente_coordenador:3,coordenacao:4,gerente:5,assistente_gerente:6,gerencia:7,operador:8,consulta:9};
function ehAdmin28(){return acesso28?.user?.role_code==='administrador';}
function ehCoordenacao28(){return AC28_COORD_ROLE_CODES.has(acesso28?.user?.role_code);}
function ehGestaoGerencia28(){return AC28_GESTAO_GERENCIA_ROLE_CODES.has(acesso28?.user?.role_code);}
function podeAbrirAcessos28(){return ehAdmin28()||ehCoordenacao28();}
function baseRole28(code){return ac28UserCache?.roles?.find(r=>r.code===code)?.base||code||'';}
function ordemRole28(code){return AC28_ROLE_ORDER[code]??999;}
function rolesOrdenados28(){return [...(ac28UserCache?.roles||[])].sort((a,b)=>ordemRole28(a.code)-ordemRole28(b.code)||String(a.nome).localeCompare(String(b.nome),'pt-BR'));}
// Administrador edita qualquer conta abaixo dele. Os três perfis da Coordenação
// compartilham o mesmo nível funcional e administram qualquer conta não administrativa.
function podeEditarConta28(user){
 if(!user||String(user.user_id)===String(acesso28?.user?.user_id))return false;
 if(ehAdmin28())return true;
 return ehCoordenacao28()&&baseRole28(user.role_code)!=='administrador';
}
function podeVerAlgumaAvaliacao28(){
 if(acesso28?.legacy)return perfil?.role==='coordenacao';
 const code=acesso28?.user?.role_code;
 return code==='administrador'||AC28_COORD_ROLE_CODES.has(code)||AC28_GESTAO_GERENCIA_ROLE_CODES.has(code);
}
function podeVerAvaliacaoFuncionario28(emp){
 if(!emp||!podeVerAlgumaAvaliacao28())return false;
 if(acesso28?.legacy)return perfil?.role==='coordenacao';
 const code=acesso28?.user?.role_code;
 if(code==='administrador'||AC28_COORD_ROLE_CODES.has(code))return true;
 return AC28_GESTAO_GERENCIA_ROLE_CODES.has(code)&&String(acesso28?.user?.gerencia||'')===String(emp.gerencia||'');
}
function podeGerenciarAvaliacaoFuncionario28(emp,acao='cadastrar'){return podeVerAvaliacaoFuncionario28(emp)&&pode28('pessoal',acao);}
function podeRegistrarDesligamentoFuncionario28(emp){
 if(!emp||!pode28('pessoal','editar'))return false;
 if(acesso28?.legacy)return perfil?.role==='coordenacao';
 const code=acesso28?.user?.role_code;
 if(code==='administrador'||AC28_COORD_ROLE_CODES.has(code))return true;
 return AC28_GESTAO_GERENCIA_ROLE_CODES.has(code)&&String(acesso28?.user?.gerencia||'')===String(emp.gerencia||'');
}
function podeAbrirRVL28(){return !!acesso28&&!!perfil;}
function rvlSomenteConsulta28(){return baseRole28(acesso28?.user?.role_code)==='consulta';}
function aplicarModoRVL28(){
 const view=document.getElementById('view-rvl');if(!view)return;
 const somente=rvlSomenteConsulta28();view.classList.toggle('rvl-readonly',somente);
 const note=document.getElementById('rvl-readonly-note');if(note)note.hidden=!somente;
 view.querySelectorAll('input,select,textarea').forEach(el=>{if(somente){if(!el.disabled){el.disabled=true;el.dataset.rvlAccessDisabled='1';}}else if(el.dataset.rvlAccessDisabled==='1'){el.disabled=false;delete el.dataset.rvlAccessDisabled;}});
 const permitido=(btn)=>{const oc=btn.getAttribute('onclick')||'';return btn.classList.contains('rvl-step')||btn.closest('.rvl-progress-list')||btn.closest('.rvl-preview-nav')||/rvlIrEtapa|rvlIrPrevia|rvlSelecionarPaginaPrevia|rvlGerarPDF|window\.scrollTo/.test(oc);};
 view.querySelectorAll('button').forEach(btn=>{if(somente&&!permitido(btn)){if(!btn.disabled){btn.disabled=true;btn.dataset.rvlAccessDisabled='1';}}else if(!somente&&btn.dataset.rvlAccessDisabled==='1'){btn.disabled=false;delete btn.dataset.rvlAccessDisabled;}});
}
function pode28(module,action='visualizar'){
 if(!acesso28||!perfil)return false;
 if(module==='demandas'&&acesso28.legacy)return false;
 if(acesso28.legacy){
  if(['acessos','auditoria'].includes(module)||action==='excluir')return false;
  if(module==='contratos')return perfil.role==='coordenacao';
  if(module==='mapa')return ['visualizar','exportar'].includes(action);
  if(['equipamentos','escalas'].includes(module)&&action!=='visualizar'&&perfil.role!=='coordenacao')return module==='equipamentos'&&['cadastrar','editar'].includes(action);
  return true;
 }
 return !!acesso28.permissions?.[module]?.includes(action);
}
function exigirPermissao28(module,action='visualizar'){
 if(pode28(module,action))return true;
 aviso28('Seu perfil não permite esta ação.');return false;
}
function aviso28(text){
 let el=document.getElementById('ac28-toast');if(!el){el=document.createElement('div');el.id='ac28-toast';el.setAttribute('role','status');document.body.append(el);}
 el.textContent=text;el.hidden=false;clearTimeout(aviso28.timer);aviso28.timer=setTimeout(()=>{el.hidden=true},6000);
}
async function contexto28(session,force=false){
 if(!force&&acesso28?.user?.user_id===session.user.id)return acesso28;
 if(ac28ContextPromise)return ac28ContextPromise;
 const generation=ac28Generation;
 ac28ContextPromise=(async()=>{const {data,error}=await sb.rpc('ap52_access_context');if(error)throw error;if(generation!==ac28Generation)throw Error('Sessão alterada.');if(!data?.user?.active)throw Error('Conta desativada.');acesso28=data;return data;})();
 try{return await ac28ContextPromise}finally{ac28ContextPromise=null;}
}
function limparDadosAcesso28(){
 try{void window.AP52ServicosCacheE2?.limpar?.();}catch(_){} // E2: limpar IndexedDB ao sair/trocar usuário.
 window.AP52Demandas66g2?.clearAll?.(); // fechamento síncrono antes de limpar identidade
 if(typeof limparDemandasAP52==='function')limparDemandasAP52();
 ac28Generation++;acesso28=null;ac28ContextPromise=null;ac28UserCache=null;ac28Selected=null;ac28Refs=null;ac28Audit=[];ac28Trash=null;ac28PhotoCache.clear();ac50PhotoWarmupPromise=null;ac50PhotoWarmupScheduled=false;ac50PhotoWarmupPending=false;ac50PrimeiraTelaPronta=false;
 funcionarios=[];ferias=[];avaliacoes=[];ponto=[];materiais=[];movimentacoes=[];equipamentos=[];escalas=[];atendimentos=[];contratosGestao=[];contratosHistoricoCache.clear();contratoHistoricoEdicaoAtual=null;
 vinculosFuncionarios=[];contratosResumoPessoal=[];escalasMesesAntigosCarregados=new Set();limparCacheFotos49();
 Object.keys(estadoCarregamento).forEach(k=>estadoCarregamento[k]=false);pessoalCacheIntegrado=null;pessoalAtividade=[];eq27Modelo=null;eq27Selecionado=null;eq27Carga={};
 document.querySelectorAll('.overlay.open').forEach(el=>el.classList.remove('open'));
 document.querySelectorAll('.ac28-dialog[open]').forEach(el=>el.close());
 document.getElementById('ac28-context')?.classList.remove('ac28-mobile-open');
 document.querySelectorAll('#pessoal-contexto-corpo,#eq27-context-body,#ac28-list,#ac28-context-body').forEach(el=>el.replaceChildren());
 document.body.style.overflow='';
}
const ac28OldLoginScreen=mostrarTelaLoginProtegida;
mostrarTelaLoginProtegida=function(message=''){limparDadosAcesso28();ac28OldLoginScreen(message);};
ativarSessaoProtegida=async function(session){
 if(!session?.user?.id){mostrarTelaLoginProtegida();return false;}
 if(ac28Activation)return ac28Activation;
 ac28Activation=(async()=>{
  try{
   if(sessaoAtual?.user?.id&&sessaoAtual.user.id!==session.user.id)limparDadosAcesso28();
   sessaoAtual=session;
   if(ac28PasswordPending||new URLSearchParams(location.search).get('acesso')==='definir'){
    ac28PasswordPending=true;
    document.getElementById('app-shell').style.display='none';
    document.getElementById('auth-gate').style.display='none';
    const dialog=document.getElementById('ac28-password');
    if(!dialog.open)dialog.showModal();
    requestAnimationFrame(()=>document.getElementById('ac28-password-value')?.focus({preventScroll:true}));
    return false;
   }
   const ctx=await contexto28(session);const u=ctx.user;
   // Compatibility field is a display/scope adapter only. Actual permissions use
   // the immutable DB-returned role_code and permissions in acesso28.
   perfil={id:u.user_id,nome:u.nome,gerencia:u.gerencia,role:u.scope==='global'?'coordenacao':'gerencia',access_role:u.role_code};
   document.getElementById('auth-gate').style.display='none';document.getElementById('app-shell').style.display='flex';
   document.getElementById('who-nome').textContent=u.nome;atualizarRotuloUnidade();
   document.getElementById('ac28-session').textContent=ctx.role_name|| (ctx.legacy?'Acesso anterior · em migração':u.role_code);
   if(!appProtegidoInicializado){appProtegidoInicializado=true;await iniciarApp();}
   aplicarPermissoes28();
   // V65.42.119.1 — comunicados da Central de Ação: uma consulta por login. No computador a Central
   // já fica aberta na lateral e, sem esta carga, ficava presa em "Carregando comunicados…".
   if(typeof carregarComunicadosCentral==='function')carregarComunicadosCentral(true).catch(()=>{});
   // V65.42.41 — restaura módulo/sub-aba somente após sessão, perfil e permissões estarem prontos.
   // Esta é a ativação efetivamente usada pelo app (sobrescreve a versão base do index.html).
   if(typeof ap52RestaurarNavegacaoSessao==='function')await ap52RestaurarNavegacaoSessao();
   if(typeof ap52InicializarHistoricoNavegacao==='function')ap52InicializarHistoricoNavegacao();
   verificarCopiaSeguranca52();
   return true;
  }catch(e){mostrarTelaLoginProtegida(e.code==='PGRST202'?'A atualização de segurança do banco ainda não foi instalada. Avise o administrador.':e.message||'Não foi possível validar seu acesso.');return false;}
 })();try{return await ac28Activation}finally{ac28Activation=null;}
};
function alternarVisibilidadeSenha28(inputId,button){
 const input=document.getElementById(inputId);if(!input||!button)return;
 const mostrar=input.type==='password';input.type=mostrar?'text':'password';button.classList.toggle('is-visible',mostrar);button.setAttribute('aria-pressed',String(mostrar));button.setAttribute('aria-label',mostrar?'Ocultar senha':'Mostrar senha');button.title=mostrar?'Ocultar senha':'Mostrar senha';
}
async function solicitarRecuperacaoSenha28(){
 const emailEl=document.getElementById('login-email'),email=emailEl?.value.trim()||'';
 const err=document.getElementById('login-erro'),info=document.getElementById('login-info'),button=document.getElementById('forgot-password-btn');
 if(err)err.textContent='';if(info)info.textContent='';
 if(!email){if(err)err.textContent='Informe seu e-mail acima para receber o link de recuperação.';emailEl?.focus({preventScroll:true});return;}
 if(button?.disabled)return;const original=button?.textContent||'Esqueci minha senha';if(button){button.disabled=true;button.textContent='Enviando…';}
 try{
  const redirectTo=`${location.origin}${location.pathname}?acesso=definir`;
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;
  if(info)info.textContent='Se este e-mail estiver cadastrado, você receberá um link para definir uma nova senha.';
 }catch(e){
  const message=String(e?.message||'').toLowerCase();
  if(err)err.textContent=message.includes('rate limit')?'O limite temporário de e-mails de recuperação foi atingido. Aguarde um pouco e tente novamente.':'Não foi possível enviar o link de recuperação agora. Tente novamente.';
 }finally{if(button){button.disabled=false;button.textContent=original;}}
}
fazerLogin=async function(){
 const emailEl=document.getElementById('login-email'),senhaEl=document.getElementById('login-senha');
 const email=(emailEl?.value||'').trim().toLowerCase(),password=senhaEl?.value||'';
 const err=document.getElementById('login-erro'),info=document.getElementById('login-info'),btn=document.getElementById('login-btn');
 if(btn?.disabled)return;
 if(info)info.textContent='';
 if(!email||!password){err.textContent='Informe seu e-mail e sua senha.';return;}
 // Mantém o e-mail normalizado visível e não apaga a senha em caso de erro.
 // Isso evita que o preenchimento automático do celular esconda qual credencial foi realmente enviada.
 if(emailEl)emailEl.value=email;
 err.textContent='';setBotaoProcessando('login-btn',true,'Entrando…');
 try{
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){
   console.warn('Falha de autenticação:',error);
   const codigo=String(error.code||'').toLowerCase(),mensagem=String(error.message||'').toLowerCase();
   if(codigo==='invalid_credentials'||/invalid login credentials|invalid credentials/.test(mensagem)){
    err.textContent='E-mail ou senha não conferem. No celular, apague o preenchimento automático e digite os dois campos novamente.';
    senhaEl?.focus({preventScroll:true});
   }else if(codigo==='email_not_confirmed'||/email not confirmed/.test(mensagem)){
    err.textContent='Este e-mail ainda não foi confirmado.';
   }else if(codigo==='user_banned'||/banned/.test(mensagem)){
    err.textContent='Este acesso está temporariamente bloqueado. Fale com a coordenação.';
   }else if(codigo==='over_request_rate_limit'||error.status===429||/rate limit|too many requests/.test(mensagem)){
    err.textContent='Houve muitas tentativas de acesso. Aguarde um pouco antes de tentar novamente.';
   }else if(error.status>=500||/fetch|network|upstream|timeout/.test(mensagem)){
    err.textContent='O serviço de login não respondeu corretamente. Verifique a conexão e tente novamente.';
   }else{
    err.textContent='Não foi possível autenticar agora. Tente novamente.';
   }
   return;
  }
  // Só limpa a senha depois que o Supabase realmente aceitou as credenciais.
  if(senhaEl)senhaEl.value='';
  await ativarSessaoProtegida(data.session);
 }catch(e){
  console.error('Falha inesperada no login:',e);
  err.textContent='Não foi possível concluir o login agora. Verifique a conexão e tente novamente.';
 }finally{setBotaoProcessando('login-btn',false);}
};
iniciarApp=async function(){
 // V50: mantém o roteamento por permissão da v49 e otimiza apenas o caminho liberado para Gestão de Pessoal.
 if(perfil.role==='coordenacao'){
  document.getElementById('emp-gerencia').innerHTML=GERENCIAS.map(g=>`<option>${g}</option>`).join('');document.getElementById('emp-gerencia-field').style.display='block';
 }

 // Sem Gestão de Pessoal: preserva o comportamento da v49 e abre o primeiro módulo liberado.
 if(!pode28('pessoal')){
  const home=['ponto','ferias','equipamentos','almoxarifado','contratos','demandas','mapa','acessos'].find(v=>(v==='acessos'?podeAbrirAcessos28()&&pode28('acessos'):pode28(moduloView28(v)))||(v==='equipamentos'&&pode28('escalas')));
  if(home){
   if(typeof ap52AplicandoHistorico!=='undefined')ap52AplicandoHistorico=true;
   try{await mudarView(home);}finally{if(typeof ap52AplicandoHistorico!=='undefined')ap52AplicandoHistorico=false;}
   if(matchMedia('(max-width:900px)').matches)mostrarInicioMobileSemHistorico();
  }else{
   document.querySelectorAll('.main>.view').forEach(el=>el.style.display='none');
   aviso28('Sua conta está ativa, mas nenhum módulo foi liberado. Solicite acesso ao administrador.');
  }
  return;
 }

 // Contratos/resumo e funcionários não dependem um do outro, então carregam em paralelo.
 // Vínculos seguem sendo aguardados antes do primeiro painel, pois definem o efetivo atual.
 // Férias e fotos completam depois, sem segurar a abertura do aplicativo.
 const [,okFuncionarios]=await Promise.all([
  carregarResumoContratosPessoal(false),
  carregarFuncionarios(false)
 ]);
 popularContratosCadastros();
 if(!okFuncionarios)return;

 // Férias só precisam dos IDs dos funcionários; podem viajar em paralelo aos vínculos.
 let feriasPromise=Promise.resolve(true);
 if(pode28('ferias')){
  feriasCargaInicialEmAndamento=true;
  feriasPromise=carregarFerias(false);
 }else{
  ferias=[];estadoCarregamento.ferias=true;
 }
 await carregarVinculosFuncionarios(false);
 atualizarBotaoMigracaoFotos();
 populatePontoSelects();
 populateFeriasEmpSelect();
 renderOverview();
 ac50PrimeiraTelaPronta=true;
 if(ac50PhotoWarmupPending){ac50PhotoWarmupPending=false;agendarPreparacaoFotos50();}

 // Não bloqueia a ativação da sessão. Quando terminar, atualiza apenas o que ficou pendente.
 if(pode28('ferias')){
  feriasPromise.then(ok=>{
   feriasCargaInicialEmAndamento=false;
   populateFeriasEmpSelect();
   if(document.getElementById('view-overview')?.style.display!=='none')renderOverview();
   if(document.getElementById('view-ferias')?.style.display!=='none')renderFerias();
   return ok;
  }).catch(e=>{
   feriasCargaInicialEmAndamento=false;
   console.warn('Carga inicial de férias concluída com erro:',e);
   if(document.getElementById('view-overview')?.style.display!=='none')renderOverview();
  });
 }
};
function moduloView28(v){return ({overview:'pessoal',funcionarios:'pessoal',ponto:'ponto',ferias:'ferias'})[v]||v;}
const ac28OldMudarView=mudarView;
mudarView=async function(view){
 if(!exigirAcessoProtegido())return;
 if(view==='overview'&&!pode28('pessoal'))view=pode28('ponto')?'ponto':'ferias';
 if(view==='acessos'&&!podeAbrirAcessos28())return aviso28('Usuários e Acessos é exclusivo do Administrador geral e da Coordenação.');
 if(view==='rvl'&&!podeAbrirRVL28())return aviso28('RVL não está disponível para esta sessão.');
 if(view==='equipamentos'&&!pode28('equipamentos')&&pode28('escalas'))secaoEquip='escalas';
 if(view!=='rvl'&&!pode28(moduloView28(view))&&!(view==='equipamentos'&&pode28('escalas')))return aviso28('Este módulo não foi liberado para seu perfil.');
 // 4.12.5: inclui a rota especial Acessos, que não chama ac28OldMudarView.
 if(view!=='demandas')window.AP52Demandas66g2?.clearAll?.();
 document.getElementById('ac28-context')?.classList.remove('ac28-mobile-open');
 document.getElementById('app-shell').classList.toggle('ac28-layout-active',view==='acessos');
 document.getElementById('view-acessos').style.display='none';
 if(view==='acessos'){
  recolherMenuMobile();document.getElementById('app-shell').classList.remove('mobile-inicio','mapa-layout-ativo','pessoal-func-layout-ativo','equip-layout-ativo','demandas-layout-ativo');
  document.querySelectorAll('.main>.view').forEach(el=>el.style.display=el.id==='view-acessos'?'block':'none');
  ['pessoal','contratos','almox','equip'].forEach(x=>document.getElementById(x+'-submenu').style.display='none');
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.id==='ac28-menu'));await carregarAcessos28();
  if(typeof ap52RegistrarRotaAtual==='function')ap52RegistrarRotaAtual();
  return;
 }
 if(['overview','funcionarios','ponto','ferias'].includes(view))await carregarFuncionarios();
 // V50: Ponto e visão geral não esperam férias; somente a própria tela de Férias exige essa carga antes de abrir.
 if(view==='ferias'&&pode28('ferias'))await carregarFerias();
 await ac28OldMudarView(view);aplicarPermissoes28();
};
const ac28LoadFuncionarios=carregarFuncionarios;
function agendarPreparacaoFotos50(){
 if(ac50PhotoWarmupScheduled||ac50PhotoWarmupPromise||!funcionarios.length)return;
 // Durante a primeira entrada, não disputa rede com contratos, vínculos e dados essenciais.
 if(!ac50PrimeiraTelaPronta){ac50PhotoWarmupPending=true;return;}
 ac50PhotoWarmupScheduled=true;
 const scheduledGeneration=ac28Generation;
 const executar=()=>{
  ac50PhotoWarmupScheduled=false;
  if(scheduledGeneration!==ac28Generation)return;
  const generation=ac28Generation;
  ac50PhotoWarmupPromise=prepararFotos28().then(()=>{
   if(generation!==ac28Generation)return;
   // Atualiza fotos somente se uma tela que as usa estiver visível; sem nova consulta ao banco.
   if(document.getElementById('view-overview')?.style.display!=='none'&&estadoCarregamento.ferias)renderOverview();
   else if(document.getElementById('view-funcionarios')?.style.display!=='none')renderFuncionarios();
  }).catch(e=>console.warn('Pré-carga de fotos adiada:',e)).finally(()=>{ac50PhotoWarmupPromise=null;});
 };
 if('requestIdleCallback'in window)requestIdleCallback(executar,{timeout:2500});
 else setTimeout(executar,900);
}
carregarFuncionarios=async function(force=false){
 if(!pode28('pessoal')){
  if(pode28('ponto')||pode28('ferias')){
   if(!ac28Refs||force){const {data,error}=await sb.rpc('ap52_employee_refs');if(error)return false;ac28Refs=data||[];}
   funcionarios=ac28Refs;estadoCarregamento.funcionarios=true;return true;
  }return true;
 }
 const ok=await ac28LoadFuncionarios(force);
 if(ok)agendarPreparacaoFotos50();
 return ok;
};
// Skip unauthorized requests, including optional cross-module summary loaders.
const ac28Loaders={carregarFerias,carregarAvaliacoes,carregarEquipamentos,carregarEscalas,carregarAtendimentos,carregarContratosGestao};
carregarFerias=(...a)=>pode28('ferias')?ac28Loaders.carregarFerias(...a):Promise.resolve(true);
carregarAvaliacoes=(...a)=>pode28('pessoal')?ac28Loaders.carregarAvaliacoes(...a):Promise.resolve(true);
carregarEquipamentos=async function(force=false){
 if(pode28('equipamentos'))return ac28Loaders.carregarEquipamentos(force);
 if(!pode28('escalas'))return true;
 if(estadoCarregamento.equipamentos&&!force)return true;
 const {data,error}=await sb.rpc('ap52_equipment_refs');if(error)return false;
 equipamentos=data||[];estadoCarregamento.equipamentos=true;return true;
};
carregarEscalas=(...a)=>pode28('escalas')?ac28Loaders.carregarEscalas(...a):Promise.resolve(true);
carregarAtendimentos=(...a)=>pode28('equipamentos')?ac28Loaders.carregarAtendimentos(...a):Promise.resolve(true);
carregarContratosGestao=(...a)=>pode28('contratos')?ac28Loaders.carregarContratosGestao(...a):Promise.resolve(true);
const ac49LoadVinculos=carregarVinculosFuncionarios;
carregarVinculosFuncionarios=(...a)=>pode28('pessoal')?ac49LoadVinculos(...a):Promise.resolve(true);

// A small query adapter prevents needless requests. Server-side RLS still
// authorizes every query even if this whole file is removed in the browser.
function consultaNegada28(message,data=null){const q=new Proxy({}, {get:(_,k)=>k==='then'?(resolve,reject)=>Promise.resolve({data,error:message?{message,code:'42501'}:null}).then(resolve,reject):()=>q});return q;}
sb.from=function(table){
 const module=AC28_TABLE_MODULE[table];if(!module)return ac28RawFrom(table);
 const canRead=pode28(module)||(table==='equip_equipamentos'&&pode28('escalas'));
 if(!canRead)return consultaNegada28('Módulo não autorizado.');
 const q=ac28RawFrom(table),original={insert:q.insert.bind(q),update:q.update.bind(q),upsert:q.upsert?.bind(q)};
 for(const [method,action]of [['insert','cadastrar'],['update','editar'],['upsert','editar']])if(original[method])q[method]=(...args)=>pode28(module,action)?original[method](...args):consultaNegada28('Ação não autorizada.');
 q.delete=()=>{
  let id=null;const del={eq(k,v){if(k==='id')id=v;return del},select(){return del},then(resolve,reject){return arquivar28(table,id).then(resolve,reject)}};return del;
 };return q;
};
async function arquivar28(table,id){
 if(!pode28(AC28_TABLE_MODULE[table],'excluir'))return {data:null,error:{message:'Somente administrador pode arquivar registros críticos.'}};
 if(!id)return {data:null,error:{message:'Registro não identificado.'}};
 if(!await segundoFator28())return {data:null,error:{message:'Operação cancelada.'}};
 const confirmation=`CONFIRMAR ${id}`;
 const {data,error}=await sb.rpc('ap52_record_change',{t:table,rid:Number(id),action:'arquivar',confirmation});ac28Trash=null;
 return {data:data?[{id:data.id}]:null,error};
}
const ac28OldPonto=salvarSituacaoPonto;
salvarSituacaoPonto=async function(emp,ano,mes,dia,situacao){
 if(acesso28?.legacy)return ac28OldPonto(emp,ano,mes,dia,situacao);
 const existente=ponto.find(p=>p.funcionario_id===emp&&p.ano===ano&&p.mes===mes&&p.dia===dia);
 if(!exigirPermissao28('ponto',existente?'editar':'cadastrar'))return;
 const {data,error}=await sb.rpc('ap52_set_attendance',{emp,y:ano,m:mes,d:dia,s:situacao||''});
 if(error){aviso28(error.message);return;}ponto=ponto.filter(p=>!(p.funcionario_id===emp&&p.ano===ano&&p.mes===mes&&p.dia===dia));if(data)ponto.push(data);renderPonto();
};

function caminhoFoto28(ref){
 if(!ref||ref.startsWith('data:')||String(ref).startsWith('r2:'))return '';
 if(!/^https?:/i.test(ref))return ref;
 try{const u=new URL(ref);if(u.origin!==SUPABASE_URL)return '';const m=u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/fotos-funcionarios\/(.+)/);return m?decodeURIComponent(m[1]):'';}catch{return '';}
}
function caminhoFotoR2(ref){const s=String(ref||'');return s.startsWith('r2:')?s.slice(3):'';}
const AC49_FOTO_VALIDADE=86400;
const AC49_FOTO_RENOVAR=3600000;
const AC49_FOTO_CHAVE='ap52-fotos-assinadas-v49';
let acR2MediaToken='',acR2MediaExpires=0,acR2MediaPromise=null;
function registrarFoto49(ref,url,validadeSeg=AC49_FOTO_VALIDADE){const agora=Date.now(),ttl=Math.max(120,Number(validadeSeg)||AC49_FOTO_VALIDADE);ac28PhotoCache.set(ref,{url,expires:agora+ttl*1000-30000,renew:agora+ttl*1000-Math.min(AC49_FOTO_RENOVAR,ttl*1000/3)});}
function restaurarCacheFotos49(){
 try{
  const uid=sessaoAtual?.user?.id;const d=JSON.parse(localStorage.getItem(AC49_FOTO_CHAVE)||'null');
  if(!uid||!d||d.uid!==uid)return;
  const agora=Date.now(),prefixo=SUPABASE_URL+'/storage/v1/object/sign/';
  Object.entries(d.itens||{}).forEach(([ref,v])=>{if(v&&typeof v.url==='string'&&v.url.startsWith(prefixo)&&v.expires>agora&&!ac28PhotoCache.has(ref))ac28PhotoCache.set(ref,v);});
 }catch(_){}
}
function salvarCacheFotos49(){
 try{
  const uid=sessaoAtual?.user?.id;if(!uid)return;
  const agora=Date.now(),itens={};ac28PhotoCache.forEach((v,ref)=>{if(v.expires>agora&&!caminhoFotoR2(ref))itens[ref]=v;});
  localStorage.setItem(AC49_FOTO_CHAVE,JSON.stringify({uid,itens}));
 }catch(_){}
}
function limparCacheFotos49(){try{localStorage.removeItem(AC49_FOTO_CHAVE);}catch(_){}acR2MediaToken='';acR2MediaExpires=0;}
async function obterTokenMidiaR2(forcar=false){
 const agora=Date.now();if(!forcar&&acR2MediaToken&&acR2MediaExpires>agora+120000)return acR2MediaToken;
 if(acR2MediaPromise&&!forcar)return acR2MediaPromise;
 acR2MediaPromise=(async()=>{
  const jwt=sessaoAtual?.access_token;if(!jwt)throw Error('Sessão não disponível para acessar o R2.');
  const resp=await fetch('/api/media/session',{method:'POST',headers:{Authorization:`Bearer ${jwt}`,Accept:'application/json'}});
  const j=await resp.json().catch(()=>({}));if(!resp.ok||!j?.token)throw Error(j?.error||'Não foi possível autorizar as fotos no R2.');
  acR2MediaToken=j.token;acR2MediaExpires=Number(j.expiresAt)||Date.now()+5*3600000;return acR2MediaToken;
 })().finally(()=>{acR2MediaPromise=null;});
 return acR2MediaPromise;
}
function urlFotoR2(ref,token){
 const path=caminhoFotoR2(ref);if(!path||!token)return '';
 return `/api/media/object/${path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token)}`;
}
function fotoUrl28(ref){
 if(!ref)return '';const c=ac28PhotoCache.get(ref);if(c&&c.expires>Date.now())return c.url;
 if(caminhoFotoR2(ref))return '';
 if(!acesso28?.legacy)return '';
 if(/^(https?:|data:)/i.test(ref))return ref;
 return SUPABASE_URL+'/storage/v1/object/public/'+FOTO_BUCKET+'/'+String(ref).split('/').map(encodeURIComponent).join('/');
}
async function prepararFotos28(){
 restaurarCacheFotos49();const agora=Date.now();
 const todas=[...new Set(funcionarios.map(f=>f.foto).filter(Boolean))];
 const r2Refs=todas.filter(r=>caminhoFotoR2(r)).filter(r=>{const c=ac28PhotoCache.get(r);return !c||c.renew<=agora;});
 if(r2Refs.length){
  try{const token=await obterTokenMidiaR2();const ttl=Math.max(300,Math.floor((acR2MediaExpires-Date.now())/1000));r2Refs.forEach(r=>registrarFoto49(r,urlFotoR2(r,token),ttl));}catch(e){console.warn('R2 indisponível nesta tentativa:',e?.message||e);}
 }
 // Fotos antigas continuam compatíveis até a migração ao R2.
 const refs=todas.filter(r=>!caminhoFotoR2(r)).filter(r=>{if(!caminhoFoto28(r))return false;const c=ac28PhotoCache.get(r);return !c||c.renew<=agora;});
 if(refs.length&&!acesso28?.legacy){
  const generation=ac28Generation;
  for(let i=0;i<refs.length;i+=50){const batch=refs.slice(i,i+50);const {data,error}=await sb.storage.from(FOTO_BUCKET).createSignedUrls(batch.map(caminhoFoto28),AC49_FOTO_VALIDADE);if(error)continue;if(generation!==ac28Generation)return;
   (data||[]).forEach((r,n)=>{if(r.signedUrl)registrarFoto49(batch[n],r.signedUrl);});}
 }
 salvarCacheFotos49();
}
avatarInnerHtml=function(f){const url=fotoUrl28(f.foto);return url?`<img src="${escapar(url)}" alt="" loading="lazy" decoding="async">`:initials(f.nome);};
enviarFotoParaStorage=async function(blob,name){
 if(!pode28('pessoal','editar')&&!pode28('pessoal','cadastrar'))throw Error('Sem permissão para enviar foto.');
 const token=await obterTokenMidiaR2();
 const resp=await fetch('/api/media/upload?scope=funcionarios',{method:'POST',headers:{'content-type':blob.type||'image/jpeg','x-ap52-media-token':token,Accept:'application/json'},body:blob});
 const j=await resp.json().catch(()=>({}));if(!resp.ok||!j?.ref)throw Error(j?.error||'Falha ao enviar a foto para o R2.');
 const ttl=Math.max(300,Math.floor((acR2MediaExpires-Date.now())/1000));registrarFoto49(j.ref,urlFotoR2(j.ref,token),ttl);return j.ref;
};
excluirFotoStorage=async function(ref){
 if(!ref||funcionarios.some(f=>f.foto===ref))return;
 const r2=caminhoFotoR2(ref);
 if(r2){
  try{const token=await obterTokenMidiaR2();const resp=await fetch(`/api/media/object/${r2.split('/').map(encodeURIComponent).join('/')}`,{method:'DELETE',headers:{'x-ap52-media-token':token,Accept:'application/json'}});if(resp.ok)ac28PhotoCache.delete(ref);else console.info('Foto R2 preservada; limpeza não autorizada.');}catch(e){console.info('Foto R2 preservada:',e?.message||e);}return;
 }
 const path=caminhoFoto28(ref);if(!path||!path.startsWith(sessaoAtual?.user?.id+'/'))return;
 const {error}=await sb.storage.from(FOTO_BUCKET).remove([path]);if(error)console.info('Foto antiga preservada; limpeza não autorizada.');
};

// Known actions are hidden at creation and rechecked inside their handlers.
const AC28_HANDLERS={
 abrirModalFuncionario:['pessoal','editar'],abrirNovoVinculoFuncionario:['pessoal','editar'],salvarFuncionario:['pessoal','editar'],excluirFuncionario:['pessoal','excluir'],
 abrirModalAvaliacao:['pessoal','visualizar'],salvarAvaliacao:['pessoal','cadastrar'],excluirAvaliacao:['pessoal','excluir'],migrarFotosParaStorage:['pessoal','editar'],
 abrirModalFerias:['ferias','editar'],salvarFerias:['ferias','editar'],
 abrirModalMaterial:['almoxarifado','editar'],salvarMaterial:['almoxarifado','editar'],excluirMaterial:['almoxarifado','excluir'],
 abrirModalMovimentacao:['almoxarifado','editar'],salvarMovimentacao:['almoxarifado','editar'],excluirMovimentacao:['almoxarifado','excluir'],
 abrirModalEquipamento:['equipamentos','editar'],salvarEquipamento:['equipamentos','editar'],excluirEquipamento:['equipamentos','excluir'],
 abrirModalAtendimento:['equipamentos','editar'],abrirModalAtendimentoEquipamento:['equipamentos','cadastrar'],salvarAtendimento:['equipamentos','editar'],excluirRegistroHoras:['equipamentos','excluir'],
 abrirModalEscala:['escalas','editar'],salvarEscala:['escalas','editar'],imprimirEscala:['escalas','exportar'],importarEscalaSetembro:['escalas','cadastrar'],
 abrirModalContratoGestao:['contratos','editar'],salvarContratoGestao:['contratos','editar'],excluirContratoGestao:['contratos','excluir'],
 aplicarSituacaoPonto:['ponto','editar'],limparSituacaoPonto:['ponto','editar'],cyclePonto:['ponto','editar']
};
function requisitoBotao28(el){
 const onclick=el.getAttribute('onclick')||'';const call=[...onclick.matchAll(/\b([\w]+)\s*\(([^)]*)/g)].find(c=>AC28_HANDLERS[c[1]]);if(!call)return null;
 const [m,a]=AC28_HANDLERS[call[1]];
 const fields={salvarFuncionario:'emp-id',salvarFerias:'ferias-id',salvarMaterial:'material-id',salvarMovimentacao:'mov-id',salvarEquipamento:'equipamento-id',salvarAtendimento:'atend-id',salvarEscala:'escala-id',salvarContratoGestao:'contrato-id'};
 if(fields[call[1]])return [m,document.getElementById(fields[call[1]])?.value?'editar':'cadastrar'];
 return [m,call[1].startsWith('abrirModal')&&!call[2].trim()?'cadastrar':a];
}
function aplicarPermissoes28(){
 if(typeof atualizarCadastroDemandasAP52==='function')atualizarCadastroDemandasAP52();
 document.querySelectorAll('[onclick]').forEach(el=>{const rule=requisitoBotao28(el);if(rule)el.classList.toggle('access-hidden28',!pode28(...rule));});
 document.querySelectorAll('.sidebar [data-view]').forEach(el=>{const v=el.dataset.view;const bloqueado=v==='rvl'?!podeAbrirRVL28():(!pode28(moduloView28(v))&&!(v==='equipamentos'&&pode28('escalas')));el.classList.toggle('access-hidden28',bloqueado);});
 document.getElementById('pessoal-menu').classList.toggle('access-hidden28',!['pessoal','ponto','ferias'].some(m=>pode28(m)));
 document.querySelectorAll('[data-equip]').forEach(el=>el.classList.toggle('access-hidden28',!pode28(el.dataset.equip==='escalas'?'escalas':'equipamentos')));
 document.getElementById('ac28-menu').classList.toggle('access-hidden28',!podeAbrirAcessos28()||!pode28('acessos'));
 if(typeof aplicarModoRVL28==='function')aplicarModoRVL28();
 const novaMov=document.getElementById('almox-nova-mov-btn');if(novaMov)novaMov.classList.toggle('access-hidden28',!pode28('almoxarifado','cadastrar'));
 const pontoAjuda=document.getElementById('ponto-ajuda-texto');
 if(pontoAjuda){
  const textoPonto=(pode28('ponto','editar')||pode28('ponto','cadastrar'))
   ?'Sábados e domingos aparecem automaticamente como fim de semana. Clique em um dia para editar o registro ao lado.'
   :'Sábados e domingos aparecem automaticamente como fim de semana.';
  if(pontoAjuda.textContent!==textoPonto) pontoAjuda.textContent=textoPonto; // V64.5: escrever sempre reativava o observador em laço
 }
 const avaliacaoEmp=funcionarios.find(f=>Number(f.id)===Number(document.getElementById('avaliacao-emp-id')?.value));const podeEditarAvaliacao=avaliacaoEmp?podeGerenciarAvaliacaoFuncionario28(avaliacaoEmp,'cadastrar'):false;document.querySelectorAll('#avaliacao-criterios input,#avaliacao-criterios button,#avaliacao-comentario,#avaliacao-periodo,#avaliacao-responsavel').forEach(el=>el.disabled=!podeEditarAvaliacao);
 const contracts=document.getElementById('contratos-menu');if(pode28('contratos'))contracts.style.display='flex';
}
let ac28MutationScheduled=false;
new MutationObserver(records=>{if(!perfil||!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1)))return;if(ac28MutationScheduled)return;ac28MutationScheduled=true;queueMicrotask(()=>{ac28MutationScheduled=false;aplicarPermissoes28();});}).observe(document.getElementById('app-shell'),{childList:true,subtree:true});

function montarAcessos28(){
 const menu=document.createElement('button');menu.id='ac28-menu';menu.className='nav-item access-hidden28';menu.type='button';menu.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></svg> <span>Usuários e Acessos</span>';menu.onclick=()=>mudarView('acessos');
 document.querySelector('.sidebar-quote').before(menu);
 const name=document.createElement('span');name.id='ac28-session';name.className='ac28-session-name';document.querySelector('.who').append(name);
 const view=document.createElement('section');view.id='view-acessos';view.className='view';view.style.display='none';
 view.innerHTML=`<div class="crumbs"><b>AP5.2</b> / Administração</div><header class="ac28-head"><div><div class="ac28-eyebrow">Segurança e responsabilidade</div><h1>Usuários e Acessos</h1><p>Uma conta por pessoa. Lotação, função e acesso são tratados separadamente.</p></div><button class="btn btn-primary" id="ac28-new">+ Novo usuário</button></header>
 <div id="ac28-stage" class="ac28-notice warn" hidden></div>
 <div class="ac28-layout"><div><nav class="ac28-tabs" aria-label="Administração de acesso">${[['users','Usuários'],['audit','Auditoria'],['trash','Arquivados']].map(([k,v])=>`<button type="button" data-ac28-tab="${k}" aria-selected="${k==='users'}">${v}</button>`).join('')}</nav>
 <section class="ac28-panel"><div id="ac28-filters" class="ac28-filters"><label>Buscar usuário<input id="ac28-search" placeholder="Nome ou e-mail" type="search"></label><label>Perfil<select id="ac28-role-filter"><option value="">Todos</option></select></label><label>Situação<select id="ac28-status-filter"><option value="">Todas</option><option value="active">Ativos</option><option value="off">Inativos</option></select></label></div><p id="ac28-count" class="ac28-count"></p><div id="ac28-list" aria-live="polite"></div></section></div>
 <aside id="ac28-context" class="ac28-panel" aria-labelledby="ac28-context-title"><header class="ac28-panel-head"><h2 id="ac28-context-title">Controle de acesso</h2><button type="button" class="btn btn-ghost" id="ac28-close" aria-label="Fechar seleção" hidden>×</button></header><div id="ac28-context-body" class="ac28-panel-body"></div></aside></div>`;
 document.querySelector('#app-shell>.main').append(view);
 document.body.insertAdjacentHTML('beforeend',`<dialog id="ac28-editor" class="ac28-dialog" aria-labelledby="ac28-editor-title"><header class="ac28-panel-head"><h2 id="ac28-editor-title">Novo usuário</h2><button type="button" class="btn btn-ghost" onclick="document.getElementById('ac28-editor').close()" aria-label="Fechar formulário">×</button></header><form id="ac28-user-form" class="ac28-form">
 <input type="hidden" id="ac28-id"><label class="ac28-full">Funcionário vinculado<select id="ac28-employee"><option value="">Sem vínculo com funcionário</option></select></label><label>Nome de exibição<input id="ac28-name" required maxlength="150" autocomplete="name"></label><label>E-mail individual<input id="ac28-email" type="email" required autocomplete="email"></label>
 <label>Perfil<select id="ac28-role"></select></label><label>Abrangência<select id="ac28-scope"><option value="gerencia">Somente uma unidade</option><option value="global">Toda a AP5.2</option></select></label><label>Unidade de acesso<select id="ac28-gc" required><option value=""></option>${AC28_UNIDADES.map(g=>`<option>${g}</option>`).join('')}</select></label><label>Situação<select id="ac28-active"><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
 <p class="ac28-help ac28-full"><b>Lotação e função</b> vêm do funcionário vinculado. <b>Perfil e abrangência</b> definem o que a conta pode fazer e quais unidades pode consultar.</p><p id="ac28-role-help" class="ac28-help ac28-full"></p><div id="ac28-employee-summary" class="ac28-notice ac28-full" hidden></div>
 <div class="ac28-full"><h3 style="font-size:15px;margin:0 0 10px">Módulos e ações</h3><p class="ac28-help">As permissões escolhidas substituem o padrão do perfil neste módulo. Edição de contas existentes, exclusões e auditoria são reservadas ao Administrador geral.</p><div id="ac28-permissions" class="ac28-permissions"></div><p class="ac28-help" style="margin-top:10px">Aprovação está prevista na estrutura do banco para fluxos futuros; nenhum fluxo de aprovação novo é ativado nesta versão.</p></div>
 <p class="ac28-help ac28-full" id="ac28-invite-note">O usuário receberá um link para definir sua própria senha. Nenhuma senha será exibida aqui.</p><p id="ac28-form-error" class="ac28-error ac28-full" role="alert"></p><footer><button type="button" class="btn btn-ghost" onclick="document.getElementById('ac28-editor').close()">Cancelar</button><button id="ac28-save" class="btn btn-primary" type="submit">Enviar convite</button></footer></form></dialog>
 <dialog id="ac28-mfa" class="ac28-dialog" aria-labelledby="ac28-mfa-title"><header class="ac28-panel-head"><h2 id="ac28-mfa-title">Confirmar identidade</h2></header><form id="ac28-mfa-form" class="ac28-form"><p class="ac28-help ac28-full">Para executar ações administrativas de acesso, confirme o código do seu aplicativo autenticador.</p><div id="ac28-mfa-setup" class="ac28-full"></div><label class="ac28-full">Código de 6 dígitos<input id="ac28-mfa-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required maxlength="6"></label><p class="ac28-error ac28-full" id="ac28-mfa-error" role="alert"></p><footer><button type="button" class="btn btn-ghost" onclick="document.getElementById('ac28-mfa').close()">Cancelar</button><button class="btn btn-primary" type="submit">Confirmar</button></footer></form></dialog>
 <dialog id="ac28-password" class="ac28-dialog" style="max-width:480px" aria-labelledby="ac28-password-title"><header class="ac28-panel-head"><h2 id="ac28-password-title">Defina sua senha</h2></header><form id="ac28-password-form" class="ac28-form"><p class="ac28-help ac28-full">Esta é sua conta individual de acesso à AP5.2.</p><label class="ac28-full">Nova senha<div class="password-wrap"><input id="ac28-password-value" type="password" autocomplete="new-password" minlength="6" required><button type="button" class="password-toggle" aria-label="Mostrar senha" aria-pressed="false" title="Mostrar senha" onclick="alternarVisibilidadeSenha28('ac28-password-value',this)"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg><svg class="eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 6.1A10.4 10.4 0 0 1 12 6c6 0 9.5 6 9.5 6a16.8 16.8 0 0 1-3.1 3.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></div></label><label class="ac28-full">Confirme a senha<div class="password-wrap"><input id="ac28-password-confirm" type="password" autocomplete="new-password" minlength="6" required><button type="button" class="password-toggle" aria-label="Mostrar senha" aria-pressed="false" title="Mostrar senha" onclick="alternarVisibilidadeSenha28('ac28-password-confirm',this)"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg><svg class="eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 6.1A10.4 10.4 0 0 1 12 6c6 0 9.5 6 9.5 6a16.8 16.8 0 0 1-3.1 3.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></div></label><p class="ac28-help ac28-full">Use pelo menos 6 caracteres, com pelo menos 1 letra maiúscula e 1 caractere especial. A senha não será compartilhada com o administrador.</p><p id="ac28-password-error" class="ac28-error ac28-full" role="alert"></p><footer><button class="btn btn-primary" type="submit">Salvar e continuar</button></footer></form></dialog>`);
 document.getElementById('ac28-new').onclick=()=>abrirEditorAcesso28();document.getElementById('ac28-close').onclick=()=>selecionarUsuario28(null);
 document.querySelectorAll('[data-ac28-tab]').forEach(el=>el.onclick=()=>abrirTabAcesso28(el.dataset.ac28Tab));
 ['ac28-search','ac28-role-filter','ac28-status-filter'].forEach(id=>document.getElementById(id).addEventListener(id==='ac28-search'?'input':'change',renderUsuarios28));
 document.getElementById('ac28-role').onchange=()=>{ajustarPerfilForm28(true);};document.getElementById('ac28-scope').onchange=ajustarEscopoGerencia28;document.getElementById('ac28-user-form').onsubmit=salvarUsuario28;
 document.getElementById('ac28-employee').onchange=()=>{const emp=(ac28Refs||funcionarios).find(f=>String(f.id)===document.getElementById('ac28-employee').value);if(emp){document.getElementById('ac28-name').value=emp.nome;if(document.getElementById('ac28-scope').value==='gerencia'&&AC28_UNIDADES.includes(emp.gerencia))document.getElementById('ac28-gc').value=emp.gerencia;}atualizarResumoFuncionario28();};
 document.getElementById('ac28-mfa-form').onsubmit=confirmarMfa28;
 document.getElementById('ac28-mfa').addEventListener('close',()=>{if(ac28MfaResolve){ac28MfaResolve(false);ac28MfaResolve=null;}});
 document.getElementById('ac28-password-form').onsubmit=salvarSenha28;
 document.getElementById('ac28-password').addEventListener('cancel',e=>e.preventDefault());
}
async function segundoFator28(){
 if(acesso28?.legacy)return false;
 const {data,error}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();if(error){aviso28(error.message);return false;}if(data.currentLevel==='aal2')return true;
 try{
  const factors=await sb.auth.mfa.listFactors();if(factors.error)throw factors.error;
  ac28MfaFactor=factors.data.totp.find(f=>f.status==='verified')?.id;
  const setup=document.getElementById('ac28-mfa-setup');setup.replaceChildren();
  if(!ac28MfaFactor){
   for(const f of factors.data.totp.filter(f=>f.status!=='verified'))await sb.auth.mfa.unenroll({factorId:f.id});
   const enrolled=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'AP5.2 · acesso administrativo'});if(enrolled.error)throw enrolled.error;
   ac28MfaFactor=enrolled.data.id;const p=document.createElement('p');p.className='ac28-help';p.textContent='Abra seu aplicativo autenticador, adicione uma conta pelo QR Code e informe o código gerado.';const img=document.createElement('img');img.alt='QR Code para cadastrar seu autenticador';const qr=enrolled.data.totp.qr_code;img.src=qr.startsWith('data:')?qr:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr);setup.append(p,img);
  }
  document.getElementById('ac28-mfa-code').value='';document.getElementById('ac28-mfa-error').textContent='';document.getElementById('ac28-mfa').showModal();
  return await new Promise(resolve=>{ac28MfaResolve=resolve;});
 }catch(e){aviso28(e.message);return false;}
}
async function confirmarMfa28(event){
 event.preventDefault();const button=event.submitter;button.disabled=true;
 try{const result=await sb.auth.mfa.challengeAndVerify({factorId:ac28MfaFactor,code:document.getElementById('ac28-mfa-code').value.trim()});if(result.error)throw result.error;
 const {data}=await sb.auth.getSession();sessaoAtual=data.session;await contexto28(data.session,true);const resolve=ac28MfaResolve;ac28MfaResolve=null;document.getElementById('ac28-mfa').close();resolve?.(true);}
 catch(e){document.getElementById('ac28-mfa-error').textContent=e.message;}finally{button.disabled=false;}
}
async function salvarSenha28(event){
 event.preventDefault();const err=document.getElementById('ac28-password-error'),password=document.getElementById('ac28-password-value').value;
 err.textContent='';
 if(password.length<6){err.textContent='A senha deve ter no mínimo 6 caracteres.';return;}
 if(!/[A-Z]/.test(password)){err.textContent='A senha deve ter pelo menos 1 letra maiúscula.';return;}
 if(!/[^A-Za-z0-9]/.test(password)){err.textContent='A senha deve ter pelo menos 1 caractere especial.';return;}
 if(password!==document.getElementById('ac28-password-confirm').value){err.textContent='As senhas precisam ser iguais.';return;}
 event.submitter.disabled=true;
 try{const {error}=await sb.auth.updateUser({password});if(error)throw error;ac28PasswordPending=false;window.AP52_RECOVERY_LINK=false;document.getElementById('ac28-password-form').reset();document.getElementById('ac28-password').close();history.replaceState(null,'',location.pathname);const {data}=await sb.auth.getSession();await ativarSessaoProtegida(data.session);}
 catch(e){err.textContent=e.message;}finally{event.submitter.disabled=false;}
}
async function carregarAcessos28(force=false){
 if(!podeAbrirAcessos28())return aviso28('Usuários e Acessos é exclusivo do Administrador geral e da Coordenação.');
 if(!exigirPermissao28('acessos'))return;
 const list=document.getElementById('ac28-list');list.innerHTML='<div class="ac28-empty">Validando acesso administrativo…</div>';
 if(!await segundoFator28()){list.innerHTML='<div class="ac28-empty">Confirme sua identidade para consultar usuários.<br><button class="btn btn-primary" onclick="carregarAcessos28()">Confirmar identidade</button></div>';return;}
 try{
  if(!ac28UserCache||force){const {data,error}=await sb.rpc('ap52_users_list');if(error)throw error;ac28UserCache=data;}
  const admin=ehAdmin28();
  document.getElementById('ac28-new').classList.toggle('access-hidden28',!pode28('acessos','cadastrar'));
  document.querySelectorAll('[data-ac28-tab]').forEach(el=>{const restrita=el.dataset.ac28Tab!=='users';el.classList.toggle('access-hidden28',restrita&&!admin);});
  if(!admin&&ac28Tab!=='users')ac28Tab='users';
  document.getElementById('ac28-role-filter').innerHTML='<option value="">Todos</option>'+rolesOrdenados28().map(r=>`<option value="${escapar(r.code)}">${escapar(r.nome)}</option>`).join('');
  const stage=document.getElementById('ac28-stage');
  if(admin&&ac28UserCache.mode!=='ativo'){
   stage.hidden=false;stage.innerHTML='Migração em preparação. Os acessos anteriores continuam ativos até a validação administrativa e a etapa final de ativação. <button class="btn btn-ghost" id="ac28-validate">Validar meu acesso de administrador</button>';
   stage.querySelector('button').onclick=validarAdmin28;
  }else{stage.hidden=true;stage.replaceChildren();}
  await abrirTabAcesso28(ac28Tab);
 }catch(e){list.innerHTML=`<div class="ac28-empty">${escapar(e.message)}<br><button class="btn btn-ghost" onclick="carregarAcessos28(true)">Tentar novamente</button></div>`;}
}
async function validarAdmin28(){if(!await segundoFator28())return;const {error}=await sb.rpc('ap52_validate_admin');if(error)return aviso28(error.message);aviso28('Administrador validado. A ativação final ainda depende da conferência e da migração de ativação.');}
function permissoesUsuario28(u){const result={};for(const m of Object.keys(AC28_MODULES)){const override=ac28UserCache.overrides.find(p=>p.user_id===u.user_id&&p.module===m);const role=ac28UserCache.role_permissions.find(p=>p.role_code===u.role_code&&p.module===m);result[m]=override?.actions||role?.actions||[];}return result;}
function renderUsuarios28(){
 if(ac28Tab!=='users'||!ac28UserCache)return;
 const term=document.getElementById('ac28-search').value.trim().toLocaleLowerCase('pt-BR'),role=document.getElementById('ac28-role-filter').value,status=document.getElementById('ac28-status-filter').value;
 const users=ac28UserCache.users.filter(u=>(!term||`${u.nome} ${u.email}`.toLocaleLowerCase('pt-BR').includes(term))&&(!role||u.role_code===role)&&(!status||(status==='active')===u.active)).sort((a,b)=>ordemRole28(a.role_code)-ordemRole28(b.role_code)||String(a.nome).localeCompare(String(b.nome),'pt-BR'));
 document.getElementById('ac28-count').textContent=`${users.length} ${users.length===1?'conta':'contas'} · contas de acesso são independentes dos funcionários`;
 const list=document.getElementById('ac28-list');list.innerHTML=users.map(u=>`<button type="button" class="ac28-row" data-user="${escapar(u.user_id)}" aria-pressed="${u.user_id===ac28Selected}"><span class="ac28-avatar">${escapar(initials(u.nome))}</span><span><b>${escapar(u.nome)}</b><small>${escapar(u.email)}</small><small><span class="ac28-role">${escapar(u.role_name)}</span> · ${escapar(u.scope==='global'?'Toda a AP5.2':u.gerencia)}</small></span><span class="ac28-tag ${u.active?'':'off'}">${u.active?'Ativo':'Inativo'}</span></button>`).join('')||'<div class="ac28-empty">Nenhum usuário nesta consulta.<br>Limpe os filtros ou crie uma conta individual.</div>';
 list.querySelectorAll('[data-user]').forEach(el=>el.onclick=()=>selecionarUsuario28(el.dataset.user,el));renderContextoAcesso28();
}
function selecionarUsuario28(id,origin){
 const mobile=matchMedia('(max-width:1100px)').matches;if(id&&mobile){ac28PreviousScroll=scrollY;ac28PreviousFocus=origin||document.activeElement;}
 ac28Selected=id;renderUsuarios28();const panel=document.getElementById('ac28-context');panel.classList.toggle('ac28-mobile-open',!!id&&mobile);
 if(id&&mobile){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');document.getElementById('ac28-close').focus({preventScroll:true});}
 else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');if(!id&&mobile){scrollTo(0,ac28PreviousScroll);ac28PreviousFocus?.focus({preventScroll:true});}}
}
function dataAcesso28(v){return v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Ainda não disponível';}
function renderContextoAcesso28(){
 if(!ac28UserCache)return;const user=ac28UserCache.users.find(u=>u.user_id===ac28Selected),box=document.getElementById('ac28-context-body'),admin=ehAdmin28();
 document.getElementById('ac28-close').hidden=!user;document.getElementById('ac28-context-title').textContent=user?'Dossiê de acesso':'Controle de acesso';
 if(!user){const n=ac28UserCache.users.length,active=ac28UserCache.users.filter(u=>u.active).length;
  const notice=admin?'Contas inativas perdem acesso aos dados imediatamente. A auditoria registra alterações no banco.':'Os perfis da Coordenação administram todas as contas abaixo do Administrador Geral. A conta de Administrador Geral permanece invisível para os demais acessos.';
  box.innerHTML=`<div class="ac28-eyebrow">Contas individuais</div><div class="ac28-stats"><div><b>${active}</b>ativas</div><div><b>${n-active}</b>inativas</div></div><div class="ac28-block"><h4>Hierarquia de perfis</h4>${rolesOrdenados28().map(r=>`<div class="ac28-perm"><span>${escapar(r.nome)}</span><b>${ac28UserCache.users.filter(u=>u.role_code===r.code).length}</b></div>`).join('')}</div><div class="ac28-block"><h4>Responsabilidade individual</h4><p class="ac28-help">Selecione uma conta para consultar sua abrangência e suas permissões. Funcionários sem login continuam no cadastro da equipe.</p></div><div class="ac28-notice">${escapar(notice)}</div>`;return;}
 const perms=permissoesUsuario28(user);const emp=funcionarios.find(f=>String(f.id)===String(user.funcionario_id));
 const podeAlterar=podeEditarConta28(user);
 const actions=podeAlterar?`<div class="ac28-actions"><button class="btn btn-primary" id="ac28-edit">Editar acesso</button><button class="btn btn-ghost" id="ac28-toggle">${user.active?'Desativar':'Ativar'}</button>${admin&&user.active?'<button class="btn btn-ghost" id="ac28-recovery">Enviar link de acesso</button>':''}</div><p class="ac28-help" style="margin-top:14px">${admin?'Senhas nunca são exibidas. O link permite que a própria pessoa defina uma nova senha.':'Os três perfis da Coordenação têm o mesmo nível funcional e podem administrar qualquer conta não administrativa.'}</p>`:`<p class="ac28-help" style="margin-top:14px">${String(user.user_id)===String(acesso28?.user?.user_id)?'Esta é a sua conta. Alterações nela são feitas por outra conta autorizada.':'Consulta de acesso. A conta de Administrador Geral é protegida e não aparece para os demais perfis.'}</p>`;
 box.innerHTML=`<span class="ac28-tag ${user.active?'':'off'}">${user.active?'Ativo':'Inativo'}</span><h3>${escapar(user.nome)}</h3><p class="ac28-email">${escapar(user.email)}</p><div class="ac28-block ac28-meta"><div><span>Perfil</span><b>${escapar(user.role_name)}</b></div><div><span>Abrangência</span>${escapar(user.scope==='global'?'Toda a AP5.2':user.gerencia)}</div><div><span>Funcionário vinculado</span>${escapar(user.funcionario_id?(emp?.nome||'Cadastro #'+user.funcionario_id):'Sem vínculo')}</div><div><span>Último acesso</span>${escapar(dataAcesso28(user.last_sign_in_at))}</div><div><span>Última alteração</span>${escapar(dataAcesso28(user.updated_at))}</div></div><div class="ac28-block"><h4>Módulos liberados</h4>${Object.entries(perms).filter(([,a])=>a.includes('visualizar')).map(([m,a])=>`<div class="ac28-perm"><span>${AC28_MODULES[m]}</span><span>${a.filter(x=>x!=='visualizar').map(x=>({cadastrar:'criar',editar:'editar',excluir:'arquivar',exportar:'exportar',aprovar:'aprovar'})[x]).join(', ')||'consulta'}</span></div>`).join('')||'<p class="ac28-help">Nenhum módulo liberado.</p>'}</div>${actions}`;
 if(podeAlterar){
  box.querySelector('#ac28-edit').onclick=()=>abrirEditorAcesso28(user);box.querySelector('#ac28-toggle').onclick=()=>alternarAtivo28(user);box.querySelector('#ac28-recovery')?.addEventListener('click',()=>enviarLink28(user));
 }
}
async function abrirEditorAcesso28(user=null){
 const action=user?'editar':'cadastrar';if(user?!podeEditarConta28(user):!exigirPermissao28('acessos',action)){if(user)aviso28('Seu perfil não permite alterar esta conta.');return;}if(!ac28UserCache||!await segundoFator28())return;
 if(!ac28Refs){if(estadoCarregamento.funcionarios&&pode28('pessoal'))ac28Refs=funcionarios;else{const {data,error}=await sb.rpc('ap52_employee_refs');if(error)return aviso28(error.message);ac28Refs=data||[];}}
 const val=(id,value)=>{document.getElementById(id).value=value??''};
 document.getElementById('ac28-user-form').reset();document.getElementById('ac28-employee').innerHTML='<option value="">Sem vínculo com funcionário</option>'+ac28Refs.map(f=>`<option value="${f.id}">${escapar(f.nome)}${f.cargo?' · '+escapar(f.cargo):''} · ${escapar(f.gerencia)}</option>`).join('');
 const rolesDisponiveis=rolesOrdenados28().filter(r=>ehAdmin28()||r.base!=='administrador');document.getElementById('ac28-role').innerHTML=rolesDisponiveis.map(r=>`<option value="${escapar(r.code)}">${escapar(r.nome)}</option>`).join('');
 val('ac28-id',user?.user_id);val('ac28-name',user?.nome);val('ac28-email',user?.email);val('ac28-employee',user?.funcionario_id);val('ac28-role',user?.role_code||'consulta');val('ac28-scope',user?.scope||'gerencia');val('ac28-gc',user?.gerencia||'');val('ac28-active',String(user?.active??true));
 document.getElementById('ac28-email').disabled=!!user;document.getElementById('ac28-editor-title').textContent=user?'Editar acesso':'Novo usuário';document.getElementById('ac28-save').textContent=user?'Salvar acesso':'Enviar convite';document.getElementById('ac28-form-error').textContent='';
 ajustarPerfilForm28(false,user);atualizarResumoFuncionario28();document.getElementById('ac28-editor').showModal();
}
function unidadesPermitidas28(base){return base==='gerencia'?AC28_GERENCIAS:AC28_UNIDADES;}
function atualizarOpcoesUnidade28(base,preferred=''){
 const gc=document.getElementById('ac28-gc'),allowed=unidadesPermitidas28(base),current=preferred||gc.value;
 gc.innerHTML='<option value="">Selecione</option>'+allowed.map(g=>`<option value="${g}">${g}</option>`).join('');
 gc.value=allowed.includes(current)?current:'';
}
function atualizarResumoFuncionario28(){
 const box=document.getElementById('ac28-employee-summary');if(!box)return;
 const emp=(ac28Refs||funcionarios).find(f=>String(f.id)===document.getElementById('ac28-employee').value);
 if(!emp){box.hidden=true;box.textContent='';return;}
 box.hidden=false;box.innerHTML=`<b>Cadastro funcional:</b> ${escapar(emp.nome)} · <b>Função:</b> ${escapar(emp.cargo||'Não informada')} · <b>Lotação:</b> ${escapar(emp.gerencia||'Não informada')}${emp.empresa?' · <b>Empresa:</b> '+escapar(emp.empresa):''}`;
}
function ajustarEscopoGerencia28(){
 const scope=document.getElementById('ac28-scope'),gc=document.getElementById('ac28-gc');
 const role=document.getElementById('ac28-role').value,base=ac28UserCache.roles.find(r=>r.code===role)?.base;
 const global=scope.value==='global',allowed=unidadesPermitidas28(base);
 gc.disabled=global;
 if(global){gc.value='';gc.setAttribute('aria-label','Unidade não se aplica para abrangência global');}
 else{
  gc.removeAttribute('aria-label');
  if(!allowed.includes(gc.value)){
   const emp=(ac28Refs||funcionarios).find(f=>String(f.id)===document.getElementById('ac28-employee').value);
   gc.value=emp&&allowed.includes(emp.gerencia)?emp.gerencia:'';
  }
 }
}
function ajustarPerfilForm28(reset=false,user=null){
 const role=document.getElementById('ac28-role').value,base=ac28UserCache.roles.find(r=>r.code===role)?.base;
 const scope=document.getElementById('ac28-scope'),gcAtual=document.getElementById('ac28-gc').value;
 scope.disabled=['administrador','coordenacao','gerencia'].includes(base);
 if(['administrador','coordenacao'].includes(base))scope.value='global';else if(base==='gerencia')scope.value='gerencia';else if(reset)scope.value='gerencia';
 atualizarOpcoesUnidade28(base,gcAtual||user?.gerencia||'');
 ajustarEscopoGerencia28();
 const roleHelp={administrador:'Administrador Geral: controle completo do sistema. Este perfil permanece invisível para todos os demais acessos.',coordenador_regional:'Coordenador Regional: nível funcional de Gestão da Coordenação, com abrangência em toda a AP5.2.',assistente_coordenador:'Assistente do Coordenador: mesmo nível funcional da Gestão da Coordenação, com abrangência em toda a AP5.2.',coordenacao:'Gestão da Coordenação: acesso gestor em toda a AP5.2. Os três perfis da Coordenação compartilham o mesmo nível funcional.',gerente:'Gerente: Gestão da Gerência restrita à GC selecionada. Pode acessar avaliações e registrar desligamentos dos funcionários da própria Gerência.',assistente_gerente:'Assistente do Gerente: mesmo nível funcional do Gerente, restrito à GC selecionada.',gerencia:'Gerência: perfil operacional/administrativo da GC, sem acesso às avaliações e sem competência para registrar desligamentos.',operador:'Operador: acesso operacional aos módulos e ações marcados.',consulta:'Consulta: acesso somente de leitura/exportação, conforme a abrangência definida.'};
 document.getElementById('ac28-role-help').textContent=roleHelp[role]||roleHelp[base]||'';
 const perms=user?permissoesUsuario28(user):Object.fromEntries(ac28UserCache.role_permissions.filter(p=>p.role_code===role).map(p=>[p.module,p.actions]));
 document.getElementById('ac28-permissions').innerHTML=`<table><thead><tr><th>Módulo</th>${AC28_ACTIONS.map(a=>`<th>${a==='excluir'?'Arquivar':a[0].toUpperCase()+a.slice(1)}</th>`).join('')}</tr></thead><tbody>${Object.entries(AC28_MODULES).map(([m,name])=>`<tr><td>${name}</td>${AC28_ACTIONS.map(a=>{const blocked=base==='administrador'||(['acessos','auditoria'].includes(m)&&base!=='administrador')||(a==='excluir'&&base!=='administrador')||(base==='consulta'&&!['visualizar','exportar'].includes(a))||(m==='mapa'&&!['visualizar','exportar'].includes(a));return `<td><input type="checkbox" data-module="${m}" data-action="${a}" aria-label="${a}: ${name}" ${perms[m]?.includes(a)?'checked':''} ${blocked?'disabled':''}></td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
 normalizarAcessos28(base);
 document.querySelectorAll('#ac28-permissions input').forEach(el=>el.onchange=()=>{const row=el.closest('tr');if(el.dataset.action!=='visualizar'&&el.checked)row.querySelector('[data-action=visualizar]').checked=true;if(el.dataset.action==='visualizar'&&!el.checked)row.querySelectorAll('input').forEach(i=>i.checked=false);});
}
// V65: o banco exige que uma conta de Coordenação tenha exatamente visualizar e cadastrar
// em Usuários e Acessos. A grade vem desmarcada e travada, então o convite era recusado.
function baseDoPerfil28(code){return ac28UserCache?.roles?.find(r=>r.code===code)?.base||'';}
function normalizarAcessos28(base){
 document.querySelectorAll('#ac28-permissions input[data-module="acessos"]').forEach(el=>{
  const permitido=base==='coordenacao' && (el.dataset.action==='visualizar'||el.dataset.action==='cadastrar');
  if(base!=='administrador') el.checked=permitido;
 });
}
function perfilForm28(){
 const v=id=>document.getElementById(id).value;const permissions=Object.fromEntries(Object.keys(AC28_MODULES).map(m=>[m,[]]));document.querySelectorAll('#ac28-permissions input:checked').forEach(el=>permissions[el.dataset.module].push(el.dataset.action));
 if(baseDoPerfil28(v('ac28-role'))==='coordenacao') permissions.acessos=['visualizar','cadastrar'];
 const scope=v('ac28-scope');return {user_id:v('ac28-id')||undefined,nome:v('ac28-name').trim(),funcionario_id:v('ac28-employee')||null,role_code:v('ac28-role'),scope,gerencia:scope==='global'?null:(v('ac28-gc')||null),active:v('ac28-active')==='true',permissions};
}
async function salvarUsuario28(event){
 event.preventDefault();const button=event.submitter;if(button.disabled)return;button.disabled=true;const p=perfilForm28(),err=document.getElementById('ac28-form-error');err.textContent='';
 const action=p.user_id?'editar':'cadastrar';const alvo=p.user_id?ac28UserCache?.users?.find(u=>String(u.user_id)===String(p.user_id)):null;const permitido=p.user_id?podeEditarConta28(alvo):pode28('acessos','cadastrar');if(!permitido){err.textContent='Seu perfil não permite esta ação.';button.disabled=false;return;}
 try{
  if(!await segundoFator28())throw Error('Confirmação cancelada.');
  let id=p.user_id,email=document.getElementById('ac28-email').value.trim();
  if(id){const {error}=await sb.rpc('ap52_user_save',{p});if(error)throw error;}
  else{const {data,error}=await sb.functions.invoke('admin-acessos',{body:{action:'invite',email,profile:p}});if(error)throw await erroEdge28(error);if(data.error)throw Error(data.error);id=data.user_id;}
  atualizarCacheUsuario28({...p,user_id:id,email});document.getElementById('ac28-editor').close();renderUsuarios28();aviso28(p.user_id?'Acesso atualizado.':'Convite enviado. A pessoa define a própria senha.');
 }catch(e){err.textContent=e.message;}finally{button.disabled=false;}
}
async function erroEdge28(error){try{const body=await error.context.json();return Error(body.error||error.message);}catch{return error;}}
function atualizarCacheUsuario28(p){const old=ac28UserCache.users.find(u=>u.user_id===p.user_id)||{};const u={...old,...p,role_name:ac28UserCache.roles.find(r=>r.code===p.role_code)?.nome,updated_at:new Date().toISOString()};delete u.permissions;ac28UserCache.users=upsertArrayPorId28(ac28UserCache.users,u);ac28UserCache.overrides=ac28UserCache.overrides.filter(r=>r.user_id!==p.user_id).concat(Object.entries(p.permissions).map(([module,actions])=>({user_id:p.user_id,module,actions})));ac28Selected=p.user_id;}
function upsertArrayPorId28(rows,u){return rows.some(x=>x.user_id===u.user_id)?rows.map(x=>x.user_id===u.user_id?u:x):[...rows,u];}
async function alternarAtivo28(user){
 if(!podeEditarConta28(user)){aviso28('Seu perfil não permite alterar esta conta.');return;}
 if(!await ap52Confirm(`${user.active?'Desativar':'Ativar'} o acesso de ${user.nome}? ${user.active?'O acesso aos dados será bloqueado imediatamente.':''}`,{title:user.active?'Desativar acesso':'Ativar acesso',variant:user.active?'danger':'info',confirmText:user.active?'Desativar':'Ativar'})||!await segundoFator28())return;
 const p={...user,active:!user.active,permissions:permissoesUsuario28(user)};const {error}=await sb.rpc('ap52_user_save',{p});if(error)return aviso28(error.message);atualizarCacheUsuario28(p);renderUsuarios28();aviso28('Situação atualizada.');
}
async function enviarLink28(user){
 if(!ehAdmin28()){aviso28('Somente o Administrador geral pode enviar links para contas existentes.');return;}
 if(!await ap52Confirm(`Enviar um link de acesso para ${user.email}?`,{title:'Enviar link de acesso',confirmText:'Enviar'})||!await segundoFator28())return;
 const {data,error}=await sb.functions.invoke('admin-acessos',{body:{action:user.last_sign_in_at?'recovery':'resend',user_id:user.user_id}});if(error)return aviso28((await erroEdge28(error)).message);aviso28(data?.error||'Link enviado. Somente o usuário poderá definir a senha.');
}
async function abrirTabAcesso28(tab){
 if(tab!=='users'&&!ehAdmin28())tab='users';
 ac28Tab=tab;document.querySelectorAll('[data-ac28-tab]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.ac28Tab===tab)));document.getElementById('ac28-filters').hidden=tab!=='users';document.getElementById('ac28-count').hidden=tab!=='users';
 if(tab==='users'){renderUsuarios28();return;}
 ac28Selected=null;renderContextoAcesso28();document.getElementById('ac28-list').innerHTML='<div class="ac28-empty">Carregando…</div>';
 if(!await segundoFator28())return;
 try{
 if(tab==='audit'){if(!ac28Audit.length)await maisAuditoria28();else renderAuditoria28();}
 else{if(!ac28Trash){const {data,error}=await sb.rpc('ap52_trash_list');if(error)throw error;ac28Trash=data||[];}renderArquivados28();}
 }catch(e){document.getElementById('ac28-list').innerHTML=`<div class="ac28-empty">${escapar(e.message)}</div>`;}
}
async function maisAuditoria28(){const before_id=ac28Audit.at(-1)?.id||null;const {data,error}=await sb.rpc('ap52_audit_list',{before_id});if(error)throw error;ac28Audit.push(...(data||[]));renderAuditoria28((data||[]).length===50);}
function renderAuditoria28(more=ac28Audit.length%50===0){
 document.getElementById('ac28-list').innerHTML=ac28Audit.map(a=>`<article class="ac28-audit"><time>${escapar(dataAcesso28(a.happened_at))}</time><strong>${escapar(a.actor_name)} · ${escapar(a.action.replaceAll('_',' '))}</strong><span>${escapar(AC28_MODULES[a.module]||a.module)} · ${escapar(a.relation_name)} #${escapar(a.record_id)} ${a.gerencia?'· '+escapar(a.gerencia):''}</span><details><summary>Ver alteração registrada</summary><pre>${escapar(JSON.stringify({campos_alterados:a.changed_fields,antes:a.before_values,depois:a.after_values},null,2))}</pre><p class="ac28-help">Fotos, telefones e textos sensíveis não são copiados para a auditoria. A alteração desses campos é identificada pelo nome do campo.</p></details></article>`).join('')||'<div class="ac28-empty">Nenhuma alteração registrada nesta etapa.</div>';
 if(more&&ac28Audit.length)document.getElementById('ac28-list').insertAdjacentHTML('beforeend','<div class="ac28-panel-body"><button type="button" class="btn btn-ghost" id="ac28-more-audit">Carregar anteriores</button></div>');document.getElementById('ac28-more-audit')?.addEventListener('click',()=>maisAuditoria28().catch(e=>aviso28(e.message)));
}
function renderArquivados28(){
 const box=document.getElementById('ac28-list');box.innerHTML=(ac28Trash||[]).sort((a,b)=>String(b.deleted_at).localeCompare(String(a.deleted_at))).map(r=>`<article class="ac28-audit"><time>Arquivado em ${escapar(dataAcesso28(r.deleted_at))}</time><strong>${escapar(r.label)}</strong><span>${escapar(AC28_TABLE_MODULE[r.table])} · #${r.id}</span><div class="ac28-actions"><button class="btn btn-primary" data-restore="${escapar(r.table)}:${r.id}">Restaurar</button><button class="btn btn-ghost" data-purge="${escapar(r.table)}:${r.id}">Eliminar definitivamente</button></div></article>`).join('')||'<div class="ac28-empty">Nenhum registro arquivado.<br>Os registros arquivados preservam o histórico até uma exclusão definitiva autorizada.</div>';
 box.querySelectorAll('[data-restore],[data-purge]').forEach(el=>el.onclick=()=>alterarArquivo28(el.dataset.restore||el.dataset.purge,el.dataset.restore?'restaurar':'eliminar'));
}
async function alterarArquivo28(key,action){
 const [t,id]=key.split(':');if(!await segundoFator28())return;
 const phrase=`${action==='eliminar'?'ELIMINAR':'CONFIRMAR'} ${id}`;
 const confirmation=await ap52Prompt(action==='eliminar'?'A exclusão definitiva também remove o histórico relacionado por vínculo e não pode ser desfeita.':'Restaure este registro para que ele volte a aparecer no sistema.','',{title:action==='eliminar'?'Eliminar definitivamente':'Restaurar registro',variant:action==='eliminar'?'danger':'info',confirmText:action==='eliminar'?'Eliminar':'Restaurar',label:`Digite ${phrase}`,multiline:false,requireText:phrase});if(confirmation!==phrase)return;
 const {error}=await sb.rpc('ap52_record_change',{t,rid:Number(id),action,confirmation});if(error)return aviso28(error.message);ac28Trash=ac28Trash.filter(r=>!(r.table===t&&String(r.id)===id));Object.keys(estadoCarregamento).forEach(k=>estadoCarregamento[k]=false);renderArquivados28();aviso28(action==='restaurar'?'Registro restaurado.':'Registro eliminado. Auditoria preservada.');
}
montarAcessos28();
document.addEventListener('keydown',e=>{const panel=document.getElementById('ac28-context');if(!panel?.classList.contains('ac28-mobile-open')||document.querySelector('.ac28-dialog[open]'))return;if(e.key==='Escape'){e.preventDefault();selecionarUsuario28(null);}if(e.key==='Tab'){const items=[...panel.querySelectorAll('button:not(:disabled)')].filter(el=>el.getClientRects().length);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}});

sb.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY')ac28PasswordPending=true;
 if(event==='SIGNED_OUT'||!session){mostrarTelaLoginProtegida();return;}
 if(sessaoAtual?.user?.id&&sessaoAtual.user.id!==session.user.id){mostrarTelaLoginProtegida();Promise.resolve(window.AP52ServicosCacheE2?.limpar?.()).then(()=>location.reload(),()=>location.reload());return;}
 sessaoAtual=session;
 if(['SIGNED_IN','PASSWORD_RECOVERY'].includes(event)&&(!perfil||ac28PasswordPending))setTimeout(()=>ativarSessaoProtegida(session),0);
});
(async()=>{
 const {data,error}=await sb.auth.getSession();
 if(error||!data.session){
  mostrarTelaLoginProtegida(ac28PasswordPending?'Não foi possível validar este link de recuperação. Aguarde alguns segundos ou solicite um novo link.':'');
 }else await ativarSessaoProtegida(data.session);
})();

// V65.1: lembrete de cópia de dados. O registro é por navegador, então o aviso
// aparece no aparelho em que a cópia não foi feita. Só para quem enxerga todas as gerências.
const AP52_COPIA_DIAS=15, AP52_COPIA_ADIAR_DIAS=7;
function diasDesde52(iso){
 const t=Date.parse(iso||'');
 return Number.isFinite(t)?(Date.now()-t)/86400000:Infinity;
}
function adiarCopiaSeguranca52(){
 try{localStorage.setItem('ap52-copia-adiada',new Date().toISOString());}catch(_){}
 document.getElementById('ap52-aviso-copia')?.remove();
}
function verificarCopiaSeguranca52(){
 try{
  if(perfil?.role!=='coordenacao')return;
  if(document.getElementById('ap52-aviso-copia'))return;
  const dias=diasDesde52(localStorage.getItem('ap52-ultima-copia'));
  if(dias<AP52_COPIA_DIAS)return;
  if(diasDesde52(localStorage.getItem('ap52-copia-adiada'))<AP52_COPIA_ADIAR_DIAS)return;
  const texto=Number.isFinite(dias)?`A última cópia de dados foi há ${Math.floor(dias)} dias.`:'Nenhuma cópia de dados foi feita neste aparelho.';
  const aviso=document.createElement('div');
  aviso.id='ap52-aviso-copia';
  aviso.setAttribute('role','status');
  aviso.innerHTML=`<span></span><a href="backup.html">Fazer cópia de dados</a><button type="button" onclick="adiarCopiaSeguranca52()">Depois</button>`;
  aviso.querySelector('span').textContent=texto;
  document.body.append(aviso);
 }catch(_){}
}
