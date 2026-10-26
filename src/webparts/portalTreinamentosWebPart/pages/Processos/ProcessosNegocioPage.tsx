import * as React from 'react';

import {
  IDocumento
} from '../../models/Documento';

import {
  IFluxoDefinicao
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  IAreaAdmin
} from '../../services/AreaAdminService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  fluxoDoProcessoParaTipo,
  IDadosProcessoNegocio,
  IExcecaoFluxoProcesso,
  IProcessoNegocio,
  ProcessoNegocioService
} from '../../services/processos/ProcessoNegocioService';

import {
  useProcessos
} from '../../hooks/useProcessos';

import {
  nomeDoTipo,
  tipoDoCodigo,
  TIPOS_DOCUMENTO
} from '../../constants/tiposDocumento';

// ============================================================
// PROCESSOS (de negócio)
//
//   Área → Processo → POP / MAP / IT ... (documentos)
//
// Cada processo define o FLUXO que seus documentos seguem (padrão do
// processo + exceções por tipo). Os fluxos ficam na aba "Fluxos".
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO_2 = '#5E6670';

export interface IProcessosNegocioPageProps {
  documentos: IDocumento[];
  areas?: IAreaAdmin[];
  contexto?: IContextoAcesso;
  dataverseService?: DataverseService;
  onAbrirDocumento: (documento: IDocumento) => void;
  onIrParaFluxos: () => void;
}

const guid = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const versaoPublicada = (
  versoes: IFluxoDefinicao[] | undefined
): number | undefined => {
  const publicada = (versoes || []).find(item => item.status === 'publicado');
  return publicada ? publicada.versao : undefined;
};

const botao = (
  principal: boolean,
  desabilitado = false
): React.CSSProperties => ({
  padding: '7px 12px',
  borderRadius: '6px',
  border: principal ? 0 : `1px solid ${COR_AZUL}`,
  background: desabilitado ? '#CBD5E1' : principal ? COR_AZUL : '#FFFFFF',
  color: principal || desabilitado ? '#FFFFFF' : COR_AZUL,
  fontSize: '12.5px',
  fontWeight: 700,
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap'
});

const estiloEntrada: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  fontSize: '13px',
  color: COR_AZUL,
  fontFamily: 'inherit',
  background: '#FFFFFF'
};

const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  marginBottom: '4px'
};

const selo = (
  textoSelo: string,
  tipo: 'ok' | 'neutro' | 'atencao'
): React.ReactElement => (
  <span
    style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 700,
      color: tipo === 'atencao' ? COR_INDIGO : COR_AZUL,
      background: tipo === 'ok' ? '#E6F9FC' : tipo === 'atencao' ? '#E8EAF8' : '#F2F2F2',
      border: tipo === 'ok' ? `1px solid ${COR_CIANO}` : '1px solid transparent',
      whiteSpace: 'nowrap'
    }}
  >
    {textoSelo}
  </span>
);

// ============================================================
// EDITAR / NOVO PROCESSO
// ============================================================

const EditarProcessoModal: React.FC<{
  dados: IDadosProcessoNegocio;
  areas: IAreaAdmin[];
  fluxos: IProcesso[];
  fluxosPorProcesso: Record<string, IFluxoDefinicao[]>;
  documentosAfetados: number;
  processando: boolean;
  nomeArea: (id: string) => string;
  onCancelar: () => void;
  onSalvar: (dados: IDadosProcessoNegocio) => void;
}> = ({
  dados,
  areas,
  fluxos,
  fluxosPorProcesso,
  documentosAfetados,
  processando,
  onCancelar,
  onSalvar
}) => {

  const [form, setForm] =
    React.useState<IDadosProcessoNegocio>(dados);

  const alterar = (parcial: Partial<IDadosProcessoNegocio>): void =>
    setForm(atual => ({ ...atual, ...parcial }));

  const alterarExcecao = (indice: number, parcial: Partial<IExcecaoFluxoProcesso>): void =>
    setForm(atual => ({
      ...atual,
      excecoes: atual.excecoes.map((item, i) => (i === indice ? { ...item, ...parcial } : item))
    }));

  const opcaoFluxo = (fluxo: IProcesso): React.ReactElement => {
    const versao = versaoPublicada(fluxosPorProcesso[fluxo.id]);
    return (
      <option key={fluxo.id} value={guid(fluxo.id)} disabled={!versao}>
        {fluxo.codigo ? `${fluxo.codigo} — ` : ''}{fluxo.nome}{versao ? ` · v${versao}` : ' · sem versão publicada (indisponível)'}
      </option>
    );
  };

  const tiposUsados =
    form.excecoes.map(item => item.tipoDocumento);

  const valido =
    !!form.nome.trim() && !!form.codigo.trim() && !!form.areaId && !!form.fluxoPadraoId &&
    form.excecoes.every(item => !!item.tipoDocumento && !!item.fluxoId);

  return (
    <div role="dialog" aria-modal="true" aria-label="Processo" style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '30px 20px', overflowY: 'auto', background: 'rgba(15,23,42,.55)' }}>
      <div style={{ width: '100%', maxWidth: '680px', padding: '24px', background: '#FFFFFF', borderRadius: '16px', color: COR_AZUL, fontSize: '13.5px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '19px' }}>{dados.id ? 'Editar processo' : 'Novo processo'}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', gap: '12px' }}>
          <div>
            <label htmlFor="proc-codigo" style={rotulo}>Código *</label>
            <input id="proc-codigo" value={form.codigo} onChange={evento => alterar({ codigo: evento.target.value.toUpperCase() })} style={estiloEntrada} />
          </div>
          <div>
            <label htmlFor="proc-nome" style={rotulo}>Nome *</label>
            <input id="proc-nome" value={form.nome} onChange={evento => alterar({ nome: evento.target.value })} placeholder="Ex.: Proposta de Solução" style={estiloEntrada} />
          </div>
        </div>

        <div style={{ marginTop: '12px' }}>
          <label htmlFor="proc-area" style={rotulo}>Área *</label>
          <select id="proc-area" value={form.areaId} onChange={evento => alterar({ areaId: guid(evento.target.value) })} style={estiloEntrada}>
            <option value="">Selecione...</option>
            {areas.map(area => <option key={area.id} value={guid(area.id)}>{area.sigla ? `${area.sigla} — ` : ''}{area.nome}</option>)}
          </select>
        </div>

        <div style={{ marginTop: '12px' }}>
          <label htmlFor="proc-descricao" style={rotulo}>Descrição</label>
          <textarea id="proc-descricao" rows={2} value={form.descricao} onChange={evento => alterar({ descricao: evento.target.value })} style={estiloEntrada} />
        </div>

        <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', border: `1px solid ${COR_BORDA}`, background: '#F8FAFC' }}>
          <label htmlFor="proc-fluxo" style={rotulo}>Fluxo padrão dos documentos *</label>
          <select id="proc-fluxo" value={form.fluxoPadraoId} onChange={evento => alterar({ fluxoPadraoId: guid(evento.target.value) })} style={estiloEntrada}>
            <option value="">Selecione...</option>
            {fluxos.map(opcaoFluxo)}
          </select>
          <div style={{ fontSize: '12px', color: COR_TEXTO_2, marginTop: '4px' }}>
            Vale para todos os documentos do processo, exceto os tipos com exceção abaixo.
          </div>

          <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 700 }}>Exceções por tipo de documento</div>
          {
            form.excecoes.map(
              (excecao, indice) => (
                <div key={indice} style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr) auto', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                  <select
                    aria-label="Tipo de documento"
                    value={excecao.tipoDocumento}
                    onChange={evento => alterarExcecao(indice, { tipoDocumento: evento.target.value })}
                    style={estiloEntrada}
                  >
                    <option value="">Tipo...</option>
                    {
                      TIPOS_DOCUMENTO.map(tipo => (
                        <option key={tipo.sigla} value={tipo.sigla} disabled={tiposUsados.indexOf(tipo.sigla) >= 0 && tipo.sigla !== excecao.tipoDocumento}>
                          {tipo.sigla} — {tipo.nome}
                        </option>
                      ))
                    }
                  </select>
                  <select
                    aria-label="Fluxo do tipo"
                    value={excecao.fluxoId}
                    onChange={evento => alterarExcecao(indice, { fluxoId: guid(evento.target.value) })}
                    style={estiloEntrada}
                  >
                    <option value="">Fluxo...</option>
                    {fluxos.map(opcaoFluxo)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setForm(atual => ({ ...atual, excecoes: atual.excecoes.filter((_, i) => i !== indice) }))}
                    style={{ ...botao(false), padding: '6px 10px' }}
                  >
                    remover
                  </button>
                </div>
              )
            )
          }
          <button
            type="button"
            onClick={() => setForm(atual => ({ ...atual, excecoes: atual.excecoes.concat([{ tipoDocumento: '', fluxoId: '' }]) }))}
            style={{ marginTop: '8px', padding: 0, border: 0, background: 'transparent', color: COR_INDIGO, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: '12.5px' }}
          >
            + exceção por tipo (ex.: IT segue outro fluxo)
          </button>
        </div>

        {
          documentosAfetados > 0 && (
            <div style={{ marginTop: '12px', fontSize: '12.5px', color: COR_INDIGO }}>
              Ao salvar, os {documentosAfetados} documento(s) do processo passam a seguir esta configuração. Revisões
              com fluxo já em andamento terminam no fluxo atual; a próxima revisão já usa o novo.
            </div>
          )
        }

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          <button type="button" disabled={processando} onClick={onCancelar} style={botao(false, processando)}>Cancelar</button>
          <button type="button" disabled={!valido || processando} onClick={() => onSalvar(form)} style={botao(true, !valido || processando)}>
            {processando ? 'Salvando...' : 'Salvar processo'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ADICIONAR DOCUMENTOS AO PROCESSO
// ============================================================

const AdicionarDocumentosModal: React.FC<{
  processo: IProcessoNegocio;
  documentos: IDocumento[];
  processoDoDocumento: Record<string, string>;
  processos: IProcessoNegocio[];
  processando: boolean;
  onCancelar: () => void;
  onAdicionar: (lista: IDocumento[]) => void;
}> = ({
  processo,
  documentos,
  processoDoDocumento,
  processos,
  processando,
  onCancelar,
  onAdicionar
}) => {

  const [busca, setBusca] =
    React.useState<string>('');

  const [soDaArea, setSoDaArea] =
    React.useState<boolean>(true);

  const [marcados, setMarcados] =
    React.useState<Record<string, boolean>>({});

  const termo = busca.trim().toLowerCase();

  const lista =
    documentos
      .filter(item => !soDaArea || guid(item.areaId) === processo.areaId)
      .filter(item => !termo || `${item.codigo} ${item.titulo}`.toLowerCase().indexOf(termo) >= 0)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const escolhidos =
    documentos.filter(item => marcados[item.id]);

  const processoAtual = (documentoId: string): IProcessoNegocio | undefined =>
    processos.find(item => item.id === processoDoDocumento[guid(documentoId)]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Adicionar documentos" style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '30px 20px', overflowY: 'auto', background: 'rgba(15,23,42,.55)' }}>
      <div style={{ width: '100%', maxWidth: '760px', padding: '24px', background: '#FFFFFF', borderRadius: '16px', color: COR_AZUL, fontSize: '13.5px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '19px' }}>Adicionar documentos a {processo.codigo}</h2>
        <div style={{ color: COR_TEXTO_2, fontSize: '12.5px', marginBottom: '12px' }}>
          Um documento pertence a um só processo: se já estiver em outro, ele é movido. Ele passa a seguir o fluxo deste
          processo (a revisão em andamento termina no fluxo atual).
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
          <input type="search" placeholder="Pesquisar documento..." value={busca} onChange={evento => setBusca(evento.target.value)} style={{ ...estiloEntrada, maxWidth: '320px' }} />
          <label style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={soDaArea} onChange={evento => setSoDaArea(evento.target.checked)} />
            Só da área do processo
          </label>
        </div>
        <div style={{ maxHeight: '380px', overflowY: 'auto', border: `1px solid ${COR_BORDA}`, borderRadius: '8px' }}>
          {
            lista.length === 0
              ? <div style={{ padding: '14px', color: COR_TEXTO_2 }}>Nenhum documento disponível.</div>
              : lista.map(
                documento => {
                  const atual = processoAtual(documento.id);
                  return (
                    <label key={documento.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${COR_BORDA}`, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!marcados[documento.id]}
                        onChange={evento => setMarcados(antes => ({ ...antes, [documento.id]: evento.target.checked }))}
                      />
                      <span style={{ flexGrow: 1 }}>
                        <strong>{documento.codigo}</strong> — {documento.titulo}
                      </span>
                      {atual ? selo(`em ${atual.codigo} (será movido)`, 'atencao') : selo('sem processo', 'neutro')}
                    </label>
                  );
                }
              )
          }
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
          <button type="button" disabled={processando} onClick={onCancelar} style={botao(false, processando)}>Cancelar</button>
          <button type="button" disabled={escolhidos.length === 0 || processando} onClick={() => onAdicionar(escolhidos)} style={botao(true, escolhidos.length === 0 || processando)}>
            Adicionar {escolhidos.length} documento(s)
          </button>
        </div>
      </div>
    </div>
  );
};

const ProcessosNegocioPage: React.FC<IProcessosNegocioPageProps> = ({
  documentos,
  areas = [],
  contexto,
  dataverseService,
  onAbrirDocumento,
  onIrParaFluxos
}) => {

  const referencias =
    React.useMemo(
      () => documentos.map(documento => ({ id: documento.id, codigo: documento.codigo })),
      [documentos]
    );

  // Fluxos (= cadastros antigos de "processo") e vínculos doc ↔ fluxo.
  const fluxos =
    useProcessos(dataverseService, referencias);

  const servico =
    React.useMemo(
      () => (dataverseService ? new ProcessoNegocioService(dataverseService) : undefined),
      [dataverseService]
    );

  const podeEditar =
    !!contexto &&
    (
      contexto.perfil === 'Administrador' ||
      (contexto.podeGerenciarProcessos !== undefined
        ? contexto.podeGerenciarProcessos
        : contexto.podeGerenciarDocumentos)
    );

  const [processos, setProcessos] =
    React.useState<IProcessoNegocio[]>([]);

  const [processoDoDocumento, setProcessoDoDocumento] =
    React.useState<Record<string, string>>({});

  const [carregando, setCarregando] =
    React.useState<boolean>(true);

  const [erro, setErro] =
    React.useState<string>('');

  const [mensagem, setMensagem] =
    React.useState<string>('');

  const [busca, setBusca] =
    React.useState<string>('');

  const [areaFiltro, setAreaFiltro] =
    React.useState<string>('');

  const [mostrarInativos, setMostrarInativos] =
    React.useState<boolean>(false);

  const [abertos, setAbertos] =
    React.useState<Record<string, boolean>>({});

  const [edicao, setEdicao] =
    React.useState<IDadosProcessoNegocio | undefined>(undefined);

  const [adicionarEm, setAdicionarEm] =
    React.useState<IProcessoNegocio | undefined>(undefined);

  const [processando, setProcessando] =
    React.useState<string>('');

  const carregar = React.useCallback(
    async (): Promise<void> => {
      if (!servico) {
        setCarregando(false);
        return;
      }
      setCarregando(true);
      setErro('');
      try {
        const [lista, mapa] = await Promise.all([servico.listar(), servico.processoPorDocumento()]);
        setProcessos(lista);
        setProcessoDoDocumento(mapa);
      } catch (error) {
        console.error(error);
        setErro(error instanceof Error ? error.message : 'Não foi possível carregar os processos.');
      } finally {
        setCarregando(false);
      }
    },
    [servico]
  );

  React.useEffect(
    () => { carregar().catch((error: unknown) => console.error(error)); },
    [carregar]
  );

  // ---------------- Dados derivados ----------------

  const areasAtivas =
    areas
      .filter(area => area.ativa)
      .sort((a, b) => (a.sigla || a.nome).localeCompare(b.sigla || b.nome, 'pt-BR'));

  const nomeArea = (id: string): string => {
    const area = areas.find(item => guid(item.id) === guid(id));
    return area ? `${area.sigla ? `${area.sigla} — ` : ''}${area.nome}` : 'Área não encontrada';
  };

  const fluxosDisponiveis =
    fluxos.processos
      .filter(item => item.ativo)
      .sort((a, b) => (a.codigo || a.nome).localeCompare(b.codigo || b.nome, 'pt-BR'));

  const descreverFluxo = (fluxoId: string): { texto: string; publicado: boolean } => {
    const fluxo = fluxos.processos.find(item => guid(item.id) === guid(fluxoId));
    if (!fluxo) {
      return { texto: fluxoId ? 'Fluxo não encontrado' : 'Sem fluxo', publicado: false };
    }
    const versao = versaoPublicada(fluxos.fluxosPorProcesso[fluxo.id]);
    return {
      texto: `${fluxo.codigo ? `${fluxo.codigo} — ` : ''}${fluxo.nome}${versao ? ` · v${versao}` : ' · sem versão publicada'}`,
      publicado: !!versao
    };
  };

  const documentosDoProcesso = (processoId: string): IDocumento[] =>
    documentos.filter(documento => processoDoDocumento[guid(documento.id)] === processoId);

  const documentosSemProcesso = (areaId: string): IDocumento[] =>
    documentos.filter(
      documento =>
        guid(documento.areaId) === guid(areaId) &&
        !processoDoDocumento[guid(documento.id)]
    );

  // Fluxo que o documento segue hoje (vínculo principal).
  const fluxoAtualDoDocumento = (documentoId: string): string => {
    const doDocumento = fluxos.vinculos.filter(item => item.documentoId === guid(documentoId));
    const principal = doDocumento.find(item => item.principal) || (doDocumento.length === 1 ? doDocumento[0] : undefined);
    return principal ? principal.processoId : '';
  };

  const termo =
    busca.trim().toLowerCase();

  const processoVisivel = (processo: IProcessoNegocio): boolean => {
    if (!mostrarInativos && !processo.ativo) {
      return false;
    }
    if (areaFiltro && processo.areaId !== guid(areaFiltro)) {
      return false;
    }
    if (!termo) {
      return true;
    }
    const docs = documentosDoProcesso(processo.id);
    return (
      `${processo.codigo} ${processo.nome} ${processo.descricao}`.toLowerCase().indexOf(termo) >= 0 ||
      docs.some(item => `${item.codigo} ${item.titulo}`.toLowerCase().indexOf(termo) >= 0)
    );
  };

  // ---------------- Ações ----------------

  const executar = async (
    texto: string,
    acao: () => Promise<string>
  ): Promise<void> => {
    setProcessando(texto);
    setErro('');
    setMensagem('');
    try {
      setMensagem(await acao());
      await Promise.all([carregar(), fluxos.recarregar(true)]);
    } catch (error) {
      console.error(error);
      setErro(error instanceof Error ? error.message : 'Não foi possível concluir.');
    } finally {
      setProcessando('');
    }
  };

  // Ajusta o fluxo dos documentos do processo à configuração dele.
  const sincronizarDocumentos = async (
    processo: IProcessoNegocio | IDadosProcessoNegocio,
    lista: IDocumento[]
  ): Promise<string> => {

    if (!servico) {
      return '';
    }

    const processoBase = {
      ...processo,
      id: processo.id || '',
      areaNome: '',
      fluxoPadraoNome: ''
    } as IProcessoNegocio;

    let alterados = 0;
    const falhas: string[] = [];

    for (const documento of lista) {
      const fluxoId = fluxoDoProcessoParaTipo(processoBase, tipoDoCodigo(documento.codigo));
      try {
        if ((await servico.sincronizarFluxoDoDocumento(documento.id, fluxoId)) === 'alterado') {
          alterados++;
        }
      } catch (error) {
        console.error(error);
        falhas.push(`${documento.codigo}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return [
      alterados > 0 ? `${alterados} documento(s) passaram a seguir o fluxo do processo (a próxima revisão já usa o fluxo novo).` : '',
      falhas.length > 0 ? `Não foi possível ajustar: ${falhas.join('; ')}` : ''
    ].filter(item => !!item).join(' ');
  };

  const salvarProcesso = (dados: IDadosProcessoNegocio): void => {
    if (!servico) {
      return;
    }
    executar('Salvando o processo...', async () => {
      const id = await servico.salvar(dados);
      const lista = documentosDoProcesso(id);
      const ajuste = lista.length > 0 ? await sincronizarDocumentos({ ...dados, id }, lista) : '';
      setEdicao(undefined);
      return `Processo ${dados.codigo.toUpperCase()} salvo.${ajuste ? ` ${ajuste}` : ''}`;
    }).catch((error: unknown) => console.error(error));
  };

  const alternarAtivo = (processo: IProcessoNegocio): void => {
    if (!servico) {
      return;
    }
    if (processo.ativo && documentosDoProcesso(processo.id).length > 0) {
      setErro('Retire ou mova os documentos deste processo antes de inativá-lo.');
      return;
    }
    executar(processo.ativo ? 'Inativando...' : 'Reativando...', async () => {
      await servico.salvar({ ...processo, ativo: !processo.ativo });
      return processo.ativo ? `Processo ${processo.codigo} inativado.` : `Processo ${processo.codigo} reativado.`;
    }).catch((error: unknown) => console.error(error));
  };

  const adicionarDocumentos = (processo: IProcessoNegocio, lista: IDocumento[]): void => {
    if (!servico) {
      return;
    }
    executar(`Adicionando ${lista.length} documento(s)...`, async () => {
      for (const documento of lista) {
        await servico.definirProcessoDoDocumento(documento.id, processo.id);
      }
      const ajuste = await sincronizarDocumentos(processo, lista);
      setAdicionarEm(undefined);
      return `${lista.length} documento(s) adicionado(s) a ${processo.codigo}.${ajuste ? ` ${ajuste}` : ''}`;
    }).catch((error: unknown) => console.error(error));
  };

  const retirarDocumento = (processo: IProcessoNegocio, documento: IDocumento): void => {
    if (!servico) {
      return;
    }
    if (!window.confirm(`Retirar ${documento.codigo} do processo ${processo.codigo}? O documento continua seguindo o fluxo atual até ser adicionado a outro processo.`)) {
      return;
    }
    executar('Retirando o documento...', async () => {
      await servico.definirProcessoDoDocumento(documento.id, undefined);
      return `${documento.codigo} retirado de ${processo.codigo}.`;
    }).catch((error: unknown) => console.error(error));
  };

  const novoProcesso = (areaId: string): void => {
    const area = areas.find(item => guid(item.id) === guid(areaId));
    const sigla = (area && area.sigla ? area.sigla : 'PRC').toUpperCase();
    const prefixo = `${sigla}-PRC-`;
    const maior =
      processos
        .filter(item => item.codigo.toUpperCase().indexOf(prefixo) === 0)
        .map(item => Number(item.codigo.substring(prefixo.length)) || 0)
        .reduce((a, b) => Math.max(a, b), 0);
    setEdicao({
      codigo: `${prefixo}${`00${maior + 1}`.slice(-3)}`,
      nome: '',
      descricao: '',
      areaId: guid(areaId),
      fluxoPadraoId: '',
      ordem: 0,
      ativo: true,
      excecoes: []
    });
  };

  // ---------------- Render ----------------

  if (!dataverseService) {
    return <div style={{ padding: '20px', color: COR_TEXTO_2 }}>Processos disponíveis só com o Dataverse.</div>;
  }

  const areasComConteudo =
    areasAtivas.filter(
      area =>
        (!areaFiltro || guid(area.id) === guid(areaFiltro)) &&
        (processos.some(item => item.areaId === guid(area.id) && processoVisivel(item)) ||
          (!termo && documentosSemProcesso(area.id).length > 0) ||
          (!termo && podeEditar && !!areaFiltro))
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: COR_AZUL }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Processos</h2>
          <div style={{ color: COR_TEXTO_2, fontSize: '13px' }}>
            Área → processo → documentos. Cada processo define o fluxo que seus documentos seguem
            ({' '}
            <button type="button" onClick={onIrParaFluxos} style={{ padding: 0, border: 0, background: 'transparent', color: COR_INDIGO, textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}>
              ver fluxos
            </button>
            ).
          </div>
        </div>
        {
          podeEditar && (
            <button
              type="button"
              disabled={!!processando || areasAtivas.length === 0}
              onClick={() => novoProcesso(areaFiltro || (areasAtivas[0] ? areasAtivas[0].id : ''))}
              style={botao(true, !!processando)}
            >
              + Novo processo
            </button>
          )
        }
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Pesquisar processo ou documento..."
          value={busca}
          onChange={evento => setBusca(evento.target.value)}
          style={{ ...estiloEntrada, maxWidth: '380px' }}
        />
        <select
          aria-label="Filtrar por área"
          value={areaFiltro}
          onChange={evento => setAreaFiltro(evento.target.value)}
          style={{ ...estiloEntrada, maxWidth: '300px' }}
        >
          <option value="">Todas as áreas</option>
          {areasAtivas.map(area => <option key={area.id} value={area.id}>{area.sigla ? `${area.sigla} — ` : ''}{area.nome}</option>)}
        </select>
        <label style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
          <input type="checkbox" checked={mostrarInativos} onChange={evento => setMostrarInativos(evento.target.checked)} />
          Mostrar inativos
        </label>
      </div>

      {processando && <div style={{ fontWeight: 600 }}>{processando}</div>}

      {
        erro && (
          <div role="alert" style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COR_INDIGO}`, background: '#E8EAF8', fontSize: '13px' }}>
            {erro}
          </div>
        )
      }

      {
        mensagem && !erro && (
          <div style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COR_CIANO}`, background: '#E6F9FC', fontSize: '13px', fontWeight: 600 }}>
            ✓ {mensagem}
          </div>
        )
      }

      {
        carregando
          ? <div style={{ color: COR_TEXTO_2 }}>Carregando processos...</div>
          : areasComConteudo.length === 0
            ? (
              <div style={{ padding: '20px', borderRadius: '10px', border: `1px dashed ${COR_BORDA}`, color: COR_TEXTO_2 }}>
                {processos.length === 0
                  ? 'Nenhum processo cadastrado ainda. Use “+ Novo processo” para criar o primeiro e definir o fluxo dos documentos dele.'
                  : 'Nenhum processo encontrado com estes filtros.'}
              </div>
            )
            : areasComConteudo.map(
              area => {
                const daArea = processos.filter(item => item.areaId === guid(area.id) && processoVisivel(item));
                const soltos = termo ? [] : documentosSemProcesso(area.id);
                return (
                  <section key={area.id} style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '10px', overflow: 'hidden', background: '#FFFFFF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 16px', background: COR_AZUL, color: '#FFFFFF' }}>
                      <strong style={{ fontSize: '13px', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        {area.sigla ? `${area.sigla} — ` : ''}{area.nome}
                      </strong>
                      <span style={{ fontSize: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {daArea.length} processo(s)
                        {
                          podeEditar && (
                            <button
                              type="button"
                              disabled={!!processando}
                              onClick={() => novoProcesso(area.id)}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #FFFFFF', background: 'transparent', color: '#FFFFFF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              + Processo nesta área
                            </button>
                          )
                        }
                      </span>
                    </div>

                    {
                      daArea.map(
                        processo => {
                          const docs = documentosDoProcesso(processo.id);
                          const aberto = abertos[processo.id] !== undefined ? abertos[processo.id] : !!termo;
                          const fluxoPadrao = descreverFluxo(processo.fluxoPadraoId);
                          const tipos = docs
                            .map(item => tipoDoCodigo(item.codigo) || 'OUTROS')
                            .filter((tipo, indice, lista) => lista.indexOf(tipo) === indice)
                            .sort();
                          return (
                            <div key={processo.id} style={{ borderTop: `1px solid ${COR_BORDA}`, opacity: processo.ativo ? 1 : 0.6 }}>
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 16px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => setAbertos(atual => ({ ...atual, [processo.id]: !aberto }))}
                                  aria-expanded={aberto}
                                  style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: '14px', color: COR_AZUL, padding: '2px 4px' }}
                                >
                                  {aberto ? '▾' : '▸'}
                                </button>
                                <div style={{ flexGrow: 1, minWidth: '260px' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <strong style={{ fontSize: '14px' }}>{processo.codigo} — {processo.nome}</strong>
                                    {selo(`${docs.length} documento(s)`, 'neutro')}
                                    {!processo.ativo && selo('Inativo', 'neutro')}
                                  </div>
                                  {processo.descricao && <div style={{ color: COR_TEXTO_2, fontSize: '12.5px', marginTop: '2px' }}>{processo.descricao}</div>}
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', fontSize: '12px', alignItems: 'center' }}>
                                    <span style={{ color: COR_TEXTO_2 }}>Fluxo:</span>
                                    {selo(fluxoPadrao.texto, fluxoPadrao.publicado ? 'ok' : 'atencao')}
                                    {
                                      processo.excecoes.map(
                                        excecao => {
                                          const fluxo = descreverFluxo(excecao.fluxoId);
                                          return (
                                            <span key={`${excecao.tipoDocumento}-${excecao.fluxoId}`}>
                                              {selo(`${excecao.tipoDocumento} → ${fluxo.texto}`, fluxo.publicado ? 'ok' : 'atencao')}
                                            </span>
                                          );
                                        }
                                      )
                                    }
                                  </div>
                                </div>
                                {
                                  podeEditar && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                      <button type="button" disabled={!!processando || !processo.ativo} onClick={() => setAdicionarEm(processo)} style={botao(true, !!processando || !processo.ativo)}>
                                        + Documentos
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!!processando}
                                        onClick={() => setEdicao({ ...processo, excecoes: processo.excecoes.map(item => ({ ...item })) })}
                                        style={botao(false, !!processando)}
                                      >
                                        Editar
                                      </button>
                                      <button type="button" disabled={!!processando} onClick={() => alternarAtivo(processo)} style={botao(false, !!processando)}>
                                        {processo.ativo ? 'Inativar' : 'Reativar'}
                                      </button>
                                    </div>
                                  )
                                }
                              </div>

                              {
                                aberto && (
                                  <div style={{ padding: '0 16px 14px 46px' }}>
                                    {
                                      docs.length === 0
                                        ? <div style={{ color: COR_TEXTO_2, fontSize: '12.5px' }}>Nenhum documento neste processo.</div>
                                        : tipos.map(
                                          tipo => (
                                            <div key={tipo} style={{ marginBottom: '8px' }}>
                                              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.05em', color: COR_TEXTO_2, textTransform: 'uppercase', marginBottom: '4px' }}>
                                                {tipo} — {nomeDoTipo(tipo)}
                                              </div>
                                              {
                                                docs
                                                  .filter(item => (tipoDoCodigo(item.codigo) || 'OUTROS') === tipo)
                                                  .sort((a, b) => a.codigo.localeCompare(b.codigo))
                                                  .map(
                                                    documento => {
                                                      const esperado = fluxoDoProcessoParaTipo(processo, tipo);
                                                      const atual = fluxoAtualDoDocumento(documento.id);
                                                      const divergente = !!esperado && !!atual && guid(esperado) !== guid(atual);
                                                      return (
                                                        <div
                                                          key={documento.id}
                                                          style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${COR_BORDA}`, marginBottom: '4px', flexWrap: 'wrap' }}
                                                        >
                                                          <button
                                                            type="button"
                                                            onClick={() => onAbrirDocumento(documento)}
                                                            style={{ padding: 0, border: 0, background: 'transparent', color: COR_AZUL, fontWeight: 700, cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}
                                                          >
                                                            {documento.codigo} — {documento.titulo}
                                                          </button>
                                                          {selo(`${documento.revisaoAtual || documento.revisao || ''} · ${documento.status || ''}`, 'neutro')}
                                                          {divergente && selo(`segue ${descreverFluxo(atual).texto}`, 'atencao')}
                                                          {
                                                            podeEditar && (
                                                              <button
                                                                type="button"
                                                                disabled={!!processando}
                                                                onClick={() => retirarDocumento(processo, documento)}
                                                                style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '6px', border: `1px solid ${COR_BORDA}`, background: '#FFFFFF', color: COR_AZUL, fontSize: '11.5px', cursor: 'pointer' }}
                                                              >
                                                                retirar
                                                              </button>
                                                            )
                                                          }
                                                        </div>
                                                      );
                                                    }
                                                  )
                                              }
                                            </div>
                                          )
                                        )
                                    }
                                  </div>
                                )
                              }
                            </div>
                          );
                        }
                      )
                    }

                    {
                      soltos.length > 0 && (
                        <div style={{ borderTop: `1px solid ${COR_BORDA}`, padding: '10px 16px', background: '#F8FAFC', fontSize: '12.5px' }}>
                          <strong>{soltos.length} documento(s) desta área sem processo:</strong>{' '}
                          <span style={{ color: COR_TEXTO_2 }}>
                            {soltos.slice(0, 8).map(item => item.codigo).join(', ')}{soltos.length > 8 ? '…' : ''}
                          </span>
                          {podeEditar && daArea.length > 0 ? <span style={{ color: COR_TEXTO_2 }}> — use “+ Documentos” no processo.</span> : null}
                        </div>
                      )
                    }
                  </section>
                );
              }
            )
      }

      {
        edicao && (
          <EditarProcessoModal
            dados={edicao}
            areas={areasAtivas}
            fluxos={fluxosDisponiveis}
            fluxosPorProcesso={fluxos.fluxosPorProcesso}
            documentosAfetados={edicao.id ? documentosDoProcesso(guid(edicao.id)).length : 0}
            processando={!!processando}
            nomeArea={nomeArea}
            onCancelar={() => setEdicao(undefined)}
            onSalvar={salvarProcesso}
          />
        )
      }

      {
        adicionarEm && (
          <AdicionarDocumentosModal
            processo={adicionarEm}
            documentos={documentos.filter(item => processoDoDocumento[guid(item.id)] !== adicionarEm.id)}
            processoDoDocumento={processoDoDocumento}
            processos={processos}
            processando={!!processando}
            onCancelar={() => setAdicionarEm(undefined)}
            onAdicionar={lista => adicionarDocumentos(adicionarEm, lista)}
          />
        )
      }
    </div>
  );
};

export default ProcessosNegocioPage;
