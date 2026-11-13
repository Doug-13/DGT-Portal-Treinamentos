import {
  DataverseService
} from '../DataverseService';

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
  COLECAO_PERFIS,
  COLECAO_SETORES,
  COLECAO_USUARIOS,
  IAcessos,
  ISessaoPainel,
  completarAcessos,
  podeNoPainel
} from './permissoesImplantacoes';

import {
  HistoricoImplantacoes
} from './HistoricoImplantacoes';

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

// Recorrência de cada envio:
//   diaria     segunda a sexta, na hora "hora"
//   semanal    nos dias marcados, cada um com a sua hora (ex.: seg 09:00, sex 17:00)
//   quinzenal  igual à semanal, semana sim, semana não (a partir de "ancora")
//   mensal     em um ou mais dias do mês, cada um com a sua hora (dia 31 = último dia)
export interface IHorarioDia {
  dia: number;
  hora: string;
}

export interface IRecorrencia {
  freq: string;
  hora: string;
  semana: IHorarioDia[];
  mes: IHorarioDia[];
  ancora?: string;
}

const HORA_OK = /^([01]\d|2[0-3]):[0-5]\d$/;

const PERFIS_LEGADOS: Record<string, string> = {
  // Configuração salva antes da gestão de acessos do próprio painel
  // (perfis do portal) → perfis do painel.
  Administrador: 'administrador',
  Gestor: 'gestor',
  Editor: 'colaborador',
  Funcionario: 'consulta'
};

const TIPO_PADRAO: Record<string, Registro> = {
  pendencias: { ativo: false, perfis: [], usuarios: [], extras: [] },
  gerencial: { ativo: false, perfis: ['administrador', 'gestor'], usuarios: [], extras: [] },
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

const hora = (valor: unknown, padrao: string): string =>
  HORA_OK.test(String(valor || '')) ? String(valor) : padrao;

const horarios = (lista: unknown, min: number, max: number): IHorarioDia[] => {
  const saida: IHorarioDia[] = [];
  (Array.isArray(lista) ? lista as Registro[] : []).forEach(h => {
    const dia = Math.round(Number(h && h.dia));
    if (dia >= min && dia <= max && !saida.some(x => x.dia === dia)) {
      saida.push({ dia, hora: hora(h.hora, '07:00') });
    }
  });
  return saida.sort((a, b) => a.dia - b.dia);
};

export const normalizarRecorrencia = (tipo: Registro): IRecorrencia => {

  const atual = (tipo.recorrencia || {}) as Registro;

  if (atual.freq) {

    const horaGeral = hora(atual.hora, '07:00');
    let semana = horarios(atual.semana, 0, 6);
    let mes = horarios(atual.mes, 1, 31);

    // Formato anterior: dias [n] + hora única; diaMes + hora única.
    if (!semana.length && Array.isArray(atual.dias)) {
      semana = horarios((atual.dias as unknown[]).map(dia => ({ dia, hora: horaGeral })), 0, 6);
    }
    if (!mes.length && atual.diaMes) {
      mes = horarios([{ dia: atual.diaMes, hora: horaGeral }], 1, 31);
    }

    return {
      freq: ['diaria', 'semanal', 'quinzenal', 'mensal'].indexOf(String(atual.freq)) >= 0 ? String(atual.freq) : 'semanal',
      hora: horaGeral,
      semana: semana.length ? semana : [{ dia: 0, hora: horaGeral }],
      mes: mes.length ? mes : [{ dia: 1, hora: horaGeral }],
      ancora: atual.ancora ? String(atual.ancora) : undefined
    };
  }

  // Programação do app original: lista de { dia, hora }.
  const antigos = horarios(tipo.horarios, 0, 6);

  return {
    freq: 'semanal',
    hora: antigos.length ? antigos[0].hora : '07:00',
    semana: antigos.length ? antigos : [{ dia: 0, hora: '07:00' }],
    mes: [{ dia: 1, hora: '07:00' }]
  };
};

// Horários em que o envio vence HOJE (zero, um ou mais).
export const horariosDeHoje = (
  recorrencia: IRecorrencia,
  agora: Date
): string[] => {

  const dia = diaDaSemana(agora);

  if (recorrencia.freq === 'diaria') {
    return dia <= 4 ? [recorrencia.hora] : [];
  }

  if (recorrencia.freq === 'semanal' || recorrencia.freq === 'quinzenal') {
    if (recorrencia.freq === 'quinzenal') {
      const ancora = recorrencia.ancora ? new Date(`${recorrencia.ancora}T00:00:00`) : agora;
      if (Math.abs(indiceDaSemana(agora) - indiceDaSemana(ancora)) % 2 !== 0) {
        return [];
      }
    }
    return recorrencia.semana.filter(h => h.dia === dia).map(h => h.hora);
  }

  if (recorrencia.freq === 'mensal') {
    // Dia maior que o mês (ex.: 31 em novembro) = último dia do mês.
    const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    return recorrencia.mes.filter(h => Math.min(h.dia, ultimo) === agora.getDate()).map(h => h.hora);
  }

  return [];
};

const NOMES_DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export const descreverRecorrencia = (r: IRecorrencia): string => {
  if (r.freq === 'diaria') { return `diário (seg a sex) ${r.hora}`; }
  if (r.freq === 'mensal') { return `mensal ${r.mes.map(h => `dia ${h.dia} ${h.hora}`).join(', ')}`; }
  return `${r.freq} ${r.semana.map(h => `${NOMES_DIAS[h.dia]} ${h.hora}`).join(', ')}`;
};

export class RelatorioImplantacoes {

  private readonly dataverse: DataverseService;
  private readonly base: BaseImplantacoes;
  private readonly sessao: ISessaoPainel;
  private readonly linkPadrao: string;
  private readonly historico: HistoricoImplantacoes | undefined;

  private conferindo: boolean = false;

  public constructor(
    dataverse: DataverseService,
    base: BaseImplantacoes,
    sessao: ISessaoPainel,
    linkPadrao: string,
    historico?: HistoricoImplantacoes
  ) {
    this.dataverse = dataverse;
    this.base = base;
    this.sessao = sessao;
    this.linkPadrao = linkPadrao;
    this.historico = historico;
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
      tipo.perfis = (tipo.perfis as string[]).map(p => PERFIS_LEGADOS[p] || p);
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

  // Usuários ativos do PAINEL (Configurações › Gestão de usuários) com e-mail.
  private acessos(): IAcessos {
    const raiz = this.base.balde(BALDE_RAIZ);
    return completarAcessos({
      usuarios: (raiz[COLECAO_USUARIOS] || {}) as unknown as IAcessos['usuarios'],
      setores: (raiz[COLECAO_SETORES] || {}) as unknown as IAcessos['setores'],
      perfis: (raiz[COLECAO_PERFIS] || {}) as unknown as IAcessos['perfis']
    });
  }

  private async carregarUsuarios(): Promise<IUsuarioEmail[]> {
    const acessos = this.acessos();
    return Object.keys(acessos.usuarios)
      .filter(k => acessos.usuarios[k].ativo && !!String(acessos.usuarios[k].email || '').trim())
      .map(k => ({
        id: k,
        nome: acessos.usuarios[k].nome,
        email: String(acessos.usuarios[k].email).trim(),
        perfil: acessos.usuarios[k].perfil
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
        const agoraHM = `${dois(agora.getHours())}:${dois(agora.getMinutes())}`;

        horariosDeHoje(recorrencia, agora)
          .filter(h => h <= agoraHM)
          .forEach(h => {
            devidos.push({
              tipo: par[0],
              id: `${par[0]}-${dataIso(agora)}-${h.replace(':', '')}`,
              motivo: `agendado · ${h} · ${descreverRecorrencia(recorrencia)}`
            });
          });
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
      return { status: 403, corpo: { erro: 'Só quem administra usuários configura os e-mails.' } };
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

      if (this.historico) {
        this.historico.registrar(
          'relatorio.configurar',
          { tipo: 'relatorio', nome: 'E-mails e relatórios' },
          TIPOS_EMAIL.map(par => `${par[1]}: ${novos[par[0]].ativo ? descreverRecorrencia(novos[par[0]].recorrencia as IRecorrencia) : 'desativado'}`).join(' | ')
        ).catch(() => undefined);
      }

      return { status: 200, corpo: { ok: true } };
    }

    if (acao === 'teste' || acao === 'enviar') {

      if (!tipos[tipo]) {
        return { status: 400, corpo: { erro: 'Tipo de envio desconhecido.' } };
      }

      const teste = acao === 'teste';

      if (teste && !this.sessao.usuario.email) {
        return { status: 400, corpo: { erro: 'Seu cadastro não tem e-mail.' } };
      }

      const registro =
        await this.enfileirar(
          tipo,
          teste ? `teste para ${this.sessao.usuario.email}` : `enviar agora · ${this.sessao.usuario.nome}`,
          teste ? { nome: this.sessao.usuario.nome, email: this.sessao.usuario.email } : undefined
        );

      await this.registrar(this.idAvulso(tipo), registro);

      if (this.historico) {
        this.historico.registrar(
          teste ? 'relatorio.teste' : 'relatorio.enviar',
          { tipo: 'relatorio', id: tipo, nome: (TIPOS_EMAIL.filter(par => par[0] === tipo)[0] || [tipo, tipo])[1] },
          `${registro.enviados} e-mail(s) na fila`
        ).catch(() => undefined);
      }

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
        perfis: Object.keys(this.acessos().perfis).map(k => ({ id: k, nome: this.acessos().perfis[k].nome })),
        projetos: dados.projetos,
        tiposNomes: TIPOS_EMAIL,
        destinatarios: dados.destinatarios,
        email: { configurado: true, conta: 'fila do Portal DGT', host: 'Power Automate' },
        link: this.link()
      }
    };
  };
}
