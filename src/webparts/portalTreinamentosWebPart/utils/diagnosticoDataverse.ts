// ============================================================
// DIAGNÓSTICO DE ERROS — Dataverse / Entra ID / Portal
//
// Transforma a mensagem técnica (ex.: 'Dataverse retornou 403 ...
// {"error":{"code":"0x80072560",...}}') em:
//   • o que aconteceu, em português;
//   • quem resolve (Administrador do Power Platform, RH, TI...);
//   • o passo a passo para resolver;
//   • os dados técnicos originais (para o suporte).
//
// Importante: o texto em inglês vem do SERVIDOR da Microsoft. O
// portal só repassa. Este arquivo apenas interpreta.
// ============================================================

export type CategoriaErroDataverse =
  | 'usuario-nao-provisionado'
  | 'usuario-desabilitado'
  | 'sem-privilegio'
  | 'sem-cadastro-portal'
  | 'cadastro-inativo'
  | 'token-consentimento'
  | 'nao-autenticado'
  | 'coluna-inexistente'
  | 'recurso-inexistente'
  | 'limite-requisicoes'
  | 'servico-indisponivel'
  | 'rede'
  | 'desconhecido';

export type OrigemErro =
  | 'Dataverse'
  | 'Entra ID'
  | 'Portal DGT'
  | 'Rede'
  | 'Desconhecida';

export interface IDiagnosticoErro {
  categoria: CategoriaErroDataverse;
  origem: OrigemErro;
  titulo: string;
  explicacao: string;
  responsavel: string;
  passos: string[];

  // Dados extraídos da resposta original.
  status?: number;
  codigo?: string;
  mensagemServidor?: string;
  privilegio?: string;
  tabela?: string;
  coluna?: string;

  mensagemOriginal: string;
}

export interface IContextoRelatorio {
  email?: string;
  ambienteUrl?: string;
  pagina?: string;
  navegador?: string;
  linhasExtras?: string[];
}

// ============================================================
// EXTRAÇÃO
// ============================================================

const textoDoErro = (
  erro: unknown
): string => {

  if (!erro) {
    return '';
  }

  if (typeof erro === 'string') {
    return erro;
  }

  if (erro instanceof Error) {
    return erro.message || String(erro);
  }

  try {
    return JSON.stringify(erro);
  } catch {
    return String(erro);
  }
};

const extrairJsonErro = (
  texto: string
): { code?: string; message?: string } => {

  const inicio =
    texto.indexOf('{');

  if (inicio < 0) {
    return {};
  }

  try {
    const json =
      JSON.parse(texto.substring(inicio)) as {
        error?: { code?: string; message?: string };
        code?: string;
        message?: string;
      };

    return {
      code: json.error?.code || json.code,
      message: json.error?.message || json.message
    };
  } catch {
    // Corpo não é JSON puro: tenta os campos por expressão regular.
    const codigo =
      texto.match(/"code"\s*:\s*"([^"]+)"/);

    const mensagem =
      texto.match(/"message"\s*:\s*"([^"]+)"/);

    return {
      code: codigo ? codigo[1] : undefined,
      message: mensagem ? mensagem[1] : undefined
    };
  }
};

// "prvReaddgt_usuario" → { acao: 'Ler', tabela: 'dgt_usuario' }
const ACOES_PRIVILEGIO: Record<string, string> = {
  Read: 'Ler',
  Create: 'Criar',
  Write: 'Gravar',
  Delete: 'Excluir',
  Append: 'Acrescentar',
  AppendTo: 'Acrescentar a',
  Assign: 'Atribuir',
  Share: 'Compartilhar'
};

const interpretarPrivilegio = (
  texto: string
): { privilegio?: string; acao?: string; tabela?: string } => {

  const encontrado =
    texto.match(/prv(AppendTo|Append|Read|Create|Write|Delete|Assign|Share)([A-Za-z0-9_]+)/);

  if (!encontrado) {
    return {};
  }

  return {
    privilegio: encontrado[0],
    acao: ACOES_PRIVILEGIO[encontrado[1]] || encontrado[1],
    tabela: encontrado[2]
  };
};

// ============================================================
// DIAGNÓSTICO
// ============================================================

const ADMIN_PP =
  'Administrador do Power Platform (ambiente DGT – Automação Processos)';

export const diagnosticarErro = (
  erro: unknown
): IDiagnosticoErro => {

  const mensagemOriginal =
    textoDoErro(erro);

  const statusEncontrado =
    mensagemOriginal.match(/retornou\s+(\d{3})/i) ||
    mensagemOriginal.match(/\b(40[0-9]|42[0-9]|5\d\d)\b/);

  const status =
    statusEncontrado
      ? Number(statusEncontrado[1])
      : undefined;

  const json =
    extrairJsonErro(mensagemOriginal);

  const codigo =
    json.code;

  const mensagemServidor =
    json.message;

  const tudo =
    `${mensagemOriginal} ${codigo || ''} ${mensagemServidor || ''}`;

  const base = {
    status,
    codigo,
    mensagemServidor,
    mensagemOriginal
  };

  // ---------- Usuário não existe no ambiente ----------
  if (
    /0x80072560/i.test(tudo) ||
    /not a member of the organization/i.test(tudo)
  ) {
    return {
      ...base,
      categoria: 'usuario-nao-provisionado',
      origem: 'Dataverse',
      titulo: 'Seu usuário ainda não foi liberado no Dataverse',
      explicacao:
        'O Dataverse recusou o acesso porque seu usuário não existe (ou não foi sincronizado) no ambiente ' +
        'onde ficam os dados do portal. Não é uma restrição do portal: o próprio servidor da Microsoft bloqueou.',
      responsavel: ADMIN_PP,
      passos: [
        'No Power Platform Admin Center, abra Ambientes → DGT – Automação Processos → Configurações → Usuários + permissões → Usuários.',
        'Procure o usuário. Se não estiver na lista, clique em "+ Adicionar usuário" e informe o e-mail — se faltar licença ou grupo de segurança, a própria mensagem dirá.',
        'Verifique se o ambiente tem um Grupo de segurança (Ambientes → Editar) e se o usuário é membro dele.',
        'Verifique se o usuário tem uma licença que inclua acesso ao Dataverse (ex.: Power Apps).',
        'Depois de sincronizado, atribua a Security Role do perfil (ou inclua no Group Team) e peça para recarregar o portal.'
      ]
    };
  }

  // ---------- Usuário desabilitado ----------
  if (
    /0x80040225/i.test(tudo) ||
    /user is disabled|is either disabled|disabled user/i.test(tudo)
  ) {
    return {
      ...base,
      categoria: 'usuario-desabilitado',
      origem: 'Dataverse',
      titulo: 'Seu usuário está desabilitado no Dataverse',
      explicacao:
        'O usuário existe no ambiente, mas está desabilitado ou sem unidade de negócios. Isso costuma acontecer ' +
        'quando a licença é removida ou o usuário sai do grupo de segurança do ambiente.',
      responsavel: ADMIN_PP,
      passos: [
        'No Power Platform Admin Center, abra Usuários do ambiente e confira o status do usuário.',
        'Confirme a licença no Centro de administração do Microsoft 365.',
        'Confirme que o usuário continua no Grupo de segurança do ambiente (se houver).',
        'Após reativar, peça para o usuário recarregar o portal.'
      ]
    };
  }

  // ---------- Falta de permissão (Security Role) ----------
  if (
    /0x80040220/i.test(tudo) ||
    /missing prv|does not have .*privilege|SecLib::/i.test(tudo)
  ) {
    const privilegio =
      interpretarPrivilegio(tudo);

    return {
      ...base,
      categoria: 'sem-privilegio',
      origem: 'Dataverse',
      privilegio: privilegio.privilegio,
      tabela: privilegio.tabela,
      titulo: 'Falta uma permissão no seu perfil do Dataverse',
      explicacao:
        privilegio.tabela
          ? `Seu usuário existe no ambiente, mas a Security Role não permite "${privilegio.acao}" na tabela ${privilegio.tabela}.`
          : 'Seu usuário existe no ambiente, mas a Security Role atribuída não permite esta operação.',
      responsavel: ADMIN_PP,
      passos: [
        'Confira qual Security Role o usuário (ou o Group Team dele) possui.',
        privilegio.tabela
          ? `Na Security Role, conceda "${privilegio.acao}" na tabela ${privilegio.tabela} (privilégio ${privilegio.privilegio}).`
          : 'Na Security Role, conceda a permissão indicada na mensagem técnica.',
        'Salve e peça para o usuário recarregar o portal.'
      ]
    };
  }

  // ---------- Regras do próprio portal ----------
  if (/não está cadastrado no Portal/i.test(tudo)) {
    return {
      ...base,
      categoria: 'sem-cadastro-portal',
      origem: 'Portal DGT',
      titulo: 'Você ainda não está cadastrado no Portal',
      explicacao:
        'O acesso ao Dataverse funcionou, mas não existe um registro de colaborador (tabela Usuário do portal) ' +
        'com o seu e-mail.',
      responsavel: 'RH / Administração do Portal de Treinamentos',
      passos: [
        'No portal (Gestão → Usuários) ou no Dataverse (tabela dgt_usuario), cadastre o colaborador.',
        'Use exatamente o mesmo e-mail da conta Microsoft 365 (mostrado nos detalhes técnicos).',
        'Marque o cadastro como Ativo e peça para recarregar o portal.'
      ]
    };
  }

  if (/inativo no Portal/i.test(tudo)) {
    return {
      ...base,
      categoria: 'cadastro-inativo',
      origem: 'Portal DGT',
      titulo: 'Seu cadastro no Portal está inativo',
      explicacao:
        'O acesso ao Dataverse funcionou e o cadastro existe, mas está marcado como inativo.',
      responsavel: 'RH / Administração do Portal de Treinamentos',
      passos: [
        'Em Gestão → Usuários, localize o colaborador e marque-o como Ativo.',
        'Peça para recarregar o portal.'
      ]
    };
  }

  // ---------- Token / consentimento (Entra ID) ----------
  if (
    /AADSTS\d+/i.test(tudo) ||
    /consent|interaction_required|invalid_grant|invalid_client|token_renewal|user_impersonation/i.test(tudo)
  ) {
    const aadsts =
      tudo.match(/AADSTS\d+/i);

    return {
      ...base,
      codigo: codigo || (aadsts ? aadsts[0] : undefined),
      categoria: 'token-consentimento',
      origem: 'Entra ID',
      titulo: 'Não foi possível obter autorização para acessar o Dataverse',
      explicacao:
        'O SharePoint não conseguiu gerar o token de acesso ao Dataverse para o seu usuário. Normalmente a ' +
        'permissão da API (Dynamics CRM → user_impersonation) não foi aprovada ou foi revogada.',
      responsavel: 'Administrador do SharePoint / Microsoft 365',
      passos: [
        'No SharePoint Admin Center, abra Avançado → Acesso à API.',
        'Verifique se a solicitação "Dynamics CRM – user_impersonation" do Portal de Treinamentos está APROVADA.',
        'Se estiver pendente, aprove; se já estiver aprovada, remova e reimplante o pacote .sppkg para gerar nova solicitação.',
        'Peça para o usuário sair e entrar novamente no Microsoft 365.'
      ]
    };
  }

  // ---------- 401 ----------
  if (status === 401) {
    return {
      ...base,
      categoria: 'nao-autenticado',
      origem: 'Entra ID',
      titulo: 'O Dataverse não reconheceu sua autenticação',
      explicacao:
        'O token enviado foi recusado (401). Pode ser sessão expirada, permissão de API não aprovada ou ' +
        'usuário sem acesso ao ambiente.',
      responsavel: 'Administrador do SharePoint / Power Platform',
      passos: [
        'Peça para o usuário sair e entrar novamente no Microsoft 365 e recarregar a página.',
        'Confira no SharePoint Admin Center → Acesso à API se a permissão Dynamics CRM está aprovada.',
        'Execute o teste de conexão abaixo e envie o relatório ao suporte.'
      ]
    };
  }

  // ---------- Coluna inexistente ----------
  const coluna =
    tudo.match(/Could not find a property named '([^']+)'/i);

  if (coluna) {
    return {
      ...base,
      categoria: 'coluna-inexistente',
      origem: 'Dataverse',
      coluna: coluna[1],
      titulo: 'Uma coluna usada pelo portal não existe no Dataverse',
      explicacao:
        `O portal consultou a coluna "${coluna[1]}", que não existe neste ambiente. ` +
        'Geralmente falta publicar uma alteração da solução ou criar a coluna.',
      responsavel: 'Desenvolvedor / Administrador da solução',
      passos: [
        `Na solução "DGT – Portal de Conhecimento e Treinamentos", verifique se a coluna ${coluna[1]} existe.`,
        'Se existir, clique em "Publicar todas as personalizações".',
        'Se não existir, crie a coluna com o nome de esquema exato.'
      ]
    };
  }

  // ---------- Tabela / recurso inexistente ----------
  if (
    status === 404 ||
    /0x80060888/i.test(tudo) ||
    /Resource not found for the segment/i.test(tudo)
  ) {
    const segmento =
      tudo.match(/segment '([^']+)'/i);

    return {
      ...base,
      categoria: 'recurso-inexistente',
      origem: 'Dataverse',
      tabela: segmento ? segmento[1] : undefined,
      titulo: 'Uma tabela ou registro usado pelo portal não foi encontrado',
      explicacao:
        segmento
          ? `O Dataverse não encontrou "${segmento[1]}". A tabela pode não existir neste ambiente ou não ter sido publicada.`
          : 'O Dataverse não encontrou o recurso solicitado (404).',
      responsavel: 'Desenvolvedor / Administrador da solução',
      passos: [
        'Confira se a solução do portal está importada e publicada neste ambiente.',
        'Confira se o endereço do ambiente configurado no portal é o correto (detalhes técnicos).'
      ]
    };
  }

  // ---------- 429 ----------
  if (status === 429) {
    return {
      ...base,
      categoria: 'limite-requisicoes',
      origem: 'Dataverse',
      titulo: 'Muitas requisições em pouco tempo',
      explicacao:
        'O Dataverse limitou temporariamente as chamadas (429). É momentâneo.',
      responsavel: 'Usuário (aguardar) / Desenvolvedor, se persistir',
      passos: [
        'Aguarde alguns segundos e recarregue a página.',
        'Se acontecer com frequência, informe o suporte com os detalhes técnicos.'
      ]
    };
  }

  // ---------- 5xx ----------
  if (status && status >= 500) {
    return {
      ...base,
      categoria: 'servico-indisponivel',
      origem: 'Dataverse',
      titulo: 'O Dataverse está indisponível no momento',
      explicacao:
        `O servidor respondeu com erro ${status}. Costuma ser instabilidade temporária da Microsoft.`,
      responsavel: 'Aguardar / Administrador do Power Platform, se persistir',
      passos: [
        'Aguarde alguns minutos e recarregue a página.',
        'Consulte a Integridade do serviço no Centro de administração do Microsoft 365.'
      ]
    };
  }

  // ---------- Rede ----------
  if (/Failed to fetch|NetworkError|Network request failed|ERR_/i.test(tudo)) {
    return {
      ...base,
      categoria: 'rede',
      origem: 'Rede',
      titulo: 'Não foi possível se comunicar com o Dataverse',
      explicacao:
        'A requisição não chegou ao servidor (rede, VPN, proxy ou bloqueio do navegador).',
      responsavel: 'TI / Infraestrutura',
      passos: [
        'Verifique a conexão com a internet/VPN.',
        'Teste em outra rede ou navegador.',
        'Se estiver na rede da empresa, confirme com a TI que *.dynamics.com não está bloqueado.'
      ]
    };
  }

  return {
    ...base,
    categoria: 'desconhecido',
    origem: status ? 'Dataverse' : 'Desconhecida',
    titulo: 'Não foi possível carregar suas permissões',
    explicacao:
      'Ocorreu um erro não catalogado. Execute o teste de conexão e envie o relatório ao suporte.',
    responsavel: 'Suporte do Portal DGT',
    passos: [
      'Clique em "Executar teste de conexão".',
      'Clique em "Copiar relatório para o suporte" e envie para o responsável pelo portal.'
    ]
  };
};

// É um erro técnico (vale mostrar o painel de diagnóstico)?
export const ehErroTecnico = (
  erro: unknown
): boolean => {

  const texto =
    textoDoErro(erro);

  return (
    /Dataverse retornou|AADSTS|0x8|Failed to fetch|not a member|cadastrado no Portal|inativo no Portal/i
      .test(texto)
  );
};

// ============================================================
// RELATÓRIO PARA O SUPORTE (texto para copiar e colar)
// ============================================================

export const montarRelatorioTecnico = (
  diagnostico: IDiagnosticoErro,
  contexto: IContextoRelatorio
): string => {

  const linhas = [
    '=== Diagnóstico — Portal DGT ===',
    `Data/hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília)`,
    `Usuário: ${contexto.email || '-'}`,
    `Ambiente: ${contexto.ambienteUrl || '-'}`,
    `Página: ${contexto.pagina || '-'}`,
    `Navegador: ${contexto.navegador || (typeof navigator !== 'undefined' ? navigator.userAgent : '-')}`,
    '',
    `Diagnóstico: ${diagnostico.titulo}`,
    `Categoria: ${diagnostico.categoria}`,
    `Origem: ${diagnostico.origem}`,
    `Quem resolve: ${diagnostico.responsavel}`,
    `HTTP: ${diagnostico.status || '-'}`,
    `Código: ${diagnostico.codigo || '-'}`,
    diagnostico.privilegio ? `Privilégio: ${diagnostico.privilegio}` : '',
    diagnostico.tabela ? `Tabela: ${diagnostico.tabela}` : '',
    diagnostico.coluna ? `Coluna: ${diagnostico.coluna}` : '',
    `Mensagem do servidor: ${diagnostico.mensagemServidor || '-'}`,
    '',
    'Mensagem original:',
    diagnostico.mensagemOriginal
  ];

  if (contexto.linhasExtras && contexto.linhasExtras.length > 0) {
    linhas.push('', ...contexto.linhasExtras);
  }

  return linhas
    .filter(
      (linha, indice, lista) =>
        linha !== '' || lista[indice - 1] !== ''
    )
    .join('\n');
};

// Log agrupado no console (F12) para o desenvolvedor.
export const registrarDiagnosticoNoConsole = (
  diagnostico: IDiagnosticoErro,
  contexto?: IContextoRelatorio
): void => {

  /* eslint-disable no-console */
  console.groupCollapsed(
    `%c[DGT] ${diagnostico.titulo}`,
    'color:#B42318;font-weight:bold'
  );
  console.log('Categoria:', diagnostico.categoria, '| Origem:', diagnostico.origem);
  console.log('HTTP:', diagnostico.status, '| Código:', diagnostico.codigo);
  console.log('Mensagem do servidor:', diagnostico.mensagemServidor);
  console.log('Quem resolve:', diagnostico.responsavel);
  console.log('Passos:', diagnostico.passos);

  if (contexto) {
    console.log('Contexto:', contexto);
  }

  console.log('Original:', diagnostico.mensagemOriginal);
  console.groupEnd();
  /* eslint-enable no-console */
};
