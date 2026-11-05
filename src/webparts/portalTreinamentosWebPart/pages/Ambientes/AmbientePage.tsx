import * as React from 'react';

import ModuloCabecalho from
  '../../components/layout/ModuloCabecalho';

import {
  Pagina
} from '../../constants/routes';

import {
  IAmbiente,
  IAmbienteRegistro
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

import VisaoGeralAmbiente from './VisaoGeralAmbiente';

import RegistroAmbiente from './RegistroAmbiente';

import AmbienteLayoutEditor from './AmbienteLayoutEditor';

import {
  IAmbienteLayout,
  lerLayout,
  normalizarLayout
} from '../../services/ambientes/layoutAmbiente';

import {
  COR,
  CaixaMensagem,
  FONTE,
  botao,
  campo,
  cartao
} from '../Orcamento/orcamentoComum';

// ============================================================
// AMBIENTE DINÂMICO (uma única tela para todos os ambientes)
//
// Telas configuráveis (modelo Arquitetura de Soluções), sem código
// novo por ambiente — ver services/ambientes/layoutAmbiente.ts:
//   Visão geral     → cards de VISÕES (contagem + filtro) e a lista
//                     com as COLUNAS escolhidas (VisaoGeralAmbiente)
//   Registro        → barra de ETAPAS do processo e o conteúdo de cada
//                     etapa (RegistroAmbiente)
//   Personalizar    → editor das telas (AmbienteLayoutEditor)
//   Configuração    → fluxo vinculado, liberação e dados do ambiente
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
  // Telas personalizadas salvas (atualiza a lista de ambientes do portal).
  onLayoutSalvo?: (ambienteId: string, layoutJson: string) => void;
}

type ModoAmbiente = 'inicio' | 'config';

type Visao =
  | { tipo: 'lista' }
  | { tipo: 'novo' }
  | { tipo: 'registro'; registroId: string };

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const mensagem = (erro: unknown): string =>
  erro instanceof Error ? erro.message : String(erro);

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

  const [modo, setModo] = React.useState<ModoAmbiente>('inicio');
  const [visaoSelecionada, setVisaoSelecionada] = React.useState('');
  // Layout salvo nesta sessão (o do portal pode estar desatualizado).
  const [layoutJson, setLayoutJson] = React.useState(ambiente.layoutJson || '');
  const [editorTelas, setEditorTelas] = React.useState(false);
  const [salvandoTelas, setSalvandoTelas] = React.useState(false);
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
    setModo('inicio');
    setVisaoSelecionada('');
    setLayoutJson(ambiente.layoutJson || '');
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

  const podeCriar = !!disponibilidade && disponibilidade.ativo;

  // Telas configuráveis: layout salvo ajustado ao fluxo publicado.
  const layout: IAmbienteLayout =
    normalizarLayout(lerLayout(layoutJson), disponibilidade ? disponibilidade.definicao : undefined);

  const aguardandoIds = pendencias.map(item => item.registro.id);

  // Quem não administra vê só os seus e os que aguardam por ele, salvo
  // se o layout liberar a lista completa.
  const registrosVisiveis =
    administra || layout.lista.todosVeemTodos
      ? registros
      : registros.filter(item => guid(item.solicitanteId) === guid(contexto.usuarioId) || aguardandoIds.indexOf(item.id) >= 0);

  const salvarTelas = async (novo: IAmbienteLayout): Promise<string[]> => {
    if (!servico) {
      return ['Sem conexão com o Dataverse.'];
    }
    setSalvandoTelas(true);
    try {
      const json = JSON.stringify(novo);
      await servico.salvarLayout(ambiente, json);
      setLayoutJson(json);
      if (props.onLayoutSalvo) {
        props.onLayoutSalvo(ambiente.id, json);
      }
      setEditorTelas(false);
      setVisaoSelecionada('');
      setSucesso('Telas do ambiente salvas.');
      return [];
    } catch (falha) {
      return [mensagem(falha)];
    } finally {
      setSalvandoTelas(false);
    }
  };

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
    <RegistroAmbiente
      ambiente={ambiente}
      registro={registro}
      layout={layout}
      estado={estado}
      carregando={carregandoRegistro}
      podeAgir={podeAgir}
      processando={processando}
      podeCancelar={administra}
      podeIniciar={podeCriar}
      motivoNaoIniciar={disponibilidade ? disponibilidade.motivo : undefined}
      dadosResponsaveis={fluxo && estado ? fluxo.dadosResponsaveis(registro, estado.instancia) : {}}
      vinculos={vinculos}
      usuarios={usuarios}
      onVoltar={() => { setVisao({ tipo: 'lista' }); setSucesso(''); }}
      onCancelar={() => { cancelar(registro).catch(() => undefined); }}
      onIniciarFluxo={() => { iniciarFluxo(registro).catch(() => undefined); }}
      onExecutar={(acaoChave, comentario, valores) => executar(registro, acaoChave, comentario, valores)}
    />
  );

  return (
    <div style={{ fontFamily: FONTE }}>
      {cabecalho}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>

        {erro && <CaixaMensagem tipo="erro" texto={erro} />}
        {sucesso && <CaixaMensagem tipo="sucesso" texto={sucesso} />}

        {visao.tipo === 'novo' && renderNovo()}

        {visao.tipo === 'registro' && registroAberto && renderRegistro(registroAberto)}

        {visao.tipo === 'registro' && !registroAberto && !carregando && (
          <CaixaMensagem tipo="alerta" texto="Registro não encontrado (ou sem permissão de leitura)." />
        )}

        {visao.tipo === 'lista' && modo === 'config' && administra && (
          <>
            <div>
              <button type="button" onClick={() => setModo('inicio')} style={botao('secundario')}>← Visão geral</button>
            </div>
            {renderConfiguracao()}
          </>
        )}

        {editorTelas && (
          <AmbienteLayoutEditor
            layout={layout}
            definicao={disponibilidade ? disponibilidade.definicao : undefined}
            disponivel={AmbienteService.telasConfiguraveisDisponiveis()}
            processando={salvandoTelas}
            onSalvar={salvarTelas}
            onFechar={() => setEditorTelas(false)}
          />
        )}

        {visao.tipo === 'lista' && modo === 'inicio' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
              <input
                value={filtro}
                onChange={evento => setFiltro(evento.target.value)}
                placeholder="Buscar por código, título, etapa, pessoa ou área"
                aria-label="Buscar registros"
                style={{ ...campo, flex: 1, minWidth: '220px' }}
              />
              {!visaoSelecionada && (
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', color: COR.azul, cursor: 'pointer' }}>
                  <input type="checkbox" checked={mostrarEncerrados} onChange={() => setMostrarEncerrados(!mostrarEncerrados)} />
                  Mostrar concluídos e cancelados
                </label>
              )}
              <button type="button" disabled={carregando} onClick={() => { carregar().catch(() => undefined); }} style={botao('secundario', carregando)}>
                Atualizar
              </button>
              {administra && (
                <>
                  <button type="button" onClick={() => setEditorTelas(true)} style={botao('secundario')} title="Visões, colunas, etapas e tela do registro">
                    Personalizar telas
                  </button>
                  <button type="button" onClick={() => setModo('config')} style={botao('secundario')} title="Fluxo, liberação e dados do ambiente">
                    Configuração
                  </button>
                </>
              )}
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
                texto={administra ? `${disponibilidade.motivo}\nUse o botão Configuração.` : 'Este ambiente ainda está sendo configurado. Novos registros serão liberados quando o fluxo for publicado.'}
              />
            )}

            {carregando
              ? <CaixaMensagem tipo="info" texto="Carregando registros..." />
              : (
                <VisaoGeralAmbiente
                  ambiente={ambiente}
                  layout={layout}
                  definicao={disponibilidade ? disponibilidade.definicao : undefined}
                  registros={registrosVisiveis}
                  contextoFiltro={{ usuarioId: contexto.usuarioId, aguardandoIds }}
                  visaoSelecionada={visaoSelecionada}
                  onSelecionarVisao={setVisaoSelecionada}
                  busca={filtro}
                  mostrarEncerrados={mostrarEncerrados}
                  onAbrir={registro => { abrirRegistro(registro).catch(() => undefined); }}
                />
              )}
          </>
        )}
      </div>
    </div>
  );
};

export default AmbientePage;
