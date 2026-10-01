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
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IAreaAdmin
} from '../../services/AreaAdminService';

import {
  consumirAberturaProcesso,
  idDocumentoNormalizado
} from '../../services/processos/ProcessoService';

import {
  useProcessos
} from '../../hooks/useProcessos';

import ProcessoFluxoEditor from
  './ProcessoFluxoEditor';

import PainelMetadados from
  './PainelMetadados';

import {
  contarUsoMetadados
} from '../../services/processos/MetadadosProcessoService';

// ============================================================
// MÓDULO PROCESSOS (modo de teste)
//
// Lista de processos → detalhe do processo:
//   - aba Fluxo: fluxo de revisão dos documentos do processo
//   - aba Documentos: documentos vinculados ao processo
//
// Processos e vínculos são LIDOS do Dataverse. Tudo o que é
// criado aqui (processos, vínculos, fluxos) fica no navegador.
// ============================================================

export interface IProcessosPageProps {
  documentos: IDocumento[];

  // Áreas cadastradas (dgt_area), para classificar os processos.
  areas?: IAreaAdmin[];
  contexto?: IContextoAcesso;
  dataverseService?: DataverseService;
  onAbrirDocumento: (documento: IDocumento) => void;
}

type AbaProcesso = 'fluxo' | 'metadados' | 'documentos';

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';

const estiloCartao: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '8px',
  overflow: 'hidden'
};

const estiloBarraSecao: React.CSSProperties = {
  background: COR_AZUL,
  color: '#FFFFFF',
  padding: '10px 20px',
  fontWeight: 700,
  fontSize: '13px',
  letterSpacing: '.06em',
  textTransform: 'uppercase'
};

const estiloRotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: COR_AZUL,
  marginBottom: '4px'
};

const estiloEntrada: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '38px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '6px 10px',
  fontFamily: 'inherit',
  fontSize: '14px',
  color: COR_AZUL,
  background: '#FFFFFF'
};

const estiloBotao = (
  principal: boolean,
  desabilitado: boolean
): React.CSSProperties => ({
  minHeight: '40px',
  padding: '0 16px',
  borderRadius: '6px',
  border: `2px solid ${COR_AZUL}`,
  background: principal ? COR_AZUL : '#FFFFFF',
  color: principal ? '#FFFFFF' : COR_AZUL,
  fontWeight: 700,
  fontSize: '13.5px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.45 : 1
});

const estiloAba = (
  ativa: boolean
): React.CSSProperties => ({
  padding: '10px 16px',
  border: 0,
  borderBottom: ativa ? `3px solid ${COR_CIANO}` : '3px solid transparent',
  background: 'transparent',
  color: COR_AZUL,
  fontSize: '13.5px',
  fontWeight: ativa ? 800 : 600,
  cursor: 'pointer'
});

const selo = (
  texto: string,
  destaque: boolean
): React.ReactElement => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '10px',
      border: `1px solid ${destaque ? COR_CIANO : COR_BORDA}`,
      background: destaque ? '#E6F9FC' : '#F2F2F2',
      color: COR_AZUL,
      fontSize: '11.5px',
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }}
  >
    {texto}
  </span>
);

const resumoFluxo = (
  versoes: IFluxoDefinicao[] | undefined
): { texto: string; publicado: boolean } => {

  if (!versoes || versoes.length === 0) {
    return { texto: 'Sem fluxo', publicado: false };
  }

  const publicada =
    versoes.find(item => item.status === 'publicado');

  const rascunho =
    versoes.find(item => item.status === 'rascunho');

  if (publicada && rascunho) {
    return { texto: `Fluxo v${publicada.versao} publicado · v${rascunho.versao} em rascunho`, publicado: true };
  }

  if (publicada) {
    return { texto: `Fluxo v${publicada.versao} publicado`, publicado: true };
  }

  return { texto: `Fluxo v${rascunho ? rascunho.versao : versoes[0].versao} em rascunho`, publicado: false };
};

const ProcessosPage: React.FC<IProcessosPageProps> = ({
  documentos,
  areas = [],
  contexto,
  dataverseService,
  onAbrirDocumento
}) => {

  const referencias =
    React.useMemo(
      () => documentos.map(documento => ({ id: documento.id, codigo: documento.codigo })),
      [documentos]
    );

  const dados =
    useProcessos(dataverseService, referencias);

  const areasAtivas =
    React.useMemo(
      () =>
        areas
          .filter(area => area.ativa)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      [areas]
    );

  const [novoAreaId, setNovoAreaId] =
    React.useState<string>('');

  const [filtroAreaId, setFiltroAreaId] =
    React.useState<string>('');

  const [processoId, setProcessoId] =
    React.useState<string>(
      () => consumirAberturaProcesso() || ''
    );

  const [aba, setAba] =
    React.useState<AbaProcesso>('fluxo');

  const [filtro, setFiltro] =
    React.useState<string>('');

  const [novoAberto, setNovoAberto] =
    React.useState<boolean>(false);

  const [novoCodigo, setNovoCodigo] =
    React.useState<string>('');

  const [novoNome, setNovoNome] =
    React.useState<string>('');

  const [novoDescricao, setNovoDescricao] =
    React.useState<string>('');

  const [erroNovo, setErroNovo] =
    React.useState<string>('');

  const [documentoParaVincular, setDocumentoParaVincular] =
    React.useState<string>('');

  const podeEditar =
    !!contexto &&
    (
      contexto.perfil === 'Administrador' ||
      contexto.podeGerenciarDocumentos
    );

  const contagemDocumentos = (
    id: string
  ): number =>
    dados.vinculos.filter(
      vinculo => vinculo.processoId === id
    ).length;

  const processoSelecionado: IProcesso | undefined =
    dados.processos.find(
      item => item.id === processoId
    );

  const avisoTeste = (
    <div
      style={{
        border: `2px solid ${COR_INDIGO}`,
        background: '#E8EAF8',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '13.5px',
        lineHeight: '20px',
        color: COR_AZUL
      }}
    >
      <strong>Modo de teste.</strong>{' '}
      Os processos cadastrados no Dataverse são apenas lidos. Processos, vínculos e fluxos
      criados aqui ficam somente neste navegador.
      {
        dados.aviso && (
          <div style={{ marginTop: '6px' }}>{dados.aviso}</div>
        )
      }
    </div>
  );

  if (dados.carregando && dados.processos.length === 0) {
    return (
      <div style={{ padding: '24px', color: COR_AZUL }}>
        Carregando processos...
      </div>
    );
  }

  if (dados.erro) {
    return (
      <div role="alert" style={{ border: `2px solid ${COR_INDIGO}`, borderRadius: '8px', padding: '16px', color: COR_AZUL }}>
        <strong style={{ color: COR_INDIGO }}>Erro.</strong> {dados.erro}
      </div>
    );
  }

  // ==========================================================
  // DETALHE DO PROCESSO
  // ==========================================================

  if (processoSelecionado) {

    const vinculosProcesso =
      dados.vinculos.filter(
        vinculo => vinculo.processoId === processoSelecionado.id
      );

    const idsVinculados =
      vinculosProcesso.map(vinculo => vinculo.documentoId);

    const documentosDisponiveis =
      documentos.filter(
        documento =>
          idsVinculados.indexOf(idDocumentoNormalizado(documento.id)) < 0
      );

    const versoes =
      dados.fluxosPorProcesso[processoSelecionado.id] || [];

    const metadadosProcesso =
      dados.metadadosPorProcesso[processoSelecionado.id] || [];

    const resumo =
      resumoFluxo(versoes);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: COR_AZUL }}>

        <div>
          <button
            type="button"
            onClick={() => setProcessoId('')}
            style={{ ...estiloBotao(false, false), minHeight: '36px' }}
          >
            ← Voltar para processos
          </button>
        </div>

        {avisoTeste}

        <section style={{ ...estiloCartao, padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flexGrow: 1, minWidth: '260px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: COR_INDIGO }}>
              Processos › {processoSelecionado.codigo || 'sem código'}
            </div>
            <h2 style={{ margin: '2px 0 4px', fontSize: '24px', lineHeight: '30px' }}>
              {processoSelecionado.nome}
            </h2>
            {
              processoSelecionado.descricao && (
                <div style={{ fontSize: '14px' }}>{processoSelecionado.descricao}</div>
              )
            }
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {selo(processoSelecionado.areaNome ? `Área: ${processoSelecionado.areaNome}` : 'Sem área', false)}
            {selo(processoSelecionado.origem === 'teste' ? 'Teste (local)' : 'Dataverse', processoSelecionado.origem === 'dataverse')}
            {selo(resumo.texto, resumo.publicado)}
            {selo(`${vinculosProcesso.length} documento(s)`, false)}
          </div>
        </section>

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #E2E8F0' }}>
          <button type="button" style={estiloAba(aba === 'fluxo')} onClick={() => setAba('fluxo')}>
            Fluxo de revisão
          </button>
          <button type="button" style={estiloAba(aba === 'metadados')} onClick={() => setAba('metadados')}>
            Metadados ({metadadosProcesso.length})
          </button>
          <button type="button" style={estiloAba(aba === 'documentos')} onClick={() => setAba('documentos')}>
            Documentos vinculados ({vinculosProcesso.length})
          </button>
        </div>

        {
          aba === 'fluxo'
            ? (
              <ProcessoFluxoEditor
                key={processoSelecionado.id}
                processo={processoSelecionado}
                versoes={versoes}
                podeEditar={podeEditar}
                onAlterado={() => dados.recarregar()}
                metadados={metadadosProcesso}
                onAlterarMetadados={lista => dados.salvarMetadados(processoSelecionado.id, lista)}
              />
            )
            : aba === 'metadados'
            ? (
              <section style={estiloCartao}>
                <div style={estiloBarraSecao}>Metadados do processo</div>
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '13.5px' }}>
                    Campos que as etapas do fluxo podem exibir, exigir ou usar nas decisões. Valem para
                    <strong> todas as versões</strong> do fluxo e aparecem nas telas <strong>nesta ordem</strong>.
                    {podeEditar ? ' As alterações ficam salvas na hora.' : ''}
                  </div>
                  <PainelMetadados
                    metadados={metadadosProcesso}
                    editavel={podeEditar}
                    usoPorChave={contarUsoMetadados(versoes)}
                    onAlterar={lista => dados.salvarMetadados(processoSelecionado.id, lista)}
                  />
                </div>
              </section>
            )
            : (
              <section style={estiloCartao}>
                <div style={estiloBarraSecao}>Documentos deste processo</div>

                {
                  podeEditar && (
                    <div style={{ padding: '14px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: `1px solid ${COR_BORDA}` }}>
                      <div style={{ minWidth: '280px', flexGrow: 1, maxWidth: '560px' }}>
                        <label htmlFor="vincular-documento" style={estiloRotulo}>Vincular documento</label>
                        <select
                          id="vincular-documento"
                          value={documentoParaVincular}
                          onChange={evento => setDocumentoParaVincular(evento.target.value)}
                          style={estiloEntrada}
                        >
                          <option value="">Selecione...</option>
                          {
                            documentosDisponiveis.map(
                              documento => (
                                <option key={documento.id} value={documento.id}>
                                  {documento.codigo} — {documento.titulo}
                                </option>
                              )
                            )
                          }
                        </select>
                      </div>
                      <button
                        type="button"
                        disabled={!documentoParaVincular}
                        onClick={() => {
                          dados.vincularDocumento(documentoParaVincular, processoSelecionado.id)
                            .then(() => setDocumentoParaVincular(''))
                            .catch((error: unknown) => console.error(error));
                        }}
                        style={estiloBotao(true, !documentoParaVincular)}
                      >
                        Vincular (teste)
                      </button>
                    </div>
                  )
                }

                {
                  vinculosProcesso.length === 0
                    ? (
                      <div style={{ padding: '18px 20px', fontSize: '14px' }}>
                        Nenhum documento vinculado a este processo.
                      </div>
                    )
                    : (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {
                          vinculosProcesso.map(
                            vinculo => {

                              const documento =
                                documentos.find(
                                  item => idDocumentoNormalizado(item.id) === vinculo.documentoId
                                );

                              const outrosProcessos =
                                dados.vinculos.filter(
                                  item =>
                                    item.documentoId === vinculo.documentoId &&
                                    item.processoId !== vinculo.processoId
                                ).length;

                              return (
                                <li
                                  key={vinculo.id}
                                  style={{ padding: '12px 20px', borderBottom: `1px solid ${COR_BORDA}`, display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}
                                >
                                  <div style={{ flexGrow: 1, minWidth: '240px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '14.5px' }}>
                                      {documento ? `${documento.codigo} — ${documento.titulo}` : `Documento ${vinculo.documentoId}`}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                      {selo(vinculo.origem === 'teste' ? 'Vínculo de teste' : 'Vínculo do Dataverse', vinculo.origem === 'dataverse')}
                                      {vinculo.principal && selo('Processo principal', true)}
                                      {outrosProcessos > 0 && selo(`+${outrosProcessos} outro(s) processo(s)`, false)}
                                    </div>
                                  </div>

                                  {
                                    documento && (
                                      <button type="button" onClick={() => onAbrirDocumento(documento)} style={estiloBotao(false, false)}>
                                        Abrir documento
                                      </button>
                                    )
                                  }

                                  {
                                    podeEditar &&
                                    outrosProcessos > 0 &&
                                    !vinculo.principal && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          dados.definirPrincipal(vinculo.documentoId, vinculo.processoId)
                                            .catch((error: unknown) => console.error(error));
                                        }}
                                        style={estiloBotao(false, false)}
                                      >
                                        Tornar principal (teste)
                                      </button>
                                    )
                                  }

                                  {
                                    podeEditar &&
                                    vinculo.origem === 'teste' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          dados.removerVinculo(vinculo.id)
                                            .catch((error: unknown) => console.error(error));
                                        }}
                                        style={estiloBotao(false, false)}
                                      >
                                        Remover vínculo
                                      </button>
                                    )
                                  }
                                </li>
                              );
                            }
                          )
                        }
                      </ul>
                    )
                }
              </section>
            )
        }
      </div>
    );
  }

  // ==========================================================
  // LISTA DE PROCESSOS
  // ==========================================================

  const termo =
    filtro.trim().toLowerCase();

  const visiveis =
    dados.processos.filter(
      processo =>
        (
          !filtroAreaId ||
          (filtroAreaId === 'sem' ? !processo.areaId : processo.areaId === filtroAreaId)
        ) &&
        (!termo ||
        `${processo.codigo} ${processo.nome} ${processo.descricao || ''}`
          .toLowerCase()
          .indexOf(termo) >= 0)
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: COR_AZUL }}>

      {avisoTeste}

      <section style={{ ...estiloCartao, padding: '14px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flexGrow: 1, minWidth: '240px', maxWidth: '480px' }}>
          <label htmlFor="filtro-processos" style={estiloRotulo}>Buscar processo</label>
          <input
            id="filtro-processos"
            type="search"
            value={filtro}
            onChange={evento => setFiltro(evento.target.value)}
            placeholder="Código, nome ou descrição"
            style={estiloEntrada}
          />
        </div>

        <div style={{ minWidth: '200px', maxWidth: '280px' }}>
          <label htmlFor="filtro-area" style={estiloRotulo}>Área</label>
          <select id="filtro-area" value={filtroAreaId} onChange={evento => setFiltroAreaId(evento.target.value)} style={estiloEntrada}>
            <option value="">Todas</option>
            {
              areasAtivas.map(
                area => <option key={area.id} value={area.id}>{area.nome}</option>
              )
            }
            <option value="sem">Sem área</option>
          </select>
        </div>

        <span style={{ fontSize: '13px' }}>
          {visiveis.length} de {dados.processos.length} processo(s)
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              dados.recarregar(true)
                .catch((error: unknown) => console.error(error));
            }}
            style={estiloBotao(false, false)}
          >
            Atualizar
          </button>

          {
            podeEditar && (
              <button
                type="button"
                onClick={() => {
                  setNovoAberto(!novoAberto);
                  setErroNovo('');
                }}
                style={estiloBotao(true, false)}
              >
                Novo processo (teste)
              </button>
            )
          }
        </div>
      </section>

      {
        novoAberto && (
          <section style={estiloCartao}>
            <div style={estiloBarraSecao}>Novo processo (somente neste navegador)</div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) minmax(0, 1fr) minmax(200px, 320px)', gap: '12px' }}>
                <div>
                  <label htmlFor="novo-codigo" style={estiloRotulo}>Código *</label>
                  <input id="novo-codigo" type="text" value={novoCodigo} onChange={evento => setNovoCodigo(evento.target.value)} style={estiloEntrada} />
                </div>
                <div>
                  <label htmlFor="novo-nome" style={estiloRotulo}>Nome *</label>
                  <input id="novo-nome" type="text" value={novoNome} onChange={evento => setNovoNome(evento.target.value)} style={estiloEntrada} />
                </div>
                <div>
                  <label htmlFor="novo-area" style={estiloRotulo}>Área *</label>
                  <select id="novo-area" value={novoAreaId} onChange={evento => setNovoAreaId(evento.target.value)} style={estiloEntrada}>
                    <option value="">Selecione...</option>
                    {
                      areasAtivas.map(
                        area => (
                          <option key={area.id} value={area.id}>
                            {area.sigla ? `${area.sigla} — ` : ''}{area.nome}
                          </option>
                        )
                      )
                    }
                  </select>
                  {
                    areasAtivas.length === 0 && (
                      <div style={{ fontSize: '12px', marginTop: '4px', color: COR_INDIGO }}>
                        Nenhuma área ativa cadastrada. Cadastre em Gestão › Áreas e acessos.
                      </div>
                    )
                  }
                </div>
              </div>
              <div>
                <label htmlFor="novo-descricao" style={estiloRotulo}>Descrição</label>
                <textarea id="novo-descricao" rows={2} value={novoDescricao} onChange={evento => setNovoDescricao(evento.target.value)} style={{ ...estiloEntrada, minHeight: '60px' }} />
              </div>
              {
                erroNovo && (
                  <div role="alert" style={{ color: COR_INDIGO, fontSize: '13.5px', fontWeight: 600 }}>{erroNovo}</div>
                )
              }
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const area =
                      areasAtivas.find(item => item.id === novoAreaId);

                    if (!area && areasAtivas.length > 0) {
                      setErroNovo('Selecione a área do processo.');
                      return;
                    }

                    const resultado =
                      dados.criarProcesso({
                        codigo: novoCodigo,
                        nome: novoNome,
                        descricao: novoDescricao,
                        areaId: area ? area.id : undefined,
                        areaNome: area ? area.nome : undefined
                      });

                    if (!resultado.ok) {
                      setErroNovo(resultado.erro);
                      return;
                    }

                    setNovoAberto(false);
                    setNovoCodigo('');
                    setNovoNome('');
                    setNovoDescricao('');
                    setNovoAreaId('');

                    if (resultado.processo) {
                      setProcessoId(resultado.processo.id);
                      setAba('fluxo');
                    }
                  }}
                  style={estiloBotao(true, false)}
                >
                  Criar processo
                </button>
                <button type="button" onClick={() => setNovoAberto(false)} style={estiloBotao(false, false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </section>
        )
      }

      {
        visiveis.length === 0
          ? (
            <section style={{ ...estiloCartao, padding: '24px', fontSize: '14px' }}>
              {
                dados.processos.length === 0
                  ? 'Nenhum processo encontrado no Dataverse. No modo de teste você pode criar processos locais em “Novo processo (teste)”.'
                  : 'Nenhum processo corresponde à busca.'
              }
            </section>
          )
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
              {
                visiveis.map(
                  processo => {

                    const resumo =
                      resumoFluxo(dados.fluxosPorProcesso[processo.id]);

                    return (
                      <button
                        key={processo.id}
                        type="button"
                        onClick={() => {
                          setProcessoId(processo.id);
                          setAba('fluxo');
                        }}
                        style={{
                          ...estiloCartao,
                          textAlign: 'left',
                          padding: '16px 18px',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          color: COR_AZUL,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: COR_INDIGO }}>
                          {processo.codigo || 'Sem código'}
                          {processo.areaNome ? ` · ${processo.areaNome}` : ''}
                        </span>
                        <span style={{ fontSize: '17px', fontWeight: 700, lineHeight: '22px' }}>
                          {processo.nome}
                        </span>
                        {
                          processo.descricao && (
                            <span style={{ fontSize: '13px', lineHeight: '19px' }}>{processo.descricao}</span>
                          )
                        }
                        <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {selo(resumo.texto, resumo.publicado)}
                          {selo(`${contagemDocumentos(processo.id)} documento(s)`, false)}
                          {processo.origem === 'teste' && selo('Teste (local)', false)}
                        </span>
                      </button>
                    );
                  }
                )
              }
            </div>
          )
      }
    </div>
  );
};

export default ProcessosPage;
