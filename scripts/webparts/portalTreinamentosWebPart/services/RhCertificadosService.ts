import {
  SPHttpClient
} from '@microsoft/sp-http';

import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  detectarDadoSensivel
} from './LicitacaoParecerService';

// ============================================================
// RH E PESSOAS — CERTIFICADOS DOS COLABORADORES
//
// Duas origens:
//   1) PLATAFORMA — treinamentos concluídos no portal:
//        dgt_usuariotreinamento (data e validade) + dgt_treinamento
//        + dgt_certificado (número/PDF) + biblioteca Certificados
//   2) EXTERNOS — cadastrados pelo RH (ensino superior, cursos,
//      NRs, certificações...), tabela dgt_certificadoexterno
//      (scripts/dataverse/criar-tabela-certificados-externos.ps1),
//      com o documento na biblioteca Certificados/Externos/<id>.
//
// Para cada colaborador × treinamento da plataforma vale a ÚLTIMA
// conclusão. Externos nunca são apagados: "Remover" só desativa
// (dgt_ativo = Não), preservando o histórico.
// ============================================================

export type SituacaoCertificadoRh =
  | 'valido'
  | 'vencendo'
  | 'vencido'
  | 'semValidade';

export type OrigemCertificadoRh = 'plataforma' | 'externo';

export interface ICertificadoRh {
  chave: string;
  origem: OrigemCertificadoRh;
  usuarioId: string;
  colaborador: string;
  email: string;
  cargo: string;
  // Plataforma: código/nome do treinamento. Externo: tipo/título.
  treinamentoId: string;
  treinamentoCodigo: string;
  treinamento: string;
  tipo: string;
  instituicao: string;
  cargaHoraria?: number;
  observacoes: string;
  realizacao: string;
  validade: string;
  nota?: number;
  numero: string;
  arquivoUrl: string;
  registradoPor: string;
  situacao: SituacaoCertificadoRh;
  diasParaVencer?: number;
}

export type StatusColaboradorRh =
  | 'verificar'   // tem certificado vencido
  | 'atencao'     // tem certificado vencendo em até 30 dias
  | 'emDia'
  | 'semCertificado';

export interface IColaboradorRh {
  usuarioId: string;
  nome: string;
  email: string;
  cargo: string;
  certificados: ICertificadoRh[];
  status: StatusColaboradorRh;
  vencidos: number;
  vencendo: number;
}

export interface IResultadoRh {
  colaboradores: IColaboradorRh[];
  // false = tabela de externos ainda não criada (script pendente).
  externosDisponivel: boolean;
}

export interface INovoCertificadoExterno {
  usuarioId: string;
  tipo: string;
  titulo: string;
  instituicao: string;
  cargaHoraria?: number;
  dataConclusao: string;   // yyyy-mm-dd
  dataValidade?: string;   // yyyy-mm-dd
  numeroRegistro?: string;
  observacoes?: string;
  arquivo?: File;
  responsavel: string;
}

export const TIPOS_CERTIFICADO_EXTERNO: string[] = [
  'Ensino superior (graduação)',
  'Pós-graduação / MBA',
  'Mestrado / Doutorado',
  'Curso técnico',
  'Curso livre / Capacitação',
  'Norma regulamentadora (NR)',
  'Certificação profissional',
  'Idioma',
  'Outro'
];

export const DIAS_AVISO_VENCIMENTO = 30;

export const TAMANHO_MAXIMO_ARQUIVO_MB = 20;

const TABELA_EXTERNO = 'dgt_certificadoexterno';

const BIBLIOTECA = 'Certificados';

const guid = (valor: unknown): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const formatado = (r: IDataverseRecord, campo: string): string =>
  texto(r, `${campo}@OData.Community.Display.V1.FormattedValue`);

const numeroOu = (r: IDataverseRecord, campo: string): number | undefined => {
  const v = r[campo];
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  const n = Number(v);
  return isNaN(n) ? undefined : n;
};

const semBarraFinal = (url: string): string =>
  (url || '').replace(/\/+$/, '');

const origemDe = (url: string): string => {
  const m = /^(https:\/\/[^/]+)/i.exec(url);
  return m ? m[1] : '';
};

const escaparOData = (valor: string): string =>
  valor.replace(/'/g, "''");

const ehTabelaInexistente = (erro: unknown): boolean => {
  const m = erro instanceof Error ? erro.message : String(erro || '');
  return /\b404\b|0x80060888|could not find|does not exist|não localizado/i.test(m);
};

export const situacaoPelaValidade = (
  validadeIso: string
): { situacao: SituacaoCertificadoRh; dias?: number } => {

  if (!validadeIso) {
    return { situacao: 'semValidade' };
  }

  // "yyyy-mm-dd" (só data) é tratado como data local.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(validadeIso);
  const validade = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(validadeIso);

  if (isNaN(validade.getTime())) {
    return { situacao: 'semValidade' };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  validade.setHours(0, 0, 0, 0);

  const dias = Math.round((validade.getTime() - hoje.getTime()) / 86400000);

  if (dias < 0) {
    return { situacao: 'vencido', dias };
  }

  return {
    situacao: dias <= DIAS_AVISO_VENCIMENTO ? 'vencendo' : 'valido',
    dias
  };
};

const statusDoColaborador = (
  certificados: ICertificadoRh[]
): { status: StatusColaboradorRh; vencidos: number; vencendo: number } => {
  const vencidos = certificados.filter(c => c.situacao === 'vencido').length;
  const vencendo = certificados.filter(c => c.situacao === 'vencendo').length;
  return {
    status: certificados.length === 0
      ? 'semCertificado'
      : vencidos > 0
        ? 'verificar'
        : vencendo > 0
          ? 'atencao'
          : 'emDia',
    vencidos,
    vencendo
  };
};

export class RhCertificadosService {

  private readonly dataverse: DataverseService;
  private readonly spHttpClient?: SPHttpClient;
  private readonly siteUrl: string;

  public constructor(
    dataverse: DataverseService,
    spHttpClient?: SPHttpClient,
    siteUrl?: string
  ) {
    this.dataverse = dataverse;
    this.spHttpClient = spHttpClient;
    this.siteUrl = semBarraFinal(siteUrl || '');
  }

  // ==========================================================
  // LEITURA
  // ==========================================================

  public async carregar(): Promise<IResultadoRh> {

    let externosDisponivel = true;

    const [usuarios, atribuicoes, treinamentos, certificados, arquivos, externos] =
      await Promise.all([
        this.dataverse.listarRegistros(
          'dgt_usuario',
          '$select=dgt_usuarioid,dgt_name,dgt_email,dgt_cargo&$filter=dgt_ativo eq true'
        ),
        this.dataverse.listarRegistros(
          'dgt_usuariotreinamento',
          '$select=dgt_usuariotreinamentoid,_dgt_usuario_value,_dgt_treinamento_value,' +
          'dgt_status,dgt_dataconclusao,dgt_datavalidade,dgt_nota,dgt_ativo'
        ),
        this.dataverse.listarRegistros(
          'dgt_treinamento',
          '$select=dgt_treinamentoid,dgt_codigo,dgt_name'
        ),
        this.dataverse
          .listarRegistros(
            'dgt_certificado',
            '$select=dgt_numero,dgt_name,dgt_arquivourl,_dgt_usuariotreinamento_value,createdon' +
            '&$filter=dgt_ativo eq true&$orderby=createdon desc'
          )
          .catch(() => [] as IDataverseRecord[]),
        this.listarPdfs()
          .catch(() => ({} as Record<string, string>)),
        this.dataverse
          .listarRegistros(
            TABELA_EXTERNO,
            '$select=dgt_certificadoexternoid,dgt_name,_dgt_usuario_value,dgt_tipo,dgt_instituicao,' +
            'dgt_cargahorariahoras,dgt_dataconclusao,dgt_datavalidade,dgt_numeroregistro,dgt_observacoes,' +
            'dgt_arquivourl,dgt_responsavelnome,createdon,_createdby_value' +
            '&$filter=dgt_ativo eq true&$orderby=dgt_dataconclusao desc'
          )
          .catch(erro => {
            if (ehTabelaInexistente(erro)) {
              externosDisponivel = false;
              return [] as IDataverseRecord[];
            }
            throw erro;
          })
      ]);

    // Treinamentos
    const porTreinamento: Record<string, IDataverseRecord> = {};
    treinamentos.forEach(t => { porTreinamento[guid(t.dgt_treinamentoid)] = t; });

    // Certificado mais recente por atribuição
    const certPorAtribuicao: Record<string, IDataverseRecord> = {};
    certificados.forEach(c => {
      const id = guid(c._dgt_usuariotreinamento_value);
      if (id && !certPorAtribuicao[id]) {
        certPorAtribuicao[id] = c;
      }
    });

    // Colaboradores
    const mapa: Record<string, IColaboradorRh> = {};
    usuarios.forEach(u => {
      const id = guid(u.dgt_usuarioid);
      mapa[id] = {
        usuarioId: id,
        nome: texto(u, 'dgt_name') || texto(u, 'dgt_email'),
        email: texto(u, 'dgt_email'),
        cargo: texto(u, 'dgt_cargo'),
        certificados: [],
        status: 'semCertificado',
        vencidos: 0,
        vencendo: 0
      };
    });

    // ---- Plataforma: última conclusão por colaborador × treinamento
    const ultima: Record<string, IDataverseRecord> = {};

    atribuicoes
      .filter(a => a.dgt_ativo !== false)
      .filter(a =>
        !!texto(a, 'dgt_dataconclusao') ||
        /conclu/i.test(formatado(a, 'dgt_status')))
      .forEach(a => {
        const usuario = guid(a._dgt_usuario_value);
        if (!mapa[usuario]) {
          return;
        }
        const chave = `${usuario}|${guid(a._dgt_treinamento_value)}`;
        const atual = ultima[chave];
        if (!atual || texto(a, 'dgt_dataconclusao') > texto(atual, 'dgt_dataconclusao')) {
          ultima[chave] = a;
        }
      });

    Object.keys(ultima).forEach(chave => {

      const a = ultima[chave];
      const usuarioId = guid(a._dgt_usuario_value);
      const treinamentoId = guid(a._dgt_treinamento_value);
      const atribuicaoId = guid(a.dgt_usuariotreinamentoid);
      const t = porTreinamento[treinamentoId];
      const c = certPorAtribuicao[atribuicaoId];
      const colaborador = mapa[usuarioId];

      const numero = c ? (texto(c, 'dgt_numero') || texto(c, 'dgt_name')) : '';
      const validade = texto(a, 'dgt_datavalidade');
      const { situacao, dias } = situacaoPelaValidade(validade);

      colaborador.certificados.push({
        chave: atribuicaoId,
        origem: 'plataforma',
        usuarioId,
        colaborador: colaborador.nome,
        email: colaborador.email,
        cargo: colaborador.cargo,
        treinamentoId,
        treinamentoCodigo: t ? texto(t, 'dgt_codigo') : '',
        treinamento: t ? texto(t, 'dgt_name') : formatado(a, '_dgt_treinamento_value') || 'Treinamento',
        tipo: 'Treinamento DGT',
        instituicao: 'DGT — Portal de Treinamentos',
        observacoes: '',
        realizacao: texto(a, 'dgt_dataconclusao'),
        validade,
        nota: numeroOu(a, 'dgt_nota'),
        numero,
        arquivoUrl:
          (c && texto(c, 'dgt_arquivourl')) ||
          (numero ? arquivos[`${numero.toLowerCase()}.pdf`] || '' : ''),
        registradoPor: 'Portal (automático)',
        situacao,
        diasParaVencer: dias
      });
    });

    // ---- Externos
    externos.forEach(e => {
      const usuarioId = guid(e._dgt_usuario_value);
      const colaborador = mapa[usuarioId];
      if (!colaborador) {
        return;
      }
      const validade = texto(e, 'dgt_datavalidade');
      const { situacao, dias } = situacaoPelaValidade(validade);

      colaborador.certificados.push({
        chave: guid(e.dgt_certificadoexternoid),
        origem: 'externo',
        usuarioId,
        colaborador: colaborador.nome,
        email: colaborador.email,
        cargo: colaborador.cargo,
        treinamentoId: '',
        treinamentoCodigo: '',
        treinamento: texto(e, 'dgt_name'),
        tipo: texto(e, 'dgt_tipo') || 'Outro',
        instituicao: texto(e, 'dgt_instituicao'),
        cargaHoraria: numeroOu(e, 'dgt_cargahorariahoras'),
        observacoes: texto(e, 'dgt_observacoes'),
        realizacao: texto(e, 'dgt_dataconclusao'),
        validade,
        numero: texto(e, 'dgt_numeroregistro'),
        arquivoUrl: texto(e, 'dgt_arquivourl'),
        registradoPor: texto(e, 'dgt_responsavelnome') || formatado(e, '_createdby_value'),
        situacao,
        diasParaVencer: dias
      });
    });

    const colaboradores = Object.keys(mapa)
      .map(id => {
        const c = mapa[id];
        c.certificados.sort((x, y) => (y.realizacao || '').localeCompare(x.realizacao || ''));
        const resumo = statusDoColaborador(c.certificados);
        c.status = resumo.status;
        c.vencidos = resumo.vencidos;
        c.vencendo = resumo.vencendo;
        return c;
      })
      .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));

    return { colaboradores, externosDisponivel };
  }

  // ==========================================================
  // CERTIFICADO EXTERNO
  // ==========================================================

  public async adicionarExterno(
    dados: INovoCertificadoExterno
  ): Promise<void> {

    const usuarioId = guid(dados.usuarioId);

    if (!dados.titulo.trim()) {
      throw new Error('Informe o curso / título do certificado.');
    }
    if (!dados.instituicao.trim()) {
      throw new Error('Informe a instituição.');
    }
    if (!dados.dataConclusao) {
      throw new Error('Informe a data de conclusão.');
    }
    if (dados.dataValidade && dados.dataValidade < dados.dataConclusao) {
      throw new Error('A validade não pode ser anterior à conclusão.');
    }

    // Política da organização (LGPD): nada de CPF, CNPJ, senhas ou
    // dados bancários nos campos digitados.
    const textoLivre = [dados.titulo, dados.instituicao, dados.numeroRegistro || '', dados.observacoes || ''].join(' ');
    const sensivel = detectarDadoSensivel(textoLivre);
    if (sensivel) {
      throw new Error(
        `Os campos contêm ${sensivel}. Remova esse dado: pela política da DGT (LGPD), ` +
        'CPF, CNPJ, senhas e dados bancários não podem ser gravados no portal.'
      );
    }

    if (dados.arquivo && dados.arquivo.size > TAMANHO_MAXIMO_ARQUIVO_MB * 1024 * 1024) {
      throw new Error(`O arquivo ultrapassa ${TAMANHO_MAXIMO_ARQUIVO_MB} MB.`);
    }

    // 1) Documento (antes do registro: se falhar, nada fica pela metade)
    let arquivoUrl = '';
    let arquivoNome = '';

    if (dados.arquivo) {
      const enviado = await this.enviarDocumento(usuarioId, dados.tipo, dados.arquivo);
      arquivoUrl = enviado.url;
      arquivoNome = enviado.nome;
    }

    // 2) Registro
    const referencia = await this.dataverse.referenciaLookup('dgt_usuario', usuarioId);

    await this.dataverse.criarRegistro(
      TABELA_EXTERNO,
      {
        dgt_name: dados.titulo.trim().substring(0, 200),
        'dgt_Usuario@odata.bind': referencia,
        dgt_tipo: (dados.tipo || 'Outro').substring(0, 100),
        dgt_instituicao: dados.instituicao.trim().substring(0, 200),
        dgt_cargahorariahoras:
          dados.cargaHoraria && dados.cargaHoraria > 0 ? Math.round(dados.cargaHoraria) : null,
        dgt_dataconclusao: dados.dataConclusao,
        dgt_datavalidade: dados.dataValidade || null,
        dgt_numeroregistro: (dados.numeroRegistro || '').trim().substring(0, 100),
        dgt_observacoes: (dados.observacoes || '').trim().substring(0, 4000),
        dgt_arquivourl: arquivoUrl,
        dgt_arquivonome: arquivoNome.substring(0, 255),
        dgt_responsavelnome: (dados.responsavel || '').substring(0, 200),
        dgt_ativo: true
      }
    );
  }

  // Remove da lista sem apagar (histórico preservado).
  public async desativarExterno(id: string): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELA_EXTERNO, guid(id), { dgt_ativo: false });
  }

  // ==========================================================
  // SHAREPOINT
  // ==========================================================

  // Certificados/Externos/<usuarioId>/<tipo>_<data-hora>.<ext>
  // (o nome original do arquivo não é usado: pode conter dados
  // pessoais).
  private async enviarDocumento(
    usuarioId: string,
    tipo: string,
    arquivo: File
  ): Promise<{ url: string; nome: string }> {

    if (!this.spHttpClient || !this.siteUrl) {
      throw new Error('Conexão com o SharePoint indisponível para enviar o documento.');
    }

    const origem = origemDe(this.siteUrl);
    const caminhoSite = this.siteUrl.substring(origem.length);

    const pastas = [
      `${caminhoSite}/${BIBLIOTECA}/Externos`,
      `${caminhoSite}/${BIBLIOTECA}/Externos/${usuarioId}`
    ];

    for (const pasta of pastas) {
      await this.garantirPasta(pasta);
    }

    const extensao = (/\.[A-Za-z0-9]{1,8}$/.exec(arquivo.name) || [''])[0].toLowerCase();
    const tipoSeguro = (tipo || 'certificado')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40) || 'certificado';
    const carimbo = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const nome = `${tipoSeguro}_${carimbo}${extensao}`;

    const conteudo = await new Promise<ArrayBuffer>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result as ArrayBuffer);
      leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      leitor.readAsArrayBuffer(arquivo);
    });

    const resposta = await this.spHttpClient.post(
      `${this.siteUrl}/_api/web/GetFolderByServerRelativePath(decodedurl='${escaparOData(pastas[1])}')` +
      `/Files/AddUsingPath(decodedurl='${escaparOData(nome)}',overwrite=false)`,
      SPHttpClient.configurations.v1,
      {
        headers: {
          Accept: 'application/json;odata=nometadata',
          'Content-Type': 'application/octet-stream'
        },
        body: conteudo as unknown as string
      }
    );

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      throw new Error(
        resposta.status === 403
          ? 'Sem permissão para enviar arquivos à biblioteca Certificados. Peça acesso de edição ao administrador do site.'
          : `Não foi possível enviar o documento ao SharePoint. ${resposta.status}. ${detalhe.substring(0, 300)}`
      );
    }

    const dados = (await resposta.json()) as { ServerRelativeUrl?: string; Name?: string };

    return {
      url: `${origem}${dados.ServerRelativeUrl || `${pastas[1]}/${nome}`}`,
      nome: dados.Name || nome
    };
  }

  private async garantirPasta(caminhoServidor: string): Promise<void> {

    if (!this.spHttpClient) {
      return;
    }

    const pasta = escaparOData(caminhoServidor);

    const consulta = await this.spHttpClient.get(
      `${this.siteUrl}/_api/web/GetFolderByServerRelativePath(decodedurl='${pasta}')?$select=Exists`,
      SPHttpClient.configurations.v1
    );

    if (consulta.ok) {
      const dados = (await consulta.json()) as { Exists?: boolean };
      if (dados.Exists !== false) {
        return;
      }
    } else if (consulta.status !== 404) {
      throw new Error(`Não foi possível verificar a pasta no SharePoint (${consulta.status}).`);
    }

    const criar = await this.spHttpClient.post(
      `${this.siteUrl}/_api/web/folders/AddUsingPath(decodedurl='${pasta}')`,
      SPHttpClient.configurations.v1,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );

    if (!criar.ok) {
      throw new Error(`Não foi possível criar a pasta "${caminhoServidor}" (${criar.status}).`);
    }
  }

  // { "dgt-2026-xxxx.pdf" → URL } da biblioteca Certificados (raiz e Emitidos).
  private async listarPdfs(): Promise<Record<string, string>> {

    const mapa: Record<string, string> = {};

    if (!this.spHttpClient || !this.siteUrl) {
      return mapa;
    }

    const origem = origemDe(this.siteUrl);
    const caminhoSite = this.siteUrl.substring(origem.length);

    for (const pasta of [BIBLIOTECA, `${BIBLIOTECA}/Emitidos`]) {
      try {
        const resposta = await this.spHttpClient.get(
          `${this.siteUrl}/_api/web/GetFolderByServerRelativePath(decodedurl='${encodeURIComponent(`${caminhoSite}/${pasta}`)}')/Files?$select=Name,ServerRelativeUrl&$top=5000`,
          SPHttpClient.configurations.v1
        );
        if (!resposta.ok) {
          continue;
        }
        const dados = (await resposta.json()) as { value?: Array<{ Name: string; ServerRelativeUrl: string }> };
        (dados.value || []).forEach(arquivo => {
          const nome = (arquivo.Name || '').toLowerCase();
          if (nome && !mapa[nome]) {
            mapa[nome] = `${origem}${arquivo.ServerRelativeUrl}`;
          }
        });
      } catch {
        // Sem acesso à pasta: a tela mostra só o número.
      }
    }

    return mapa;
  }
}
