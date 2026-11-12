import {
  DataverseService
} from '../DataverseService';

import {
  lerModulosAcesso,
  moduloLiberado
} from '../../utils/modulosPortal';

import {
  BaseImplantacoes,
  DocumentoPainel
} from './BaseImplantacoes';

import {
  BALDE_RAIZ,
  IMPL_EMAIL,
  STATUS_EMAIL_PENDENTE,
  TABELA_IMPL_EMAIL
} from './esquemaImplantacoes';

import {
  ISessaoPainel,
  podeNoPainel
} from './permissoesImplantacoes';

import {
  RotaPainel
} from './PonteApiImplantacoes';

import {
  IUsuarioEmail,
  TIPOS_EMAIL,
  dadosDosEmails,
  montarEmails,
  previaDoEmail
} from '../../pages/Implantacoes/legado/painelEmails';

// ============================================================
// IMPLANTAÇÕES — e-mails do painel (relatórios)
//
// Três envios, cada um com recorrência, destinatários, prévia, teste
// e "Enviar agora":
//
//   pendencias   Relatório semanal: pendências por pessoa
//   gerencial    Resumo gerencial
//   cronogramas  Cronograma para o cliente e a equipe
//
// Antes: servidor Python (tools/relatorio.py) com conta SMTP própria e
// um agendador sempre ligado. No portal:
//
//   - o CONTEÚDO é montado no navegador (legado/painelEmails.js);
//   - cada e-mail vira uma linha em dgt_implemail (status Pendente) e
//     um fluxo do Power Automate envia;
//   - a RECORRÊNCIA é conferida por quem está com o painel aberto
//     (Editor, Gestor ou Administrador). Uma trava no Dataverse
//     (relatorioEnvios/<horário>) garante um único envio por horário.
//
// Configuração: documento config/relatorio (só o Administrador do
// módulo altera). Registro dos envios: coleção relatorioEnvios.
// ============================================================

type Registro = Record<string, unknown>;

interface IRecorrencia {
  freq: string;
  dias: number[];
  diaMes: number;
  hora: string;
  ancora?: string;
}

const PERFIS_PORTAL = [
  { id: 'Administrador', nome: 'Administrador' },
  { id: 'Gestor', nome: 'Gestor' },
  { id: 'Editor', nome: 'Editor' },
  { id: 'Funcionario', nome: 'Colaborador' }
];

const RECORRENCIA_PADRAO: IRecorrencia = {
  freq: 'semanal',
  dias: [0],
  diaMes: 1,
  hora: '07:00'
};

const TIPO_PADRAO: Record<string, Registro> = {
  pendencias: { ativo: false, perfis: [], usuarios: [], extras: [] },
  gerencial: { ativo: false, perfis: ['Administrador', 'Gestor'], usuarios: [], extras: [] },
  cronogramas: {
    ativo: false,
    perfis: [],
    usuarios: [],
    extras: [],
    projetos: undefined,
    conteudo: 'resumo',
    alocados: false,
    clientes: true
  }
};

const dois = (n: number): string => (n < 10 ? '0' : '') + n;

const dataIso = (d: Date): string =>
  `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

// Segunda = 0 ... domingo = 6 (como no painel).
const diaDaSemana = (d: Date): number => (d.getDay() + 6) % 7;

// Número da semana (segunda a domingo) contado de uma data fixa.
const indiceDaSemana = (d: Date): number => {
  const meiaNoite = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((meiaNoite.getTime() - new Date(2024, 0, 1).getTime()) / 864e5);
  return Math.floor(dias / 7);
};

const semAcento = (valor: unknown): string =>
  String(valor || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const perfilDoRotulo = (rotulo: unknown): string => {
  const r = semAcento(rotulo);
  if (r.indexOf('admin') === 0) { return 'Administrador'; }
  if (r.indexOf('gestor') === 0) { return 'Gestor'; }
  if (r.indexOf('editor') === 0) { return 'Editor'; }
  return 'Funcionario';
};

const normalizarRecorrencia = (tipo: Registro): IRecorrencia => {

  const atual = tipo.recorrencia as Partial<IRecorrencia> | undefined;

  if (atual && atual.freq) {
    return {
      freq: String(atual.freq),
      dias: Array.isArray(atual.dias) ? atual.dias.map(Number).filter(n => n >= 0 && n <= 6) : [0],
      diaMes: Math.max(1, Math.min(31, Number(atual.diaMes) || 1)),
      hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(atual.hora || '')) ? String(atual.hora) : '07:00',
      ancora: atual.ancora ? String(atual.ancora) : undefined
    };
  }

  // Programação antiga do painel: lista de { dia, hora }.
  const horarios = Array.isArray(tipo.horarios) ? tipo.horarios as Registro[] : [];

  if (horarios.length > 0) {
    const dias: number[] = [];
    horarios.forEach(h => {
      const dia = Number(h.dia);
      if (dia >= 0 && dia <= 6 && dias.indexOf(dia) < 0) {
        dias.push(dia);
      }
    });
    return { freq: 'semanal', dias, diaMes: 1, hora: String(horarios[0].hora || '07:00') };
  }

  return { ...RECORRENCIA_PADRAO, dias: RECORRENCIA_PADRAO.dias.slice() };
};

// O envio deste tipo vence hoje? Devolve a hora marcada (Date) ou undefined.
export const horarioDeHoje = (
  recorrencia: IRecorrencia,
  agora: Date
): Date | undefined => {

  const dia = diaDaSemana(agora);
  let vale = false;

  if (recorrencia.freq === 'diaria') {
    vale = dia <= 4;
  } else if (recorrencia.freq === 'semanal') {
    vale = recorrencia.dias.indexOf(dia) >= 0;
  } else if (recorrencia.freq === 'quinzenal') {
    const ancora = recorrencia.ancora ? new Date(`${recorrencia.ancora}T00:00:00`) : agora;
    vale = recorrencia.dias.indexOf(dia) >= 0 &&
      Math.abs(indiceDaSemana(agora) - indiceDaSemana(ancora)) % 2 === 0;
  } else if (recorrencia.freq === 'mensal') {
    const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    vale = agora.getDate() === Math.min(recorrencia.diaMes, ultimo);
  }

  if (!vale) {
    return undefined;
  }

  const partes = recorrencia.hora.split(':');

  return new Date(
    agora.getFullYear(), agora.getMonth(), agora.getDate(),
    Number(partes[0]) || 0, Number(partes[1]) || 0, 0, 0
  );
};

const descreverRecorrencia = (r: IRecorrencia): string => {
  const nomes = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const dias = r.dias.slice().sort().map(d => nomes[d]).join(', ');
  if (r.freq === 'diaria') { return `diário ${r.hora}`; }
  if (r.freq === 'quinzenal') { return `quinzenal ${dias} ${r.hora}`; }
  if (r.freq === 'mensal') { return `mensal dia ${r.diaMes} ${r.hora}`; }
  return `semanal ${dias} ${r.hora}`;
};

export class RelatorioImplantacoes {

  private readonly dataverse: DataverseService;
  private readonly base: BaseImplantacoes;
  private readonly sessao: ISessaoPainel;
  private readonly linkPadrao: string;

  private usuarios: IUsuarioEmail[] | undefined;
  private conferindo: boolean = false;

  public constructor(
    dataverse: DataverseService,
    base: BaseImplantacoes,
    sessao: ISessaoPainel,
    linkPadrao: string
  ) {
    this.dataverse = dataverse;
    this.base = base;
    this.sessao = sessao;
    this.linkPadrao = linkPadrao;
  }

  // ----------------------------------------------------------
  // Configuração
  // ----------------------------------------------------------

  private documento(): Registro {
    return ((this.base.balde(BALDE_RAIZ).config || {}).relatorio || {}) as DocumentoPainel;
  }

  private tipos(): Record<string, Registro> {

    const salvos = (this.documento().tipos || {}) as Record<string, Registro>;
    const tipos: Record<string, Registro> = {};

    TIPOS_EMAIL.forEach(par => {
      const chave = par[0];
      const tipo: Registro = { ...TIPO_PADRAO[chave], ...(salvos[chave] || {}) };
      tipo.recorrencia = normalizarRecorrencia(tipo);
      // "todos os projetos" é gravado como null no painel.
      if (chave === 'cronogramas' && !Array.isArray(tipo.projetos)) {
        tipo.projetos = null; // eslint-disable-line @rushstack/no-new-null
      }
      if (!Array.isArray(tipo.perfis)) {
        tipo.perfis = [];
      }
      delete tipo.horarios;
      tipos[chave] = tipo;
    });

    return tipos;
  }

  private link(): string {
    return String(this.documento().link || this.linkPadrao || '');
  }

  private enviados(): Registro[] {

    const mapa = (this.base.balde(BALDE_RAIZ).relatorioEnvios || {}) as Record<string, Registro>;

    return Object.keys(mapa)
      .map(chave => mapa[chave])
      .filter(item => !!item && !!item.em)
      .sort((a, b) => String(a.em) < String(b.em) ? 1 : String(a.em) > String(b.em) ? -1 : 0)
      .slice(0, 30);
  }

  // Usuários ativos do portal com o módulo Implantações liberado.
  private async carregarUsuarios(): Promise<IUsuarioEmail[]> {

    if (this.usuarios) {
      return this.usuarios;
    }

    const registros =
      await this.dataverse.listarRegistros(
        'dgt_usuario',
        '$select=dgt_usuarioid,dgt_name,dgt_email,dgt_perfilacesso,dgt_modulosacesso&$filter=dgt_ativo eq true&$orderby=dgt_name asc'
      );

    this.usuarios =
      registros
        .map(registro => {
          const perfil = perfilDoRotulo(
            registro['dgt_perfilacesso@OData.Community.Display.V1.FormattedValue']
          );
          return {
            id: String(registro.dgt_usuarioid || ''),
            nome: String(registro.dgt_name || ''),
            email: String(registro.dgt_email || '').trim(),
            perfil,
            liberado: moduloLiberado(perfil, lerModulosAcesso(registro.dgt_modulosacesso), 'implantacoes')
          };
        })
        .filter(usuario => usuario.liberado && !!usuario.email)
        .map(usuario => ({ id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil }));

    return this.usuarios;
  }

  // ----------------------------------------------------------
  // Envio (fila dgt_implemail)
  // ----------------------------------------------------------

  private async enfileirar(
    tipo: string,
    motivo: string,
    soPara?: { nome: string; email: string }
  ): Promise<Registro> {

    const usuarios = await this.carregarUsuarios();

    const montado =
      montarEmails(
        this.base.todosOsBaldes(),
        this.tipos(),
        tipo,
        usuarios,
        this.link(),
        soPara,
        new Date()
      );

    const falhas: string[] = [];
    let enviados = 0;

    for (let i = 0; i < montado.emails.length; i++) {

      const email = montado.emails[i];
      const linha: Registro = {};

      linha[IMPL_EMAIL.assunto] = email.assunto.substring(0, 200);
      linha[IMPL_EMAIL.para] = email.para;
      linha[IMPL_EMAIL.corpo] = email.html;
      linha[IMPL_EMAIL.tipo] = tipo;
      linha[IMPL_EMAIL.motivo] = motivo.substring(0, 200);
      linha[IMPL_EMAIL.status] = STATUS_EMAIL_PENDENTE;

      try {
        await this.dataverse.criarRegistro(TABELA_IMPL_EMAIL, linha);
        enviados++;
      } catch (erro) {
        falhas.push(`${email.para}: ${(erro instanceof Error ? erro.message : String(erro)).substring(0, 120)}`);
      }
    }

    return {
      em: new Date().toISOString(),
      tipo,
      motivo,
      enviados,
      pulados: montado.pulados,
      falhas: falhas.slice(0, 10),
      por: this.sessao.usuario.nome
    };
  }

  // Registra o envio (aparece em "Últimos envios").
  private async registrar(id: string, registro: Registro): Promise<void> {
    await (this.base.doc(`relatorioEnvios/${id}`)).set(registro);
  }

  private idAvulso(tipo: string): string {
    return `${tipo}-${new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 14)}-${Math.random().toString(36).substring(2, 6)}`;
  }

  // ----------------------------------------------------------
  // Recorrência: chamado pela página ao abrir e a cada poucos minutos
  // ----------------------------------------------------------

  public async conferirAgendados(): Promise<void> {

    if (this.conferindo || !podeNoPainel(this.sessao.perms, 'projetos', 'editar')) {
      return;
    }

    this.conferindo = true;

    try {

      const agora = new Date();
      const tipos = this.tipos();
      const devidos: Array<{ tipo: string; id: string; motivo: string }> = [];

      TIPOS_EMAIL.forEach(par => {

        const tipo = tipos[par[0]];

        if (!tipo.ativo) {
          return;
        }

        const recorrencia = tipo.recorrencia as IRecorrencia;
        const alvo = horarioDeHoje(recorrencia, agora);

        if (alvo && alvo.getTime() <= agora.getTime()) {
          devidos.push({
            tipo: par[0],
            id: `${par[0]}-${dataIso(agora)}-${recorrencia.hora.replace(':', '')}`,
            motivo: `agendado · ${descreverRecorrencia(recorrencia)}`
          });
        }
      });

      if (devidos.length === 0) {
        return;
      }

      // Confere o que os outros já enviaram antes de tentar a trava.
      await this.base.sincronizar();

      const feitos = (this.base.balde(BALDE_RAIZ).relatorioEnvios || {}) as Registro;

      for (let i = 0; i < devidos.length; i++) {

        const devido = devidos[i];

        if (feitos[devido.id]) {
          continue;
        }

        const minha =
          await this.base.criarExclusivo(
            'relatorioEnvios',
            devido.id,
            { tipo: devido.tipo, motivo: devido.motivo, situacao: 'enviando', por: this.sessao.usuario.nome }
          );

        if (!minha) {
          continue;
        }

        try {
          await this.registrar(devido.id, await this.enfileirar(devido.tipo, devido.motivo));
        } catch (erro) {
          await this.registrar(devido.id, {
            em: new Date().toISOString(),
            tipo: devido.tipo,
            motivo: devido.motivo,
            enviados: 0,
            pulados: 0,
            falhas: [(erro instanceof Error ? erro.message : String(erro)).substring(0, 200)]
          });
        }
      }

    } finally {
      this.conferindo = false;
    }
  }

  // ----------------------------------------------------------
  // Rotas do painel (api/admin/relatorio...)
  // ----------------------------------------------------------

  public rota: RotaPainel = async (caminho, corpo, consulta) => {

    if (caminho !== 'api/admin/relatorio' && caminho !== 'api/admin/relatorio/previa') {
      return undefined;
    }

    if (!podeNoPainel(this.sessao.perms, 'relatorio', 'administrar')) {
      return { status: 403, corpo: { erro: 'Só o Administrador do módulo configura os e-mails.' } };
    }

    const tipos = this.tipos();

    if (caminho === 'api/admin/relatorio/previa') {

      const tipo = (/(?:^|&)tipo=([a-z]+)/.exec(consulta) || [])[1] || 'pendencias';

      return {
        status: 200,
        corpo: previaDoEmail(
          this.base.todosOsBaldes(),
          tipos,
          tipo,
          this.link(),
          this.sessao.usuario.nome,
          /(?:^|&)cliente=1/.test(consulta),
          new Date()
        )
      };
    }

    const acao = String(corpo.acao || '');
    const tipo = String(corpo.tipo || '');

    if (acao === 'salvar') {

      const recebidos = (corpo.tipos || {}) as Record<string, Registro>;
      const novos: Record<string, Registro> = {};

      TIPOS_EMAIL.forEach(par => {
        const chave = par[0];
        const novo: Registro = { ...tipos[chave], ...(recebidos[chave] || {}) };
        const recorrencia = normalizarRecorrencia(novo);
        const anterior = tipos[chave].recorrencia as IRecorrencia;
        // Quinzenal: as quinzenas contam a partir da semana em que foi configurado.
        if (recorrencia.freq === 'quinzenal') {
          recorrencia.ancora = anterior.freq === 'quinzenal' && anterior.ancora ? anterior.ancora : dataIso(new Date());
        } else {
          delete recorrencia.ancora;
        }
        novo.recorrencia = recorrencia;
        delete novo.horarios;
        novos[chave] = novo;
      });

      await this.base.doc('config/relatorio').set({
        tipos: novos,
        link: String(corpo.link || '').trim()
      });

      return { status: 200, corpo: { ok: true } };
    }

    if (acao === 'teste' || acao === 'enviar') {

      if (!tipos[tipo]) {
        return { status: 400, corpo: { erro: 'Tipo de envio desconhecido.' } };
      }

      const teste = acao === 'teste';

      if (teste && !this.sessao.usuario.email) {
        return { status: 400, corpo: { erro: 'Seu cadastro no portal não tem e-mail.' } };
      }

      const registro =
        await this.enfileirar(
          tipo,
          teste ? `teste para ${this.sessao.usuario.email}` : `enviar agora · ${this.sessao.usuario.nome}`,
          teste ? { nome: this.sessao.usuario.nome, email: this.sessao.usuario.email } : undefined
        );

      await this.registrar(this.idAvulso(tipo), registro);

      const falhas = registro.falhas as string[];

      if (Number(registro.enviados) === 0 && falhas.length > 0) {
        return { status: 502, corpo: { erro: `Não foi possível colocar os e-mails na fila: ${falhas[0]}` } };
      }

      return {
        status: 200,
        corpo: { ...registro, para: this.sessao.usuario.email }
      };
    }

    // Leitura da configuração (abre a aba).
    const usuarios = await this.carregarUsuarios();
    const dados = dadosDosEmails(this.base.todosOsBaldes(), tipos, usuarios);

    return {
      status: 200,
      corpo: {
        cfg: { tipos, enviados: this.enviados() },
        usuarios: usuarios.map(usuario => ({ ...usuario, ativo: true })),
        perfis: PERFIS_PORTAL,
        projetos: dados.projetos,
        tiposNomes: TIPOS_EMAIL,
        destinatarios: dados.destinatarios,
        email: { configurado: true, conta: 'fila do Portal DGT', host: 'Power Automate' },
        link: this.link()
      }
    };
  };
}
