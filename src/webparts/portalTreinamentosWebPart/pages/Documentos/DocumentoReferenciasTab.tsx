import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IDocumento
} from '../../models/Documento';

import {
  IDocumentoResumoReferencia,
  IReferenciaDocumento,
  IReferenciasDocumento,
  IVinculosTreinamentoDocumento,
  carregarReferenciasDocumento,
  carregarVinculosTreinamento,
  desvincularDocumentoDoTreinamento,
  ehDocumentoControle,
  sincronizarVinculosTreinamento
} from '../../services/referencias/ReferenciasDocumentoService';

import {
  gravarValorDocumentos
} from '../../services/fluxo/valorDocumento';

import {
  StatusDocumentoBadge
} from '../../components/common/StatusDocumento';

// ============================================================
// ABA "REFERÊNCIAS" DO DOCUMENTO
//
//   ↗ Este documento referencia  → o que ele cita nos metadados
//   ↙ Referenciado por            → quem cita este documento
//   🎓 Treinamentos vinculados    → dgt_treinamentodocumento
//      (num treinamento/TRN: os documentos ligados ao treinamento)
// ============================================================

export interface IDocumentoReferenciasTabProps {
  documento: IDocumento;
  dataverseService?: DataverseService;
  onAbrirDocumento?: (documentoId: string) => void;

  // Administrador: pode desvincular treinamentos (desativa o vínculo).
  podeAdministrar?: boolean;
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  borda: '#E2E8F0',
  linha: '#F1F5F9',
  texto2: '#5E6670',
  link: '#0867D7'
};

const cartao: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR.borda}`,
  borderRadius: '12px',
  overflow: 'hidden',
  marginBottom: '14px'
};

const LinkDocumento: React.FC<{
  documento: IDocumentoResumoReferencia;
  onAbrir?: (id: string) => void;
}> = ({ documento, onAbrir }) =>
  onAbrir && documento.ativo
    ? (
      <button
        type="button"
        onClick={() => onAbrir(documento.id)}
        title={`Abrir ${documento.codigo}`}
        style={{
          border: 0,
          background: 'transparent',
          padding: 0,
          color: COR.link,
          fontWeight: 700,
          fontSize: '13px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textDecoration: 'underline',
          textUnderlineOffset: '2px'
        }}
      >
        {documento.codigo || '(sem código)'} ↗
      </button>
    )
    : <strong style={{ fontSize: '13px', color: COR.azul }}>{documento.codigo || '(sem código)'}</strong>;

const Secao: React.FC<{
  icone: string;
  titulo: string;
  descricao: string;
  quantidade: number;
  vazio: string;
}> = ({ icone, titulo, descricao, quantidade, vazio, children }) => (
  <section style={cartao}>
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${COR.borda}`, background: '#F8FAFC' }}>
      <strong style={{ color: COR.azul, fontSize: '14px' }}>
        {icone} {titulo} ({quantidade})
      </strong>
      <div style={{ color: COR.texto2, fontSize: '12px', marginTop: '2px' }}>{descricao}</div>
    </div>
    {
      quantidade === 0
        ? <div style={{ padding: '14px 16px', color: '#94A3B8', fontSize: '13px' }}>{vazio}</div>
        : <div style={{ overflowX: 'auto' }}>{children}</div>
    }
  </section>
);

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 16px',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '.03em',
  color: COR.texto2,
  borderBottom: `1px solid ${COR.borda}`,
  whiteSpace: 'nowrap'
};

const td: React.CSSProperties = {
  padding: '9px 16px',
  fontSize: '13px',
  color: COR.azul,
  borderBottom: `1px solid ${COR.linha}`,
  verticalAlign: 'middle'
};

const TabelaReferencias: React.FC<{
  itens: IReferenciaDocumento[];
  onAbrir?: (id: string) => void;
}> = ({ itens, onAbrir }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead>
      <tr>
        <th style={th}>Documento</th>
        <th style={th}>Tipo</th>
        <th style={th}>Título</th>
        <th style={th}>Campo</th>
        <th style={th}>Revisão</th>
        <th style={th}>Área</th>
        <th style={th}>Status</th>
      </tr>
    </thead>
    <tbody>
      {
        itens.map((item, indice) => (
          <tr key={`${item.documento.id}-${item.campo}-${indice}`}>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>
              <LinkDocumento documento={item.documento} onAbrir={onAbrir} />
              {ehDocumentoControle(item.documento.tipo) && (
                <span style={{ marginLeft: '6px', fontSize: '10.5px', fontWeight: 700, color: '#485CC7' }}>🎓 TREINAMENTO</span>
              )}
            </td>
            <td style={{ ...td, color: COR.texto2, whiteSpace: 'nowrap' }}>{item.documento.tipo || '—'}</td>
            <td style={td}>{item.documento.titulo}</td>
            <td style={{ ...td, color: COR.texto2 }}>{item.campo}</td>
            <td style={{ ...td, whiteSpace: 'nowrap', color: COR.texto2 }}>
              {item.revisao}{item.revisaoStatus ? ` · ${item.revisaoStatus}` : ''}
            </td>
            <td style={{ ...td, color: COR.texto2 }}>{item.documento.areaNome || '—'}</td>
            <td style={td}><StatusDocumentoBadge status={item.documento.status} /></td>
          </tr>
        ))
      }
    </tbody>
  </table>
);

const DocumentoReferenciasTab: React.FC<IDocumentoReferenciasTabProps> = ({
  documento,
  dataverseService,
  onAbrirDocumento,
  podeAdministrar
}) => {

  const [desvinculando, setDesvinculando] =
    React.useState('');

  const [referencias, setReferencias] =
    React.useState<IReferenciasDocumento>({ referencia: [], referenciadoPor: [] });

  const [treinamentos, setTreinamentos] =
    React.useState<IVinculosTreinamentoDocumento>({ treinamentos: [], documentosDoTreinamento: [] });

  const [carregando, setCarregando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  // Vínculo com treinamento que a referência exige mas não foi criado
  // (ex.: referência gravada antes da correção, sem permissão...).
  const [avisoVinculo, setAvisoVinculo] =
    React.useState('');

  const controle =
    ehDocumentoControle(documento.tipo);

  const carregar = React.useCallback(
    async (): Promise<void> => {
      if (!dataverseService) {
        setErro('Serviço do Dataverse indisponível nesta tela.');
        return;
      }

      setCarregando(true);
      setErro('');

      try {
        const [refs, vinculos] =
          await Promise.all([
            carregarReferenciasDocumento(dataverseService, documento.id),
            carregarVinculosTreinamento(dataverseService, {
              id: documento.id,
              codigo: documento.codigo,
              tipo: documento.tipo
            }).catch(falha => {
              console.error(falha);
              return { treinamentos: [], documentosDoTreinamento: [] } as IVinculosTreinamentoDocumento;
            })
          ]);

        setReferencias(refs);

        // ------------------------------------------------------------
        // Concilia: referência que envolve um treinamento (TRN) precisa
        // do vínculo treinamento × documento. Se faltar, cria agora
        // (idempotente — já vinculado não duplica).
        // ------------------------------------------------------------
        const envolveTreinamento =
          (outro: { tipo: string }): boolean =>
            controle !== ehDocumentoControle(outro.tipo);

        const pares: Array<Promise<number>> = [];

        const citadosComTreinamento =
          refs.referencia.filter(item => envolveTreinamento(item.documento));

        if (citadosComTreinamento.length > 0) {
          pares.push(
            sincronizarVinculosTreinamento(
              dataverseService,
              { id: documento.id, codigo: documento.codigo, tipo: documento.tipo },
              { referencias: gravarValorDocumentos(citadosComTreinamento.map(item => item.documento)) }
            )
          );
        }

        refs.referenciadoPor
          .filter(item => envolveTreinamento(item.documento))
          .forEach(item => {
            pares.push(
              sincronizarVinculosTreinamento(
                dataverseService,
                { id: item.documento.id, codigo: item.documento.codigo, tipo: item.documento.tipo },
                { referencias: gravarValorDocumentos([{ id: documento.id, codigo: documento.codigo, titulo: documento.titulo }]) }
              )
            );
          });

        let vinculosFinais = vinculos;
        setAvisoVinculo('');

        const mensagensFalha: string[] = [];

        if (pares.length > 0) {
          const resultados =
            await Promise.all(
              pares.map(par => par.catch(falha => {
                console.error(falha);
                mensagensFalha.push(falha instanceof Error ? falha.message : String(falha));
                return -1;
              }))
            );

          if (resultados.some(qtd => qtd > 0)) {
            // Vínculo criado agora: relê os treinamentos vinculados.
            vinculosFinais =
              await carregarVinculosTreinamento(dataverseService, {
                id: documento.id,
                codigo: documento.codigo,
                tipo: documento.tipo
              }).catch(() => vinculos);
          }

          if (resultados.some(qtd => qtd < 0)) {
            setAvisoVinculo(
              'Há referência a treinamento sem o vínculo treinamento × documento, e não foi possível criá-lo agora: ' +
              mensagensFalha.join(' ')
            );
          }
        }

        setTreinamentos(vinculosFinais);
      } catch (falha) {
        console.error(falha);
        setErro(`Não foi possível carregar as referências: ${falha instanceof Error ? falha.message : String(falha)}`);
      } finally {
        setCarregando(false);
      }
    },
    [dataverseService, documento.id, documento.codigo, documento.tipo, documento.titulo, controle]
  );

  React.useEffect(
    () => {
      carregar().catch(falha => console.error(falha));
    },
    [carregar]
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <span style={{ fontSize: '12.5px', color: COR.texto2 }}>
          Referências feitas nos metadados do fluxo (campos "Documento referenciado"). Vale a revisão mais recente de cada documento.
        </span>
        <button
          type="button"
          onClick={() => { carregar().catch(falha => console.error(falha)); }}
          disabled={carregando}
          style={{
            border: 0,
            background: 'transparent',
            color: COR.link,
            fontWeight: 700,
            fontSize: '12.5px',
            cursor: carregando ? 'default' : 'pointer',
            opacity: carregando ? 0.5 : 1,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap'
          }}
        >
          {carregando ? 'Carregando...' : '⟳ Atualizar'}
        </button>
      </div>

      {erro && <div style={{ color: '#B42318', fontSize: '13px', marginBottom: '12px' }}>{erro}</div>}
      {avisoVinculo && <div style={{ color: '#B54708', background: '#FFFAEB', padding: '8px 12px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '12px' }}>{avisoVinculo}</div>}

      <Secao
        icone="↗"
        titulo="Este documento referencia"
        descricao={`Documentos citados por ${documento.codigo}.`}
        quantidade={referencias.referencia.length}
        vazio={carregando ? 'Carregando...' : 'Este documento não referencia nenhum outro.'}
      >
        <TabelaReferencias itens={referencias.referencia} onAbrir={onAbrirDocumento} />
      </Secao>

      <Secao
        icone="↙"
        titulo="Referenciado por"
        descricao={`Documentos que citam ${documento.codigo} (ex.: se o pai cita o filho, o filho mostra o pai aqui).`}
        quantidade={referencias.referenciadoPor.length}
        vazio={carregando ? 'Carregando...' : 'Nenhum documento referencia este.'}
      >
        <TabelaReferencias itens={referencias.referenciadoPor} onAbrir={onAbrirDocumento} />
      </Secao>

      {
        controle
          ? (
            <Secao
              icone="🎓"
              titulo="Documentos vinculados ao treinamento"
              descricao={
                treinamentos.treinamentoDoControle
                  ? `Documentos ligados ao treinamento ${treinamentos.treinamentoDoControle.codigo} — ${treinamentos.treinamentoDoControle.nome}. Uma revisão desses documentos com retreinamento gera retreinamento deste curso.`
                  : 'Treinamento deste documento de controle não encontrado.'
              }
              quantidade={treinamentos.documentosDoTreinamento.length}
              vazio={carregando ? 'Carregando...' : 'Nenhum documento vinculado a este treinamento.'}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Documento</th>
                    <th style={th}>Título</th>
                    <th style={th}>Área</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {
                    treinamentos.documentosDoTreinamento.map(doc => (
                      <tr key={doc.id}>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}><LinkDocumento documento={doc} onAbrir={onAbrirDocumento} /></td>
                        <td style={td}>{doc.titulo}</td>
                        <td style={{ ...td, color: COR.texto2 }}>{doc.areaNome || '—'}</td>
                        <td style={td}><StatusDocumentoBadge status={doc.status} /></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </Secao>
          )
          : (
            <Secao
              icone="🎓"
              titulo="Treinamentos vinculados"
              descricao="Treinamentos que usam este documento. Uma revisão que exige retreinamento gera retreinamento deles."
              quantidade={treinamentos.treinamentos.length}
              vazio={carregando ? 'Carregando...' : 'Nenhum treinamento vinculado a este documento.'}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Código</th>
                    <th style={th}>Treinamento</th>
                    <th style={th}>Obrigatório</th>
                    <th style={th}>Origem</th>
                    {podeAdministrar && <th style={th} />}
                  </tr>
                </thead>
                <tbody>
                  {
                    treinamentos.treinamentos.map(item => {
                      // Treinamentos que as referências pedem (código do
                      // documento TRN citado = código do treinamento).
                      const codigosReferenciados =
                        referencias.referencia
                          .concat(referencias.referenciadoPor)
                          .filter(ref => ehDocumentoControle(ref.documento.tipo))
                          .map(ref => ref.documento.codigo.trim().toUpperCase());

                      const corresponde =
                        codigosReferenciados.indexOf((item.codigo || '').trim().toUpperCase()) >= 0;

                      const suspeito =
                        item.automatico && !corresponde;

                      return (
                        <tr key={item.relacaoId || item.id} style={suspeito ? { background: '#FEF3F2' } : undefined}>
                          <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{item.codigo || '—'}</td>
                          <td style={td}>{item.nome}</td>
                          <td style={{ ...td, color: COR.texto2 }}>{item.obrigatorio ? 'Sim' : 'Não'}</td>
                          <td style={{ ...td, fontSize: '12px', color: suspeito ? '#B42318' : COR.texto2 }} title={item.observacao || undefined}>
                            {
                              suspeito
                                ? '⚠ Automático, mas não corresponde às referências'
                                : item.automatico
                                  ? '✓ Pela referência'
                                  : 'Manual'
                            }
                          </td>
                          {
                            podeAdministrar && (
                              <td style={{ ...td, textAlign: 'right' }}>
                                <button
                                  type="button"
                                  disabled={!!desvinculando || !dataverseService || !item.relacaoId}
                                  onClick={() => {
                                    if (!dataverseService || !item.relacaoId) {
                                      return;
                                    }
                                    if (!window.confirm(
                                      `Desvincular o treinamento ${item.codigo} de ${documento.codigo}?\n\n` +
                                      'Novas revisões deste documento deixarão de gerar retreinamento desse curso. ' +
                                      'O vínculo é desativado (o histórico é preservado).'
                                    )) {
                                      return;
                                    }
                                    setDesvinculando(item.relacaoId);
                                    desvincularDocumentoDoTreinamento(dataverseService, item.relacaoId)
                                      .then(() => carregar())
                                      .catch(falha => {
                                        console.error(falha);
                                        setErro(`Não foi possível desvincular: ${falha instanceof Error ? falha.message : String(falha)}`);
                                      })
                                      .then(() => setDesvinculando(''), () => setDesvinculando(''));
                                  }}
                                  style={{
                                    border: `1px solid ${suspeito ? '#B42318' : '#CBD5E1'}`,
                                    background: '#FFFFFF',
                                    color: suspeito ? '#B42318' : COR.azul,
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {desvinculando === item.relacaoId ? 'Desvinculando...' : 'Desvincular'}
                                </button>
                              </td>
                            )
                          }
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </Secao>
          )
      }
    </div>
  );
};

export default DocumentoReferenciasTab;
