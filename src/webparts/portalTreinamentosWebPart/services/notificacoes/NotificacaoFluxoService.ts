import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  AreaAdminService,
  IUsuarioAreaAdmin
} from '../AreaAdminService';

import {
  IResponsavelResolvido
} from '../../models/Fluxo';

import {
  usuarioAtende
} from '../fluxo/ResolvedorResponsaveis';

import {
  CanalNotificacao,
  IDadosMensagemNotificacao,
  IDespachanteNotificacoes,
  IDestinatarioNotificacao,
  INotificacaoSolicitada,
  emailsDoTexto,
  montarTextoNotificacao
} from '../fluxo/notificacaoFluxo';

// ============================================================
// NOTIFICAÇÕES DO FLUXO → FILA DE E-MAILS EXISTENTE (dgt_implemail)
//
// Não cria tabela nova: aproveita a fila do painel de Implantações.
// Uma linha POR DESTINATÁRIO E POR CANAL (dgt_para tem 320 caracteres e
// assim ninguém vê o e-mail dos outros):
//
//   E-mail → dgt_status "Pendente": enviado pelo fluxo de e-mail que JÁ
//            existe (docs/implantacoes.md), sem nenhuma alteração nele.
//   Teams  → dgt_status "PendenteTeams": o fluxo de e-mail não pega
//            (filtra 'Pendente'); quem envia é o fluxo
//            "DGT - Notificações Teams" (docs/notificacoes-fluxo.md).
//
// dgt_tipo = "notificacaoFluxo" identifica as linhas; dgt_motivo guarda
// a chave do pedido + canal + destinatário (não envia duas vezes).
//
// Nenhuma credencial passa pelo portal: o envio usa as conexões do
// Power Automate.
// ============================================================

export const TABELA_FILA_EMAIL = 'dgt_implemail';

export const COL_FILA_EMAIL = {
  id: 'dgt_implemailid',
  assunto: 'dgt_name',
  para: 'dgt_para',
  corpo: 'dgt_corpo',
  tipo: 'dgt_tipo',
  motivo: 'dgt_motivo',
  status: 'dgt_status'
};

export const TIPO_NOTIFICACAO_FLUXO = 'notificacaoFluxo';
export const STATUS_PENDENTE_EMAIL = 'Pendente';
export const STATUS_PENDENTE_TEAMS = 'PendenteTeams';

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (registro: IDataverseRecord, campo: string): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

const mensagemErro = (erro: unknown): string =>
  (erro instanceof Error ? erro.message : String(erro));

const explicar = (erro: unknown): Error =>
  /403|privilege|prvCreate|permiss/i.test(mensagemErro(erro))
    ? new Error('Sem permissão para gravar na fila de e-mails (dgt_implemail). Peça ao administrador o privilégio Criar nessa tabela.')
    : erro instanceof Error ? erro : new Error(String(erro));

// Chave curta e estável (dgt_motivo tem 200 caracteres).
const resumo = (valor: string): string => {
  let a = 5381;
  let b = 52711;
  for (let i = 0; i < valor.length; i++) {
    const c = valor.charCodeAt(i);
    a = ((a * 33) ^ c) >>> 0;
    b = ((b * 31) ^ c) >>> 0;
  }
  return a.toString(36) + b.toString(36);
};

const escaparHtml = (valor: string): string =>
  valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Mensagem em texto → corpo HTML (a fila envia o corpo como HTML).
// Links viram clicáveis; quebras de linha viram <br>.
export const mensagemEmHtml = (mensagem: string): string => {
  const texto = escaparHtml(mensagem || '')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\r?\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#202A44">${texto}</div>`;
};

// Limites das colunas (ver o script de criação).
const corte = (valor: string, maximo: number): string =>
  valor.length > maximo ? `${valor.slice(0, maximo - 1)}…` : valor;

export class NotificacaoFluxoService implements IDespachanteNotificacoes {

  private readonly dataverse: DataverseService;

  // documento | ambiente | orcamento (só para diagnóstico no console).
  private readonly origem: string;

  private vinculos: IUsuarioAreaAdmin[] | undefined;
  private vinculosLidosEm = 0;

  // false = usuário consultado e sem e-mail (não consulta de novo).
  private readonly usuarios: { [id: string]: IDestinatarioNotificacao | false } = {};

  public constructor(dataverse: DataverseService, origem: string) {
    this.dataverse = dataverse;
    this.origem = origem;
  }

  // ----------------------------------------------------------
  // Registro dos pedidos (chamado pelo FluxoService)
  // ----------------------------------------------------------

  public async registrar(
    pedidos: INotificacaoSolicitada[],
    dados: IDadosMensagemNotificacao
  ): Promise<string[]> {

    const avisos: string[] = [];

    for (const pedido of pedidos) {
      try {
        const aviso = await this.registrarUm(pedido, dados);
        if (aviso) {
          avisos.push(aviso);
        }
      } catch (erro) {
        console.error(erro);
        avisos.push(`Notificação de "${pedido.elementoNome}" não registrada: ${explicar(erro).message}`);
      }
    }

    return avisos;
  }

  private async registrarUm(
    pedido: INotificacaoSolicitada,
    dados: IDadosMensagemNotificacao
  ): Promise<string | undefined> {

    const config = pedido.config;

    // Responsáveis → pessoas (mesma regra das pendências).
    const resolvidos: IResponsavelResolvido[] =
      dados.resolverResponsaveis
        ? dados.resolverResponsaveis(pedido.responsaveisEtapa.concat(config.destinatarios), dados.valores)
        : [];

    const pessoas =
      await this.pessoas(resolvidos);

    const adicionais =
      config.canais.indexOf('email') >= 0 ? emailsDoTexto(config.emailsAdicionais) : [];

    const emailsPessoas =
      pessoas.map(item => item.email.toLowerCase()).filter(Boolean);

    const emails =
      emailsPessoas.concat(adicionais).filter((item, i, lista) => lista.indexOf(item) === i);

    if (emails.length === 0 && pessoas.length === 0) {
      return `Notificação de "${pedido.elementoNome}": nenhum destinatário encontrado (confira os destinatários e o e-mail dos usuários).`;
    }

    // dgt_name (assunto) e dgt_motivo têm 200 caracteres.
    const assunto = corte(montarTextoNotificacao(config.assunto, pedido, dados).replace(/\s+/g, ' ').trim(), 200);
    const corpo = mensagemEmHtml(corte(montarTextoNotificacao(config.mensagem, pedido, dados), 200000));

    const linhas: Array<{ para: string; status: string; canal: CanalNotificacao }> = [];

    if (config.canais.indexOf('email') >= 0) {
      emails.forEach(email => linhas.push({ para: email, status: STATUS_PENDENTE_EMAIL, canal: 'email' }));
    }
    // Teams: só pessoas do portal (e-mails adicionais podem não ser contas Teams).
    if (config.canais.indexOf('teams') >= 0) {
      emailsPessoas.forEach(email => linhas.push({ para: email, status: STATUS_PENDENTE_TEAMS, canal: 'teams' }));
    }

    const base = `nf:${resumo(pedido.chave)}`;

    for (const linha of linhas) {

      const motivo = corte(`${base}:${linha.canal}:${linha.para}`, 200);

      // Idempotente: o mesmo pedido nunca gera duas linhas.
      const existentes = await this.dataverse.listarRegistros(
        TABELA_FILA_EMAIL,
        `$select=${COL_FILA_EMAIL.id}&$filter=${COL_FILA_EMAIL.tipo} eq '${TIPO_NOTIFICACAO_FLUXO}' and ${COL_FILA_EMAIL.motivo} eq '${motivo.replace(/'/g, "''")}'&$top=1`
      );
      if (existentes.length > 0) {
        continue;
      }

      await this.dataverse.criarRegistro(TABELA_FILA_EMAIL, {
        [COL_FILA_EMAIL.assunto]: assunto,
        [COL_FILA_EMAIL.para]: corte(linha.para, 320),
        [COL_FILA_EMAIL.corpo]: corpo,
        [COL_FILA_EMAIL.tipo]: TIPO_NOTIFICACAO_FLUXO,
        [COL_FILA_EMAIL.motivo]: motivo,
        [COL_FILA_EMAIL.status]: linha.status
      });
    }

    console.info(`[notificações] ${linhas.length} envio(s) na fila (${this.origem}) — ${pedido.elementoNome}`);

    return undefined;
  }

  // ----------------------------------------------------------
  // Responsáveis resolvidos → pessoas com e-mail
  // ----------------------------------------------------------

  private async lerVinculos(): Promise<IUsuarioAreaAdmin[]> {
    if (!this.vinculos || Date.now() - this.vinculosLidosEm > 10 * 60 * 1000) {
      try {
        this.vinculos = await new AreaAdminService(this.dataverse).listarUsuariosArea();
      } catch {
        this.vinculos = this.vinculos || [];
      }
      this.vinculosLidosEm = Date.now();
    }
    return this.vinculos;
  }

  private async usuario(id: string): Promise<IDestinatarioNotificacao | undefined> {
    const chave = guid(id);
    if (!chave) {
      return undefined;
    }
    if (this.usuarios[chave] === undefined) {
      try {
        const linhas = await this.dataverse.listarRegistros(
          'dgt_usuario',
          `$select=dgt_usuarioid,dgt_name,dgt_email,dgt_ativo&$filter=dgt_usuarioid eq ${chave}&$top=1`
        );
        const linha = linhas[0];
        this.usuarios[chave] = linha && linha.dgt_ativo !== false && texto(linha, 'dgt_email')
          ? { usuarioId: chave, nome: texto(linha, 'dgt_name'), email: texto(linha, 'dgt_email') }
          : false;
      } catch {
        this.usuarios[chave] = false;
      }
    }
    return this.usuarios[chave] || undefined;
  }

  private async pessoas(resolvidos: IResponsavelResolvido[]): Promise<IDestinatarioNotificacao[]> {

    const lista: IDestinatarioNotificacao[] = [];

    const incluir = (pessoa?: IDestinatarioNotificacao): void => {
      if (pessoa && pessoa.email && !lista.some(item => guid(item.usuarioId) === guid(pessoa.usuarioId))) {
        lista.push(pessoa);
      }
    };

    if (resolvidos.length === 0) {
      return lista;
    }

    const vinculos = await this.lerVinculos();

    // Ids diretos: usuário fixo, pessoas definidas por área, hierarquia já calculada.
    const ids: string[] = [];
    resolvidos.forEach(resolvido => {
      (resolvido.pessoas || []).concat(resolvido.usuariosIds || []).concat(resolvido.usuarioId ? [resolvido.usuarioId] : [])
        .forEach(id => {
          if (guid(id) && ids.indexOf(guid(id)) < 0) {
            ids.push(guid(id));
          }
        });
    });

    // Área / hierarquia: quem atende hoje, pelos vínculos ativos.
    vinculos
      .filter(vinculo => vinculo.ativo && resolvidos.some(resolvido => usuarioAtende(resolvido, vinculo.usuarioId, vinculos)))
      .forEach(vinculo => {
        if (ids.indexOf(guid(vinculo.usuarioId)) < 0) {
          ids.push(guid(vinculo.usuarioId));
        }
      });

    for (const id of ids) {
      const vinculo = vinculos.find(item => guid(item.usuarioId) === id && !!item.usuarioEmail);
      incluir(vinculo
        ? { usuarioId: id, nome: vinculo.usuarioNome, email: vinculo.usuarioEmail }
        : await this.usuario(id));
    }

    return lista;
  }
}
