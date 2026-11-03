import * as React from 'react';

import styles from
  '../../components/PortalTreinamentos.module.scss';

import ModuloCabecalho from
  '../../components/layout/ModuloCabecalho';

import {
  Icones
} from '../../components/common/Icones';

import {
  Pagina
} from '../../constants/routes';

import {
  IAmbiente,
  IAmbienteRegistro,
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  AreaAdminService,
  IAreaAdmin,
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  AmbienteService,
  administraAmbiente,
  ambienteLiberado
} from '../../services/ambientes/AmbienteService';

import {
  AmbienteFluxoService,
  IDisponibilidadeFluxoAmbiente,
  IEstadoFluxoRegistro,
  IPendenciaAmbiente
} from '../../services/ambientes/AmbienteFluxoService';

import PainelFluxoOrcamento from
  '../Orcamento/PainelFluxoOrcamento';

import {
  COR,
  CaixaMensagem,
  FONTE,
  Selo,
  SeloPrazo,
  botao,
  campo,
  cartao,
  formatarData,
  formatarDataHora
} from '../Orcamento/orcamentoComum';

import {
  situacaoPrazo
} from '../../services/orcamento/diasUteis';

// ============================================================
// AMBIENTE DINÂMICO (uma única tela para todos os ambientes)
//
// Abas:
//   Aguardando você → registros cuja etapa atual tem você como
//                     responsável (definido no desenho do fluxo)
//   Meus registros  → registros que você abriu
//   Todos           → Administrador e administrador do ambiente
//   Configuração    → Administrador e administrador do ambiente
//
// Cada registro segue o fluxo publicado do processo do ambiente.
// Os botões, campos, responsáveis e prazos de cada etapa vêm do
// desenho — nada é fixo nesta tela.
// ============================================================

export interface IAmbientePageProps {
  ambiente: IAmbiente;
  contexto?: IContextoAcesso;
  dataverseService?: DataverseService;
  areas?: IAreaAdmin[];
  usuariosAreas?: IUsuarioAreaAdmin[];
  navegar: (pagina: Pagina) => void;
  // Abre o editor de fluxo já no processo do ambiente.
  onDesenharFluxo: (processoId: string) => void;
  // Abre o modal de edição do ambiente (Administrador global).
  onEditarAmbiente?: () => void;
}

type AbaAmbiente = 'pendencias' | 'meus' | 'todos' | 'config';

type Visao =
  | { tipo: 'lista' }
  | { tipo: 'novo' }
  | { tipo: 'registro'; registroId: string };

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const mensagem = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro);

const CORES_SITUACAO: Record<SituacaoRegistroAmbiente, { texto: string; cor: string; fundo: string }> = {
  emAndamento: { texto: 'Em andamento', cor: '#0F4C81', fundo: '#E8F2FF' },
  concluido: { texto: 'Concluído', cor: '#107C10', fundo: '#E7F6EC' },
  cancelado: { texto: 'Cancelado', cor: '#64748b', fundo: '#F1F5F9' }
};

const SeloSituacao: React.FC<{ situacao: SituacaoRegistroAmbiente }> = ({ situacao }) => {
  const cores = CORES_SITUACAO[situacao] || CORES_SITUACAO.emAndamento;
  return <Selo texto={cores.texto} cor={cores.cor} fundo={cores.fundo} />;
};

const celula: React.CSSProperties = {
  padding: '9px 10px',
  borderTop: `1px solid ${COR.borda}`,
  fontSize: '13px',
  color: COR.azul,
  verticalAlign: 'top'
};

const cabecalhoCelula: React.CSSProperties = {
  ...celula,
  borderTop: 0,
  fontSize: '11.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: COR.texto2,
  textAlign: 'left',
  background: COR.fundo
};

const AmbientePage: React.FC<IAmbientePageProps> = (props) => {

  const { ambiente, contexto, dataverseService } = props;

  const administra = administraAmbiente(contexto, ambiente);
  const liberado = ambienteLiberado(contexto, ambiente);
  const adminGlobal = !!contexto && contexto.perfil === 'Administrador';

  const servico = React.useMemo(
    () => (dataverseService ? new AmbienteService(dataverseService) : undefined),
    [dataverseService]
  );

  const fluxo = React.useMemo(
    () => (dataverseService ? new AmbienteFluxoService(dataverseService) : undefined),
    [dataverseService]
  );

  const [aba, setAba] = React.useState<AbaAmbiente>('pendencias');
  const [visao, setVisao] = React.useState<Visao>({ tipo: 'lista' });
  const [registros, setRegistros] = React.useState<IAmbienteRegistro[]>([]);
  const [pendencias, setPendencias] = React.useState<IPendenciaAmbiente[]>([]);
  const [disponibilidade, setDisponibilidade] = React.useState<IDisponibilidadeFluxoAmbiente | undefined>(undefined);
  const [carregando, setCarregando] = React.useState(true);
  const [processando, setProcessando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [sucesso, setSucesso] = React.useState('');
  const [filtro, setFiltro] = React.useState('');
  const [mostrarEncerrados, setMostrarEncerrados] = React.useState(false);

  // Novo registro
  const [novoTitulo, setNovoTitulo] = React.useState('');
  const [novoDescricao, setNovoDescricao] = React.useState('');
  const [novoAreaId, setNovoAreaId] = React.useState('');

  // Áreas (as do portal; se vierem vazias, a página lê sozinha).
  const [areasLidas, setAreasLidas] = React.useState<IAreaAdmin[]>([]);

  const areas = (props.areas && props.areas.length > 0) ? props.areas : areasLidas;

  React.useEffect(() => {
    if ((props.areas && props.areas.length > 0) || !dataverseService) {
      return;
    }
    new AreaAdminService(dataverseService)
      .listarAreas()
      .then(lista => setAreasLidas(lista))
      .catch(() => setAreasLidas([]));
  }, [props.areas, dataverseService]);

  // Registro aberto
  const [estado, setEstado] = React.useState<IEstadoFluxoRegistro | undefined>(undefined);
  const [podeAgir, setPodeAgir] = React.useState(false);
  const [vinculos, setVinculos] = React.useState<IUsuarioAreaAdmin[]>([]);
  const [usuarios, setUsuarios] = React.useState<Array<{ id: string; nome: string }>>([]);
  const [carregandoRegistro, setCarregandoRegistro] = React.useState(false);

  // ----------------------------------------------------------
  // Carga
  // ----------------------------------------------------------

  const carregar = React.useCallback(async (): Promise<void> => {

    if (!servico || !fluxo || !contexto || !liberado) {
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro('');

    try {
      const [lista, disp] = await Promise.all([
        servico.listarRegistros(ambiente),
        fluxo.verificar(ambiente)
      ]);
      setRegistros(lista);
      setDisponibilidade(disp);
      setPendencias(await fluxo.pendenciasDoUsuario(lista, contexto));
    } catch (falha) {
      setErro(`Não foi possível carregar os registros de ${ambiente.nome}: ${mensagem(falha)}`);
    } finally {
      setCarregando(false);
    }
  }, [servico, fluxo, contexto, liberado, ambiente]);

  // Trocar de ambiente pelo menu: volta para a lista.
  React.useEffect(() => {
    setVisao({ tipo: 'lista' });
    setAba('pendencias');
    setSucesso('');
    setFiltro('');
    carregar().catch(() => undefined);
  }, [ambiente.id, ambiente.processoId]);

  const registroAberto =
    visao.tipo === 'registro'
      ? registros.filter(item => item.id === visao.registroId)[0]
      : undefined;

  const abrirRegistro = React.useCallback(async (registro: IAmbienteRegistro): Promise<void> => {
    if (!fluxo || !contexto) {
      return;
    }
    setVisao({ tipo: 'registro', registroId: registro.id });
    setCarregandoRegistro(true);
    setEstado(undefined);
    setErro('');
    try {
      const [estadoLido, listaVinculos, listaUsuarios] = await Promise.all([
        fluxo.carregar(registro),
        fluxo.vinculos(),
        fluxo.usuarios()
      ]);
      setVinculos(listaVinculos);
      setUsuarios(listaUsuarios);
      setEstado(estadoLido);
      setPodeAgir(estadoLido ? await fluxo.podeAgir(estadoLido, registro, contexto) : false);
    } catch (falha) {
      setErro(`Não foi possível abrir o registro: ${mensagem(falha)}`);
    } finally {
      setCarregandoRegistro(false);
    }
  }, [fluxo, contexto]);

  // Relê a lista e o registro aberto depois de uma ação.
  const recarregarRegistro = async (registroId: string): Promise<void> => {
    if (!servico || !fluxo || !contexto) {
      return;
    }
    const lista = await servico.listarRegistros(ambiente);
    setRegistros(lista);
    setPendencias(await fluxo.pendenciasDoUsuario(lista, contexto));
    const atualizado = lista.filter(item => item.id === registroId)[0];
    if (atualizado) {
      await abrirRegistro(atualizado);
    }
  };

  // ----------------------------------------------------------
  // Ações
  // ----------------------------------------------------------

  const criarRegistro = async (): Promise<void> => {
    if (!servico || !fluxo || !contexto) {
      return;
    }
    setProcessando(true);
    setErro('');
    setSucesso('');
    try {
      const registro =
        await servico.criarRegistro(
          ambiente,
          { titulo: novoTitulo, descricao: novoDescricao, areaId: novoAreaId },
          contexto
        );

      const inicio = await fluxo.iniciar(ambiente, registro, contexto);

      setNovoTitulo('');
      setNovoDescricao('');
      setNovoAreaId('');

      if (!inicio.ok) {
        setErro(`${ambiente.rotuloRegistro} ${registro.codigo} foi criado, mas o fluxo não começou: ${inicio.erros.join(' ')} Abra o registro e use "Iniciar fluxo".`);
      } else {
        setSucesso(`${ambiente.rotuloRegistro} ${registro.codigo} criado e enviado para a primeira etapa do fluxo.${inicio.avisos.length > 0 ? `\n${inicio.avisos.join('\n')}` : ''}`);
      }

      await recarregarRegistro(registro.id);
    } catch (falha) {
      setErro(mensagem(falha));
    } finally {
      setProcessando(false);
    }
  };

  const iniciarFluxo = async (registro: IAmbienteRegistro): Promise<void> => {
    if (!fluxo || !contexto) {
      return;
    }
    setProcessando(true);
    setErro('');
    const resultado = await fluxo.iniciar(ambiente, registro, contexto);
    setProcessando(false);
    if (!resultado.ok) {
      setErro(resultado.erros.join('\n'));
      return;
    }
    await recarregarRegistro(registro.id);
  };

  const executar = async (
    registro: IAmbienteRegistro,
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>
  ): Promise<string[]> => {
    if (!fluxo || !contexto) {
      return ['Sem conexão com o Dataverse.'];
    }
    setProcessando(true);
    setSucesso('');
    try {
      const resultado = await fluxo.executar(ambiente, registro, contexto, acaoChave, comentario, valores);
      if (!resultado.ok) {
        return resultado.erros;
      }
      setSucesso(resultado.avisos.length > 0 ? `Ação registrada.\n${resultado.avisos.join('\n')}` : 'Ação registrada.');
      await recarregarRegistro(registro.id);
      return [];
    } catch (falha) {
      return [mensagem(falha)];
    } finally {
      setProcessando(false);
    }
  };

  const cancelar = async (registro: IAmbienteRegistro): Promise<void> => {
    if (!fluxo || !contexto) {
      return;
    }
    const motivo = window.prompt(`Motivo do cancelamento de ${registro.codigo} (obrigatório). O histórico é preservado.`);
    if (motivo === null) {
      return;
    }
    setProcessando(true);
    setErro('');
    const resultado = await fluxo.cancelar(ambiente, registro, motivo, contexto);
    setProcessando(false);
    if (!resultado.ok) {
      setErro(resultado.erros.join('\n'));
      return;
    }
    setSucesso(`${registro.codigo} cancelado.`);
    await recarregarRegistro(registro.id);
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  const cabecalho = (
    <ModuloCabecalho
      config={{
        icone: ambiente.icone,
        titulo: ambiente.nome,
        subtitulo: ambiente.subtitulo || `Cada ${ambiente.rotuloRegistro.toLowerCase()} segue o fluxo do ambiente.`,
        descricao: ambiente.descricao || 'Etapas, responsáveis e prazos definidos no fluxo publicado.',
        citacao: 'Processo claro é processo que se cumpre.'
      }}
      abas={[]}
      paginaAtual={'ambiente'}
      navegar={props.navegar}
    />
  );

  if (!contexto) {
    return <>{cabecalho}<CaixaMensagem tipo="info" texto="Carregando permissões..." /></>;
  }

  if (!liberado) {
    return (
      <>
        {cabecalho}
        <CaixaMensagem
          tipo="alerta"
          texto={`O ambiente ${ambiente.nome} não está liberado para o seu usuário. Fale com o gestor da sua área ou com um administrador.`}
        />
      </>
    );
  }

  if (!dataverseService) {
    return <>{cabecalho}<CaixaMensagem tipo="erro" texto="Sem conexão com o Dataverse." /></>;
  }

  const abas: Array<{ chave: AbaAmbiente; rotulo: string; icone: keyof typeof Icones; visivel: boolean }> = [
    { chave: 'pendencias', rotulo: `Aguardando você${pendencias.length > 0 ? ` (${pendencias.length})` : ''}`, icone: 'bell', visivel: true },
    { chave: 'meus', rotulo: 'Meus registros', icone: 'fileText', visivel: true },
    { chave: 'todos', rotulo: 'Todos', icone: 'grid', visivel: administra },
    { chave: 'config', rotulo: 'Configuração', icone: 'settings', visivel: administra }
  ];

  const podeCriar = !!disponibilidade && disponibilidade.ativo;

  const termo = filtro.trim().toLowerCase();

  const listaDaAba: IAmbienteRegistro[] =
    aba === 'pendencias'
      ? pendencias.map(item => item.registro)
      : aba === 'meus'
        ? registros.filter(item => guid(item.solicitanteId) === guid(contexto.usuarioId))
        : aba === 'todos'
          ? registros
          : [];

  const listaFiltrada =
    listaDaAba
      .filter(item => aba === 'pendencias' || mostrarEncerrados || item.situacao === 'emAndamento')
      .filter(item =>
        !termo ||
        `${item.codigo} ${item.titulo} ${item.etapaAtual} ${item.solicitanteNome} ${item.areaNome}`.toLowerCase().indexOf(termo) >= 0
      );

  const renderTabelaRegistros = (): React.ReactNode => (
    <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTE }}>
        <thead>
          <tr>
            <th style={cabecalhoCelula}>Código</th>
            <th style={cabecalhoCelula}>{ambiente.rotuloRegistro}</th>
            <th style={cabecalhoCelula}>Etapa atual</th>
            <th style={cabecalhoCelula}>Prazo da etapa</th>
            <th style={cabecalhoCelula}>Situação</th>
            <th style={cabecalhoCelula}>Aberto por</th>
            <th style={cabecalhoCelula}>Aberto em</th>
          </tr>
        </thead>
        <tbody>
          {listaFiltrada.map(item => {
            const prazo = item.prazoEtapa && item.situacao === 'emAndamento' ? situacaoPrazo(item.prazoEtapa) : undefined;
            return (
              <tr
                key={item.id}
                onClick={() => { abrirRegistro(item).catch(() => undefined); }}
                style={{ cursor: 'pointer' }}
                title="Abrir"
              >
                <td style={{ ...celula, fontWeight: 700, whiteSpace: 'nowrap' }}>{item.codigo}</td>
                <td style={celula}>{item.titulo}{item.areaNome ? <span style={{ display: 'block', fontSize: '11.5px', color: COR.texto2 }}>{item.areaNome}</span> : null}</td>
                <td style={celula}>{item.etapaAtual || '—'}</td>
                <td style={{ ...celula, whiteSpace: 'nowrap' }}>{item.prazoEtapa && item.situacao === 'emAndamento' ? <SeloPrazo prazo={item.prazoEtapa} situacao={prazo} /> : '—'}</td>
                <td style={celula}><SeloSituacao situacao={item.situacao} /></td>
                <td style={celula}>{item.solicitanteNome || '—'}</td>
                <td style={{ ...celula, whiteSpace: 'nowrap' }}>{formatarData(item.criadoEm)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {listaFiltrada.length === 0 && (
        <div style={{ padding: '18px', fontSize: '13.5px', color: COR.texto2, textAlign: 'center' }}>
          {aba === 'pendencias' ? 'Nada aguardando você neste ambiente.' : 'Nenhum registro encontrado.'}
        </div>
      )}
    </div>
  );

  const renderConfiguracao = (): React.ReactNode => {
    const passo = (feito: boolean, titulo: string, detalhe: React.ReactNode): React.ReactNode => (
      <div style={{ display: 'flex', gap: '10px', padding: '10px 0', borderTop: `1px solid ${COR.borda}` }}>
        <span style={{ fontSize: '16px', color: feito ? '#107C10' : COR.texto2, minWidth: '20px' }}>{feito ? '✓' : '○'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: COR.azul }}>{titulo}</div>
          <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '2px' }}>{detalhe}</div>
        </div>
      </div>
    );

    return (
      <div style={{ ...cartao, fontFamily: FONTE }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: COR.azul, marginBottom: '6px' }}>Configuração do ambiente</div>

        {passo(
          true,
          'Ambiente criado',
          <>Chave <code>{ambiente.chave}</code> · códigos {ambiente.prefixoCodigo}-{new Date().getFullYear()}-0001 · registros chamados de “{ambiente.rotuloRegistro}”.</>
        )}

        {passo(
          !!disponibilidade && disponibilidade.ativo,
          'Fluxo vinculado e publicado',
          <>
            <div>
              Fluxo vinculado: <strong>{disponibilidade && disponibilidade.processo ? `${disponibilidade.processo.codigo ? `${disponibilidade.processo.codigo} — ` : ''}${disponibilidade.processo.nome}` : (ambiente.processoNome || '—')}</strong>
            </div>
            <div style={{ marginTop: '4px' }}>
              {disponibilidade && disponibilidade.ativo && disponibilidade.definicao
                ? `Versão v${disponibilidade.definicao.versao} publicada. Novos registros seguem esta versão; os em andamento terminam na versão com que começaram.`
                : (disponibilidade ? disponibilidade.motivo : 'Verificando...')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                disabled={!ambiente.processoId}
                onClick={() => props.onDesenharFluxo(ambiente.processoId)}
                style={botao('principal', !ambiente.processoId)}
              >
                {disponibilidade && disponibilidade.ativo ? 'Editar fluxo (nova versão)' : 'Desenhar fluxo'}
              </button>
              {adminGlobal && props.onEditarAmbiente && (
                <button type="button" onClick={props.onEditarAmbiente} style={botao('secundario')}>
                  Trocar fluxo
                </button>
              )}
            </div>
            {disponibilidade && disponibilidade.avisos && disponibilidade.avisos.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <CaixaMensagem
                  tipo="alerta"
                  texto={`Este fluxo tem etapas próprias de documentos, que no ambiente são ignoradas (o fluxo segue adiante):\n${disponibilidade.avisos.map(item => `• ${item}`).join('\n')}`}
                />
              </div>
            )}
            <div style={{ marginTop: '6px' }}>
              O mesmo fluxo pode ser usado por mais de um ambiente: uma nova versão publicada vale para os novos registros de todos eles.
              Na aba <strong>Metadados</strong> do processo ficam os campos do registro (ex.: Valor estimado, Data de abertura).
              Responsáveis: “Autor da revisão” = quem abriu o registro; “Gestor da área” = gestores da área informada no registro.
            </div>
          </>
        )}

        {passo(
          ambiente.liberadoParaTodos || ambiente.perfisPadrao.length > 0,
          'Liberado para os usuários',
          <>
            {ambiente.liberadoParaTodos
              ? 'Liberado para todos (quem não tem lista própria de módulos).'
              : ambiente.perfisPadrao.length > 0
                ? `Liberado por padrão para: ${ambiente.perfisPadrao.map(item => item === 'Funcionario' ? 'Colaborador' : item).join(', ')}.`
                : 'Sem liberação padrão: só aparece para quem for liberado individualmente.'}
            {' '}A liberação individual e o “Administrador do módulo” ficam em Usuários e acessos, como nos demais módulos.
            {adminGlobal && (
              <div style={{ marginTop: '8px' }}>
                <button type="button" onClick={() => props.navegar('usuariosAcessos')} style={botao('secundario')}>
                  Abrir Usuários e acessos
                </button>
              </div>
            )}
          </>
        )}

        {adminGlobal && props.onEditarAmbiente && (
          <div style={{ borderTop: `1px solid ${COR.borda}`, paddingTop: '12px', marginTop: '4px' }}>
            <button type="button" onClick={props.onEditarAmbiente} style={botao('secundario')}>
              Editar dados do ambiente
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderNovo = (): React.ReactNode => (
    <div style={{ ...cartao, fontFamily: FONTE }}>
      <div style={{ fontSize: '15px', fontWeight: 700, color: COR.azul, marginBottom: '10px' }}>
        Novo(a) {ambiente.rotuloRegistro.toLowerCase()}
      </div>

      {!podeCriar && (
        <CaixaMensagem tipo="alerta" texto={disponibilidade ? disponibilidade.motivo : 'Verificando o fluxo...'} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        <label style={{ display: 'block', gridColumn: '1 / -1' }}>
          <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>Título *</span>
          <input value={novoTitulo} maxLength={200} onChange={evento => setNovoTitulo(evento.target.value)} style={campo} />
        </label>

        <label style={{ display: 'block', gridColumn: '1 / -1' }}>
          <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>Descrição</span>
          <textarea rows={4} value={novoDescricao} maxLength={4000} onChange={evento => setNovoDescricao(evento.target.value)} style={{ ...campo, resize: 'vertical' }} />
        </label>

        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: COR.azul, marginBottom: '4px' }}>Área</span>
          <select value={novoAreaId} onChange={evento => setNovoAreaId(evento.target.value)} style={campo}>
            <option value="">(sem área)</option>
            {areas.filter(item => item.ativa).map(item => (
              <option key={item.id} value={item.id}>{item.sigla ? `${item.sigla} — ${item.nome}` : item.nome}</option>
            ))}
          </select>
          <span style={{ display: 'block', fontSize: '11.5px', color: COR.texto2, marginTop: '3px' }}>
            Usada pelas etapas cujo responsável é “Gestor da área”.
          </span>
        </label>
      </div>

      <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '10px' }}>
        Os demais campos são preenchidos nas etapas do fluxo, conforme o desenho.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
        <button type="button" disabled={processando} onClick={() => setVisao({ tipo: 'lista' })} style={botao('secundario', processando)}>
          Voltar
        </button>
        <button
          type="button"
          disabled={processando || !podeCriar || novoTitulo.trim().length < 3}
          onClick={() => { criarRegistro().catch(() => undefined); }}
          style={botao('principal', processando || !podeCriar || novoTitulo.trim().length < 3)}
        >
          {processando ? 'Criando...' : 'Criar e iniciar fluxo'}
        </button>
      </div>
    </div>
  );

  const renderRegistro = (registro: IAmbienteRegistro): React.ReactNode => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: FONTE }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <button type="button" onClick={() => { setVisao({ tipo: 'lista' }); setSucesso(''); }} style={botao('secundario')}>
          ← Voltar
        </button>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '12px', color: COR.texto2, fontWeight: 700 }}>{registro.codigo}</div>
          <div style={{ fontSize: '18px', color: COR.azul, fontWeight: 700 }}>{registro.titulo}</div>
        </div>
        <SeloSituacao situacao={registro.situacao} />
        {administra && registro.situacao === 'emAndamento' && (
          <button type="button" disabled={processando} onClick={() => { cancelar(registro).catch(() => undefined); }} style={botao('perigo', processando)}>
            Cancelar registro
          </button>
        )}
      </div>

      <div style={{ ...cartao, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
        <div><div style={{ fontSize: '11.5px', color: COR.texto2, fontWeight: 700 }}>ABERTO POR</div><div style={{ fontSize: '13.5px', color: COR.azul }}>{registro.solicitanteNome || '—'}</div></div>
        <div><div style={{ fontSize: '11.5px', color: COR.texto2, fontWeight: 700 }}>ABERTO EM</div><div style={{ fontSize: '13.5px', color: COR.azul }}>{formatarDataHora(registro.criadoEm)}</div></div>
        <div><div style={{ fontSize: '11.5px', color: COR.texto2, fontWeight: 700 }}>ÁREA</div><div style={{ fontSize: '13.5px', color: COR.azul }}>{registro.areaNome || '—'}</div></div>
        {registro.concluidoEm && (
          <div><div style={{ fontSize: '11.5px', color: COR.texto2, fontWeight: 700 }}>{registro.situacao === 'cancelado' ? 'CANCELADO EM' : 'CONCLUÍDO EM'}</div><div style={{ fontSize: '13.5px', color: COR.azul }}>{formatarDataHora(registro.concluidoEm)}</div></div>
        )}
        {registro.descricao && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '11.5px', color: COR.texto2, fontWeight: 700 }}>DESCRIÇÃO</div>
            <div style={{ fontSize: '13.5px', color: COR.azul, whiteSpace: 'pre-line' }}>{registro.descricao}</div>
          </div>
        )}
      </div>

      {carregandoRegistro && <CaixaMensagem tipo="info" texto="Carregando o fluxo..." />}

      {!carregandoRegistro && !estado && registro.situacao === 'emAndamento' && (
        <div style={cartao}>
          <div style={{ fontSize: '13.5px', color: COR.azul, marginBottom: '8px' }}>
            O fluxo deste registro ainda não foi iniciado.
          </div>
          <button
            type="button"
            disabled={processando || !podeCriar}
            onClick={() => { iniciarFluxo(registro).catch(() => undefined); }}
            style={botao('principal', processando || !podeCriar)}
          >
            Iniciar fluxo
          </button>
          {!podeCriar && disponibilidade && <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '6px' }}>{disponibilidade.motivo}</div>}
        </div>
      )}

      {!carregandoRegistro && estado && (
        <PainelFluxoOrcamento
          estado={estado}
          dadosResponsaveis={fluxo ? fluxo.dadosResponsaveis(registro, estado.instancia) : {}}
          vinculos={vinculos}
          usuarios={usuarios}
          podeAgir={podeAgir}
          processando={processando}
          onExecutar={(acaoChave, comentario, valores) => executar(registro, acaoChave, comentario, valores)}
          rotuloFluxo={`Fluxo de ${ambiente.nome}`}
          textoConcluido={registro.situacao === 'cancelado' ? 'Registro cancelado' : `✓ ${ambiente.rotuloRegistro} concluído(a) — fluxo encerrado`}
          diagramaAberto={false}
        />
      )}
    </div>
  );

  return (
    <div style={{ fontFamily: FONTE }}>
      {cabecalho}

      {visao.tipo === 'lista' && (
        <nav className={styles.trainingTabs}>
          {abas.filter(item => item.visivel).map(item => {
            const ativo = aba === item.chave;
            const IconeAba = Icones[item.icone];
            return (
              <button
                key={item.chave}
                type="button"
                className={ativo ? styles.trainingTabActive : styles.trainingTab}
                onClick={() => setAba(item.chave)}
                aria-current={ativo ? 'page' : undefined}
              >
                <span style={{ display: 'inline-flex', color: ativo ? '#0874ce' : '#5C7287' }}>
                  <IconeAba />
                </span>
                <strong>{item.rotulo}</strong>
              </button>
            );
          })}
        </nav>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>

        {erro && <CaixaMensagem tipo="erro" texto={erro} />}
        {sucesso && <CaixaMensagem tipo="sucesso" texto={sucesso} />}

        {visao.tipo === 'novo' && renderNovo()}

        {visao.tipo === 'registro' && registroAberto && renderRegistro(registroAberto)}

        {visao.tipo === 'registro' && !registroAberto && !carregando && (
          <CaixaMensagem tipo="alerta" texto="Registro não encontrado (ou sem permissão de leitura)." />
        )}

        {visao.tipo === 'lista' && aba === 'config' && administra && renderConfiguracao()}

        {visao.tipo === 'lista' && aba !== 'config' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
              <input
                value={filtro}
                onChange={evento => setFiltro(evento.target.value)}
                placeholder="Buscar por código, título, etapa, pessoa ou área"
                aria-label="Buscar registros"
                style={{ ...campo, flex: 1, minWidth: '220px' }}
              />
              {aba !== 'pendencias' && (
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', color: COR.azul, cursor: 'pointer' }}>
                  <input type="checkbox" checked={mostrarEncerrados} onChange={() => setMostrarEncerrados(!mostrarEncerrados)} />
                  Mostrar concluídos e cancelados
                </label>
              )}
              <button type="button" disabled={carregando} onClick={() => { carregar().catch(() => undefined); }} style={botao('secundario', carregando)}>
                Atualizar
              </button>
              <button
                type="button"
                disabled={!podeCriar}
                title={podeCriar ? undefined : (disponibilidade ? disponibilidade.motivo : '')}
                onClick={() => { setSucesso(''); setVisao({ tipo: 'novo' }); }}
                style={botao('principal', !podeCriar)}
              >
                + Novo(a) {ambiente.rotuloRegistro.toLowerCase()}
              </button>
            </div>

            {!carregando && disponibilidade && !disponibilidade.ativo && (
              <CaixaMensagem
                tipo="alerta"
                texto={administra ? `${disponibilidade.motivo}\nUse a aba Configuração.` : 'Este ambiente ainda está sendo configurado. Novos registros serão liberados quando o fluxo for publicado.'}
              />
            )}

            {carregando
              ? <CaixaMensagem tipo="info" texto="Carregando registros..." />
              : renderTabelaRegistros()}

            {aba === 'pendencias' && pendencias.length > 0 && (
              <div style={{ fontSize: '12px', color: COR.texto2 }}>
                {pendencias.filter(item => {
                  const prazo = item.tarefa.prazo ? situacaoPrazo(item.tarefa.prazo, item.tarefa.criadaEm) : undefined;
                  return !!prazo && prazo.atrasado;
                }).length} com prazo vencido.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AmbientePage;
