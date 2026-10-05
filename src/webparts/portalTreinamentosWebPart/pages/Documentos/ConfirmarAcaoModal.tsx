import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  IFluxoAcao,
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  ACOES_DE_PUBLICACAO,
  adicionarDiasUteis,
  ehAcaoDeDevolucao,
  executarAcao,
  obterElementoAtual
} from '../../services/fluxo/FluxoEngine';

import {
  ESTILO_PASSO_FLUXO,
  categoriaDoPasso
} from '../../services/fluxo/categoriaPasso';

// ============================================================
// CONFIRMAÇÃO DA AÇÃO DO FLUXO
//
// Ao clicar em um botão da etapa (Aprovar, Reprovar, Concluir...):
//   • mostra para onde o documento vai (próxima atividade,
//     responsável, prazo, status, número da revisão);
//   • mostra o que o sistema fará sozinho no caminho
//     (sub-revisão, publicação, fim do fluxo);
//   • pede o comentário (obrigatório quando a ação exige);
//   • só executa ao clicar em "Confirmar".
//
// A prévia é uma SIMULAÇÃO do motor (nada é gravado): usa a mesma
// regra da execução real, então mostra também os bloqueios
// (ex.: reprovação que levaria para uma etapa seguinte).
//
// Renderizado no <body> (createPortal), com estilos próprios.
// ============================================================

export interface IConfirmarAcaoModalProps {
  definicao: IFluxoDefinicao;
  instancia: IFluxoInstancia;
  etapaAtual: IFluxoElemento;
  acao: IFluxoAcao;
  ator: IFluxoAtor;
  valores: Record<string, string>;
  processando: boolean;
  // Erros devolvidos pela execução real (ex.: falha ao gravar).
  errosExecucao: string[];
  onConfirmar: (comentario: string) => Promise<boolean>;
  onCancelar: () => void;
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO_2 = '#5E6670';
const FONTE = "Barlow, Arial, 'Segoe UI', sans-serif";

const DESCRICAO_RESPONSAVEL: Record<string, string> = {
  autorRevisao: 'Autor da revisão',
  gestorArea: 'Gestor da área do documento'
};

const formatarData = (
  iso: string
): string => {
  const data = new Date(iso);
  return isNaN(data.getTime())
    ? '-'
    : data.toLocaleDateString('pt-BR');
};

const Linha: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '6px 0', borderBottom: '1px solid #F2F2F2' }}>
    <span style={{ fontSize: '12px', color: COR_TEXTO_2 }}>{rotulo}</span>
    <span style={{ fontSize: '13.5px', fontWeight: 600, color: COR_AZUL }}>{children}</span>
  </div>
);

const ConfirmarAcaoModal: React.FC<IConfirmarAcaoModalProps> = ({
  definicao,
  instancia,
  etapaAtual,
  acao,
  ator,
  valores,
  processando,
  errosExecucao,
  onConfirmar,
  onCancelar
}) => {

  const [comentario, setComentario] =
    React.useState<string>('');

  const devolucao =
    ehAcaoDeDevolucao(acao);

  const comentarioObrigatorio =
    acao.exigeComentario;

  // Simulação (sem gravar). Se o comentário for obrigatório e ainda
  // estiver vazio, simula com um texto provisório só para descobrir
  // o caminho; a validação real acontece no Confirmar.
  const simulacao =
    React.useMemo(
      () =>
        executarAcao(
          definicao,
          instancia,
          {
            acaoChave: acao.chave,
            comentario: comentario.trim() || (comentarioObrigatorio ? 'prévia' : ''),
            valores,
            ator
          }
        ),
      [definicao, instancia, acao.chave, valores, ator, comentarioObrigatorio, comentario.trim() === '']
    );

  const nova =
    simulacao.ok ? simulacao.instancia : undefined;

  const proxima =
    nova && nova.status !== 'concluido'
      ? obterElementoAtual(definicao, nova)
      : undefined;

  // Passos automáticos no caminho (sub-revisão, publicação...).
  const automaticos =
    nova
      ? nova.historico
        .slice(0, nova.historico.length - instancia.historico.length)
        .filter(passo => passo.sistema)
        .reverse()
      : [];

  const publicaria =
    simulacao.acoesSistema.some(item => ACOES_DE_PUBLICACAO.indexOf(item) >= 0);

  const mudaRevisao =
    !!nova && nova.revisao !== instancia.revisao;

  const faltaComentario =
    comentarioObrigatorio && !comentario.trim();

  const podeConfirmar =
    simulacao.ok && !faltaComentario && !processando;

  const estiloAcao =
    ESTILO_PASSO_FLUXO[
      categoriaDoPasso({
        id: '', data: '', elementoId: '', elementoNome: '',
        acaoChave: acao.chave, acaoRotulo: acao.rotulo, resultado: acao.resultado,
        executadoPorId: '', executadoPorNome: '', sistema: false
      })
    ];

  // Esc fecha; trava a rolagem da página por trás.
  React.useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape' && !processando) {
        onCancelar();
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [onCancelar, processando]);

  const confirmar = (): void => {
    if (!podeConfirmar) {
      return;
    }
    onConfirmar(comentario.trim())
      .catch((error: unknown) => console.error(error));
  };

  const responsaveis =
    proxima
      ? proxima.responsaveis
        .map(item => item.referenciaNome || item.descricao || DESCRICAO_RESPONSAVEL[item.tipo] || item.tipo)
        .filter(Boolean)
      : [];

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Confirmar ${acao.rotulo}`}
      onClick={() => { if (!processando) { onCancelar(); } }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
        background: 'rgba(32, 42, 68, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: FONTE
      }}
    >
      <div
        onClick={evento => evento.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(32, 42, 68, 0.3)'
        }}
      >
        {/* Cabeçalho */}
        <div style={{ background: COR_AZUL, color: '#FFFFFF', padding: '16px 20px', borderBottom: `4px solid ${estiloAcao.cor}` }}>
          <div style={{ fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.85 }}>
            {etapaAtual.nome} · {instancia.revisao}
          </div>
          <div style={{ fontSize: '19px', fontWeight: 700, marginTop: '2px' }}>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px',
                background: estiloAcao.fundo, color: estiloAcao.cor, fontSize: '13px', verticalAlign: 'middle'
              }}
            >
              {estiloAcao.icone}
            </span>
            Confirmar “{acao.rotulo}”
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {
            acao.mensagemConfirmacao && (
              <div style={{ fontSize: '13px', lineHeight: 1.5, background: '#FFF4E5', border: '1px solid #F5C77E', borderRadius: '8px', padding: '10px 12px', color: COR_AZUL }}>
                {acao.mensagemConfirmacao}
              </div>
            )
          }

          {/* Bloqueio / erro na simulação */}
          {
            !simulacao.ok && (
              <div role="alert" style={{ fontSize: '13px', lineHeight: 1.5, background: '#FDE7E9', border: '1px solid #B42318', borderRadius: '8px', padding: '10px 12px', color: COR_AZUL }}>
                <strong style={{ color: '#B42318' }}>Não é possível executar esta ação:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                  {simulacao.erros.map(erro => <li key={erro}>{erro}</li>)}
                </ul>
              </div>
            )
          }

          {/* Próxima atividade */}
          {
            nova && (
              <section>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: COR_TEXTO_2, marginBottom: '6px' }}>
                  Próxima atividade
                </div>

                {
                  proxima
                    ? (
                      <div style={{ border: `1px solid ${COR_BORDA}`, borderLeft: `4px solid ${devolucao ? '#B42318' : '#05C3DD'}`, borderRadius: '8px', padding: '10px 14px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: COR_AZUL, marginBottom: '4px' }}>
                          {devolucao ? '↩ ' : '→ '}{proxima.nome}
                        </div>
                        <Linha rotulo="Responsável">
                          {responsaveis.length > 0 ? responsaveis.join(' · ') : 'Definido no fluxo'}
                        </Linha>
                        {
                          !!proxima.prazoDiasUteis && (
                            <Linha rotulo="Prazo">
                              {formatarData(adicionarDiasUteis(new Date().toISOString(), proxima.prazoDiasUteis))}
                              {' '}({proxima.prazoDiasUteis} {proxima.prazoDiasUteis === 1 ? 'dia útil' : 'dias úteis'})
                            </Linha>
                          )
                        }
                        {
                          proxima.statusDocumento && (
                            <Linha rotulo="Status do documento">{proxima.statusDocumento}</Linha>
                          )
                        }
                        {
                          mudaRevisao && (
                            <Linha rotulo="Número da revisão">{instancia.revisao} → {nova.revisao}</Linha>
                          )
                        }
                        {
                          proxima.instrucoes && (
                            <p style={{ margin: '8px 0 0', fontSize: '12.5px', lineHeight: 1.5, color: COR_TEXTO_2 }}>
                              {proxima.instrucoes}
                            </p>
                          )
                        }
                      </div>
                    )
                    : (
                      <div style={{ border: `1px solid ${COR_BORDA}`, borderLeft: '4px solid #107C10', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, color: COR_AZUL }}>
                        ■ O fluxo desta revisão será concluído.
                        {mudaRevisao && <div style={{ fontWeight: 400, fontSize: '13px', marginTop: '4px' }}>Número da revisão: {instancia.revisao} → {nova.revisao}</div>}
                        {
                          !publicaria && (
                            <div style={{ fontWeight: 400, fontSize: '12.5px', marginTop: '4px', color: COR_TEXTO_2 }}>
                              O caminho não passa por uma publicação: a revisão não fica vigente.
                            </div>
                          )
                        }
                      </div>
                    )
                }
              </section>
            )
          }

          {/* O que o sistema faz sozinho */}
          {
            automaticos.length > 0 && (
              <section>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: COR_TEXTO_2, marginBottom: '6px' }}>
                  O sistema fará automaticamente
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {
                    automaticos.map(passo => {
                      const estilo = ESTILO_PASSO_FLUXO[categoriaDoPasso(passo)];
                      return (
                        <li key={passo.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: COR_AZUL }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: estilo.fundo, color: estilo.cor, border: `1.5px solid ${estilo.cor}`, fontSize: '11px', fontWeight: 800 }}>
                            {estilo.icone}
                          </span>
                          {passo.acaoRotulo.replace(' (simulada)', '')}
                        </li>
                      );
                    })
                  }
                </ul>
              </section>
            )
          }

          {/* Comentário */}
          <div>
            <label htmlFor="confirmar-comentario" style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: COR_TEXTO_2, marginBottom: '6px' }}>
              Comentário {comentarioObrigatorio ? '(obrigatório)' : '(opcional)'}
            </label>
            <textarea
              id="confirmar-comentario"
              rows={4}
              autoFocus
              value={comentario}
              disabled={processando}
              onChange={evento => setComentario(evento.target.value)}
              placeholder={devolucao ? 'Explique o que precisa ser ajustado…' : 'Observações para o histórico…'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: `1px solid ${faltaComentario ? '#B42318' : COR_BORDA}`,
                borderRadius: '8px',
                padding: '8px 10px',
                fontFamily: 'inherit',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
            {
              faltaComentario && (
                <span style={{ fontSize: '12px', color: '#B42318' }}>Informe o comentário para confirmar.</span>
              )
            }
          </div>

          {
            errosExecucao.length > 0 && (
              <div role="alert" style={{ fontSize: '13px', background: '#FDE7E9', border: '1px solid #B42318', borderRadius: '8px', padding: '10px 12px' }}>
                <strong style={{ color: '#B42318' }}>Não foi possível executar:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                  {errosExecucao.map(erro => <li key={erro}>{erro}</li>)}
                </ul>
              </div>
            )
          }
        </div>

        {/* Rodapé */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: `1px solid ${COR_BORDA}`, background: '#F7F9FB' }}>
          <button
            type="button"
            onClick={onCancelar}
            disabled={processando}
            style={{ minHeight: '40px', padding: '0 18px', borderRadius: '6px', border: `1px solid ${COR_BORDA}`, background: '#FFFFFF', color: COR_AZUL, fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', fontFamily: FONTE }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!podeConfirmar}
            style={{
              minHeight: '40px', padding: '0 18px', borderRadius: '6px', border: 0,
              background: estiloAcao.cor, color: '#FFFFFF', fontWeight: 700, fontSize: '13.5px',
              cursor: podeConfirmar ? 'pointer' : 'not-allowed', opacity: podeConfirmar ? 1 : 0.45, fontFamily: FONTE
            }}
          >
            {processando ? 'Executando…' : `Confirmar ${acao.rotulo}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmarAcaoModal;
