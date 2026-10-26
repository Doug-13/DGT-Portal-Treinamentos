import * as React from 'react';

import {
  IDocumento,
  IDocumentoRevisao
} from '../../models/Documento';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  DocumentoService
} from '../../services/DocumentoService';

import {
  SharePointDocumentoService
} from '../../services/sharepoint/SharePointDocumentoService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  IControleTreinamento,
  TreinamentoDocumentoControleService
} from '../../services/TreinamentoDocumentoControleService';

import {
  controleDocumentalHabilitado
} from '../../constants/controleDocumental';

import {
  useDocumentoRevisaoFluxo
} from '../../hooks/useDocumentoRevisaoFluxo';

import {
  useEtapasFluxoTreinamentos
} from '../../hooks/useEtapasFluxoTreinamentos';

import FluxoRevisaoTab from
  '../Documentos/FluxoRevisaoTab';

import EtapaFluxoTreinamentoModal from
  './EtapaFluxoTreinamentoModal';

import ResumoTreinamentoFluxo from
  './ResumoTreinamentoFluxo';

// ============================================================
// ASSISTENTE DO TREINAMENTO (Treinamento → Módulos → Avaliação)
// COM O FLUXO DE REVISÃO AO LADO
//
// Quem elabora/revisa o treinamento vê, na mesma tela em que
// edita: revisão, etapa atual, responsável, prazo, instruções,
// campos da etapa e os botões para avançar (ex.: "Enviar para
// Avaliação"), além do resumo de módulos e avaliação.
// Sem documento de controle, a página aparece como antes.
// ============================================================

export interface IPainelFluxoAssistenteTreinamentoProps {
  treinamentoId: string;
  treinamentos: ITreinamentoAdmin[];

  documentosControle?: IDocumento[];
  onRecarregarDocumentos?: () => Promise<void>;

  contexto?: IContextoAcesso;
  usuariosAreas?: IUsuarioAreaAdmin[];
  dataverseService?: DataverseService;
  sharePointDocumentoService?: SharePointDocumentoService;

  onAbrirProcesso?: (processoId: string) => void;

  children?: React.ReactNode;
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  azul10: '#EDF0F5',
  borda: '#E2E8F0',
  textoSec: '#64748B'
};

const guid = (valor?: string): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const PainelFluxoAssistenteTreinamento: React.FC<IPainelFluxoAssistenteTreinamentoProps> = ({
  treinamentoId,
  treinamentos,
  documentosControle,
  onRecarregarDocumentos,
  contexto,
  usuariosAreas,
  dataverseService,
  sharePointDocumentoService,
  onAbrirProcesso,
  children
}) => {

  const id = guid(treinamentoId);

  const treinamento =
    treinamentos.find(item => guid(item.id) === id);

  const [controle, setControle] =
    React.useState<IControleTreinamento | undefined>(undefined);

  const [revisoes, setRevisoes] =
    React.useState<IDocumentoRevisao[]>([]);

  const [versao, setVersao] =
    React.useState(0);

  const [verFluxoCompleto, setVerFluxoCompleto] =
    React.useState(false);

  // Largura da tela: no celular o painel vai para baixo.
  const [largo, setLargo] =
    React.useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 1100 : true);

  React.useEffect(
    () => {
      const aoRedimensionar = (): void => setLargo(window.innerWidth >= 1100);
      window.addEventListener('resize', aoRedimensionar);
      return () => window.removeEventListener('resize', aoRedimensionar);
    },
    []
  );

  const carregar =
    React.useCallback(
      async (): Promise<void> => {

        if (!dataverseService || !controleDocumentalHabilitado() || !id) {
          setControle(undefined);
          return;
        }

        try {
          const lido =
            await new TreinamentoDocumentoControleService(dataverseService)
              .obterPorTreinamento(id);

          setControle(lido);

          setRevisoes(
            lido
              ? await new DocumentoService(dataverseService).getRevisoesDocumento(lido.documentoId)
              : []
          );
        } catch (erro) {
          console.error('Não foi possível carregar o fluxo do treinamento:', erro);
          setControle(undefined);
        }
      },
      [dataverseService, id]
    );

  React.useEffect(
    () => {
      carregar().catch(erro => console.error(erro));
    },
    [carregar]
  );

  const documento =
    controle
      ? (documentosControle || []).find(item => guid(item.id) === controle.documentoId)
      : undefined;

  // Documento recém-criado ainda fora da lista: recarrega uma vez.
  const recarregouRef =
    React.useRef('');

  React.useEffect(
    () => {
      if (
        controle &&
        !documento &&
        onRecarregarDocumentos &&
        recarregouRef.current !== controle.documentoId
      ) {
        recarregouRef.current = controle.documentoId;
        onRecarregarDocumentos().catch(erro => console.error(erro));
      }
    },
    [controle, documento, onRecarregarDocumentos]
  );

  const aoAlterar =
    React.useCallback(
      async (): Promise<void> => {
        await carregar();
        setVersao(atual => atual + 1);
      },
      [carregar]
    );

  const usuarioFluxo =
    React.useMemo(
      () => ({
        id: contexto?.usuarioId || '',
        nome: contexto?.nome || contexto?.email || ''
      }),
      [contexto]
    );

  const fluxo =
    useDocumentoRevisaoFluxo(
      dataverseService,
      sharePointDocumentoService,
      documento,
      revisoes,
      usuarioFluxo,
      aoAlterar
    );

  const controles =
    React.useMemo(
      (): Record<string, IControleTreinamento> =>
        controle ? { [id]: controle } : {},
      [controle, id]
    );

  const areaPorDocumento =
    React.useMemo(
      (): Record<string, string> =>
        controle && documento ? { [controle.documentoId]: documento.areaId || '' } : {},
      [controle, documento]
    );

  const vinculos =
    React.useMemo(
      () => usuariosAreas || [],
      [usuariosAreas]
    );

  const etapas =
    useEtapasFluxoTreinamentos(
      dataverseService,
      controles,
      contexto,
      vinculos,
      areaPorDocumento
    );

  // Sem controle documental: só a página.
  if (!controle || !treinamento) {
    return <>{children}</>;
  }

  const etapa = etapas.etapas[id];

  const painel = (
    <aside
      style={{
        position: largo ? 'sticky' : 'static',
        top: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {/* cabeçalho do painel */}
      <div
        style={{
          background: '#FFFFFF',
          border: `1px solid ${COR.borda}`,
          borderLeft: `4px solid ${COR.ciano}`,
          borderRadius: '10px',
          padding: '12px 14px'
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: COR.indigo }}>
          Fluxo de revisão
        </div>
        <div style={{ fontWeight: 700, color: COR.azul, marginTop: '2px' }}>
          {controle.codigo} · {controle.revisaoEmAndamento ? controle.revisaoEmAndamento.revisao : controle.revisaoVigente || '-'}
        </div>
        <div style={{ fontSize: '12px', color: COR.textoSec, marginTop: '4px', lineHeight: 1.5 }}>
          {controle.revisaoEmAndamento
            ? (
              <>
                Etapa: <strong style={{ color: COR.azul }}>{etapa ? etapa.etapa : controle.revisaoEmAndamento.status || 'Elaboração'}</strong>
                {etapa && etapa.responsaveis.length > 0 && (
                  <> · Resp.: {etapa.responsaveis.join(' · ')}</>
                )}
              </>
            )
            : `Vigente na ${controle.revisaoVigente || '-'} — sem revisão em andamento.`}
        </div>
        {!controle.vigente && (
          <div style={{ fontSize: '12px', color: COR.textoSec, marginTop: '4px' }}>
            O treinamento fica inativo até a publicação pelo fluxo.
          </div>
        )}
      </div>

      {/* etapa atual com os botões */}
      {controle.revisaoEmAndamento && documento && (
        <div style={{ background: '#FFFFFF', borderRadius: '10px' }}>
          {fluxo.erro && (
            <div style={{ marginBottom: '8px', color: '#B42318', fontSize: '13px' }}>{fluxo.erro}</div>
          )}
          {fluxo.aviso && (
            <div style={{ marginBottom: '8px', color: '#15803D', fontSize: '13px' }}>{fluxo.aviso}</div>
          )}
          <FluxoRevisaoTab
            key={`assistente-${documento.id}-${versao}`}
            compacto
            documento={documento}
            revisoes={revisoes}
            contexto={contexto}
            dataverseService={dataverseService}
            onAbrirProcesso={onAbrirProcesso}
            onRevisaoAlterada={aoAlterar}
            onVerFluxoCompleto={() => setVerFluxoCompleto(true)}
            onAnexarArquivo={sharePointDocumentoService ? fluxo.anexarArquivo : undefined}
            erroAnexo={fluxo.erro}
          />
        </div>
      )}

      {controle.revisaoEmAndamento && !documento && (
        <div style={{ background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '10px', padding: '12px 14px', color: COR.textoSec, fontSize: '13px' }}>
          Carregando o documento {controle.codigo}...
        </div>
      )}

      {/* resumo de módulos e avaliação */}
      <ResumoTreinamentoFluxo
        key={`resumo-${versao}`}
        treinamento={treinamento}
        areaNome={documento ? documento.area : undefined}
        revisao={controle.revisaoEmAndamento ? controle.revisaoEmAndamento.revisao : controle.revisaoVigente}
        dataverseService={dataverseService}
        iniciarRecolhido
      />
    </aside>
  );

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: largo ? 'minmax(0, 1fr) minmax(360px, 420px)' : 'minmax(0, 1fr)',
          gap: '18px',
          alignItems: 'start'
        }}
      >
        <div style={{ minWidth: 0 }}>
          {children}
        </div>
        {painel}
      </div>

      {verFluxoCompleto && (
        <EtapaFluxoTreinamentoModal
          treinamento={treinamento}
          controle={controle}
          etapa={etapa}
          documento={documento}
          contexto={contexto}
          dataverseService={dataverseService}
          sharePointDocumentoService={sharePointDocumentoService}
          onFechar={() => setVerFluxoCompleto(false)}
          onAlterado={aoAlterar}
          onAbrirProcesso={onAbrirProcesso}
        />
      )}
    </>
  );
};

export default PainelFluxoAssistenteTreinamento;
