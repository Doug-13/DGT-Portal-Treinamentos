import * as React from 'react';

import {
  IDocumento,
  IDocumentoRevisao
} from '../../models/Documento';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IControleTreinamento
} from '../../services/TreinamentoDocumentoControleService';

import {
  IEtapaFluxoTreinamento
} from '../../hooks/useEtapasFluxoTreinamentos';

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
  useDocumentoRevisaoFluxo
} from '../../hooks/useDocumentoRevisaoFluxo';

import FluxoRevisaoTab from
  '../Documentos/FluxoRevisaoTab';

// ============================================================
// "VER ETAPA DO FLUXO" (menu ⋮ da Gestão de treinamentos)
//
// Mostra onde o treinamento está no fluxo do processo: etapa atual,
// responsável, prazo e o desenho do fluxo com a etapa destacada.
// O responsável da etapa pode concluí-la daqui mesmo.
// ============================================================

export interface IEtapaFluxoTreinamentoModalProps {
  treinamento: ITreinamentoAdmin;
  controle: IControleTreinamento;
  etapa?: IEtapaFluxoTreinamento;
  documento?: IDocumento;

  contexto?: IContextoAcesso;
  dataverseService?: DataverseService;
  sharePointDocumentoService?: SharePointDocumentoService;

  onFechar: () => void;
  onAlterado?: () => Promise<void>;
  onAbrirProcesso?: (processoId: string) => void;

  // Ação escolhida na lista (ex.: "Enviar para Avaliação"): a janela
  // mostra os campos da etapa e só o botão dessa ação.
  acaoChave?: string;
  acaoRotulo?: string;

}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  azul10: '#EDF0F5',
  ciano10: '#E6F9FC',
  borda: '#E2E8F0',
  textoSec: '#64748B',
  atraso: '#B42318'
};

const dataBr = (valor?: string): string => {
  if (!valor) {
    return '-';
  }
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  return isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR');
};

const vencido = (prazo?: string): boolean => {
  if (!prazo) {
    return false;
  }
  const d = new Date(prazo.length === 10 ? `${prazo}T23:59:59` : prazo);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
};

const rotulo: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: COR.textoSec,
  marginBottom: '4px'
};

const EtapaFluxoTreinamentoModal: React.FC<IEtapaFluxoTreinamentoModalProps> = ({
  treinamento,
  controle,
  etapa,
  documento,
  contexto,
  dataverseService,
  sharePointDocumentoService,
  onFechar,
  onAlterado,
  onAbrirProcesso,
  acaoChave,
  acaoRotulo
}) => {

  const [revisoes, setRevisoes] =
    React.useState<IDocumentoRevisao[]>([]);

  const [carregando, setCarregando] =
    React.useState(true);

  const [versao, setVersao] =
    React.useState(0);

  // Desenho completo do fluxo (abre sob demanda).
  const [verDesenho, setVerDesenho] =
    React.useState(false);

  const carregar =
    React.useCallback(
      async (): Promise<void> => {
        if (!dataverseService) {
          setCarregando(false);
          return;
        }
        setCarregando(true);
        try {
          setRevisoes(
            await new DocumentoService(dataverseService)
              .getRevisoesDocumento(controle.documentoId)
          );
        } catch (erro) {
          console.error(erro);
        } finally {
          setCarregando(false);
        }
      },
      [dataverseService, controle.documentoId]
    );

  React.useEffect(
    () => {
      carregar().catch(erro => console.error(erro));
    },
    [carregar]
  );

  const aoAlterar =
    React.useCallback(
      async (): Promise<void> => {
        await carregar();
        setVersao(atual => atual + 1);
        if (onAlterado) {
          await onAlterado();
        }
        // Ação escolhida na lista: concluída, volta para a lista.
        if (acaoChave) {
          onFechar();
        }
      },
      [carregar, onAlterado, acaoChave, onFechar]
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

  // Fecha com Esc.
  React.useEffect(
    () => {
      const tecla = (evento: KeyboardEvent): void => {
        if (evento.key === 'Escape') {
          onFechar();
        }
      };
      window.addEventListener('keydown', tecla);
      return () => window.removeEventListener('keydown', tecla);
    },
    [onFechar]
  );

  const prazoVencido = vencido(etapa ? etapa.prazo : undefined);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Etapa do fluxo — ${treinamento.codigo}`}
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(32, 42, 68, .45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '32px 16px',
        overflowY: 'auto'
      }}
    >
      <div
        onClick={evento => evento.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1200px',
          background: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(0,0,0,.2)',
          overflow: 'hidden'
        }}
      >
        {/* cabeçalho */}
        <div
          style={{
            background: COR.azul,
            color: '#FFFFFF',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '.06em', textTransform: 'uppercase', color: COR.ciano, fontWeight: 700 }}>
              {acaoRotulo ? acaoRotulo : 'Etapa do fluxo'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>
              {treinamento.codigo} — {treinamento.nome}
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            style={{ border: '1px solid #FFFFFF', background: 'transparent', color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Fechar
          </button>
        </div>

        {/* onde está */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
            padding: '16px 20px',
            background: COR.azul10,
            borderBottom: `1px solid ${COR.borda}`
          }}
        >
          <div>
            <div style={rotulo}>Revisão</div>
            <div style={{ fontWeight: 700, color: COR.azul }}>
              {controle.revisaoEmAndamento ? controle.revisaoEmAndamento.revisao : controle.revisaoVigente || '-'}
            </div>
          </div>
          <div>
            <div style={rotulo}>Etapa atual</div>
            <div style={{ fontWeight: 700, color: COR.indigo }}>
              {etapa ? etapa.etapa : controle.revisaoEmAndamento ? controle.revisaoEmAndamento.status : 'Sem revisão em andamento'}
            </div>
          </div>
          <div>
            <div style={rotulo}>Responsável</div>
            <div>{etapa && etapa.responsaveis.length > 0 ? etapa.responsaveis.join(' · ') : '-'}</div>
            {etapa && etapa.aguardandoVoce && (
              <div style={{ marginTop: '4px', display: 'inline-block', background: COR.ciano10, color: COR.azul, borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                Aguardando você
              </div>
            )}
          </div>
          <div>
            <div style={rotulo}>Prazo da etapa</div>
            <div style={{ color: prazoVencido ? COR.atraso : undefined, fontWeight: prazoVencido ? 700 : 400 }}>
              {etapa && etapa.prazo ? `${dataBr(etapa.prazo)}${prazoVencido ? ' (vencido)' : ''}` : '-'}
            </div>
          </div>
          <div>
            <div style={rotulo}>Na etapa desde</div>
            <div>{etapa && etapa.desde ? dataBr(etapa.desde) : etapa && etapa.naoIniciado ? 'Fluxo ainda não iniciado' : '-'}</div>
          </div>
        </div>

        {/* desenho do fluxo com a etapa atual + ações do responsável */}
        <div style={{ padding: '16px 20px' }}>
          {fluxo.erro && (
            <div style={{ marginBottom: '10px', color: COR.atraso, fontSize: '13px' }}>{fluxo.erro}</div>
          )}

          {fluxo.aviso && (
            <div style={{ marginBottom: '10px', color: '#15803D', fontSize: '13px' }}>{fluxo.aviso}</div>
          )}

          {carregando && (
            <div style={{ color: COR.textoSec }}>Carregando o fluxo...</div>
          )}

          {!carregando && !documento && (
            <div style={{ color: COR.textoSec }}>
              Não foi possível carregar o documento de controle {controle.codigo}. Verifique o seu acesso à área do treinamento.
            </div>
          )}

          {/* Etapa atual com os botões de ação (modo compacto). */}
          {!carregando && documento && (
            <FluxoRevisaoTab
              key={`etapa-${documento.id}-${versao}`}
              compacto
              somenteAcao={acaoChave}
              documento={documento}
              revisoes={revisoes}
              contexto={contexto}
              dataverseService={dataverseService}
              onAbrirProcesso={onAbrirProcesso}
              onRevisaoAlterada={aoAlterar}
              onVerFluxoCompleto={() => setVerDesenho(true)}
              onAnexarArquivo={sharePointDocumentoService ? fluxo.anexarArquivo : undefined}
              erroAnexo={fluxo.erro}
            />
          )}

          {/* Desenho do fluxo com a etapa destacada e o histórico. */}
          {!carregando && documento && (
            <div style={{ marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setVerDesenho(!verDesenho)}
                style={{ border: 'none', background: 'transparent', color: COR.indigo, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                {verDesenho ? 'Ocultar desenho do fluxo' : 'Ver desenho do fluxo e histórico'}
              </button>

              {verDesenho && (
                <div style={{ marginTop: '10px' }}>
                  <FluxoRevisaoTab
                    key={`desenho-${documento.id}-${versao}`}
                    documento={documento}
                    revisoes={revisoes}
                    contexto={contexto}
                    dataverseService={dataverseService}
                    onAbrirProcesso={onAbrirProcesso}
                    onRevisaoAlterada={aoAlterar}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EtapaFluxoTreinamentoModal;
