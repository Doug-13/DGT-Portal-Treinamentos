import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso,
  PerfilAcesso
} from '../../services/AutorizacaoService';

import {
  IAreaAdmin,
  IUsuarioAreaAdmin,
  PerfilArea
} from '../../services/AreaAdminService';

import {
  IDadosUsuariosAcessos,
  IUsuarioAcesso,
  UsuariosAcessosService
} from '../../services/UsuariosAcessosService';

import {
  ChaveModuloPortal,
  MODULOS_PADRAO,
  MODULOS_PORTAL,
  modulosEfetivos
} from '../../utils/modulosPortal';

import {
  ResumoAcessoEfetivo
} from './ResumoAcessoEfetivo';

import {
  CadastroUsuarioService,
  IUsuarioAmbiente
} from '../../services/CadastroUsuarioService';

// ============================================================
// USUÁRIOS E ACESSOS (menu do nome do usuário, no topo)
//
// Somente Administrador: perfil do portal, papéis por área (Membro,
// Gestor, Administrador da área, Editor) e módulos liberados.
// Regras do que cada combinação libera: utils/regrasAcesso.ts.
// ============================================================

export interface IUsuariosAcessosPageProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
  onVoltar: () => void;
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#E5E7EB';
const COR_TEXTO_2 = '#64748b';

const PERFIS_PORTAL: Array<{ valor: PerfilAcesso; rotulo: string; descricao: string }> = [
  { valor: 'Funcionario', rotulo: 'Colaborador', descricao: 'Faz os próprios treinamentos e consulta documentos.' },
  { valor: 'Editor', rotulo: 'Editor', descricao: 'Cria e mantém o conteúdo dos módulos liberados e acompanha a equipe das áreas em que é Editor (sem área de Editor = todas). Não cadastra usuários nem altera acessos.' },
  { valor: 'Gestor', rotulo: 'Gestor', descricao: 'Acompanha a equipe, atribui treinamentos, vê conformidade e aprova documentos em todo o portal. Não cria conteúdo.' },
  { valor: 'Administrador', rotulo: 'Administrador', descricao: 'Acesso total, inclusive usuários, acessos e permissões.' }
];

const rotuloPerfil = (
  perfil: PerfilAcesso
): string =>
  (PERFIS_PORTAL.find(item => item.valor === perfil) || { rotulo: perfil }).rotulo;

const COR_PERFIL_AREA: Record<string, { cor: string; fundo: string }> = {
  Membro: { cor: '#334155', fundo: '#F1F5F9' },
  Gestor: { cor: '#0F6CBD', fundo: '#E8F2FF' },
  'Administrador da área': { cor: '#485CC7', fundo: '#E8EAF8' },
  Editor: { cor: '#0E7C66', fundo: '#E3F6F1' }
};

const guid = (valor?: string): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const botao = (
  principal: boolean,
  desabilitado = false
): React.CSSProperties => ({
  minHeight: '34px',
  padding: '0 14px',
  borderRadius: '6px',
  border: principal ? 0 : `1px solid ${COR_BORDA}`,
  background: principal ? '#0877c9' : '#FFFFFF',
  color: principal ? '#FFFFFF' : COR_AZUL,
  fontWeight: 700,
  fontSize: '12.5px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.5 : 1,
  whiteSpace: 'nowrap'
});

const campo: React.CSSProperties = {
  padding: '7px 10px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  fontSize: '13px',
  background: '#FFFFFF',
  color: COR_AZUL
};

const Chip: React.FC<{ texto: string; cor: string; fundo: string; apagado?: boolean }> = ({ texto, cor, fundo, apagado }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '999px',
      background: fundo,
      color: cor,
      fontSize: '11.5px',
      fontWeight: 700,
      marginRight: '4px',
      marginBottom: '4px',
      opacity: apagado ? 0.5 : 1,
      textDecoration: apagado ? 'line-through' : undefined
    }}
  >
    {texto}
  </span>
);

// ------------------------------------------------------------
// Painel de gerenciamento de um usuário
// ------------------------------------------------------------

interface IPainelUsuarioProps {
  item: IUsuarioAcesso;
  dados: IDadosUsuariosAcessos;
  contexto?: IContextoAcesso;
  servico: UsuariosAcessosService;
  onAlterado: () => Promise<void>;
  onFechar: () => void;
}

const PainelUsuario: React.FC<IPainelUsuarioProps> = ({
  item,
  dados,
  contexto,
  servico,
  onAlterado,
  onFechar
}) => {

  const admin = servico.ehAdministrador(contexto);

  const [ocupado, setOcupado] = React.useState<boolean>(false);
  const [mensagem, setMensagem] = React.useState<string>('');
  const [erro, setErro] = React.useState<string>('');

  const [novaArea, setNovaArea] = React.useState<string>('');
  const [novoPerfil, setNovoPerfil] = React.useState<PerfilArea>('Membro');

  const [modulos, setModulos] = React.useState<ChaveModuloPortal[] | undefined>(item.modulos);

  React.useEffect(() => setModulos(item.modulos), [item.modulos]);

  const executar = async (acao: () => Promise<void>, sucesso: string): Promise<void> => {
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      await acao();
      await onAlterado();
      setMensagem(sucesso);
    } catch (error) {
      setErro((error as Error).message || String(error));
    } finally {
      setOcupado(false);
    }
  };

  const perfisAreaPermitidos: PerfilArea[] =
    admin ? ['Membro', 'Gestor', 'Administrador da área', 'Editor'] : [];

  const areasDisponiveis: IAreaAdmin[] =
    dados.areasGerenciaveis.filter(
      area =>
        area.ativa &&
        !item.vinculos.some(vinculo => guid(vinculo.areaId) === guid(area.id) && vinculo.ativo)
    );

  const salvarVinculo = (vinculo: IUsuarioAreaAdmin, alteracao: Partial<IUsuarioAreaAdmin>): void => {
    executar(
      () => servico.salvarVinculo(contexto, {
        id: vinculo.id,
        usuarioId: vinculo.usuarioId,
        areaId: vinculo.areaId,
        perfil: (alteracao.perfil || vinculo.perfil) as PerfilArea,
        ativo: alteracao.ativo !== undefined ? alteracao.ativo : vinculo.ativo
      }),
      'Papel na área atualizado.'
    ).catch(() => undefined);
  };

  const adicionarArea = (): void => {
    if (!novaArea) {
      return;
    }
    // Reativa um vínculo antigo da mesma área, se existir.
    const antigo = item.vinculos.find(vinculo => guid(vinculo.areaId) === guid(novaArea));
    executar(
      () => servico.salvarVinculo(contexto, {
        id: antigo ? antigo.id : undefined,
        usuarioId: item.usuario.id,
        areaId: novaArea,
        perfil: novoPerfil,
        ativo: true
      }),
      'Área incluída.'
    ).then(() => setNovaArea('')).catch(() => undefined);
  };

  const efetivos =
    modulosEfetivos(item.usuario.perfilAcesso, modulos);

  const ehPadrao =
    !modulos || modulos.length === 0;

  const alternarModulo = (chave: ChaveModuloPortal): void => {
    const atual = modulosEfetivos(item.usuario.perfilAcesso, modulos);
    const novo = atual.indexOf(chave) >= 0 ? atual.filter(m => m !== chave) : atual.concat([chave]);
    const igualPadrao = novo.length === MODULOS_PADRAO.length && novo.every(m => MODULOS_PADRAO.indexOf(m) >= 0);
    setModulos(igualPadrao ? undefined : novo);
  };

  const modulosAlterados =
    JSON.stringify(modulos || []) !== JSON.stringify(item.modulos || []);

  const secao: React.CSSProperties = { marginBottom: '20px' };
  const titulo: React.CSSProperties = { fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: COR_TEXTO_2, margin: '0 0 8px' };

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Acesso de ${item.usuario.nome}`}
      onClick={() => { if (!ocupado) { onFechar(); } }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(32,42,68,.45)', display: 'flex', justifyContent: 'flex-end', fontFamily: "Barlow, Arial, 'Segoe UI', sans-serif" }}
    >
      <div
        onClick={evento => evento.stopPropagation()}
        style={{ width: 'min(720px, 100%)', height: '100%', background: '#F7F9FB', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(32,42,68,.25)' }}
      >
        <div style={{ background: COR_AZUL, color: '#FFFFFF', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.85 }}>Gerenciar acesso</div>
            <div style={{ fontSize: '19px', fontWeight: 700 }}>{item.usuario.nome}</div>
            <div style={{ fontSize: '12.5px', opacity: 0.85, overflowWrap: 'anywhere' }}>{item.usuario.email}</div>
          </div>
          <button type="button" aria-label="Fechar" onClick={onFechar} style={{ ...botao(false), background: 'transparent', color: '#FFFFFF', borderColor: 'rgba(255,255,255,.4)' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '18px 20px' }}>

          {mensagem && <div role="status" style={{ marginBottom: '14px', padding: '8px 12px', borderRadius: '8px', background: '#E7F6EC', color: '#107C10', fontSize: '13px', fontWeight: 600 }}>✓ {mensagem}</div>}
          {erro && <div role="alert" style={{ marginBottom: '14px', padding: '8px 12px', borderRadius: '8px', background: '#FDE7E9', color: '#B42318', fontSize: '13px' }}>{erro}</div>}

          {/* 1. Perfil do portal */}
          <div style={secao}>
            <h3 style={titulo}>Perfil no portal</h3>
            {
              admin
                ? (
                  <>
                    <select
                      aria-label="Perfil no portal"
                      value={item.usuario.perfilAcesso}
                      disabled={ocupado}
                      onChange={evento => executar(
                        () => servico.definirPerfilGlobal(contexto, item.usuario.id, evento.target.value as PerfilAcesso),
                        'Perfil do portal atualizado.'
                      ).catch(() => undefined)}
                      style={{ ...campo, minWidth: '220px' }}
                    >
                      {PERFIS_PORTAL.map(perfil => <option key={perfil.valor} value={perfil.valor}>{perfil.rotulo}</option>)}
                    </select>
                    <div style={{ fontSize: '12px', color: COR_TEXTO_2, marginTop: '6px' }}>
                      {(PERFIS_PORTAL.find(perfil => perfil.valor === item.usuario.perfilAcesso) || PERFIS_PORTAL[0]).descricao}
                    </div>
                  </>
                )
                : (
                  <div style={{ fontSize: '14px', fontWeight: 700, color: COR_AZUL }}>
                    {rotuloPerfil(item.usuario.perfilAcesso)}
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: COR_TEXTO_2 }}>Somente administradores alteram o perfil do portal.</span>
                  </div>
                )
            }
          </div>

          {/* 2. Papéis por área */}
          <div style={secao}>
            <h3 style={titulo}>Papéis por área</h3>
            <p style={{ fontSize: '12px', color: COR_TEXTO_2, margin: '0 0 8px' }}>
              A mesma pessoa pode ter papéis diferentes em cada área. <strong>Gestor</strong> (ou Administrador da área) libera equipe,
              atribuição e aprovação de documentos naquela área. <strong>Editor</strong> libera criar conteúdo (nos módulos marcados abaixo)
              e acompanhar a equipe daquela área.
            </p>

            <div style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '10px', background: '#FFFFFF', overflow: 'hidden' }}>
              {
                item.vinculos.length === 0 && (
                  <div style={{ padding: '12px', fontSize: '13px', color: COR_TEXTO_2 }}>Sem área vinculada.</div>
                )
              }
              {
                item.vinculos.map(vinculo => {
                  const gerenciavel = servico.podeGerenciarArea(contexto, vinculo.areaId);
                  const opcoes = perfisAreaPermitidos.indexOf(vinculo.perfil) >= 0 ? perfisAreaPermitidos : perfisAreaPermitidos.concat([vinculo.perfil]);
                  return (
                    <div key={vinculo.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 12px', borderTop: `1px solid ${COR_BORDA}`, opacity: vinculo.ativo ? 1 : 0.6 }}>
                      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                        <strong style={{ fontSize: '13px', color: COR_AZUL }}>{vinculo.areaSigla ? `${vinculo.areaSigla} · ` : ''}{vinculo.areaNome}</strong>
                        {!vinculo.ativo && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#B42318', fontWeight: 700 }}>inativo</span>}
                        {!gerenciavel && <span style={{ display: 'block', fontSize: '11px', color: COR_TEXTO_2 }}>Área de outro gestor — somente leitura</span>}
                      </div>
                      <select
                        aria-label={`Papel em ${vinculo.areaNome}`}
                        value={vinculo.perfil}
                        disabled={!gerenciavel || ocupado || !vinculo.ativo || (!admin && vinculo.perfil === 'Administrador da área')}
                        onChange={evento => salvarVinculo(vinculo, { perfil: evento.target.value as PerfilArea })}
                        style={campo}
                      >
                        {opcoes.map(perfil => <option key={perfil} value={perfil}>{perfil}</option>)}
                      </select>
                      <button
                        type="button"
                        disabled={!gerenciavel || ocupado || (!admin && vinculo.perfil === 'Administrador da área')}
                        onClick={() => salvarVinculo(vinculo, { ativo: !vinculo.ativo })}
                        style={{ ...botao(false, !gerenciavel || ocupado), color: vinculo.ativo ? '#B42318' : '#107C10' }}
                      >
                        {vinculo.ativo ? 'Retirar da área' : 'Reativar'}
                      </button>
                    </div>
                  );
                })
              }

              {
                areasDisponiveis.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', borderTop: `1px solid ${COR_BORDA}`, background: '#F8FAFC' }}>
                    <select aria-label="Incluir em área" value={novaArea} disabled={ocupado} onChange={evento => setNovaArea(evento.target.value)} style={{ ...campo, flex: '1 1 200px' }}>
                      <option value="">Incluir em outra área…</option>
                      {areasDisponiveis.map(area => <option key={area.id} value={area.id}>{area.sigla ? `${area.sigla} · ` : ''}{area.nome}</option>)}
                    </select>
                    <select aria-label="Papel na nova área" value={novoPerfil} disabled={ocupado} onChange={evento => setNovoPerfil(evento.target.value as PerfilArea)} style={campo}>
                      {perfisAreaPermitidos.map(perfil => <option key={perfil} value={perfil}>{perfil}</option>)}
                    </select>
                    <button type="button" disabled={!novaArea || ocupado} onClick={adicionarArea} style={botao(true, !novaArea || ocupado)}>+ Incluir</button>
                  </div>
                )
              }
            </div>
          </div>

          {/* 3. Módulos */}
          <div style={secao}>
            <h3 style={titulo}>Módulos liberados</h3>
            {
              !dados.modulosDisponiveis
                ? (
                  <div style={{ fontSize: '12.5px', lineHeight: 1.5, padding: '10px 12px', borderRadius: '8px', background: '#FFF4E5', border: '1px solid #F5C77E', color: COR_AZUL }}>
                    A coluna <strong>Módulos de acesso</strong> (<code>dgt_modulosacesso</code>) ainda não existe na tabela
                    <strong> Usuário</strong> do Dataverse. Enquanto isso, todos acessam os módulos que o perfil permite.
                  </div>
                )
                : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                      {
                        MODULOS_PORTAL.map(modulo => {
                          const marcado = efetivos.indexOf(modulo.chave) >= 0;
                          return (
                            <label key={modulo.chave} title={modulo.descricao} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 10px', border: `1px solid ${marcado ? '#05C3DD' : COR_BORDA}`, background: marcado ? '#E6F9FC' : '#FFFFFF', borderRadius: '8px', fontSize: '13px', cursor: admin ? 'pointer' : 'default' }}>
                              <input type="checkbox" checked={marcado} disabled={!admin || ocupado || item.usuario.perfilAcesso === 'Administrador'} onChange={() => alternarModulo(modulo.chave)} />
                              <span><strong>{modulo.nome}</strong><span style={{ display: 'block', fontSize: '11px', color: COR_TEXTO_2 }}>{modulo.descricao}</span></span>
                            </label>
                          );
                        })
                      }
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: COR_TEXTO_2, flex: 1 }}>
                        {
                          item.usuario.perfilAcesso === 'Administrador'
                            ? 'Administrador acessa todos os módulos.'
                            : ehPadrao
                              ? 'Módulos padrão (Licitações não incluída).'
                              : `Personalizado: ${efetivos.length} de ${MODULOS_PORTAL.length} módulos.`
                        }
                        {!admin && ' Somente administradores alteram os módulos (valem para o portal inteiro).'}
                      </span>
                      {
                        admin && (
                          <button
                            type="button"
                            disabled={!modulosAlterados || ocupado}
                            onClick={() => executar(() => servico.definirModulos(contexto, item.usuario.id, modulos), 'Módulos atualizados.').catch(() => undefined)}
                            style={botao(true, !modulosAlterados || ocupado)}
                          >
                            Salvar módulos
                          </button>
                        )
                      }
                    </div>
                  </>
                )
            }
          </div>

          {/* 4. Resultado */}
          <div style={secao}>
            <h3 style={titulo}>O que este usuário acessa</h3>
            <ResumoAcessoEfetivo
              perfil={item.usuario.perfilAcesso}
              vinculos={item.vinculos.filter(vinculo => vinculo.ativo).map(vinculo => ({ areaId: vinculo.areaId, areaNome: vinculo.areaNome, perfil: vinculo.perfil }))}
              modulos={modulos}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ------------------------------------------------------------
// Adicionar usuários do ambiente ao portal
// ------------------------------------------------------------
// Lista quem já foi liberado no ambiente Dataverse (Power Platform
// admin center → Usuários) mas ainda não tem cadastro no portal, e
// cadastra com um clique (nome, e-mail, UPN e Entra Object ID vêm
// do próprio ambiente). Opcionalmente já vincula a uma área, o que
// dispara as atribuições automáticas dos treinamentos da área.
// ------------------------------------------------------------

interface ISelecaoCadastro {
  marcado: boolean;
  perfil: PerfilAcesso;
}

const AdicionarUsuariosModal: React.FC<{
  pendentes: IUsuarioAmbiente[];
  areas: IAreaAdmin[];
  cadastro: CadastroUsuarioService;
  servico: UsuariosAcessosService;
  contexto?: IContextoAcesso;
  onConcluido: () => void;
  onFechar: () => void;
}> = ({ pendentes, areas, cadastro, servico, contexto, onConcluido, onFechar }) => {

  const [selecao, setSelecao] = React.useState<Record<string, ISelecaoCadastro>>(() => {
    const inicial: Record<string, ISelecaoCadastro> = {};
    pendentes.forEach(p => { inicial[p.systemUserId] = { marcado: true, perfil: 'Funcionario' }; });
    return inicial;
  });
  const [areaId, setAreaId] = React.useState<string>('');
  const [papelArea, setPapelArea] = React.useState<PerfilArea>('Membro');
  const [processando, setProcessando] = React.useState<boolean>(false);
  const [progresso, setProgresso] = React.useState<string>('');
  const [resultado, setResultado] = React.useState<{ ok: number; falhas: string[] } | undefined>(undefined);

  const marcados = pendentes.filter(p => selecao[p.systemUserId] && selecao[p.systemUserId].marcado);

  const alterar = (id: string, parcial: Partial<ISelecaoCadastro>): void =>
    setSelecao(atual => ({ ...atual, [id]: { ...atual[id], ...parcial } }));

  const cadastrar = async (): Promise<void> => {
    setProcessando(true);
    let ok = 0;
    const falhas: string[] = [];

    for (let i = 0; i < marcados.length; i++) {
      const pessoa = marcados[i];
      setProgresso(`Cadastrando ${i + 1} de ${marcados.length}: ${pessoa.nome}…`);
      try {
        const usuarioId = await cadastro.cadastrar(pessoa, selecao[pessoa.systemUserId].perfil);
        if (areaId) {
          await servico.salvarVinculo(contexto, {
            usuarioId,
            areaId,
            perfil: papelArea,
            ativo: true
          });
        }
        ok++;
      } catch (erro) {
        falhas.push(`${pessoa.nome}: ${(erro as Error).message || String(erro)}`);
      }
    }

    setProgresso('');
    setProcessando(false);
    setResultado({ ok, falhas });
    if (ok > 0) {
      onConcluido();
    }
  };

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar usuários ao portal"
      onClick={() => { if (!processando) { onFechar(); } }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(32,42,68,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: "Barlow, Arial, 'Segoe UI', sans-serif" }}
    >
      <div
        onClick={evento => evento.stopPropagation()}
        style={{ width: 'min(860px, 100%)', maxHeight: '100%', overflowY: 'auto', background: '#FFFFFF', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,.3)', padding: '20px 22px', boxSizing: 'border-box' }}
      >
        <h2 style={{ margin: 0, fontSize: '18px', color: COR_AZUL }}>Adicionar usuários ao portal</h2>
        <p style={{ margin: '4px 0 16px', fontSize: '13px', color: COR_TEXTO_2 }}>
          Pessoas já liberadas no ambiente do Dataverse que ainda não têm cadastro no portal.
          Nome, e-mail, UPN e Entra Object ID vêm do Microsoft 365.
        </p>

        {resultado
          ? (
            <div>
              <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#E7F5EE', color: '#0B6B3A', fontSize: '13px', fontWeight: 700 }}>
                ✓ {resultado.ok} usuário(s) cadastrado(s){areaId ? ' e vinculado(s) à área' : ''}.
              </div>
              {resultado.falhas.length > 0 && (
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: '#FDE7E9', color: '#B42318', fontSize: '12.5px' }}>
                  <strong>Não cadastrados ({resultado.falhas.length}):</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                    {resultado.falhas.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" onClick={onFechar} style={botao(true)}>Concluir</button>
              </div>
            </div>
          )
          : (
            <>
              <div style={{ overflowX: 'auto', border: `1px solid ${COR_BORDA}`, borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
                  <thead>
                    <tr>
                      {['', 'Usuário', 'Situação', 'Perfil no portal'].map(coluna => (
                        <th key={coluna} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px', color: COR_TEXTO_2, background: '#F8FAFC', borderBottom: `1px solid ${COR_BORDA}` }}>{coluna}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendentes.map(p => {
                      const atual = selecao[p.systemUserId];
                      return (
                        <tr key={p.systemUserId}>
                          <td style={{ padding: '8px 10px', borderBottom: `1px solid ${COR_BORDA}`, width: '32px' }}>
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${p.nome}`}
                              checked={atual.marcado}
                              disabled={processando}
                              onChange={() => alterar(p.systemUserId, { marcado: !atual.marcado })}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', borderBottom: `1px solid ${COR_BORDA}` }}>
                            <strong style={{ display: 'block', fontSize: '13px', color: COR_AZUL }}>{p.nome}</strong>
                            <span style={{ fontSize: '12px', color: COR_TEXTO_2 }}>{p.email}</span>
                          </td>
                          <td style={{ padding: '8px 10px', borderBottom: `1px solid ${COR_BORDA}` }}>
                            {p.situacao === 'inativo'
                              ? <Chip texto="Inativo no portal — será reativado" cor="#B45309" fundo="#FFF4E5" />
                              : <Chip texto="Novo" cor="#0F6CBD" fundo="#E8F2FF" />}
                          </td>
                          <td style={{ padding: '8px 10px', borderBottom: `1px solid ${COR_BORDA}` }}>
                            <select
                              aria-label={`Perfil de ${p.nome}`}
                              value={atual.perfil}
                              disabled={processando || !atual.marcado}
                              onChange={evento => alterar(p.systemUserId, { perfil: evento.target.value as PerfilAcesso })}
                              style={campo}
                            >
                              {PERFIS_PORTAL.map(perfil => (
                                <option key={perfil.valor} value={perfil.valor}>{perfil.rotulo}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: COR_AZUL }}>
                  Vincular à área (opcional)
                  <select
                    value={areaId}
                    disabled={processando}
                    onChange={evento => setAreaId(evento.target.value)}
                    style={{ ...campo, display: 'block', marginTop: '4px', minWidth: '240px' }}
                  >
                    <option value="">Não vincular agora</option>
                    {areas.filter(a => a.ativa).map(area => (
                      <option key={area.id} value={area.id}>{area.sigla ? `${area.sigla} · ` : ''}{area.nome}</option>
                    ))}
                  </select>
                </label>
                {areaId && (
                  <label style={{ fontSize: '12px', fontWeight: 700, color: COR_AZUL }}>
                    Papel na área
                    <select
                      value={papelArea}
                      disabled={processando}
                      onChange={evento => setPapelArea(evento.target.value as PerfilArea)}
                      style={{ ...campo, display: 'block', marginTop: '4px' }}
                    >
                      {(['Membro', 'Gestor', 'Administrador da área', 'Editor'] as PerfilArea[]).map(papel => (
                        <option key={papel} value={papel}>{papel}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {areaId && (
                <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: COR_TEXTO_2 }}>
                  Ao vincular à área, os treinamentos e trilhas da área são atribuídos automaticamente.
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '18px' }}>
                {progresso && <span style={{ marginRight: 'auto', fontSize: '12px', color: COR_TEXTO_2 }}>{progresso}</span>}
                <button type="button" onClick={onFechar} disabled={processando} style={botao(false, processando)}>Cancelar</button>
                <button
                  type="button"
                  onClick={() => { cadastrar().catch(() => undefined); }}
                  disabled={processando || marcados.length === 0}
                  style={botao(true, processando || marcados.length === 0)}
                >
                  {processando ? 'Cadastrando…' : `Cadastrar ${marcados.length} usuário(s)`}
                </button>
              </div>
            </>
          )}
      </div>
    </div>,
    document.body
  );
};

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------

const UsuariosAcessosPage: React.FC<IUsuariosAcessosPageProps> = ({
  dataverseService,
  contexto,
  onVoltar
}) => {

  const servico = React.useMemo(
    () => (dataverseService ? new UsuariosAcessosService(dataverseService) : undefined),
    [dataverseService]
  );

  const [dados, setDados] = React.useState<IDadosUsuariosAcessos | undefined>(undefined);
  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [erro, setErro] = React.useState<string>('');
  const [busca, setBusca] = React.useState<string>('');
  const [filtroArea, setFiltroArea] = React.useState<string>('');
  const [selecionadoId, setSelecionadoId] = React.useState<string>('');

  // Usuários do ambiente ainda não cadastrados no portal
  const cadastro = React.useMemo(
    () => (dataverseService ? new CadastroUsuarioService(dataverseService) : undefined),
    [dataverseService]
  );
  const [pendentes, setPendentes] = React.useState<IUsuarioAmbiente[]>([]);
  const [erroPendentes, setErroPendentes] = React.useState<string>('');
  const [adicionarAberto, setAdicionarAberto] = React.useState<boolean>(false);

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      setCarregando(false);
      setErro('Dataverse não conectado.');
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      setDados(await servico.carregar(contexto));
    } catch (error) {
      setErro((error as Error).message || String(error));
    } finally {
      setCarregando(false);
    }
  }, [servico, contexto]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const admin = !!servico && servico.ehAdministrador(contexto);

  const carregarPendentes = React.useCallback(async (): Promise<void> => {
    if (!cadastro || !admin) {
      return;
    }
    try {
      setErroPendentes('');
      setPendentes(await cadastro.listarPendentes());
    } catch (error) {
      setErroPendentes((error as Error).message || String(error));
    }
  }, [cadastro, admin]);

  React.useEffect(() => {
    carregarPendentes().catch(() => undefined);
  }, [carregarPendentes]);

  const filtrados = React.useMemo(() => {
    if (!dados) {
      return [];
    }
    const termo = busca.trim().toLowerCase();
    return dados.usuarios.filter(item =>
      (!termo || `${item.usuario.nome} ${item.usuario.email}`.toLowerCase().indexOf(termo) >= 0) &&
      (!filtroArea || item.vinculos.some(vinculo => guid(vinculo.areaId) === guid(filtroArea) && vinculo.ativo))
    );
  }, [dados, busca, filtroArea]);

  const selecionado =
    dados ? dados.usuarios.find(item => item.usuario.id === selecionadoId) : undefined;

  const indicadores = dados
    ? [
      { titulo: admin ? 'Usuários' : 'Pessoas nas suas áreas', valor: dados.usuarios.length },
      { titulo: 'Gestores de área', valor: dados.usuarios.filter(item => item.vinculos.some(v => v.ativo && (v.perfil === 'Gestor' || v.perfil === 'Administrador da área'))).length },
      { titulo: 'Editores', valor: dados.usuarios.filter(item => item.usuario.perfilAcesso === 'Editor' || item.vinculos.some(v => v.ativo && v.perfil === 'Editor')).length },
      { titulo: 'Sem área', valor: dados.usuarios.filter(item => !item.vinculos.some(v => v.ativo)).length },
      { titulo: 'Com módulos personalizados', valor: dados.usuarios.filter(item => !!item.modulos).length }
    ]
    : [];

  return (
    <section style={{ fontFamily: "Barlow, Arial, 'Segoe UI', sans-serif" }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: COR_AZUL }}>Usuários e acessos</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: COR_TEXTO_2 }}>
            {admin
              ? 'Perfil no portal, papéis por área e módulos liberados de cada usuário.'
              : 'Pessoas das áreas que você gerencia e o papel de cada uma.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {admin && cadastro && (
            <button
              type="button"
              onClick={() => setAdicionarAberto(true)}
              disabled={pendentes.length === 0}
              title={pendentes.length === 0 ? 'Todos os usuários do ambiente já estão no portal.' : undefined}
              style={botao(true, pendentes.length === 0)}
            >
              + Adicionar usuários{pendentes.length > 0 ? ` (${pendentes.length})` : ''}
            </button>
          )}
          <button type="button" onClick={onVoltar} style={botao(false)}>← Voltar</button>
        </div>
      </div>

      {admin && pendentes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', background: '#FFF4E5', border: '1px solid #F5D48A', fontSize: '13px', color: COR_AZUL }}>
          <span style={{ flex: 1, minWidth: '240px' }}>
            <strong>{pendentes.length} usuário(s)</strong> liberado(s) no ambiente ainda não estão no portal
            {': '}{pendentes.slice(0, 4).map(p => p.nome).join(', ')}{pendentes.length > 4 ? '…' : ''}.
          </span>
          <button type="button" onClick={() => setAdicionarAberto(true)} style={botao(true)}>Revisar e cadastrar</button>
        </div>
      )}

      {admin && erroPendentes && (
        <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '8px', background: '#F1F5F9', color: COR_TEXTO_2, fontSize: '12px' }}>
          Não foi possível comparar com os usuários do ambiente: {erroPendentes}
        </div>
      )}

      {erro && <div role="alert" style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '8px', background: '#FDE7E9', color: '#B42318', fontSize: '13px' }}>{erro}</div>}

      {
        dados && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {indicadores.map(item => (
              <div key={item.titulo} style={{ background: '#FFFFFF', border: `1px solid ${COR_BORDA}`, borderRadius: '12px', padding: '12px 16px' }}>
                <span style={{ display: 'block', fontSize: '12px', color: COR_TEXTO_2 }}>{item.titulo}</span>
                <strong style={{ fontSize: '22px', color: COR_AZUL }}>{item.valor}</strong>
              </div>
            ))}
          </div>
        )
      }

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', background: '#FFFFFF', border: `1px solid ${COR_BORDA}`, borderRadius: '12px', padding: '12px' }}>
        <input aria-label="Pesquisar usuário" value={busca} onChange={evento => setBusca(evento.target.value)} placeholder="Pesquisar por nome ou e-mail…" style={{ ...campo, flex: '1 1 260px' }} />
        <select aria-label="Filtrar por área" value={filtroArea} onChange={evento => setFiltroArea(evento.target.value)} style={{ ...campo, minWidth: '220px' }}>
          <option value="">{admin ? 'Todas as áreas' : 'Todas as minhas áreas'}</option>
          {(dados ? dados.areasGerenciaveis : []).map(area => <option key={area.id} value={area.id}>{area.sigla ? `${area.sigla} · ` : ''}{area.nome}</option>)}
        </select>
      </div>

      {carregando && <p style={{ fontSize: '13px', color: COR_TEXTO_2 }}>Carregando usuários…</p>}

      {
        !carregando && dados && (
          <div style={{ overflowX: 'auto', background: '#FFFFFF', border: `1px solid ${COR_BORDA}`, borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
              <thead>
                <tr>
                  {['Usuário', 'Perfil no portal', 'Papéis por área', 'Módulos', ''].map(coluna => (
                    <th key={coluna} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: COR_TEXTO_2, background: '#F8FAFC', borderBottom: `1px solid ${COR_BORDA}` }}>{coluna}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {
                  filtrados.map(item => (
                    <tr key={item.usuario.id}>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR_BORDA}`, verticalAlign: 'top' }}>
                        <strong style={{ display: 'block', fontSize: '13px', color: COR_AZUL }}>{item.usuario.nome}</strong>
                        <span style={{ fontSize: '12px', color: COR_TEXTO_2 }}>{item.usuario.email}</span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR_BORDA}`, verticalAlign: 'top', fontSize: '13px' }}>
                        {rotuloPerfil(item.usuario.perfilAcesso)}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR_BORDA}`, verticalAlign: 'top' }}>
                        {item.vinculos.length === 0 && <Chip texto="Sem área" cor="#64748B" fundo="#F1F5F9" />}
                        {
                          item.vinculos.map(vinculo => {
                            const cores = COR_PERFIL_AREA[vinculo.perfil] || COR_PERFIL_AREA.Membro;
                            return (
                              <Chip
                                key={vinculo.id}
                                texto={`${vinculo.areaSigla || vinculo.areaNome} · ${vinculo.perfil}`}
                                cor={cores.cor}
                                fundo={cores.fundo}
                                apagado={!vinculo.ativo}
                              />
                            );
                          })
                        }
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR_BORDA}`, verticalAlign: 'top' }}>
                        {
                          !item.modulos
                            ? <span style={{ fontSize: '12.5px', color: COR_TEXTO_2 }}>{item.usuario.perfilAcesso === 'Administrador' ? 'Todos' : 'Padrão'}</span>
                            : item.modulos.map(chave => (
                              <Chip key={chave} texto={(MODULOS_PORTAL.find(m => m.chave === chave) || { nome: chave }).nome} cor="#0B6B3A" fundo="#E7F6EC" />
                            ))
                        }
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR_BORDA}`, verticalAlign: 'top', textAlign: 'right' }}>
                        <button type="button" onClick={() => setSelecionadoId(item.usuario.id)} style={botao(true)}>Gerenciar</button>
                      </td>
                    </tr>
                  ))
                }
                {
                  filtrados.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '16px', fontSize: '13px', color: COR_TEXTO_2 }}>Nenhum usuário encontrado.</td></tr>
                  )
                }
              </tbody>
            </table>
          </div>
        )
      }

      {
        selecionado && dados && servico && (
          <PainelUsuario
            item={selecionado}
            dados={dados}
            contexto={contexto}
            servico={servico}
            onAlterado={carregar}
            onFechar={() => setSelecionadoId('')}
          />
        )
      }

      {
        adicionarAberto && cadastro && servico && dados && (
          <AdicionarUsuariosModal
            pendentes={pendentes}
            areas={dados.areas}
            cadastro={cadastro}
            servico={servico}
            contexto={contexto}
            onConcluido={() => {
              carregar().catch(() => undefined);
              carregarPendentes().catch(() => undefined);
            }}
            onFechar={() => setAdicionarAberto(false)}
          />
        )
      }
    </section>
  );
};

export default UsuariosAcessosPage;
