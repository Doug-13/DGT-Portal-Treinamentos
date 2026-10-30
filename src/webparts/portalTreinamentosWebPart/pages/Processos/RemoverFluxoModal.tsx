import * as React from 'react';

import {
  IProcesso
} from '../../models/Processo';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  ExclusaoFluxoService,
  IAnaliseExclusaoFluxo
} from '../../services/processos/ExclusaoFluxoService';

// ============================================================
// REMOVER FLUXO (somente Administrador)
//
//   Com documentos vinculados → "Transferir documentos" (abre a
//                               transferência; depois volta aqui).
//   Com histórico de revisões → "Arquivar fluxo" (some da lista,
//                               nada é apagado).
//   Sem nada ligado           → "Remover definitivamente" (apaga o
//                               fluxo e todos os dados dele). Exige
//                               digitar o código do fluxo.
// ============================================================

export interface IRemoverFluxoModalProps {
  dataverseService: DataverseService;
  processo: IProcesso;
  onTransferir: () => void;
  onFechar: (alterou: boolean) => void;
}

const COR = {
  azul: '#202A44',
  texto2: '#5E6670',
  borda: '#D9D9D6',
  vermelho: '#B42318',
  vermelhoClaro: '#FEF3F2',
  ambar: '#B54708',
  ambarClaro: '#FFFAEB',
  verde: '#067647'
};

const botao = (
  tipo: 'primario' | 'perigo' | 'secundario',
  desabilitado = false
): React.CSSProperties => ({
  padding: '9px 16px',
  borderRadius: '8px',
  border: tipo === 'secundario' ? `1px solid ${COR.azul}` : 0,
  background: desabilitado ? '#CBD5E1' : tipo === 'perigo' ? COR.vermelho : tipo === 'primario' ? COR.azul : '#FFFFFF',
  color: tipo === 'secundario' ? COR.azul : '#FFFFFF',
  fontWeight: 700,
  fontSize: '13px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit'
});

const Linha: React.FC<{ rotulo: string; quantidade: number }> = ({ rotulo, quantidade }) => (
  <li style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
    <span>{rotulo}</span>
    <strong>{quantidade}</strong>
  </li>
);

const RemoverFluxoModal: React.FC<IRemoverFluxoModalProps> = ({
  dataverseService,
  processo,
  onTransferir,
  onFechar
}) => {

  const servico =
    React.useMemo(() => new ExclusaoFluxoService(dataverseService), [dataverseService]);

  const [analise, setAnalise] =
    React.useState<IAnaliseExclusaoFluxo | undefined>(undefined);

  const [erro, setErro] =
    React.useState('');

  const [processando, setProcessando] =
    React.useState(false);

  const [progresso, setProgresso] =
    React.useState('');

  const [confirmacao, setConfirmacao] =
    React.useState('');

  const codigoConfirmacao =
    (processo.codigo || processo.nome || '').trim();

  React.useEffect(
    () => {
      let ativo = true;
      setErro('');
      servico.analisar(processo.id)
        .then(resultado => { if (ativo) { setAnalise(resultado); } })
        .catch(falha => {
          console.error(falha);
          if (ativo) { setErro(`Não foi possível analisar o fluxo: ${falha instanceof Error ? falha.message : String(falha)}`); }
        });
      return () => { ativo = false; };
    },
    [servico, processo.id]
  );

  const executar = async (acao: 'arquivar' | 'excluir'): Promise<void> => {
    setProcessando(true);
    setErro('');
    try {
      if (acao === 'arquivar') {
        await servico.arquivar(processo.id);
      } else {
        await servico.excluir(processo.id, setProgresso);
      }
      onFechar(true);
    } catch (falha) {
      console.error(falha);
      setErro(falha instanceof Error ? falha.message : String(falha));
      setProcessando(false);
      setProgresso('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="remover-fluxo-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, .45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={evento => { if (evento.target === evento.currentTarget && !processando) { onFechar(false); } }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#FFFFFF',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(15, 23, 42, .25)',
          color: COR.azul,
          fontSize: '13.5px'
        }}
      >
        <div style={{ background: COR.azul, color: '#FFFFFF', padding: '14px 20px' }}>
          <strong id="remover-fluxo-titulo" style={{ fontSize: '15px' }}>Remover fluxo</strong>
          <div style={{ fontSize: '12.5px', opacity: 0.85, marginTop: '2px' }}>
            {processo.codigo ? `${processo.codigo} — ` : ''}{processo.nome}
          </div>
        </div>

        <div style={{ padding: '18px 20px' }}>
          {
            !analise && !erro && (
              <div style={{ color: COR.texto2 }}>Verificando o que está ligado a este fluxo...</div>
            )
          }

          {
            analise && (
              <>
                <ul style={{ listStyle: 'none', margin: '0 0 14px', padding: 0, fontSize: '13px' }}>
                  <Linha rotulo="Documentos vinculados" quantidade={analise.documentosVinculados} />
                  <Linha rotulo="Revisões que já usaram este fluxo (histórico)" quantidade={analise.revisoesComHistorico} />
                  <Linha rotulo="Versões do fluxo" quantidade={analise.versoes.length} />
                  <Linha rotulo="Metadados" quantidade={analise.metadados.length} />
                  <Linha rotulo="Processos de negócio que usam como padrão" quantidade={analise.processosNegocioPadrao.length} />
                </ul>

                {
                  analise.acao === 'transferir' && (
                    <div style={{ padding: '12px 14px', borderRadius: '8px', background: COR.ambarClaro, color: COR.ambar, lineHeight: 1.5 }}>
                      <strong>Este fluxo tem {analise.documentosVinculados} documento(s) vinculado(s).</strong>
                      <br />
                      Transfira os documentos para outro fluxo (as revisões em andamento seguem na etapa
                      equivalente). Depois da transferência, volte aqui para remover o fluxo.
                    </div>
                  )
                }

                {
                  analise.acao === 'arquivar' && (
                    <div style={{ padding: '12px 14px', borderRadius: '8px', background: COR.ambarClaro, color: COR.ambar, lineHeight: 1.5 }}>
                      <strong>Não há documentos vinculados, mas {analise.revisoesComHistorico} revisão(ões) já passaram por este fluxo.</strong>
                      <br />
                      Para não perder o histórico dessas revisões, o fluxo não pode ser apagado. Ele pode ser
                      <strong> arquivado</strong>: some da lista de fluxos e nada é perdido.
                    </div>
                  )
                }

                {
                  analise.acao === 'excluir' && (
                    <>
                      <div style={{ padding: '12px 14px', borderRadius: '8px', background: COR.vermelhoClaro, color: COR.vermelho, lineHeight: 1.5 }}>
                        <strong>Remoção definitiva.</strong> O fluxo, as versões, os metadados e os demais dados
                        ligados a ele serão apagados do Dataverse. Esta ação não pode ser desfeita.
                        {
                          analise.processosNegocioPadrao.length > 0 && (
                            <>
                              <br />
                              Ficarão sem fluxo padrão: {analise.processosNegocioPadrao.map(item => item.nome).join(', ')}.
                            </>
                          )
                        }
                      </div>

                      <label style={{ display: 'block', marginTop: '14px', fontSize: '12.5px', fontWeight: 700 }}>
                        Para confirmar, digite <code style={{ background: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>{codigoConfirmacao}</code>
                        <input
                          type="text"
                          value={confirmacao}
                          disabled={processando}
                          onChange={evento => setConfirmacao(evento.target.value)}
                          autoComplete="off"
                          style={{
                            display: 'block',
                            width: '100%',
                            boxSizing: 'border-box',
                            marginTop: '6px',
                            padding: '8px 10px',
                            border: `1px solid ${COR.borda}`,
                            borderRadius: '6px',
                            fontFamily: 'inherit',
                            fontSize: '13.5px'
                          }}
                        />
                      </label>
                    </>
                  )
                }
              </>
            )
          }

          {progresso && <div style={{ marginTop: '12px', color: COR.texto2, fontSize: '12.5px' }}>{progresso}</div>}
          {erro && <div style={{ marginTop: '12px', color: COR.vermelho, fontSize: '12.5px' }}>{erro}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <button type="button" disabled={processando} onClick={() => onFechar(false)} style={botao('secundario', processando)}>
            Cancelar
          </button>

          {
            analise && analise.acao === 'transferir' && (
              <button type="button" onClick={onTransferir} style={botao('primario')}>
                ⇄ Transferir documentos
              </button>
            )
          }

          {
            analise && analise.acao === 'arquivar' && (
              <button type="button" disabled={processando} onClick={() => { executar('arquivar').catch(() => undefined); }} style={botao('primario', processando)}>
                {processando ? 'Arquivando...' : 'Arquivar fluxo'}
              </button>
            )
          }

          {
            analise && analise.acao === 'excluir' && (
              <button
                type="button"
                disabled={processando || confirmacao.trim() !== codigoConfirmacao}
                onClick={() => { executar('excluir').catch(() => undefined); }}
                style={botao('perigo', processando || confirmacao.trim() !== codigoConfirmacao)}
              >
                {processando ? 'Removendo...' : '🗑 Remover definitivamente'}
              </button>
            )
          }
        </div>
      </div>
    </div>
  );
};

export default RemoverFluxoModal;
