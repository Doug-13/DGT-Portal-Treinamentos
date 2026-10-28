import * as React from 'react';

import {
  DataverseService,
  IDataverseRecord
} from '../../services/DataverseService';

import {
  carregarDadosProcessos
} from '../../services/processos/ProcessoService';

import {
  IValorDocumento,
  gravarValorDocumentos,
  lerValorDocumentos
} from '../../services/fluxo/valorDocumento';

import {
  CONTROLE_DOCUMENTAL
} from '../../constants/controleDocumental';

// ============================================================
// CAMPO "DOCUMENTO REFERENCIADO" DO FLUXO
//
// Busca os documentos ATIVOS da plataforma (dgt_documento) por código
// ou título, com filtro por ÁREA e por PROCESSO (vínculo
// dgt_documentoprocesso). Documentos de controle de treinamento
// (tipo TRN) e o próprio documento não são oferecidos.
//
//   multiplo = false → tipo 'documento'  (um)
//   multiplo = true  → tipo 'documentos' (vários)
//
// A lista é carregada uma vez e reaproveitada por todos os campos da
// tela (cache de 5 minutos).
// ============================================================

export interface ICampoDocumentoFluxoProps {
  id: string;

  // Valor gravado (JSON — ver services/fluxo/valorDocumento.ts).
  valor: string;

  onAlterar: (valor: string) => void;

  multiplo?: boolean;

  desabilitado?: boolean;

  dataverseService?: DataverseService;

  // Documento em revisão (não pode referenciar a si mesmo).
  documentoAtualId?: string;

  // Abre o documento referenciado (link no código).
  onAbrirDocumento?: (documentoId: string) => void;
}

interface IDocumentoOpcao extends IValorDocumento {
  tipo: string;
  status: string;
  areaId: string;
  areaNome: string;
  processoIds: string[];
}

interface IProcessoOpcao {
  id: string;
  codigo: string;
  nome: string;
  areaId: string;
}

interface IBaseDocumentos {
  documentos: IDocumentoOpcao[];
  processos: IProcessoOpcao[];
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  ciano10: '#E6F9FC',
  borda: '#D9D9D6',
  texto2: '#5E6670',
  fundo: '#F8FAFC'
};

const LIMITE_RESULTADOS = 10;

const guid = (
  valor: unknown
): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor).trim();
};

const formatado = (
  registro: IDataverseRecord,
  campo: string
): string =>
  texto(registro, `${campo}@OData.Community.Display.V1.FormattedValue`) ||
  texto(registro, campo);

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// ------------------------------------------------------------
// Cache compartilhado
// ------------------------------------------------------------

let cacheBase: { lidoEm: number; base: Promise<IBaseDocumentos> } | undefined;

const carregarBase = (
  dataverse: DataverseService
): Promise<IBaseDocumentos> => {

  if (cacheBase && Date.now() - cacheBase.lidoEm < 5 * 60 * 1000) {
    return cacheBase.base;
  }

  const base = (async (): Promise<IBaseDocumentos> => {

    const registros = await dataverse.getDocumentos();

    // Processos e vínculos documento ↔ processo. Se falhar, o filtro
    // por processo fica indisponível, mas o campo continua funcionando.
    let processos: IProcessoOpcao[] = [];
    const processosPorDocumento: Record<string, string[]> = {};

    try {
      const dados = await carregarDadosProcessos(dataverse);

      processos =
        dados.processos
          .filter(processo => processo.ativo !== false)
          .map(processo => ({
            id: guid(processo.id),
            codigo: processo.codigo || '',
            nome: processo.nome || processo.codigo || '',
            areaId: guid(processo.areaId)
          }))
          .sort((a, b) => (a.codigo || a.nome).localeCompare(b.codigo || b.nome));

      dados.vinculos.forEach(vinculo => {
        const documentoId = guid(vinculo.documentoId);
        if (!documentoId) {
          return;
        }
        processosPorDocumento[documentoId] = (processosPorDocumento[documentoId] || []).concat(guid(vinculo.processoId));
      });
    } catch (erro) {
      console.error(erro);
    }

    const documentos =
      registros
        .map(registro => {
          const id = guid(registro.dgt_documentoid);
          return {
            id,
            codigo: texto(registro, 'dgt_codigo'),
            titulo: texto(registro, 'dgt_titulo') || texto(registro, 'dgt_name'),
            tipo: texto(registro, 'dgt_tipo').toUpperCase(),
            status: formatado(registro, 'dgt_status'),
            areaId: guid(registro._dgt_area_value),
            areaNome: formatado(registro, '_dgt_area_value'),
            processoIds: processosPorDocumento[id] || []
          };
        })
        .filter(doc =>
          !!doc.id &&
          doc.tipo !== CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO
        );

    return { documentos, processos };
  })();

  base.catch(() => { cacheBase = undefined; });

  cacheBase = { lidoEm: Date.now(), base };
  return base;
};

const estiloSelect: React.CSSProperties = {
  minHeight: '34px',
  border: `1px solid ${COR.borda}`,
  borderRadius: '6px',
  padding: '6px 8px',
  fontFamily: 'inherit',
  fontSize: '13px',
  color: COR.azul,
  background: '#FFFFFF',
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box'
};

const CampoDocumentoFluxo: React.FC<ICampoDocumentoFluxoProps> = (props) => {

  const selecionados =
    lerValorDocumentos(props.valor);

  const [base, setBase] =
    React.useState<IBaseDocumentos>({ documentos: [], processos: [] });

  const [carregando, setCarregando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  const [busca, setBusca] =
    React.useState('');

  const [areaId, setAreaId] =
    React.useState('');

  const [processoId, setProcessoId] =
    React.useState('');

  const [aberto, setAberto] =
    React.useState(false);

  const [destaque, setDestaque] =
    React.useState(0);

  const caixaRef =
    React.useRef<HTMLDivElement>(null);

  React.useEffect(
    () => {
      if (!props.dataverseService) {
        return;
      }

      let ativo = true;
      setCarregando(true);
      setErro('');

      carregarBase(props.dataverseService)
        .then(dados => { if (ativo) { setBase(dados); } })
        .catch(falha => {
          console.error(falha);
          if (ativo) { setErro('Não foi possível carregar os documentos da plataforma.'); }
        })
        .then(() => { if (ativo) { setCarregando(false); } }, () => undefined);

      return () => { ativo = false; };
    },
    [props.dataverseService]
  );

  // Fecha a lista ao clicar fora do campo.
  React.useEffect(
    () => {
      if (!aberto) {
        return;
      }

      const aoClicar = (evento: MouseEvent): void => {
        if (caixaRef.current && !caixaRef.current.contains(evento.target as Node)) {
          setAberto(false);
        }
      };

      document.addEventListener('mousedown', aoClicar);
      return () => document.removeEventListener('mousedown', aoClicar);
    },
    [aberto]
  );

  // Áreas que têm documentos (ordem alfabética).
  const areas =
    React.useMemo(
      () => {
        const mapa: Record<string, string> = {};
        base.documentos.forEach(doc => {
          if (doc.areaId) {
            mapa[doc.areaId] = doc.areaNome || doc.areaId;
          }
        });
        return Object.keys(mapa)
          .map(id => ({ id, nome: mapa[id] }))
          .sort((a, b) => a.nome.localeCompare(b.nome));
      },
      [base.documentos]
    );

  // Processos oferecidos: com área escolhida, os da área, os sem área
  // e os que têm algum documento da área vinculado.
  const processos =
    React.useMemo(
      () => {
        if (!areaId) {
          return base.processos;
        }

        const daArea: Record<string, boolean> = {};
        base.documentos
          .filter(doc => doc.areaId === areaId)
          .forEach(doc => doc.processoIds.forEach(id => { daArea[id] = true; }));

        return base.processos.filter(processo =>
          processo.areaId === areaId ||
          !processo.areaId ||
          !!daArea[processo.id]
        );
      },
      [base, areaId]
    );

  // Se o processo escolhido saiu da lista (troca de área), limpa.
  React.useEffect(
    () => {
      if (processoId && !processos.some(processo => processo.id === processoId)) {
        setProcessoId('');
      }
    },
    [processos, processoId]
  );

  const idsSelecionados =
    selecionados.map(doc => doc.id);

  const atual =
    guid(props.documentoAtualId);

  const candidatos =
    React.useMemo(
      () => {
        const termo = normalizar(busca.trim());
        return base.documentos.filter(doc =>
          doc.id !== atual &&
          idsSelecionados.indexOf(doc.id) < 0 &&
          (!areaId || doc.areaId === areaId) &&
          (!processoId || doc.processoIds.indexOf(processoId) >= 0) &&
          (
            !termo ||
            normalizar(doc.codigo).indexOf(termo) >= 0 ||
            normalizar(doc.titulo).indexOf(termo) >= 0
          )
        );
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [base.documentos, busca, areaId, processoId, atual, props.valor]
    );

  const resultados =
    candidatos.slice(0, LIMITE_RESULTADOS);

  const adicionar = (
    doc: IDocumentoOpcao
  ): void => {
    const novo: IValorDocumento = { id: doc.id, codigo: doc.codigo, titulo: doc.titulo };
    props.onAlterar(
      gravarValorDocumentos(props.multiplo ? selecionados.concat(novo) : [novo])
    );
    setBusca('');
    setDestaque(0);
    if (!props.multiplo) {
      setAberto(false);
    }
  };

  const remover = (
    id: string
  ): void => {
    props.onAlterar(
      gravarValorDocumentos(selecionados.filter(doc => doc.id !== id))
    );
  };

  const aoTeclar = (
    evento: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setAberto(true);
      setDestaque(atualIndice => Math.min(atualIndice + 1, resultados.length - 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setDestaque(atualIndice => Math.max(atualIndice - 1, 0));
    } else if (evento.key === 'Enter') {
      if (aberto && resultados[destaque]) {
        evento.preventDefault();
        adicionar(resultados[destaque]);
      }
    } else if (evento.key === 'Escape') {
      setAberto(false);
    }
  };

  // Mostra a busca quando ainda cabe documento (um: nenhum escolhido;
  // vários: sempre).
  const podeAdicionar =
    !props.desabilitado &&
    (props.multiplo || selecionados.length === 0);

  return (
    <div ref={caixaRef} style={{ position: 'relative' }}>

      {/* Documentos escolhidos */}
      {
        selecionados.length > 0 &&
        (
          <div
            id={podeAdicionar ? undefined : props.id}
            style={{
              display: 'grid',
              gap: '6px',
              marginBottom: podeAdicionar ? '8px' : 0
            }}
          >
            {
              selecionados.map(doc => {
                const info = base.documentos.find(item => item.id === doc.id);
                return (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 8px',
                      border: `1px solid ${COR.borda}`,
                      borderLeft: `4px solid ${COR.ciano}`,
                      borderRadius: '6px',
                      background: props.desabilitado ? '#F2F2F2' : '#FFFFFF'
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: '16px' }}>📄</span>
                    <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                      {
                        props.onAbrirDocumento
                          ? (
                            <button
                              type="button"
                              onClick={() => (props.onAbrirDocumento as (id: string) => void)(doc.id)}
                              title={`Abrir ${doc.codigo}`}
                              style={{
                                display: 'block',
                                border: 0,
                                background: 'transparent',
                                padding: 0,
                                color: '#0867D7',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                textDecoration: 'underline',
                                textUnderlineOffset: '2px'
                              }}
                            >
                              {doc.codigo || '(sem código)'} ↗
                            </button>
                          )
                          : (
                            <strong style={{ display: 'block', color: COR.azul, fontSize: '13px' }}>
                              {doc.codigo || '(sem código)'}
                            </strong>
                          )
                      }
                      <small style={{ color: COR.texto2, fontSize: '12px' }}>
                        {doc.titulo}
                        {info && info.areaNome ? ` · ${info.areaNome}` : ''}
                        {info && info.status ? ` · ${info.status}` : ''}
                      </small>
                    </span>
                    {
                      !props.desabilitado &&
                      (
                        <button
                          type="button"
                          onClick={() => remover(doc.id)}
                          title="Remover referência"
                          aria-label={`Remover ${doc.codigo}`}
                          style={{
                            border: `1px solid ${COR.borda}`,
                            background: '#FFFFFF',
                            color: COR.azul,
                            borderRadius: '6px',
                            padding: '3px 9px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                          }}
                        >
                          ✕
                        </button>
                      )
                    }
                  </div>
                );
              })
            }
          </div>
        )
      }

      {
        props.desabilitado && selecionados.length === 0 &&
        (
          <div style={{ fontSize: '13px', color: COR.texto2, padding: '8px 0' }}>—</div>
        )
      }

      {/* Filtros + busca */}
      {
        podeAdicionar &&
        (
          <div
            style={{
              padding: '8px',
              border: `1px solid ${aberto ? COR.ciano : COR.borda}`,
              borderRadius: '8px',
              background: COR.fundo
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: '8px',
                marginBottom: '8px'
              }}
            >
              <select
                aria-label="Filtrar por área"
                value={areaId}
                disabled={carregando}
                onChange={evento => { setAreaId(evento.target.value); setAberto(true); setDestaque(0); }}
                style={estiloSelect}
              >
                <option value="">Todas as áreas</option>
                {areas.map(area => <option key={area.id} value={area.id}>{area.nome}</option>)}
              </select>

              <select
                aria-label="Filtrar por processo"
                value={processoId}
                disabled={carregando || processos.length === 0}
                onChange={evento => { setProcessoId(evento.target.value); setAberto(true); setDestaque(0); }}
                style={estiloSelect}
              >
                <option value="">
                  {processos.length === 0 && !carregando ? 'Nenhum processo disponível' : 'Todos os processos'}
                </option>
                {
                  processos.map(processo => (
                    <option key={processo.id} value={processo.id}>
                      {processo.codigo ? `${processo.codigo} — ` : ''}{processo.nome}
                    </option>
                  ))
                }
              </select>
            </div>

            <input
              id={props.id}
              type="text"
              role="combobox"
              aria-expanded={aberto}
              aria-autocomplete="list"
              autoComplete="off"
              value={busca}
              placeholder={
                carregando
                  ? 'Carregando documentos...'
                  : props.multiplo
                    ? '🔍 Buscar por código ou título para adicionar...'
                    : '🔍 Buscar documento por código ou título...'
              }
              onChange={evento => { setBusca(evento.target.value); setAberto(true); setDestaque(0); }}
              onFocus={() => setAberto(true)}
              onKeyDown={aoTeclar}
              style={{ ...estiloSelect, fontSize: '14px', minHeight: '36px' }}
            />

            {
              erro &&
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#B42318' }}>{erro}</div>
            }

            {
              aberto &&
              (
                <ul
                  role="listbox"
                  style={{
                    margin: '6px 0 0',
                    padding: '4px',
                    listStyle: 'none',
                    background: '#FFFFFF',
                    border: `1px solid ${COR.borda}`,
                    borderRadius: '8px',
                    maxHeight: '280px',
                    overflowY: 'auto'
                  }}
                >
                  {
                    carregando
                      ? <li style={{ padding: '10px', fontSize: '13px', color: COR.texto2 }}>Carregando documentos...</li>
                      : resultados.length === 0
                        ? (
                          <li style={{ padding: '10px', fontSize: '13px', color: COR.texto2 }}>
                            Nenhum documento encontrado com esses filtros.
                          </li>
                        )
                        : resultados.map(
                          (doc, indice) => (
                            <li
                              key={doc.id}
                              role="option"
                              aria-selected={indice === destaque}
                              onMouseDown={evento => { evento.preventDefault(); adicionar(doc); }}
                              onMouseEnter={() => setDestaque(indice)}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr auto',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '7px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                background: indice === destaque ? COR.ciano10 : 'transparent'
                              }}
                            >
                              <strong style={{ fontSize: '12.5px', color: COR.azul, whiteSpace: 'nowrap' }}>
                                {doc.codigo || '(sem código)'}
                              </strong>
                              <span style={{ fontSize: '13px', color: COR.azul, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {doc.titulo}
                              </span>
                              <small style={{ fontSize: '11px', color: COR.texto2, whiteSpace: 'nowrap' }}>
                                {[doc.tipo, doc.areaNome].filter(item => !!item).join(' · ')}
                              </small>
                            </li>
                          )
                        )
                  }
                  {
                    !carregando && candidatos.length > LIMITE_RESULTADOS &&
                    (
                      <li style={{ padding: '6px 8px', fontSize: '11.5px', color: COR.texto2 }}>
                        Mostrando {LIMITE_RESULTADOS} de {candidatos.length}. Refine pela área, processo ou busca.
                      </li>
                    )
                  }
                </ul>
              )
            }
          </div>
        )
      }
    </div>
  );
};

export default CampoDocumentoFluxo;
