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
  ehDocumentoControle
} from '../../services/referencias/ReferenciasDocumentoService';

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
  onAbrirDocumento
}) => {

  const [referencias, setReferencias] =
    React.useState<IReferenciasDocumento>({ referencia: [], referenciadoPor: [] });

  const [treinamentos, setTreinamentos] =
    React.useState<IVinculosTreinamentoDocumento>({ treinamentos: [], documentosDoTreinamento: [] });

  const [carregando, setCarregando] =
    React.useState(false);

  const [erro, setErro] =
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
        setTreinamentos(vinculos);
      } catch (falha) {
        console.error(falha);
        setErro(`Não foi possível carregar as referências: ${falha instanceof Error ? falha.message : String(falha)}`);
      } finally {
        setCarregando(false);
      }
    },
    [dataverseService, documento.id, documento.codigo, documento.tipo]
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
                  </tr>
                </thead>
                <tbody>
                  {
                    treinamentos.treinamentos.map(item => (
                      <tr key={item.id}>
                        <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{item.codigo || '—'}</td>
                        <td style={td}>{item.nome}</td>
                        <td style={{ ...td, color: COR.texto2 }}>{item.obrigatorio ? 'Sim' : 'Não'}</td>
                      </tr>
                    ))
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
