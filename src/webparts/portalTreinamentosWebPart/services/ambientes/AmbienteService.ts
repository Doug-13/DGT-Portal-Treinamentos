import {
  DataverseService
} from '../DataverseService';

import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  IAmbiente,
  IAmbienteRegistro,
  IEdicaoAmbiente,
  IFluxoOpcaoAmbiente,
  INovoAmbiente,
  INovoRegistroAmbiente,
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

import {
  IconeChave
} from '../../components/common/Icones';

import {
  MODULOS_PORTAL,
  chaveModuloAmbiente,
  moduloLiberado,
  registrarModulosAmbientes
} from '../../utils/modulosPortal';

import {
  ExclusaoFluxoService
} from '../processos/ExclusaoFluxoService';

import {
  obterPersistenciaFluxo
} from '../fluxo/persistenciaFluxo';

import {
  AMBIENTE,
  ANOTACAO_FORMATADA,
  PREFIXO_PROCESSO_AMBIENTE,
  REGISTRO,
  TABELAS_AMBIENTE
} from './esquemaAmbientes';

// ============================================================
// AMBIENTES DINÂMICOS — leitura e gravação
//
// Criar um ambiente:
//   1. cria o PROCESSO do ambiente (dgt_processo, AMB-<CHAVE>) — é
//      nele que o fluxo é desenhado e publicado (Processos → Fluxos);
//   2. cria o registro em dgt_ambiente apontando para o processo;
//   3. registra o módulo "amb:<chave>" (menu e Usuários e acessos).
//
// Nada é apagado: ambiente é desativado, registro é cancelado.
// ============================================================

const guid = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: Record<string, unknown>,
  campo: string
): string =>
  registro[campo] === undefined || registro[campo] === null
    ? ''
    : String(registro[campo]);

const mensagem = (
  erro: unknown
): string =>
  erro instanceof Error ? erro.message : String(erro);

const lerListaJson = (
  valor: unknown
): string[] => {
  if (!valor) {
    return [];
  }
  try {
    const lista = JSON.parse(String(valor));
    return Array.isArray(lista) ? lista.map(item => String(item)) : [];
  } catch {
    return [];
  }
};

// Colunas das telas configuráveis existem no Dataverse? (undefined =
// ainda não testado). Sem elas, as consultas seguem sem essas colunas
// e o ambiente usa o layout gerado do fluxo.
const estadoColunasLayout: { disponivel: boolean | undefined } = { disponivel: undefined };

const marcarColunasLayout = (disponivel: boolean): void => {
  estadoColunasLayout.disponivel = disponivel;
};

const marcarColunasLayoutDesconhecidas = (): void => {
  estadoColunasLayout.disponivel = undefined;
};

// Colunas de anexos (dgt_permiteanexos, dgt_bibliotecaanexos).
const estadoColunasAnexos: { disponivel: boolean | undefined } = { disponivel: undefined };

// Coluna dgt_mostrarsequencia.
const estadoColunasSequencia: { disponivel: boolean | undefined } = { disponivel: undefined };

const marcarGrupo = (estado: { disponivel: boolean | undefined }, disponivel: boolean): void => {
  estado.disponivel = disponivel;
};

// "Could not find a property named 'dgt_x' on type ..." → dgt_x
export const colunaAusente = (texto: string): string | undefined => {
  const achado = /property named '([A-Za-z0-9_]+)'/i.exec(texto || '');
  return achado ? achado[1].toLowerCase() : undefined;
};

const lerValoresJson = (
  valor: unknown
): Record<string, string> => {
  if (!valor) {
    return {};
  }
  try {
    const objeto = JSON.parse(String(valor));
    return objeto && typeof objeto === 'object' && !Array.isArray(objeto) ? objeto as Record<string, string> : {};
  } catch {
    return {};
  }
};

// Chave técnica a partir do nome: "Licitações Públicas" → "licitacoes-publicas".
export const gerarChaveAmbiente = (
  nome: string
): string =>
  (nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);

// Prefixo do código a partir do nome: "Licitações Públicas" → "LP";
// uma palavra só → 3 primeiras letras ("Compras" → "COM").
export const gerarPrefixoAmbiente = (
  nome: string
): string => {
  const palavras =
    gerarChaveAmbiente(nome).split('-').filter(item => item.length > 0);
  if (palavras.length === 0) {
    return '';
  }
  const prefixo =
    palavras.length === 1
      ? palavras[0].substring(0, 3)
      : palavras.map(item => item.charAt(0)).join('').substring(0, 5);
  return prefixo.toUpperCase();
};

// Chaves que não podem ser usadas por ambientes (módulos fixos e
// palavras reservadas do portal).
const CHAVES_RESERVADAS: string[] = [
  'inicio', 'treinamentos', 'documentos', 'processos', 'licitacoes',
  'arquitetura', 'indicadores', 'orcamento', 'rh', 'kits', 'hh',
  'admin', 'ambiente', 'ambientes', 'outro'
];

export const validarDadosAmbiente = (
  dados: INovoAmbiente,
  existentes: IAmbiente[],
  idAtual?: string
): string[] => {

  const erros: string[] = [];
  const nome = (dados.nome || '').trim();
  const chave = (dados.chave || '').trim();
  const prefixo = (dados.prefixoCodigo || '').trim();

  if (nome.length < 3) {
    erros.push('Informe o nome do ambiente (mínimo de 3 letras).');
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(chave) || chave.length < 2 || chave.length > 40) {
    erros.push('A chave deve ter de 2 a 40 caracteres: letras minúsculas sem acento, números e hífen (ex.: licitacoes-publicas).');
  }

  if (CHAVES_RESERVADAS.indexOf(chave) >= 0) {
    erros.push(`A chave "${chave}" é reservada pelo portal. Escolha outra.`);
  }

  if (existentes.some(item => item.chave === chave && item.id !== idAtual)) {
    erros.push(`Já existe um ambiente com a chave "${chave}" (inclusive desativado).`);
  }

  if (existentes.some(item => item.ativo && item.nome.trim().toLowerCase() === nome.toLowerCase() && item.id !== idAtual)) {
    erros.push(`Já existe um ambiente ativo chamado "${nome}".`);
  }

  if (!/^[A-Z0-9]{2,6}$/.test(prefixo)) {
    erros.push('O prefixo do código deve ter de 2 a 6 letras maiúsculas ou números (ex.: LIC).');
  }

  if (!(dados.rotuloRegistro || '').trim()) {
    erros.push('Informe como cada registro é chamado (ex.: Solicitação).');
  }

  return erros;
};

// ------------------------------------------------------------
// Acesso
// ------------------------------------------------------------

// O usuário pode entrar no ambiente? Mesma regra dos módulos fixos.
export const ambienteLiberado = (
  contexto: IContextoAcesso | undefined,
  ambiente: IAmbiente
): boolean =>
  !!contexto &&
  contexto.ativo !== false &&
  ambiente.ativo &&
  moduloLiberado(contexto.perfil, contexto.modulosPermitidos, chaveModuloAmbiente(ambiente.chave));

// Administrador global ou "Administrador do módulo" deste ambiente.
export const administraAmbiente = (
  contexto: IContextoAcesso | undefined,
  ambiente: IAmbiente
): boolean =>
  !!contexto &&
  (
    contexto.perfil === 'Administrador' ||
    (contexto.modulosAdministrados || []).indexOf(chaveModuloAmbiente(ambiente.chave)) >= 0
  );

// Criar ambientes muda o PORTAL: só o Administrador global.
export const podeCriarAmbiente = (
  contexto: IContextoAcesso | undefined
): boolean =>
  !!contexto &&
  contexto.perfil === 'Administrador';

// Leva os ambientes ATIVOS para o registro de módulos (menu, rotas,
// Meu perfil e Usuários e acessos).
export const registrarAmbientesNoPortal = (
  ambientes: IAmbiente[]
): void =>
  registrarModulosAmbientes(
    ambientes
      .filter(item => item.ativo)
      .map(item => ({
        chave: item.chave,
        nome: item.nome,
        descricao: item.descricao,
        padrao: item.liberadoParaTodos,
        padraoPerfis: item.perfisPadrao
      }))
  );

// Nome do ambiente pelo módulo (usado onde só há a chave "amb:...").
export const nomeModuloAmbiente = (
  chaveModulo: string
): string =>
  (MODULOS_PORTAL.find(item => item.chave === chaveModulo) || { nome: chaveModulo }).nome;

// ------------------------------------------------------------
// Serviço
// ------------------------------------------------------------

export interface IResultadoListaAmbientes {
  ambientes: IAmbiente[];
  // false = as tabelas ainda não existem no Dataverse.
  disponivel: boolean;
  aviso: string;
}

export interface IAnaliseExclusaoAmbiente {
  registros: { total: number; emAndamento: number; concluidos: number; cancelados: number; ids: string[] };
  // Outros ambientes que usam o mesmo fluxo (o fluxo fica).
  outrosAmbientes: string[];
  // Documentos/revisões que usam o fluxo (o fluxo não pode ser apagado).
  documentosNoFluxo: number;
  revisoesNoFluxo: number;
  // O fluxo pode ser apagado junto (só este ambiente o usa, sem documentos).
  podeExcluirFluxo: boolean;
  processoNome: string;
}

export interface IResultadoGravacaoAmbiente {
  ok: boolean;
  erros: string[];
  ambiente?: IAmbiente;
}

export class AmbienteService {

  private readonly dataverse: DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // ----------------------------------------------------------
  // Ambientes
  // ----------------------------------------------------------

  private converterAmbiente(
    registro: Record<string, unknown>
  ): IAmbiente {
    return {
      id: guid(registro[AMBIENTE.id]),
      chave: texto(registro, AMBIENTE.chave),
      nome: texto(registro, AMBIENTE.nome),
      descricao: texto(registro, AMBIENTE.descricao),
      subtitulo: texto(registro, AMBIENTE.subtitulo),
      icone: (texto(registro, AMBIENTE.icone) || 'workflow') as IconeChave,
      ordem: Number(registro[AMBIENTE.ordem] || 0),
      ativo: registro[AMBIENTE.ativo] !== false,
      liberadoParaTodos: registro[AMBIENTE.liberadoParaTodos] === true,
      perfisPadrao: lerListaJson(registro[AMBIENTE.perfisPadrao]),
      processoId: guid(registro[AMBIENTE.processoValor]),
      processoNome: texto(registro, AMBIENTE.processoValor + ANOTACAO_FORMATADA),
      prefixoCodigo: texto(registro, AMBIENTE.prefixoCodigo),
      rotuloRegistro: texto(registro, AMBIENTE.rotuloRegistro) || 'Registro',
      permiteAnexos: registro[AMBIENTE.permiteAnexos] === true,
      // Sem a coluna ou sem valor (ambiente antigo): mostra.
      mostrarSequencia: registro[AMBIENTE.mostrarSequencia] !== false,
      bibliotecaAnexos: texto(registro, AMBIENTE.bibliotecaAnexos),
      layoutJson: texto(registro, AMBIENTE.layout)
    };
  }

  private async consultarComLayout(
    tabela: string,
    selecaoBase: string[],
    selecaoLayout: string[],
    resto: string
  ): Promise<Array<Record<string, unknown>>> {
    if (estadoColunasLayout.disponivel !== false) {
      try {
        const registros =
          await this.dataverse.listarRegistros(tabela, `$select=${selecaoBase.concat(selecaoLayout).join(',')}${resto}`);
        marcarColunasLayout(true);
        return registros;
      } catch (erro) {
        if (!/could not find a property|propert(y|ies).*(not exist|não existe)|Could not find/i.test(mensagem(erro))) {
          throw erro;
        }
        marcarColunasLayout(false);
        console.warn('[Ambientes] Colunas das telas configuráveis ainda não existem. Execute criar-tabelas-ambientes.ps1.');
      }
    }
    return this.dataverse.listarRegistros(tabela, `$select=${selecaoBase.join(',')}${resto}`);
  }

  // false = falta criar as colunas (o editor de telas avisa).
  public static telasConfiguraveisDisponiveis(): boolean {
    return estadoColunasLayout.disponivel !== false;
  }

  // Grava a configuração das telas do ambiente.
  public async salvarLayout(
    ambiente: IAmbiente,
    layoutJson: string
  ): Promise<void> {
    if (estadoColunasLayout.disponivel === false) {
      throw new Error('A coluna dgt_layoutjson ainda não existe. Execute scripts/dataverse/criar-tabelas-ambientes.ps1 e recarregue o portal.');
    }
    await this.dataverse.atualizarRegistro(
      TABELAS_AMBIENTE.ambiente,
      ambiente.id,
      { [AMBIENTE.layout]: layoutJson }
    );
  }

  // Todos os ambientes (ativos e desativados), na ordem do menu.
  // Se a tabela ainda não existe, devolve disponivel = false sem erro:
  // o portal continua funcionando exatamente como antes.
  public async listar(): Promise<IResultadoListaAmbientes> {

    try {
      const base = [
        AMBIENTE.id, AMBIENTE.nome, AMBIENTE.chave, AMBIENTE.descricao,
        AMBIENTE.subtitulo, AMBIENTE.icone, AMBIENTE.ordem, AMBIENTE.ativo,
        AMBIENTE.liberadoParaTodos, AMBIENTE.perfisPadrao, AMBIENTE.prefixoCodigo,
        AMBIENTE.rotuloRegistro, AMBIENTE.processoValor
      ];
      const ordem = `&$orderby=${AMBIENTE.ordem} asc,${AMBIENTE.nome} asc`;
      // Colunas opcionais (cada grupo vem de um script; a falta de uma
      // não desliga as outras). A mensagem do Dataverse diz qual falta.
      const grupos: Array<{ colunas: string[]; estado: { disponivel: boolean | undefined }; aviso: string }> = [
        { colunas: [AMBIENTE.permiteAnexos, AMBIENTE.bibliotecaAnexos], estado: estadoColunasAnexos, aviso: 'anexos' },
        { colunas: [AMBIENTE.mostrarSequencia], estado: estadoColunasSequencia, aviso: 'sequência de atividades' }
      ];
      let registros: Array<Record<string, unknown>> | undefined;
      for (let tentativa = 0; tentativa <= grupos.length && !registros; tentativa++) {
        const ativos = grupos.filter(grupo => grupo.estado.disponivel !== false);
        try {
          registros = await this.consultarComLayout(
            TABELAS_AMBIENTE.ambiente,
            base.concat(...ativos.map(grupo => grupo.colunas)),
            [AMBIENTE.layout],
            ordem
          );
          ativos.forEach(grupo => marcarGrupo(grupo.estado, true));
        } catch (erro) {
          if (!/could not find a property|propert(y|ies).*(not exist|não existe)|Could not find/i.test(mensagem(erro)) || ativos.length === 0) {
            throw erro;
          }
          const faltando = colunaAusente(mensagem(erro));
          const culpados = ativos.filter(grupo => !faltando || grupo.colunas.indexOf(faltando) >= 0);
          (culpados.length > 0 ? culpados : ativos).forEach(grupo => {
            marcarGrupo(grupo.estado, false);
            console.warn(`[Ambientes] Colunas de ${grupo.aviso} ainda não existem. Execute criar-tabelas-ambientes.ps1.`);
          });
          // A tentativa pode ter marcado as telas como ausentes por engano.
          marcarColunasLayoutDesconhecidas();
        }
      }
      if (!registros) {
        registros = await this.consultarComLayout(TABELAS_AMBIENTE.ambiente, base, [AMBIENTE.layout], ordem);
      }

      return {
        ambientes: registros.map(item => this.converterAmbiente(item)).filter(item => !!item.chave),
        disponivel: true,
        aviso: ''
      };
    } catch (erro) {
      const texto = mensagem(erro);
      const naoExiste =
        /404|could not find|não encontr|Resource not found|entityset|EntitySetName/i.test(texto);
      return {
        ambientes: [],
        disponivel: false,
        aviso: naoExiste
          ? 'As tabelas de ambientes ainda não existem no Dataverse. Execute scripts/dataverse/criar-tabelas-ambientes.ps1.'
          : `Não foi possível ler os ambientes: ${texto}`
      };
    }
  }

  // Fluxos de Processos → Fluxos que podem ser ligados a um ambiente
  // (ativos), com a indicação de versão publicada e de quais
  // ambientes já os usam.
  public async listarFluxos(
    ambientes: IAmbiente[]
  ): Promise<IFluxoOpcaoAmbiente[]> {

    const persistencia = obterPersistenciaFluxo(this.dataverse);
    const dados = await persistencia.processos.carregar(true, []);
    const ativos = dados.processos.filter(item => item.ativo !== false);

    const publicados =
      await Promise.all(
        ativos.map(async item => {
          try {
            return !!(await persistencia.catalogo.versaoPublicada(item.id));
          } catch {
            return false;
          }
        })
      );

    return ativos
      .map((item, indice) => ({
        id: guid(item.id),
        codigo: item.codigo || '',
        nome: item.nome,
        publicado: publicados[indice],
        ambientes: ambientes.filter(amb => guid(amb.processoId) === guid(item.id)).map(amb => amb.nome)
      }))
      .sort((a, b) => `${a.codigo} ${a.nome}`.localeCompare(`${b.codigo} ${b.nome}`, 'pt-BR'));
  }

  // Confere se o fluxo escolhido existe e está ativo.
  private async fluxoExistente(
    processoId: string
  ): Promise<{ id: string; nome: string } | undefined> {
    const persistencia = obterPersistenciaFluxo(this.dataverse);
    const dados = await persistencia.processos.carregar(true, []);
    const processo =
      dados.processos.filter(item => guid(item.id) === guid(processoId) && item.ativo !== false)[0];
    return processo ? { id: processo.id, nome: processo.nome } : undefined;
  }

  // Cria o ambiente. O fluxo é um já existente (dados.processoId) ou
  // um processo novo criado agora (AMB-<CHAVE>).
  public async criar(
    dados: INovoAmbiente,
    existentes: IAmbiente[]
  ): Promise<IResultadoGravacaoAmbiente> {

    const erros = validarDadosAmbiente(dados, existentes);
    if (erros.length > 0) {
      return { ok: false, erros };
    }

    // 1. Fluxo do ambiente: existente ou novo processo.
    const persistencia = obterPersistenciaFluxo(this.dataverse);
    const codigoProcesso = `${PREFIXO_PROCESSO_AMBIENTE}${dados.chave.toUpperCase()}`.substring(0, 100);

    let processoId = '';
    let processoNome = '';

    if (dados.processoId) {
      try {
        const existente = await this.fluxoExistente(dados.processoId);
        if (!existente) {
          return { ok: false, erros: ['O fluxo escolhido não foi encontrado ou está inativo. Escolha outro ou crie um fluxo novo.'] };
        }
        processoId = existente.id;
        processoNome = existente.nome;
      } catch (erro) {
        return { ok: false, erros: [`Não foi possível ler os fluxos: ${mensagem(erro)}`] };
      }
    } else {
      // Fluxo novo, só deste ambiente.
      try {
        const atuais = await persistencia.processos.carregar(true, []);
        const jaExiste =
          atuais.processos.filter(item => (item.codigo || '').toUpperCase() === codigoProcesso)[0];

        if (jaExiste) {
          // Reaproveita (ex.: tentativa anterior que criou o processo e
          // falhou ao gravar o ambiente).
          processoId = jaExiste.id;
          processoNome = jaExiste.nome;
        } else {
          const criado =
            await persistencia.processos.criarProcesso(
              {
                codigo: codigoProcesso,
                nome: `Ambiente: ${dados.nome.trim()}`.substring(0, 200),
                descricao: `Fluxo dos registros do ambiente "${dados.nome.trim()}" (criado pelo portal).`
              },
              atuais.processos
            );

          if (!criado.ok || !criado.processo) {
            return { ok: false, erros: [criado.erro || 'Não foi possível criar o processo do ambiente.'] };
          }

          processoId = criado.processo.id;
          processoNome = criado.processo.nome;
        }
      } catch (erro) {
        return { ok: false, erros: [`Não foi possível criar o processo do fluxo: ${mensagem(erro)}`] };
      }
    }

    // 2. Ambiente.
    try {
      const corpo: Record<string, unknown> = {
        ...this.corpoAmbiente(dados),
        [AMBIENTE.chave]: dados.chave.trim(),
        [AMBIENTE.ativo]: true
      };

      if (!persistencia.local) {
        corpo[AMBIENTE.processoBind] =
          await this.dataverse.referenciaLookup(TABELAS_AMBIENTE.processo, processoId);
      }

      const id = await this.dataverse.criarRegistro(TABELAS_AMBIENTE.ambiente, corpo);

      return {
        ok: true,
        erros: [],
        ambiente: {
          id: guid(id),
          chave: dados.chave.trim(),
          nome: dados.nome.trim(),
          descricao: (dados.descricao || '').trim(),
          subtitulo: (dados.subtitulo || '').trim(),
          icone: dados.icone,
          ordem: dados.ordem,
          ativo: true,
          liberadoParaTodos: dados.liberadoParaTodos,
          perfisPadrao: dados.perfisPadrao,
          processoId,
          processoNome,
          prefixoCodigo: dados.prefixoCodigo.trim(),
          rotuloRegistro: dados.rotuloRegistro.trim(),
          permiteAnexos: !!dados.permiteAnexos,
          bibliotecaAnexos: (dados.bibliotecaAnexos || '').trim(),
          mostrarSequencia: dados.mostrarSequencia !== false,
          layoutJson: ''
        }
      };
    } catch (erro) {
      return {
        ok: false,
        erros: [
          dados.processoId
            ? `O ambiente não foi gravado: ${mensagem(erro)}`
            : `O processo do fluxo (${codigoProcesso}) foi criado, mas o ambiente não foi gravado: ${mensagem(erro)}. Tente de novo: o processo será reaproveitado.`
        ]
      };
    }
  }

  // Altera os dados do ambiente. A CHAVE nunca muda (as liberações
  // dos usuários apontam para ela). O fluxo pode ser trocado por outro
  // já existente: registros em andamento continuam no fluxo (e versão)
  // em que começaram; os novos seguem o novo fluxo.
  public async atualizar(
    ambiente: IAmbiente,
    dados: IEdicaoAmbiente,
    existentes: IAmbiente[]
  ): Promise<IResultadoGravacaoAmbiente> {

    const erros =
      validarDadosAmbiente({ ...dados, chave: ambiente.chave }, existentes, ambiente.id);

    if (erros.length > 0) {
      return { ok: false, erros };
    }

    let processoId = ambiente.processoId;
    let processoNome = ambiente.processoNome;
    const trocarFluxo = !!dados.processoId && guid(dados.processoId) !== guid(ambiente.processoId);

    try {
      const corpo: Record<string, unknown> = {
        ...this.corpoAmbiente(dados),
        [AMBIENTE.ativo]: dados.ativo
      };

      if (trocarFluxo) {
        const existente = await this.fluxoExistente(dados.processoId as string);
        if (!existente) {
          return { ok: false, erros: ['O fluxo escolhido não foi encontrado ou está inativo.'] };
        }
        processoId = guid(existente.id);
        processoNome = existente.nome;
        corpo[AMBIENTE.processoBind] =
          await this.dataverse.referenciaLookup(TABELAS_AMBIENTE.processo, processoId);
      }

      await this.dataverse.atualizarRegistro(
        TABELAS_AMBIENTE.ambiente,
        ambiente.id,
        corpo
      );
    } catch (erro) {
      return { ok: false, erros: [mensagem(erro)] };
    }

    return {
      ok: true,
      erros: [],
      ambiente: {
        ...ambiente,
        processoId,
        processoNome,
        nome: dados.nome.trim(),
        descricao: (dados.descricao || '').trim(),
        subtitulo: (dados.subtitulo || '').trim(),
        icone: dados.icone,
        ordem: dados.ordem,
        ativo: dados.ativo,
        liberadoParaTodos: dados.liberadoParaTodos,
        perfisPadrao: dados.perfisPadrao,
        prefixoCodigo: dados.prefixoCodigo.trim(),
        rotuloRegistro: dados.rotuloRegistro.trim()
      }
    };
  }

  private corpoAmbiente(
    dados: INovoAmbiente
  ): Record<string, unknown> {
    return {
      [AMBIENTE.nome]: dados.nome.trim().substring(0, 200),
      [AMBIENTE.descricao]: (dados.descricao || '').trim().substring(0, 500),
      [AMBIENTE.subtitulo]: (dados.subtitulo || '').trim().substring(0, 200),
      [AMBIENTE.icone]: dados.icone,
      [AMBIENTE.ordem]: Math.round(Number(dados.ordem) || 0),
      [AMBIENTE.liberadoParaTodos]: dados.liberadoParaTodos,
      [AMBIENTE.perfisPadrao]: JSON.stringify(dados.perfisPadrao || []),
      [AMBIENTE.prefixoCodigo]: dados.prefixoCodigo.trim().toUpperCase().substring(0, 20),
      [AMBIENTE.rotuloRegistro]: dados.rotuloRegistro.trim().substring(0, 100),
      ...(estadoColunasSequencia.disponivel === true
        ? { [AMBIENTE.mostrarSequencia]: dados.mostrarSequencia !== false }
        : {}),
      // Só grava os anexos se as colunas existirem (script).
      ...(estadoColunasAnexos.disponivel === true
        ? {
          [AMBIENTE.permiteAnexos]: !!dados.permiteAnexos,
          [AMBIENTE.bibliotecaAnexos]: (dados.bibliotecaAnexos || '').trim().substring(0, 400)
        }
        : {})
    };
  }

  // false = falta criar a coluna da sequência (o formulário avisa).
  public static sequenciaDisponivel(): boolean {
    return estadoColunasSequencia.disponivel === true;
  }

  // false = falta criar as colunas de anexos (o formulário avisa).
  public static anexosDisponiveis(): boolean {
    return estadoColunasAnexos.disponivel === true;
  }

  // ----------------------------------------------------------
  // Exclusão (fase de criação/testes) e desativação
  // ----------------------------------------------------------

  public async analisarExclusao(
    ambiente: IAmbiente,
    todos: IAmbiente[]
  ): Promise<IAnaliseExclusaoAmbiente> {
    const registros = await this.listarRegistros(ambiente);
    const outros = todos.filter(item => item.id !== ambiente.id && guid(item.processoId) === guid(ambiente.processoId) && !!ambiente.processoId);
    let documentos = 0;
    let revisoes = 0;
    if (ambiente.processoId) {
      const analise = await new ExclusaoFluxoService(this.dataverse).analisar(ambiente.processoId);
      documentos = analise.documentosVinculados;
      revisoes = analise.revisoesComHistorico;
    }
    return {
      registros: {
        total: registros.length,
        emAndamento: registros.filter(item => item.situacao === 'emAndamento').length,
        concluidos: registros.filter(item => item.situacao === 'concluido').length,
        cancelados: registros.filter(item => item.situacao === 'cancelado').length,
        ids: registros.map(item => item.id)
      },
      outrosAmbientes: outros.map(item => item.nome),
      documentosNoFluxo: documentos,
      revisoesNoFluxo: revisoes,
      podeExcluirFluxo: !!ambiente.processoId && outros.length === 0 && documentos === 0 && revisoes === 0,
      processoNome: ambiente.processoNome || ''
    };
  }

  public async reativar(ambiente: IAmbiente): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELAS_AMBIENTE.ambiente, ambiente.id, { [AMBIENTE.ativo]: true });
  }

  // Desativa: some do menu; registros e histórico ficam.
  public async desativar(ambiente: IAmbiente): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELAS_AMBIENTE.ambiente, ambiente.id, { [AMBIENTE.ativo]: false });
  }

  // Exclui DEFINITIVAMENTE o ambiente e os registros dele (fase de
  // criação/testes). Com excluirFluxo, remove também o processo/fluxo
  // se ninguém mais o usa. Refaz a análise antes de apagar.
  public async excluir(
    ambiente: IAmbiente,
    todos: IAmbiente[],
    excluirFluxo: boolean,
    onProgresso?: (mensagem: string) => void
  ): Promise<string[]> {
    const avisos: string[] = [];
    const analise = await this.analisarExclusao(ambiente, todos);
    const ids = analise.registros.ids;
    for (let i = 0; i < ids.length; i++) {
      if (onProgresso) {
        onProgresso(`Excluindo registros (${i + 1}/${ids.length})`);
      }
      await this.dataverse.excluirRegistro(TABELAS_AMBIENTE.registro, ids[i]);
    }
    if (onProgresso) {
      onProgresso('Excluindo o ambiente');
    }
    await this.dataverse.excluirRegistro(TABELAS_AMBIENTE.ambiente, ambiente.id);

    if (excluirFluxo && ambiente.processoId) {
      if (!analise.podeExcluirFluxo) {
        avisos.push(
          analise.outrosAmbientes.length > 0
            ? `O fluxo foi mantido: também é usado por ${analise.outrosAmbientes.join(', ')}.`
            : 'O fluxo foi mantido: há documentos ou revisões que o usam.'
        );
      } else {
        try {
          await new ExclusaoFluxoService(this.dataverse).excluir(ambiente.processoId, onProgresso);
        } catch (erro) {
          avisos.push(`O ambiente foi excluído, mas o fluxo não: ${mensagem(erro)}`);
        }
      }
    }
    return avisos;
  }

  // ----------------------------------------------------------
  // Registros do ambiente
  // ----------------------------------------------------------

  private converterRegistro(
    registro: Record<string, unknown>
  ): IAmbienteRegistro {
    const situacao = texto(registro, REGISTRO.situacao) as SituacaoRegistroAmbiente;
    return {
      id: guid(registro[REGISTRO.id]),
      ambienteId: guid(registro[REGISTRO.ambienteValor]),
      codigo: texto(registro, REGISTRO.codigo),
      titulo: texto(registro, REGISTRO.titulo),
      descricao: texto(registro, REGISTRO.descricao),
      areaId: guid(registro[REGISTRO.areaValor]),
      areaNome: texto(registro, REGISTRO.areaValor + ANOTACAO_FORMATADA),
      solicitanteId: guid(registro[REGISTRO.solicitanteValor]),
      solicitanteNome: texto(registro, REGISTRO.solicitanteValor + ANOTACAO_FORMATADA),
      situacao: situacao === 'concluido' || situacao === 'cancelado' ? situacao : 'emAndamento',
      etapaAtual: texto(registro, REGISTRO.etapaAtual),
      etapaAtualId: texto(registro, REGISTRO.etapaAtualId),
      valores: lerValoresJson(registro[REGISTRO.valores]),
      prazoEtapa: texto(registro, REGISTRO.prazoEtapa),
      criadoEm: texto(registro, REGISTRO.criadoEm),
      concluidoEm: texto(registro, REGISTRO.concluidoEm)
    };
  }

  // Registros do ambiente que o usuário consegue LER (a Security Role
  // do Dataverse decide o alcance), mais recentes primeiro.
  public async listarRegistros(
    ambiente: IAmbiente
  ): Promise<IAmbienteRegistro[]> {
    const registros =
      await this.consultarComLayout(
        TABELAS_AMBIENTE.registro,
        [
          REGISTRO.id, REGISTRO.titulo, REGISTRO.codigo, REGISTRO.descricao,
          REGISTRO.situacao, REGISTRO.etapaAtual, REGISTRO.prazoEtapa,
          REGISTRO.concluidoEm, REGISTRO.criadoEm, REGISTRO.ambienteValor,
          REGISTRO.areaValor, REGISTRO.solicitanteValor
        ],
        [REGISTRO.etapaAtualId, REGISTRO.valores],
        `&$filter=${REGISTRO.ambienteValor} eq ${ambiente.id}` +
        `&$orderby=${REGISTRO.criadoEm} desc`
      );
    return registros.map(item => this.converterRegistro(item));
  }

  // Próximo código: <PREFIXO>-<ANO>-<0001>. O sequencial é por
  // ambiente e por ano.
  private async proximoCodigo(
    ambiente: IAmbiente
  ): Promise<string> {
    const ano = new Date().getFullYear();
    const base = `${(ambiente.prefixoCodigo || 'REG').toUpperCase()}-${ano}-`;
    const existentes =
      await this.dataverse.listarRegistros(
        TABELAS_AMBIENTE.registro,
        `$select=${REGISTRO.codigo}` +
        `&$filter=${REGISTRO.ambienteValor} eq ${ambiente.id} and startswith(${REGISTRO.codigo},'${base}')`
      );
    const maior =
      existentes
        .map(item => parseInt(texto(item, REGISTRO.codigo).substring(base.length), 10))
        .filter(numero => !isNaN(numero))
        .reduce((atual, numero) => Math.max(atual, numero), 0);
    // (padStart não existe no alvo ES5 do SPFx)
    const sequencial = `0000${maior + 1}`;
    return `${base}${sequencial.substring(sequencial.length - Math.max(4, String(maior + 1).length))}`;
  }

  public async criarRegistro(
    ambiente: IAmbiente,
    dados: INovoRegistroAmbiente,
    contexto: IContextoAcesso
  ): Promise<IAmbienteRegistro> {

    const titulo = (dados.titulo || '').trim();

    if (titulo.length < 3) {
      throw new Error('Informe o título (mínimo de 3 letras).');
    }

    const codigo = await this.proximoCodigo(ambiente);

    const corpo: Record<string, unknown> = {
      [REGISTRO.titulo]: titulo.substring(0, 200),
      [REGISTRO.codigo]: codigo,
      [REGISTRO.descricao]: (dados.descricao || '').trim().substring(0, 4000),
      [REGISTRO.situacao]: 'emAndamento',
      [REGISTRO.ambienteBind]: await this.dataverse.referenciaLookup(TABELAS_AMBIENTE.ambiente, ambiente.id),
      [REGISTRO.solicitanteBind]: await this.dataverse.referenciaLookup(TABELAS_AMBIENTE.usuario, contexto.usuarioId)
    };

    if (dados.areaId) {
      corpo[REGISTRO.areaBind] = await this.dataverse.referenciaLookup(TABELAS_AMBIENTE.area, dados.areaId);
    }

    const id = await this.dataverse.criarRegistro(TABELAS_AMBIENTE.registro, corpo);

    return {
      id: guid(id),
      ambienteId: ambiente.id,
      codigo,
      titulo,
      descricao: (dados.descricao || '').trim(),
      areaId: guid(dados.areaId),
      areaNome: '',
      solicitanteId: guid(contexto.usuarioId),
      solicitanteNome: contexto.nome,
      situacao: 'emAndamento',
      etapaAtual: '',
      etapaAtualId: '',
      valores: {},
      prazoEtapa: '',
      criadoEm: new Date().toISOString(),
      concluidoEm: ''
    };
  }
}
