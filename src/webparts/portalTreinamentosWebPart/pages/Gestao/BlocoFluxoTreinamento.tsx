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
// FLUXO DE REVISÃO NO ASSISTENTE DO TREINAMENTO
// (Treinamento → Módulos → Avaliação)
//
// Quem elabora/revisa o treinamento vê, no MESMO card em que
// edita: revisão, etapa atual, responsável, prazo, instruções,
// campos da etapa e os botões para avançar (ex.: "Enviar para
// Avaliação"), além do resumo de módulos e avaliação.
//
//   modo 'embutido' → dentro do card do formulário (Treinamento);
//   modo 'card'     → card próprio (páginas Módulos e Avaliação).
//
// Sem documento de controle, não mostra nada.
// ============================================================

export interface IBlocoFluxoTreinamentoProps {
  treinamentoId: string;
  treinamentos: ITreinamentoAdmin[];

  documentosControle?: IDocumento[];
  onRecarregarDocumentos?: () => Promise<void>;

  contexto?: IContextoAcesso;
  usuariosAreas?: IUsuarioAreaAdmin[];
  dataverseService?: DataverseService;
  sharePointDocumentoService?: SharePointDocumentoService;

  onAbrirProcesso?: (processoId: string) => void;

  modo?: 'embutido' | 'card';
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

const BlocoFluxoTreinamento: React.FC<IBlocoFluxoTreinamentoProps> = ({
  treinamentoId,
  treinamentos,
  documentosControle,
  onRecarregarDocumentos,
  contexto,
  usuariosAreas,
  dataverseService,
  sharePointDocumentoService,
  onAbrirProcesso,
  modo = 'embutido'
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

  // Sem controle documental: nada a mostrar.
  if (!controle || !treinamento) {
    return null;
  }

  const etapa = etapas.etapas[id];

  const embutido = modo === 'embutido';

  return (
    <>
      <section
        style={
          embutido
            ? { marginTop: '24px', paddingTop: '18px', borderTop: `1px solid ${COR.borda}` }
            : { marginTop: '18px', padding: '24px', background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '14px', maxWidth: '980px' }
        }
      >
        {/* identificação */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: COR.indigo }}>
              Fluxo de revisão
            </span>
            <span style={{ fontWeight: 700, color: COR.azul, marginLeft: '8px' }}>
              {controle.codigo} · {controle.revisaoEmAndamento ? controle.revisaoEmAndamento.revisao : controle.revisaoVigente || '-'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: COR.textoSec }}>
            {controle.vigente
              ? `Vigente na ${controle.revisaoVigente}.`
              : 'Inativo até a publicação pelo fluxo.'}
          </div>
        </div>

        {/* etapa atual: responsável, prazo, instruções, campos e botões */}
        {controle.revisaoEmAndamento && documento && (
          <div>
            {fluxo.erro && (
              <div style={{ marginBottom: '8px', color: '#B42318', fontSize: '13px' }}>{fluxo.erro}</div>
            )}
            {fluxo.aviso && (
              <div style={{ marginBottom: '8px', color: '#15803D', fontSize: '13px' }}>{fluxo.aviso}</div>
            )}
            <FluxoRevisaoTab
              key={`assistente-${documento.id}-${versao}`}
              compacto
              embutido
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
          <div style={{ color: COR.textoSec, fontSize: '13px' }}>
            Carregando o documento {controle.codigo}...
          </div>
        )}

        {!controle.revisaoEmAndamento && (
          <div style={{ color: COR.textoSec, fontSize: '13px' }}>
            Nenhuma revisão em andamento. Para alterar o treinamento, abra uma nova revisão
            na Gestão (menu ⋮ → Revisões / nova revisão).
          </div>
        )}

        {/* resumo de módulos e avaliação */}
        <div style={{ marginTop: '14px' }}>
          <ResumoTreinamentoFluxo
            key={`resumo-${versao}`}
            treinamento={treinamento}
            areaNome={documento ? documento.area : undefined}
            revisao={controle.revisaoEmAndamento ? controle.revisaoEmAndamento.revisao : controle.revisaoVigente}
            dataverseService={dataverseService}
            iniciarRecolhido
          />
        </div>
      </section>

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

export default BlocoFluxoTreinamento;
