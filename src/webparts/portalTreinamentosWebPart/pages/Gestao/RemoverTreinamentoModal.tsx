import * as React from 'react';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IImpactoRemocao
} from '../../services/TreinamentoRemocaoService';

// ============================================================
// REMOVER TREINAMENTO (modal)
//
// 1. Analisa o impacto (o que será excluído e se há bloqueios).
// 2. Bloqueia se houver atribuições ou trilhas.
// 3. Exige digitar o código do treinamento para confirmar.
// ============================================================

export interface IRemoverTreinamentoModalProps {
  treinamento?: ITreinamentoAdmin;
  onAnalisar: (treinamento: ITreinamentoAdmin) => Promise<IImpactoRemocao>;
  onRemover: (
    treinamento: ITreinamentoAdmin,
    aoProgredir: (mensagem: string) => void
  ) => Promise<void>;
  onFechar: () => void;
}

const C = {
  azulEscuro: '#0B2D4D',
  branco: '#FFFFFF',
  texto: '#18324A',
  secundario: '#66788A',
  borda: '#D8E2EC',
  fundo: '#F6F9FC',
  vermelho: '#B42318',
  vermelhoClaro: '#FDE7E9',
  ambar: '#B45309',
  ambarClaro: '#FFF4E5'
};

const botao: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: '8px',
  border: `1px solid ${C.borda}`,
  background: C.branco,
  color: C.texto,
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer'
};

const RemoverTreinamentoModal: React.FC<IRemoverTreinamentoModalProps> = (
  props
) => {

  const [impacto, setImpacto] = React.useState<IImpactoRemocao | undefined>();
  const [analisando, setAnalisando] = React.useState(false);
  const [removendo, setRemovendo] = React.useState(false);
  const [progresso, setProgresso] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [confirmacao, setConfirmacao] = React.useState('');

  const treinamento = props.treinamento;

  React.useEffect(
    () => {
      setImpacto(undefined);
      setErro('');
      setConfirmacao('');
      setProgresso('');

      if (!treinamento) {
        return;
      }

      setAnalisando(true);

      props.onAnalisar(treinamento)
        .then(resultado => setImpacto(resultado))
        .catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível analisar o treinamento.'))
        .then(() => setAnalisando(false))
        .catch(() => setAnalisando(false));
    },
    [treinamento ? treinamento.id : '']
  );

  if (!treinamento) {
    return null;
  }

  const codigoConfirmacao =
    (treinamento.codigo || treinamento.nome).trim();

  const confirmado =
    confirmacao.trim().toUpperCase() === codigoConfirmacao.toUpperCase();

  const remover = async (): Promise<void> => {
    setRemovendo(true);
    setErro('');

    try {
      await props.onRemover(treinamento, setProgresso);
      props.onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível remover o treinamento.');
      setProgresso('');
    } finally {
      setRemovendo(false);
    }
  };

  const itens: Array<[string, number]> = impacto
    ? [
      ['Módulos', impacto.modulos],
      ['Conteúdos dos módulos', impacto.conteudos],
      ['Perguntas dos módulos', impacto.perguntasModulo],
      ['Avaliações', impacto.avaliacoes],
      ['Questões', impacto.questoes],
      ['Alternativas', impacto.alternativas + impacto.alternativasPerguntas],
      ['Documentos vinculados (só o vínculo)', impacto.documentosVinculados],
      ['Regras de atribuição por área', impacto.regrasArea]
    ]
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Remover treinamento"
      onClick={() => { if (!removendo) { props.onFechar(); } }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 45, 77, 0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '60px 16px',
        overflowY: 'auto'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: C.branco,
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(11, 45, 77, 0.25)',
          color: C.texto,
          padding: '22px 24px'
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: '19px', color: C.vermelho }}>
          Remover treinamento
        </h2>

        <div style={{ fontSize: '14px', marginBottom: '16px' }}>
          <strong>{treinamento.codigo}</strong> · {treinamento.nome}
        </div>

        {analisando && (
          <div style={{ color: C.secundario, fontSize: '14px' }}>
            Verificando atribuições, trilhas e estrutura do treinamento...
          </div>
        )}

        {erro && (
          <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '8px', background: C.vermelhoClaro, color: C.vermelho, fontSize: '13px' }}>
            {erro}
          </div>
        )}

        {impacto && !impacto.podeRemover && (
          <div style={{ padding: '14px', borderRadius: '8px', background: C.ambarClaro, color: C.ambar, fontSize: '13px', lineHeight: 1.5 }}>
            <strong>Remoção bloqueada.</strong> {impacto.motivoBloqueio}
          </div>
        )}

        {impacto && impacto.podeRemover && (
          <>
            <p style={{ margin: '0 0 10px', fontSize: '13px', color: C.secundario }}>
              O treinamento nunca foi atribuído e não está em trilhas. Serão excluídos de forma definitiva:
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '14px' }}>
              <tbody>
                {itens.map(([rotulo, quantidade]) => (
                  <tr key={rotulo} style={{ borderTop: `1px solid ${C.borda}` }}>
                    <td style={{ padding: '6px 4px' }}>{rotulo}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700 }}>{quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: '10px 12px', borderRadius: '8px', background: C.fundo, fontSize: '12px', color: C.secundario, marginBottom: '14px', lineHeight: 1.5 }}>
              Os documentos em si não são excluídos, apenas o vínculo com este treinamento.
              A remoção fica registrada no histórico de auditoria. <strong>Esta ação não pode ser desfeita.</strong>
            </div>

            <label style={{ fontSize: '13px', fontWeight: 600 }}>
              Para confirmar, digite o código <strong>{codigoConfirmacao}</strong>:
            </label>

            <input
              value={confirmacao}
              disabled={removendo}
              onChange={e => setConfirmacao(e.target.value)}
              placeholder={codigoConfirmacao}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: '6px',
                padding: '10px 12px',
                border: `1px solid ${C.borda}`,
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </>
        )}

        {progresso && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: C.secundario }}>
            {progresso}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          <button
            type="button"
            disabled={removendo}
            onClick={props.onFechar}
            style={{ ...botao, opacity: removendo ? 0.6 : 1 }}
          >
            {impacto && !impacto.podeRemover ? 'Fechar' : 'Cancelar'}
          </button>

          {impacto && impacto.podeRemover && (
            <button
              type="button"
              disabled={!confirmado || removendo}
              onClick={() => { void remover(); }}
              style={{
                ...botao,
                border: 'none',
                background: C.vermelho,
                color: C.branco,
                opacity: !confirmado || removendo ? 0.5 : 1
              }}
            >
              {removendo ? 'Removendo...' : 'Remover definitivamente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RemoverTreinamentoModal;
