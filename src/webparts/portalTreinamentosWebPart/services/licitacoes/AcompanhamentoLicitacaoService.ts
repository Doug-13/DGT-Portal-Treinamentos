import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  ILicitacaoResultado
} from '../../models/Licitacao';

import {
  gerarChaveEdital,
  mascararDadosSensiveis
} from '../LicitacaoParecerService';

import {
  carregarDetalheEdital,
  carregarDocumentosEdital,
  carregarItensEdital
} from '../PncpEditalService';

import {
  IAlteracaoDetectada,
  ISnapshotLicitacao,
  TipoAlteracao,
  compararSnapshots,
  montarSnapshot
} from '../../utils/snapshotLicitacao';

// ============================================================
// ACOMPANHAMENTO DE LICITAÇÕES (opção B, em duas fases)
//
// Tabelas (scripts/dataverse/criar-tabelas-acompanhamento-licitacoes.ps1):
//   dgt_licitacaoacompanhamento  um por edital acompanhado (foto atual)
//   dgt_licitacaoalteracao       linha do tempo (o que mudou e quando)
//
// FASE 1 (sempre ativa): a foto é atualizada quando o edital aparece
//   numa busca ou é aberto no Pré-visualizar (o identificador do PNCP
//   existe só em memória). Nada com CNPJ é gravado.
//
// FASE 2 (ao registrar a chave no plugin): ao acompanhar, o portal
//   envia o identificador à Custom API dgt_AcompanharLicitacao; o
//   PLUGIN o criptografa (AES-256 + HMAC) e grava numa coluna com
//   segurança de campo. A verificação diária (fluxo) chama
//   dgt_AtualizarAcompanhamentos, que descriptografa em memória,
//   consulta o PNCP e grava as alterações. O portal nunca lê o
//   identificador de volta.
// ============================================================

export const TABELA_ACOMPANHAMENTO = 'dgt_licitacaoacompanhamento';
export const TABELA_ALTERACAO = 'dgt_licitacaoalteracao';

const A = {
  id: 'dgt_licitacaoacompanhamentoid',
  nome: 'dgt_name',
  chave: 'dgt_chaveedital',
  orgao: 'dgt_orgao',
  local: 'dgt_local',
  modalidade: 'dgt_modalidade',
  numero: 'dgt_numeroedital',
  objeto: 'dgt_objeto',
  situacao: 'dgt_situacao',
  valor: 'dgt_valorestimado',
  abertura: 'dgt_dataabertura',
  encerramento: 'dgt_dataencerramento',
  snapshot: 'dgt_snapshotjson',
  ativo: 'dgt_ativo',
  automatico: 'dgt_monitoramentoautomatico',
  ultima: 'dgt_ultimaverificacao',
  responsavel: 'dgt_responsavelnome'
};

const L = {
  id: 'dgt_licitacaoalteracaoid',
  nome: 'dgt_name',
  acompBind: 'dgt_Acompanhamento@odata.bind',
  acompValor: '_dgt_acompanhamento_value',
  chave: 'dgt_chaveedital',
  tipo: 'dgt_tipo',
  descricao: 'dgt_descricao',
  anterior: 'dgt_valoranterior',
  novo: 'dgt_valornovo',
  origem: 'dgt_origem',
  lida: 'dgt_lida'
};

export interface IAcompanhamento {
  id: string;
  chaveEdital: string;
  orgao: string;
  local: string;
  modalidade: string;
  numero: string;
  objeto: string;
  situacao: string;
  valor?: number;
  abertura: string;
  encerramento: string;
  snapshot?: ISnapshotLicitacao;
  automatico: boolean;
  ultimaVerificacao: string;
  responsavel: string;
  criadoEm: string;
  // Tarefa de acompanhamento no ClickUp (criada ao "Participar").
  clickupTarefaId: string;
  clickupUrl: string;
}

// Dados do parecer e da IA que vão para a tarefa do ClickUp.
export interface IContextoTarefaClickUp {
  justificativa: string;
  responsavel: string;
  analiseIa?: {
    recomendacao: string;
    compatibilidade: number;
    resumo: string;
  };
}

export type OrigemAlteracao = 'busca' | 'automatica' | 'portal';

export interface IAlteracaoLicitacao {
  id: string;
  acompanhamentoId: string;
  chaveEdital: string;
  tipo: TipoAlteracao;
  descricao: string;
  anterior: string;
  novo: string;
  origem: OrigemAlteracao;
  lida: boolean;
  detectadaEm: string;
}

const guid = (valor: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v);
};

const lerSnapshot = (json: string): ISnapshotLicitacao | undefined => {
  try {
    return json ? JSON.parse(json) as ISnapshotLicitacao : undefined;
  } catch {
    return undefined;
  }
};

const mapearAcompanhamento = (r: IDataverseRecord): IAcompanhamento => ({
  id: guid(r[A.id]),
  chaveEdital: texto(r, A.chave),
  orgao: texto(r, A.orgao),
  local: texto(r, A.local),
  modalidade: texto(r, A.modalidade),
  numero: texto(r, A.numero),
  objeto: texto(r, A.objeto),
  situacao: texto(r, A.situacao),
  valor: r[A.valor] === null || r[A.valor] === undefined ? undefined : Number(r[A.valor]),
  abertura: texto(r, A.abertura),
  encerramento: texto(r, A.encerramento),
  snapshot: lerSnapshot(texto(r, A.snapshot)),
  automatico: r[A.automatico] === true,
  ultimaVerificacao: texto(r, A.ultima),
  responsavel: texto(r, A.responsavel),
  criadoEm: texto(r, 'createdon'),
  clickupTarefaId: texto(r, 'dgt_clickuptarefaid'),
  clickupUrl: texto(r, 'dgt_clickupurl')
});

const mapearAlteracao = (r: IDataverseRecord): IAlteracaoLicitacao => ({
  id: guid(r[L.id]),
  acompanhamentoId: guid(r[L.acompValor]),
  chaveEdital: texto(r, L.chave),
  tipo: (texto(r, L.tipo) || 'situacao') as TipoAlteracao,
  descricao: texto(r, L.descricao),
  anterior: texto(r, L.anterior),
  novo: texto(r, L.novo),
  origem: (texto(r, L.origem) || 'busca') as OrigemAlteracao,
  lida: r[L.lida] === true,
  detectadaEm: texto(r, 'createdon')
});

export const ehTabelaAcompanhamentoInexistente = (erro: unknown): boolean => {
  const m = erro instanceof Error ? erro.message : String(erro || '');
  return /\b404\b|0x80060888|could not find|does not exist|não localizado/i.test(m);
};

// Junta as linhas da descrição: tira as linhas vazias de dentro das
// tabelas (linhas condicionais) e as vazias repetidas.
const juntarMarkdown = (linhas: string[]): string => {
  const saida: string[] = [];
  linhas.forEach((linha, k) => {
    if (linha === '') {
      const anterior = saida.length > 0 ? saida[saida.length - 1] : '';
      const proxima = linhas.slice(k + 1).find(l => l !== '') || '';
      if (anterior === '' || (anterior.indexOf('|') === 0 && proxima.indexOf('|') === 0)) {
        return;
      }
    }
    saida.push(linha);
  });
  return saida.join('\n').trim();
};

export class AcompanhamentoLicitacaoService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // ----------------------------------------------------------
  // Leitura
  // ----------------------------------------------------------

  public async listar(): Promise<IAcompanhamento[]> {
    const registros = await this.dataverse.listarRegistros(
      TABELA_ACOMPANHAMENTO,
      // Sem $select: traz também as colunas do ClickUp quando já
      // existirem (o script delas pode ser rodado depois).
      `$filter=${A.ativo} eq true&$orderby=${A.ultima} desc`
    );
    return registros.map(mapearAcompanhamento);
  }

  public async listarAlteracoes(): Promise<IAlteracaoLicitacao[]> {
    const registros = await this.dataverse.listarRegistros(
      TABELA_ALTERACAO,
      '$select=' + [L.id, L.acompValor, L.chave, L.tipo, L.descricao, L.anterior, L.novo, L.origem, L.lida, 'createdon'].join(',') +
      '&$filter=statecode eq 0&$orderby=createdon desc&$top=2000'
    );
    return registros.map(mapearAlteracao);
  }

  // ----------------------------------------------------------
  // Foto atual do edital (consulta o PNCP com o id em memória)
  // ----------------------------------------------------------

  public async fotografar(item: ILicitacaoResultado): Promise<ISnapshotLicitacao> {

    if (!item.idPncp) {
      return montarSnapshot({
        valor: item.valor,
        abertura: item.abertura,
        encerramento: item.encerramento,
        objeto: item.objeto
      });
    }

    const [detalhe, documentos, itens] = await Promise.all([
      carregarDetalheEdital(item.idPncp).catch(() => undefined),
      carregarDocumentosEdital(item.idPncp).catch(() => []),
      carregarItensEdital(item.idPncp).then(r => r.itens).catch(() => [])
    ]);

    return montarSnapshot({
      situacao: detalhe ? detalhe.situacao : undefined,
      valor: item.valor,
      abertura: item.abertura,
      encerramento: item.encerramento,
      objeto: item.objeto,
      documentos,
      itens
    });
  }

  // ----------------------------------------------------------
  // Acompanhar / parar
  // ----------------------------------------------------------

  public async acompanhar(
    item: ILicitacaoResultado,
    responsavel: string,
    existente?: IAcompanhamento
  ): Promise<{ acompanhamento: IAcompanhamento; automatico: boolean; aviso?: string }> {

    const chave = gerarChaveEdital(item);
    const foto = await this.fotografar(item);

    const dados: Record<string, unknown> = {
      [A.nome]: `${mascararDadosSensiveis(item.orgao)} ${mascararDadosSensiveis(item.numero)}`.substring(0, 200),
      [A.chave]: chave,
      [A.orgao]: mascararDadosSensiveis(item.orgao).substring(0, 200),
      [A.local]: (item.local || '').substring(0, 200),
      [A.modalidade]: (item.modalidade || '').substring(0, 100),
      [A.numero]: mascararDadosSensiveis(item.numero || '').substring(0, 100),
      [A.objeto]: foto.objeto.substring(0, 4000),
      [A.situacao]: foto.situacao.substring(0, 200),
      [A.valor]: foto.valor === undefined ? null : Math.round(foto.valor * 100) / 100,
      [A.abertura]: foto.abertura,
      [A.encerramento]: foto.encerramento,
      [A.snapshot]: JSON.stringify(foto),
      [A.ativo]: true,
      [A.ultima]: new Date().toISOString(),
      [A.responsavel]: (responsavel || '').substring(0, 200)
    };

    let id: string;

    if (existente) {
      id = existente.id;
      await this.dataverse.atualizarRegistro(TABELA_ACOMPANHAMENTO, id, dados);
    } else {
      // Reativa um acompanhamento antigo do mesmo edital, se houver.
      const antigos = await this.dataverse.listarRegistros(
        TABELA_ACOMPANHAMENTO,
        `$select=${A.id}&$filter=${A.chave} eq '${chave.replace(/'/g, "''")}'&$top=1`
      );
      if (antigos.length > 0) {
        id = guid(antigos[0][A.id]);
        await this.dataverse.atualizarRegistro(TABELA_ACOMPANHAMENTO, id, dados);
      } else {
        id = await this.dataverse.criarRegistro(TABELA_ACOMPANHAMENTO, dados);
      }
    }

    await this.registrarAlteracoes(id, chave, [{
      tipo: 'inicio',
      descricao: 'Acompanhamento iniciado',
      anterior: '',
      novo: foto.situacao || 'edital publicado'
    }], 'portal', true);

    // FASE 2: o plugin criptografa e guarda o identificador.
    let automatico = false;
    let aviso: string | undefined;

    if (item.idPncp) {
      try {
        const r = await this.dataverse.chamarCustomApiJson('dgt_AcompanharLicitacao', {
          acao: 'acompanhar',
          chaveEdital: chave,
          idPncp: item.idPncp
        });
        automatico = r.cifrado === true;
        aviso = typeof r.motivo === 'string' ? r.motivo : undefined;
      } catch (erro) {
        aviso = 'Verificação automática indisponível (fase 1): ' +
          (erro instanceof Error ? erro.message : String(erro)).substring(0, 160);
      }
    }

    const lidos = await this.dataverse.listarRegistros(
      TABELA_ACOMPANHAMENTO,
      `$filter=${A.id} eq ${id}`
    );

    return {
      acompanhamento: lidos.length > 0 ? mapearAcompanhamento(lidos[0]) : mapearAcompanhamento({ [A.id]: id, ...dados }),
      automatico,
      aviso
    };
  }

  public async parar(acompanhamento: IAcompanhamento): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELA_ACOMPANHAMENTO, acompanhamento.id, { [A.ativo]: false });
    // Apaga o identificador criptografado (se houver).
    await this.dataverse
      .chamarCustomApiJson('dgt_AcompanharLicitacao', { acao: 'parar', chaveEdital: acompanhamento.chaveEdital })
      .catch(() => undefined);
  }

  // ----------------------------------------------------------
  // Verificação pela busca (fase 1)
  // ----------------------------------------------------------

  public async verificar(
    item: ILicitacaoResultado,
    acompanhamento: IAcompanhamento
  ): Promise<IAlteracaoDetectada[]> {

    const foto = await this.fotografar(item);
    const anterior = acompanhamento.snapshot;
    const mudancas = anterior ? compararSnapshots(anterior, foto) : [];

    // Documentos/itens que não carregaram agora: mantém os anteriores.
    const fotoFinal: ISnapshotLicitacao = {
      ...foto,
      situacao: foto.situacao || (anterior ? anterior.situacao : ''),
      documentos: foto.documentos.length > 0 ? foto.documentos : (anterior ? anterior.documentos : []),
      itens: foto.itens.length > 0 ? foto.itens : (anterior ? anterior.itens : [])
    };

    if (mudancas.length > 0) {
      await this.registrarAlteracoes(acompanhamento.id, acompanhamento.chaveEdital, mudancas, 'busca', false);
    }

    await this.dataverse.atualizarRegistro(TABELA_ACOMPANHAMENTO, acompanhamento.id, {
      [A.situacao]: fotoFinal.situacao.substring(0, 200),
      [A.valor]: fotoFinal.valor === undefined ? null : Math.round(fotoFinal.valor * 100) / 100,
      [A.abertura]: fotoFinal.abertura,
      [A.encerramento]: fotoFinal.encerramento,
      [A.objeto]: fotoFinal.objeto.substring(0, 4000),
      [A.snapshot]: JSON.stringify(fotoFinal),
      [A.ultima]: new Date().toISOString()
    });

    // Edital acompanhado antes da fase 2: liga a verificação automática.
    if (!acompanhamento.automatico && item.idPncp) {
      await this.dataverse
        .chamarCustomApiJson('dgt_AcompanharLicitacao', {
          acao: 'acompanhar',
          chaveEdital: acompanhamento.chaveEdital,
          idPncp: item.idPncp
        })
        .catch(() => undefined);
    }

    return mudancas;
  }

  // ----------------------------------------------------------
  // Verificação automática agora (fase 2)
  // ----------------------------------------------------------

  public async verificarAgora(): Promise<Record<string, unknown>> {
    return this.dataverse.chamarCustomApiJson('dgt_AtualizarAcompanhamentos', {});
  }

  // ----------------------------------------------------------
  // Tarefa no ClickUp (Custom API dgt_CriarTarefaClickUp)
  // ----------------------------------------------------------
  // O token do ClickUp fica SÓ no plugin. A descrição vai SEM CNPJ
  // e SEM link do PNCP (que contém o CNPJ); o link é para o portal.

  public async criarTarefaClickUp(
    item: ILicitacaoResultado,
    acompanhamento: IAcompanhamento,
    contexto: IContextoTarefaClickUp
  ): Promise<{ id: string; url: string; existente: boolean }> {

    const encerramento = item.encerramento ? new Date(item.encerramento) : undefined;
    const prazoValido = !!encerramento && !isNaN(encerramento.getTime());
    const dias = prazoValido && encerramento
      ? Math.ceil((encerramento.getTime() - Date.now()) / 86400000)
      : undefined;

    // 1 = urgente, 2 = alta, 3 = normal (prioridades do ClickUp)
    const prioridade = dias === undefined ? 3 : dias <= 3 ? 1 : dias <= 7 ? 2 : 3;

    const moeda = (v?: number): string =>
      v === undefined || v === null || isNaN(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const data = (v?: string): string => {
      const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(v || '');
      return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}` : ''}` : '—';
    };

    const limpo = (v?: string): string => mascararDadosSensiveis(v || '').trim();

    // Detalhes atualizados do PNCP (itens, documentos, onde disputar).
    let detalhe: ILicitacaoResultado['dados'] | undefined;
    let documentos: Array<{ titulo: string; tipo: string; publicacao?: string }> = [];
    let itens: Array<{ numeroItem: number; descricao: string; quantidade?: number; unidade?: string; valorTotal?: number; tipo: string }> = [];

    if (item.idPncp) {
      const [d, docs, its] = await Promise.all([
        carregarDetalheEdital(item.idPncp).catch(() => undefined),
        carregarDocumentosEdital(item.idPncp).catch(() => []),
        carregarItensEdital(item.idPncp).then(r => r.itens).catch(() => [])
      ]);
      detalhe = d;
      documentos = docs;
      itens = its;
    }

    const portal = `${window.location.origin}${window.location.pathname}`;
    const orgao = limpo(item.orgao);
    const numero = limpo(item.numero);
    const municipio = (item.local || orgao).split('/')[0].trim();
    const uf = (item.local || '').split('/')[1] ? (item.local || '').split('/')[1].trim() : '';
    const prazoTexto = dias === undefined ? '' : dias < 0 ? ' (encerrado)' : ` (faltam ${dias} dia${dias === 1 ? '' : 's'})`;

    // ---------------- Descrição (Markdown) ----------------

    const linhas: string[] = [
      `> **${item.modalidade || 'Edital'} ${numero}** · ${orgao} · ${item.local || ''}`,
      `> ⏰ **Encerramento das propostas: ${data(item.encerramento)}**${prazoTexto}`,
      '',
      '## Resumo',
      `| | |`,
      `|---|---|`,
      `| **Órgão** | ${orgao} |`,
      detalhe && detalhe.unidadeCompradora ? `| **Unidade compradora** | ${limpo(detalhe.unidadeCompradora)} |` : '',
      `| **Município / UF** | ${item.local || '—'} |`,
      detalhe && detalhe.esfera ? `| **Esfera** | ${detalhe.esfera}${detalhe.poder ? ` / ${detalhe.poder}` : ''} |` : '',
      `| **Modalidade** | ${item.modalidade || '—'} |`,
      detalhe && detalhe.modoDisputa ? `| **Modo de disputa** | ${detalhe.modoDisputa} |` : '',
      detalhe && detalhe.srp !== undefined ? `| **Registro de preços** | ${detalhe.srp ? 'Sim' : 'Não'} |` : '',
      `| **Número** | ${numero || '—'} |`,
      detalhe && detalhe.processo ? `| **Processo** | ${limpo(detalhe.processo)} |` : '',
      `| **Valor estimado** | ${moeda(item.valor)} |`,
      `| **Publicação** | ${data(item.publicacao)} |`,
      `| **Abertura das propostas** | ${data(item.abertura)} |`,
      `| **Encerramento das propostas** | **${data(item.encerramento)}**${prazoTexto} |`,
      `| **Situação no PNCP** | ${acompanhamento.situacao || (detalhe && detalhe.situacao) || '—'} |`,
      detalhe && detalhe.amparoLegalNome ? `| **Amparo legal** | ${limpo(detalhe.amparoLegalNome)} |` : '',
      item.score >= 0 ? `| **Aderência da busca** | ${item.score}%${item.motivos.length ? ` (${item.motivos.join('; ')})` : ''} |` : '',
      '',
      '## Objeto',
      limpo(item.objeto) || '—'
    ];

    if (detalhe && detalhe.informacaoComplementar) {
      linhas.push('', '**Informação complementar:** ' + limpo(detalhe.informacaoComplementar).substring(0, 1500));
    }

    // Onde participar (plataforma da disputa)
    if (detalhe && (detalhe.sistemaOrigem || detalhe.linkSistemaOrigem)) {
      linhas.push('', '## Onde participar');
      if (detalhe.sistemaOrigem) {
        linhas.push(`- **Plataforma:** ${limpo(detalhe.sistemaOrigem)}`);
      }
      const link = detalhe.linkSistemaOrigem || '';
      // Só links que não carregam CNPJ (regra da DGT).
      if (link && /^https?:\/\//i.test(link) && limpo(link) === link) {
        linhas.push(`- **Link da disputa:** ${link}`);
      }
      linhas.push('- Confirmar o cadastro da DGT na plataforma antes do prazo.');
    }

    // Itens
    if (itens.length > 0) {
      const somaItens = itens.reduce((t, i) => t + (i.valorTotal || 0), 0);
      linhas.push('', `## Itens (${itens.length}${somaItens > 0 ? ` · soma ${moeda(somaItens)}` : ''})`, '| Nº | Descrição | Qtd. | Valor total |', '|---|---|---|---|');
      itens.slice(0, 15).forEach(i => {
        linhas.push(`| ${i.numeroItem} | ${limpo(i.descricao).replace(/\|/g, '/').substring(0, 120)} | ${i.quantidade !== undefined ? `${i.quantidade}${i.unidade ? ` ${i.unidade}` : ''}` : '—'} | ${moeda(i.valorTotal)} |`);
      });
      if (itens.length > 15) {
        linhas.push('', `_+ ${itens.length - 15} item(ns) — ver o edital completo no portal._`);
      }
    }

    // Documentos
    if (documentos.length > 0) {
      linhas.push('', `## Documentos publicados (${documentos.length})`);
      documentos.slice(0, 20).forEach(d => {
        linhas.push(`- ${limpo(d.titulo)}${d.tipo ? ` — _${d.tipo}_` : ''}${d.publicacao ? ` (${data(d.publicacao)})` : ''}`);
      });
    }

    // Parecer e IA
    linhas.push(
      '',
      '## Parecer da DGT',
      `✓ **Participar** — ${contexto.responsavel || 'equipe DGT'}`,
      '',
      limpo(contexto.justificativa) || '—'
    );

    if (contexto.analiseIa) {
      linhas.push(
        '',
        '## Análise da IA',
        `- **Sugestão:** ${contexto.analiseIa.recomendacao}`,
        `- **Compatibilidade com a DGT:** ${contexto.analiseIa.compatibilidade}%`,
        '',
        limpo(contexto.analiseIa.resumo)
      );
    }

    linhas.push(
      '',
      '## Acompanhamento',
      `Alterações do edital (situação, prazos, documentos, itens) no [Portal DGT › Licitações › Acompanhamento](${portal}).`
    );

    // ---------------- Etiquetas ----------------

    const tags = [
      (item.modalidade || '').toLowerCase().replace(/\s*-\s*/g, ' ').trim(),
      uf.toLowerCase()
    ].filter(t => t.length > 0);

    // ---------------- Campos personalizados ----------------
    // O plugin só preenche os campos mapeados na configuração
    // ("campos": { "orgao": "<id do campo>", ... }).

    // Resumo curto para o campo "Resumo do Edital" (texto longo).
    const resumo = [
      `${item.modalidade || 'Edital'} ${numero} — ${orgao} (${item.local || ''})`,
      `Valor estimado: ${moeda(item.valor)} · Encerramento das propostas: ${data(item.encerramento)}`,
      detalhe && detalhe.sistemaOrigem ? `Plataforma: ${limpo(detalhe.sistemaOrigem)}` : '',
      `Objeto: ${(limpo(item.objeto) || '—').substring(0, 1200)}`,
      contexto.analiseIa
        ? `IA: ${contexto.analiseIa.recomendacao} · compatibilidade ${contexto.analiseIa.compatibilidade}%`
        : '',
      `Parecer DGT: Participar — ${(limpo(contexto.justificativa) || '—').substring(0, 600)}`
    ].filter(l => l.length > 0).join('\n');

    const campos: Record<string, unknown> = {
      orgaoMunicipio: `${orgao} — ${item.local || municipio}`,
      dataPregao: prazoValido && encerramento ? encerramento.getTime() : null,
      resumo,
      orgao,
      municipio,
      uf,
      modalidade: item.modalidade || '',
      numero,
      valorEstimado: item.valor === undefined ? null : Math.round(item.valor * 100) / 100,
      abertura: item.abertura && !isNaN(new Date(item.abertura).getTime()) ? new Date(item.abertura).getTime() : null,
      encerramento: prazoValido && encerramento ? encerramento.getTime() : null,
      compatibilidade: contexto.analiseIa ? contexto.analiseIa.compatibilidade : null,
      // score < 0 = tarefa criada pela aba Acompanhamento, sem a busca:
      // a aderência fica em branco (e não 0).
      aderencia: item.score >= 0 ? item.score : null,
      parecer: `Participar — ${contexto.responsavel || 'equipe DGT'} em ${new Date().toLocaleDateString('pt-BR')}: ` +
        (limpo(contexto.justificativa) || '—').substring(0, 1800),
      plataforma: detalhe && detalhe.sistemaOrigem ? limpo(detalhe.sistemaOrigem) : '',
      linkPortal: portal
    };

    const resultado = await this.dataverse.chamarCustomApiJson('dgt_CriarTarefaClickUp', {
      chaveEdital: acompanhamento.chaveEdital,
      // Padrão das tarefas do ClickUp: "Edital de Serafina Corrêa — Nº 51/2026"
      nome: `Edital de ${municipio}${numero ? ` — Nº ${numero}` : ''}`.substring(0, 250),
      descricao: juntarMarkdown(linhas),
      dataLimite: prazoValido && encerramento ? encerramento.getTime() : null,
      prioridade,
      tags,
      campos
    });

    return {
      id: String(resultado.id || ''),
      url: String(resultado.url || ''),
      existente: resultado.existente === true
    };
  }

  public async marcarLidas(alteracoes: IAlteracaoLicitacao[]): Promise<void> {
    await Promise.all(
      alteracoes
        .filter(a => !a.lida)
        .map(a => this.dataverse.atualizarRegistro(TABELA_ALTERACAO, a.id, { [L.lida]: true }))
    );
  }

  private async registrarAlteracoes(
    acompanhamentoId: string,
    chave: string,
    mudancas: IAlteracaoDetectada[],
    origem: OrigemAlteracao,
    lida: boolean
  ): Promise<void> {

    const referencia = await this.dataverse.referenciaLookup(TABELA_ACOMPANHAMENTO, acompanhamentoId);

    for (const m of mudancas) {
      await this.dataverse.criarRegistro(TABELA_ALTERACAO, {
        [L.nome]: m.descricao.substring(0, 200),
        [L.acompBind]: referencia,
        [L.chave]: chave,
        [L.tipo]: m.tipo,
        [L.descricao]: m.descricao.substring(0, 2000),
        [L.anterior]: mascararDadosSensiveis(m.anterior).substring(0, 4000),
        [L.novo]: mascararDadosSensiveis(m.novo).substring(0, 4000),
        [L.origem]: origem,
        [L.lida]: lida
      });
    }
  }
}
