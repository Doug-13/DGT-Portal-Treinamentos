import {
  DataverseService
} from '../DataverseService';

import {
  BaseImplantacoes,
  DocumentoPainel
} from './BaseImplantacoes';

import {
  BALDE_RAIZ
} from './esquemaImplantacoes';

import {
  HistoricoImplantacoes,
  IAlvoHistorico
} from './HistoricoImplantacoes';

import {
  ACOES,
  CATEGORIAS,
  COLECAO_PERFIS,
  COLECAO_SETORES,
  COLECAO_USUARIOS,
  IAcessos,
  ICadastroPerfil,
  ICadastroSetor,
  ICadastroUsuario,
  ISessaoPainel,
  ORDEM_PERFIS,
  PERFIS_INICIAIS,
  PermissoesPainel,
  RECURSOS,
  SETORES_INICIAIS,
  completarAcessos,
  limparPermissoes,
  podeNoPainel
} from './permissoesImplantacoes';

import {
  RotaPainel
} from './PonteApiImplantacoes';

// ============================================================
// IMPLANTAÇÕES — Configurações: usuários, setores, perfis e histórico
//
// As mesmas regras do app original (tools/auth.py), agora sobre o
// Dataverse e sem senha (a identificação é o login do portal):
//
//   api/admin/resumo      dados da área de Configurações
//   api/admin/usuario     criar / editar / ativar / desativar / excluir
//   api/admin/setor       criar / editar / ativar / desativar / excluir
//   api/admin/perfil      criar / editar / excluir
//   api/admin/historico   consulta do histórico de atividades
//
// Regras mantidas: só quem ADMINISTRA usuários define perfil (além de
// Consulta) e permissões individuais; só um Administrador concede o
// perfil Administrador; ninguém concede a um perfil o que não tem; o
// último administrador ativo não pode ser desativado nem excluído;
// quem já acessou o painel é desativado em vez de excluído (histórico).
// ============================================================

type Registro = Record<string, unknown>;
type Resultado = { status: number; corpo: unknown };

class ErroAdmin extends Error {
  public readonly status: number;
  public constructor(mensagem: string, status?: number) {
    super(mensagem);
    this.status = status || 400;
  }
}

const EMAIL_OK = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;

const agora = (): string => new Date().toISOString();

const novoId = (prefixo: string): string =>
  `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;

const normalizar = (valor: unknown): string =>
  String(valor || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const espacos = (valor: unknown, max: number): string =>
  String(valor || '').split(/\s+/).filter(x => !!x).join(' ').substring(0, max);

const textoPermissoes = (perms: PermissoesPainel): string =>
  Object.keys(perms).filter(k => perms[k].length).map(k => `${k}: ${perms[k].join('/')}`).join(', ') || 'nenhuma';

const iguais = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a || {}) === JSON.stringify(b || {});

export class AdminImplantacoes {

  private readonly dataverse: DataverseService;
  private readonly base: BaseImplantacoes;
  private readonly sessao: ISessaoPainel;
  private readonly historico: HistoricoImplantacoes;

  private portalUsuarios: Array<{ nome: string; email: string }> | undefined;

  public constructor(
    dataverse: DataverseService,
    base: BaseImplantacoes,
    sessao: ISessaoPainel,
    historico: HistoricoImplantacoes
  ) {
    this.dataverse = dataverse;
    this.base = base;
    this.sessao = sessao;
    this.historico = historico;
  }

  // ----------------------------------------------------------
  // Leitura dos cadastros (memória da base, sincronizada)
  // ----------------------------------------------------------

  private acessos(): IAcessos {
    const raiz = this.base.balde(BALDE_RAIZ);
    return completarAcessos({
      usuarios: (raiz[COLECAO_USUARIOS] || {}) as unknown as Record<string, ICadastroUsuario>,
      setores: (raiz[COLECAO_SETORES] || {}) as unknown as Record<string, ICadastroSetor>,
      perfis: (raiz[COLECAO_PERFIS] || {}) as unknown as Record<string, ICadastroPerfil>
    });
  }

  private get perms(): PermissoesPainel {
    return this.sessao.perms;
  }

  private pode(recurso: string, acao?: string): boolean {
    return podeNoPainel(this.perms, recurso, acao);
  }

  private exigir(recurso: string, acao: string): void {
    if (!this.pode(recurso, acao)) {
      throw new ErroAdmin('Você não tem permissão para esta ação.', 403);
    }
  }

  private souTotal(): boolean {
    return this.sessao.usuario.perfil === 'administrador';
  }

  private adminsAtivos(acessos: IAcessos, exceto?: string): string[] {
    return Object.keys(acessos.usuarios).filter(k =>
      k !== exceto &&
      acessos.usuarios[k].ativo &&
      !!(acessos.perfis[acessos.usuarios[k].perfil] || {} as ICadastroPerfil).total
    );
  }

  private gravar(colecao: string, id: string, dados: unknown): Promise<void> {
    return this.base.gravarSistema(colecao, id, dados === undefined ? undefined : dados as DocumentoPainel);
  }

  private registrar(acao: string, alvo: IAlvoHistorico, detalhe?: string): void {
    this.historico.registrar(acao, alvo, detalhe).catch(() => undefined);
  }

  // ----------------------------------------------------------
  // Primeira configuração: setores e perfis iniciais
  // ----------------------------------------------------------

  public async semear(): Promise<void> {

    if (!this.souTotal()) {
      return;
    }

    const raiz = this.base.balde(BALDE_RAIZ);
    const setores = (raiz[COLECAO_SETORES] || {}) as Registro;
    const perfis = (raiz[COLECAO_PERFIS] || {}) as Registro;
    const gravacoes: Array<Promise<void>> = [];

    if (Object.keys(setores).length === 0) {
      SETORES_INICIAIS.forEach(nome => {
        gravacoes.push(this.gravar(COLECAO_SETORES, novoId('set'), { nome, ativo: true, criadoEm: agora() }));
      });
    }

    ORDEM_PERFIS.forEach(k => {
      if (!perfis[k]) {
        gravacoes.push(this.gravar(COLECAO_PERFIS, k, { ...PERFIS_INICIAIS[k], criadoEm: agora() }));
      }
    });

    await Promise.all(gravacoes);
  }

  // Último acesso e evento "acesso.login".
  public async registrarEntrada(): Promise<void> {

    const id = this.sessao.usuario.id;
    const usuario = (this.base.balde(BALDE_RAIZ)[COLECAO_USUARIOS] || {})[id] as unknown as ICadastroUsuario | undefined;

    if (usuario) {
      await this.gravar(COLECAO_USUARIOS, id, { ...usuario, ultimoLogin: agora() });
    }

    this.registrar('acesso.login', { tipo: 'usuario', id, nome: this.sessao.usuario.nome }, usuario ? '' : 'administrador do módulo no portal');
  }

  // ----------------------------------------------------------
  // Usuários do portal (sugestões no cadastro)
  // ----------------------------------------------------------

  private async listarPortal(): Promise<Array<{ nome: string; email: string }>> {

    if (this.portalUsuarios) {
      return this.portalUsuarios;
    }

    try {
      const registros =
        await this.dataverse.listarRegistros(
          'dgt_usuario',
          '$select=dgt_name,dgt_email&$filter=dgt_ativo eq true&$orderby=dgt_name asc'
        );
      this.portalUsuarios =
        registros
          .map(r => ({ nome: String(r.dgt_name || ''), email: String(r.dgt_email || '').trim() }))
          .filter(u => !!u.email);
    } catch {
      this.portalUsuarios = [];
    }

    return this.portalUsuarios;
  }

  // ----------------------------------------------------------
  // Resumo (abre Configurações)
  // ----------------------------------------------------------

  private publico(acessos: IAcessos, id: string, u: ICadastroUsuario): Registro {
    const setor = acessos.setores[u.setor];
    const perfil = acessos.perfis[u.perfil];
    return {
      id,
      nome: u.nome || '',
      email: u.email || '',
      setor: u.setor || '',
      setorNome: setor ? setor.nome : '',
      perfil: u.perfil || '',
      perfilNome: perfil ? perfil.nome : '',
      ativo: !!u.ativo,
      bloqueado: false,
      trocarSenha: false,
      perms: u.perms || {},
      criadoEm: u.criadoEm || '',
      criadoPor: u.criadoPor || '',
      atualizadoEm: u.atualizadoEm || '',
      atualizadoPor: u.atualizadoPor || '',
      ultimoLogin: u.ultimoLogin || ''
    };
  }

  private async resumo(): Promise<Registro> {

    const acessos = this.acessos();
    const saida: Registro = {
      recursos: RECURSOS,
      acoes: ACOES,
      categorias: CATEGORIAS
    };

    if (this.pode('usuarios') || this.pode('setores') || this.pode('perfis')) {

      const porSetor: Record<string, number> = {};
      const porPerfil: Record<string, number> = {};

      Object.keys(acessos.usuarios).forEach(k => {
        const u = acessos.usuarios[k];
        porSetor[u.setor] = (porSetor[u.setor] || 0) + 1;
        porPerfil[u.perfil] = (porPerfil[u.perfil] || 0) + 1;
      });

      saida.setores = Object.keys(acessos.setores).map(k => ({
        id: k,
        nome: acessos.setores[k].nome,
        ativo: acessos.setores[k].ativo !== false,
        usuarios: porSetor[k] || 0
      })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

      const ordem = (k: string): number => {
        const i = ORDEM_PERFIS.indexOf(k);
        return i < 0 ? 99 : i;
      };

      saida.perfis = Object.keys(acessos.perfis)
        .sort((a, b) => ordem(a) - ordem(b) || acessos.perfis[a].nome.localeCompare(acessos.perfis[b].nome, 'pt-BR'))
        .map(k => ({
          id: k,
          nome: acessos.perfis[k].nome,
          descricao: acessos.perfis[k].descricao || '',
          perms: acessos.perfis[k].perms || {},
          sistema: !!acessos.perfis[k].sistema,
          total: !!acessos.perfis[k].total,
          usuarios: porPerfil[k] || 0
        }));
    }

    if (this.pode('usuarios')) {
      saida.usuarios = Object.keys(acessos.usuarios).map(k => this.publico(acessos, k, acessos.usuarios[k]));
      saida.pedidos = [];
      if (this.pode('usuarios', 'criar') || this.pode('usuarios', 'editar')) {
        saida.portalUsuarios = await this.listarPortal();
      }
    }

    if (this.pode('historico')) {
      saida.nomesUsuarios = Object.keys(acessos.usuarios).map(k => ({ id: k, nome: acessos.usuarios[k].nome }));
    }

    return saida;
  }

  // ----------------------------------------------------------
  // Usuários
  // ----------------------------------------------------------

  private async usuario(d: Registro): Promise<Registro> {

    const acessos = this.acessos();
    const U = acessos.usuarios;
    const acao = String(d.acao || '');
    let uid = String(d.id || '');
    const alvo = U[uid];
    const eu = this.sessao.usuario.id;

    if (acao !== 'criar' && !alvo) {
      throw new ErroAdmin('Usuário não encontrado.', 404);
    }

    const R: IAlvoHistorico = { tipo: 'usuario', id: uid, nome: alvo ? alvo.nome : '' };
    const perfilTotal = (pid: string): boolean => !!(acessos.perfis[pid] || {} as ICadastroPerfil).total;

    if (acao === 'criar' || acao === 'editar') {

      this.exigir('usuarios', acao);

      const nome = espacos(d.nome, 120);
      const email = String(d.email || '').trim().toLowerCase();
      const setor = String(d.setor || '');
      const perfil = String(d.perfil || '');

      if (nome.length < 3) {
        throw new ErroAdmin('Informe o nome completo.');
      }
      if (!EMAIL_OK.test(email)) {
        throw new ErroAdmin('E-mail inválido.');
      }
      if (Object.keys(U).some(k => k !== uid && String(U[k].email || '').toLowerCase() === email)) {
        throw new ErroAdmin('Já existe um usuário com este e-mail.', 409);
      }
      if (!acessos.setores[setor]) {
        throw new ErroAdmin('Escolha um setor.');
      }
      if (acao === 'criar' && acessos.setores[setor].ativo === false) {
        throw new ErroAdmin('Este setor está inativo.');
      }
      if (!acessos.perfis[perfil]) {
        throw new ErroAdmin('Escolha um perfil.');
      }

      const mudaPerfil = acao === 'criar' || perfil !== alvo.perfil;
      const perms = Object.prototype.hasOwnProperty.call(d, 'perms') ? limparPermissoes(d.perms) : (alvo ? alvo.perms || {} : {});
      const mudaPerms = !iguais(perms, alvo ? alvo.perms || {} : {});

      if (((mudaPerfil && perfil !== 'consulta') || mudaPerms) && !this.pode('usuarios', 'administrar')) {
        throw new ErroAdmin('Só quem administra usuários pode definir perfil e permissões.', 403);
      }
      if ((perfilTotal(perfil) || (alvo && perfilTotal(alvo.perfil))) && !this.souTotal()) {
        throw new ErroAdmin('Só um administrador pode conceder ou alterar o perfil Administrador.', 403);
      }

      if (acao === 'criar') {
        const ativo = d.ativo !== false;
        uid = novoId('usr');
        await this.gravar(COLECAO_USUARIOS, uid, {
          nome, email, setor, perfil, perms, ativo,
          criadoEm: agora(), criadoPor: eu, atualizadoEm: agora(), atualizadoPor: eu
        });
        this.registrar('usuario.criar', { tipo: 'usuario', id: uid, nome },
          `${email} · setor ${acessos.setores[setor].nome} · perfil ${acessos.perfis[perfil].nome}${ativo ? '' : ' · inativo'}`);
        return { id: uid };
      }

      if (uid === eu && perfilTotal(alvo.perfil) && !perfilTotal(perfil) && this.adminsAtivos(acessos, uid).length === 0) {
        throw new ErroAdmin('Você é o único administrador ativo: não pode sair do perfil Administrador.');
      }

      const mudancas: string[] = [];
      if (nome !== alvo.nome) {
        mudancas.push(`nome: ${alvo.nome} → ${nome}`);
      }
      if (email !== String(alvo.email || '').toLowerCase()) {
        mudancas.push(`e-mail: ${alvo.email} → ${email}`);
      }

      await this.gravar(COLECAO_USUARIOS, uid, {
        ...alvo, nome, email, setor, perfil, perms, atualizadoEm: agora(), atualizadoPor: eu
      });

      R.nome = nome;
      if (mudancas.length) {
        this.registrar('usuario.editar', R, mudancas.join('; '));
      }
      if (setor !== alvo.setor) {
        this.registrar('usuario.setor', R, `${(acessos.setores[alvo.setor] || {} as ICadastroSetor).nome || '–'} → ${acessos.setores[setor].nome}`);
      }
      if (perfil !== alvo.perfil) {
        this.registrar('usuario.perfil', R, `${(acessos.perfis[alvo.perfil] || {} as ICadastroPerfil).nome || '–'} → ${acessos.perfis[perfil].nome}`);
      }
      if (mudaPerms) {
        this.registrar('usuario.permissoes', R, Object.keys(perms).length ? `permissões individuais: ${textoPermissoes(perms)}` : 'permissões individuais removidas (vale o perfil)');
      }
      return {};
    }

    if (acao === 'ativar' || acao === 'desativar') {

      this.exigir('usuarios', 'administrar');

      if (acao === 'desativar') {
        if (uid === eu) {
          throw new ErroAdmin('Você não pode desativar o próprio usuário.');
        }
        if (perfilTotal(alvo.perfil) && this.adminsAtivos(acessos, uid).length === 0) {
          throw new ErroAdmin('Este é o único administrador ativo.');
        }
      }

      await this.gravar(COLECAO_USUARIOS, uid, { ...alvo, ativo: acao === 'ativar', atualizadoEm: agora(), atualizadoPor: eu });
      this.registrar(`usuario.${acao}`, R, acao === 'desativar' ? 'sem acesso ao painel' : 'acesso liberado');
      return {};
    }

    if (acao === 'link_senha') {
      throw new ErroAdmin('No portal não há senha: o acesso é pelo login do Microsoft 365.');
    }

    if (acao === 'excluir') {

      this.exigir('usuarios', 'excluir');

      if (uid === eu) {
        throw new ErroAdmin('Você não pode excluir o próprio usuário.');
      }
      if (perfilTotal(alvo.perfil) && this.adminsAtivos(acessos, uid).length === 0) {
        throw new ErroAdmin('Este é o único administrador ativo.');
      }
      if (alvo.ultimoLogin) {
        throw new ErroAdmin('Este usuário já acessou o painel: para manter o histórico, desative-o em vez de excluir.', 409);
      }

      await this.gravar(COLECAO_USUARIOS, uid, undefined);
      this.registrar('usuario.excluir', R, alvo.email || '');
      return {};
    }

    throw new ErroAdmin('Ação desconhecida.');
  }

  // ----------------------------------------------------------
  // Setores
  // ----------------------------------------------------------

  private async setor(d: Registro): Promise<Registro> {

    const acessos = this.acessos();
    const S = acessos.setores;
    const acao = String(d.acao || '');
    let sid = String(d.id || '');
    const alvo = S[sid];
    const eu = this.sessao.usuario.id;

    if (acao !== 'criar' && !alvo) {
      throw new ErroAdmin('Setor não encontrado.', 404);
    }

    const nome = espacos(d.nome, 80);
    const vinculados = Object.keys(acessos.usuarios).filter(k => acessos.usuarios[k].setor === sid).length;

    if (acao === 'criar' || acao === 'editar') {

      this.exigir('setores', acao);

      if (nome.length < 2) {
        throw new ErroAdmin('Informe o nome do setor.');
      }
      if (Object.keys(S).some(k => k !== sid && normalizar(S[k].nome) === normalizar(nome))) {
        throw new ErroAdmin('Já existe um setor com este nome.', 409);
      }

      if (acao === 'criar') {
        sid = novoId('set');
        await this.gravar(COLECAO_SETORES, sid, { nome, ativo: true, criadoEm: agora(), criadoPor: eu });
        this.registrar('setor.criar', { tipo: 'setor', id: sid, nome });
        return { id: sid };
      }

      const antes = alvo.nome;
      await this.gravar(COLECAO_SETORES, sid, { ...alvo, nome, atualizadoEm: agora(), atualizadoPor: eu });
      this.registrar('setor.editar', { tipo: 'setor', id: sid, nome }, `${antes} → ${nome}`);
      return {};
    }

    if (acao === 'ativar' || acao === 'desativar') {
      this.exigir('setores', 'editar');
      await this.gravar(COLECAO_SETORES, sid, { ...alvo, ativo: acao === 'ativar', atualizadoEm: agora(), atualizadoPor: eu });
      this.registrar(`setor.${acao}`, { tipo: 'setor', id: sid, nome: alvo.nome }, `${vinculados} usuário(s) vinculado(s)`);
      return {};
    }

    if (acao === 'excluir') {
      this.exigir('setores', 'excluir');
      if (vinculados) {
        throw new ErroAdmin(`O setor tem ${vinculados} usuário(s) vinculado(s): mude o setor deles ou desative o setor.`, 409);
      }
      await this.gravar(COLECAO_SETORES, sid, undefined);
      this.registrar('setor.excluir', { tipo: 'setor', id: sid, nome: alvo.nome });
      return {};
    }

    throw new ErroAdmin('Ação desconhecida.');
  }

  // ----------------------------------------------------------
  // Perfis
  // ----------------------------------------------------------

  private async perfil(d: Registro): Promise<Registro> {

    const acessos = this.acessos();
    const P = acessos.perfis;
    const acao = String(d.acao || '');
    let pid = String(d.id || '');
    const alvo = P[pid];
    const eu = this.sessao.usuario.id;

    if (acao !== 'criar' && !alvo) {
      throw new ErroAdmin('Perfil não encontrado.', 404);
    }
    if (alvo && alvo.total && acao !== 'criar') {
      throw new ErroAdmin('O perfil Administrador tem sempre acesso completo e não pode ser alterado.');
    }

    const nome = espacos(d.nome, 60);
    const descricao = espacos(d.descricao, 240);

    if (acao === 'criar' || acao === 'editar') {

      this.exigir('perfis', acao);

      if (nome.length < 2) {
        throw new ErroAdmin('Informe o nome do perfil.');
      }
      if (Object.keys(P).some(k => k !== pid && normalizar(P[k].nome) === normalizar(nome))) {
        throw new ErroAdmin('Já existe um perfil com este nome.', 409);
      }

      const perms = limparPermissoes(d.perms);

      // Ninguém concede a um perfil o que não tem (evita escalar o próprio acesso).
      const negada = Object.keys(perms).some(k => perms[k].some(a => !podeNoPainel(this.perms, k, a)));
      if (negada) {
        throw new ErroAdmin('Você não pode conceder permissões que você mesmo não tem.', 403);
      }

      if (acao === 'criar') {
        pid = novoId('prf');
        await this.gravar(COLECAO_PERFIS, pid, { nome, descricao, perms, sistema: false, criadoEm: agora(), criadoPor: eu });
        this.registrar('perfil.criar', { tipo: 'perfil', id: pid, nome }, textoPermissoes(perms));
        return { id: pid };
      }

      const mudou = !iguais(perms, alvo.perms);
      await this.gravar(COLECAO_PERFIS, pid, { ...alvo, nome, descricao, perms, atualizadoEm: agora(), atualizadoPor: eu });
      this.registrar(mudou ? 'perfil.permissoes' : 'perfil.editar', { tipo: 'perfil', id: pid, nome }, mudou ? textoPermissoes(perms) : 'nome/descrição');
      return {};
    }

    if (acao === 'excluir') {
      this.exigir('perfis', 'excluir');
      if (alvo.sistema) {
        throw new ErroAdmin('Perfis iniciais não podem ser excluídos.');
      }
      const n = Object.keys(acessos.usuarios).filter(k => acessos.usuarios[k].perfil === pid).length;
      if (n) {
        throw new ErroAdmin(`O perfil tem ${n} usuário(s): mude o perfil deles antes de excluir.`, 409);
      }
      await this.gravar(COLECAO_PERFIS, pid, undefined);
      this.registrar('perfil.excluir', { tipo: 'perfil', id: pid, nome: alvo.nome });
      return {};
    }

    throw new ErroAdmin('Ação desconhecida.');
  }

  // ----------------------------------------------------------
  // Rotas
  // ----------------------------------------------------------

  public rota: RotaPainel = async (caminho, corpo, consulta): Promise<Resultado | undefined> => {

    const rotas = ['api/admin/resumo', 'api/admin/usuario', 'api/admin/setor', 'api/admin/perfil', 'api/admin/historico'];

    if (rotas.indexOf(caminho) < 0) {
      return undefined;
    }

    try {

      if (caminho === 'api/admin/resumo') {
        return { status: 200, corpo: await this.resumo() };
      }

      if (caminho === 'api/admin/historico') {

        if (!this.pode('historico')) {
          return { status: 403, corpo: { erro: 'Você não tem permissão para ver o histórico.' } };
        }

        const p = new URLSearchParams(consulta);
        const r = await this.historico.consultar({
          q: p.get('q') || '',
          uid: p.get('uid') || '',
          setor: p.get('setor') || '',
          cat: p.get('cat') || '',
          de: p.get('de') || '',
          ate: p.get('ate') || '',
          pag: Number(p.get('pag')) || 1,
          por: Number(p.get('por')) || 50
        });

        return { status: 200, corpo: r };
      }

      const resposta =
        caminho === 'api/admin/usuario' ? await this.usuario(corpo)
          : caminho === 'api/admin/setor' ? await this.setor(corpo)
            : await this.perfil(corpo);

      return { status: 200, corpo: { ok: true, ...resposta } };

    } catch (erro) {

      if (erro instanceof ErroAdmin) {
        return { status: erro.status, corpo: { erro: erro.message } };
      }

      throw erro;
    }
  };
}
