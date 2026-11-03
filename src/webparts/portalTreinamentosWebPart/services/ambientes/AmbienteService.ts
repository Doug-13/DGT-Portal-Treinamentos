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
      rotuloRegistro: texto(registro, AMBIENTE.rotuloRegistro) || 'Registro'
    };
  }

  // Todos os ambientes (ativos e desativados), na ordem do menu.
  // Se a tabela ainda não existe, devolve disponivel = false sem erro:
  // o portal continua funcionando exatamente como antes.
  public async listar(): Promise<IResultadoListaAmbientes> {

    try {
      const registros =
        await this.dataverse.listarRegistros(
          TABELAS_AMBIENTE.ambiente,
          '$select=' + [
            AMBIENTE.id, AMBIENTE.nome, AMBIENTE.chave, AMBIENTE.descricao,
            AMBIENTE.subtitulo, AMBIENTE.icone, AMBIENTE.ordem, AMBIENTE.ativo,
            AMBIENTE.liberadoParaTodos, AMBIENTE.perfisPadrao, AMBIENTE.prefixoCodigo,
            AMBIENTE.rotuloRegistro, AMBIENTE.processoValor
          ].join(',') +
          `&$orderby=${AMBIENTE.ordem} asc,${AMBIENTE.nome} asc`
        );

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
          rotuloRegistro: dados.rotuloRegistro.trim()
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
      [AMBIENTE.rotuloRegistro]: dados.rotuloRegistro.trim().substring(0, 100)
    };
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
      await this.dataverse.listarRegistros(
        TABELAS_AMBIENTE.registro,
        '$select=' + [
          REGISTRO.id, REGISTRO.titulo, REGISTRO.codigo, REGISTRO.descricao,
          REGISTRO.situacao, REGISTRO.etapaAtual, REGISTRO.prazoEtapa,
          REGISTRO.concluidoEm, REGISTRO.criadoEm, REGISTRO.ambienteValor,
          REGISTRO.areaValor, REGISTRO.solicitanteValor
        ].join(',') +
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
      prazoEtapa: '',
      criadoEm: new Date().toISOString(),
      concluidoEm: ''
    };
  }
}
