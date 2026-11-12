import * as React from 'react';

import {
  IRevisaoQuestao
} from '../../services/RevisaoAvaliacaoService';

// ============================================================
// REVISÃO DAS RESPOSTAS (resultado da avaliação, quando aprovado)
//
// Mostra cada questão como foi apresentada, a alternativa marcada pela
// pessoa e a resposta correta. Carrega só quando a pessoa pede.
//
// Cores DGT: ciano = resposta correta, índigo = marcada e errada.
// ============================================================

export interface IRevisaoRespostasProps {
  tentativaId: string;
  onCarregar: (tentativaId: string) => Promise<IRevisaoQuestao[]>;
}

const C = {
  azul: '#202A44',
  ciano: '#05C3DD',
  claroCiano: '#E6F9FC',
  indigo: '#485CC7',
  claroIndigo: '#E8EAF8',
  linha: '#D9D9D6',
  texto2: '#5E6470'
};

const etiqueta = (fundo: string, cor: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  background: fundo,
  color: cor,
  fontSize: 11.5,
  fontWeight: 700,
  whiteSpace: 'nowrap'
});

const RevisaoRespostas: React.FC<IRevisaoRespostasProps> = ({
  tentativaId,
  onCarregar
}) => {

  const [aberta, setAberta] = React.useState(false);
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [questoes, setQuestoes] = React.useState<IRevisaoQuestao[] | undefined>(undefined);

  const alternar = (): void => {
    if (aberta) {
      setAberta(false);
      return;
    }

    setAberta(true);

    if (questoes) {
      return;
    }

    setCarregando(true);
    setErro('');

    onCarregar(tentativaId)
      .then(lista => setQuestoes(lista))
      .catch(e => setErro(
        e instanceof Error
          ? `Não foi possível carregar as respostas: ${e.message}`
          : 'Não foi possível carregar as respostas.'
      ))
      .then(() => setCarregando(false))
      .catch(() => undefined);
  };

  return (
    <div style={{ marginTop: 22 }}>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberta}
        style={{
          padding: '10px 18px',
          borderRadius: 10,
          border: `1px solid ${C.azul}`,
          background: '#FFFFFF',
          color: C.azul,
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          fontFamily: 'inherit'
        }}
      >
        {aberta ? 'Ocultar minhas respostas' : 'Ver minhas respostas'}
      </button>

      {aberta && (
        <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>

          {carregando && (
            <p style={{ margin: 0, color: C.texto2, fontSize: 14 }}>Carregando as respostas...</p>
          )}

          {erro && (
            <p style={{ margin: 0, color: C.indigo, fontSize: 14 }}>{erro}</p>
          )}

          {!carregando && !erro && questoes && questoes.length === 0 && (
            <p style={{ margin: 0, color: C.texto2, fontSize: 14 }}>
              As respostas desta tentativa não foram encontradas.
            </p>
          )}

          {!carregando && questoes && questoes.map((questao, indice) => (
            <article
              key={questao.id}
              style={{
                padding: '16px 18px',
                background: '#FFFFFF',
                border: `1px solid ${C.linha}`,
                borderLeft: `4px solid ${questao.acertou ? C.ciano : C.indigo}`,
                borderRadius: 10
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <strong style={{ color: C.azul, fontSize: 15, lineHeight: 1.45 }}>
                  {indice + 1}. {questao.enunciado}
                </strong>
                <span
                  style={
                    questao.acertou
                      ? etiqueta(C.claroCiano, C.azul)
                      : etiqueta(C.claroIndigo, C.indigo)
                  }
                >
                  {questao.acertou ? '✓ Acertou' : '✕ Errou'}
                </span>
              </div>

              {!questao.respondida && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: C.indigo }}>Questão não respondida.</p>
              )}

              <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                {questao.alternativas.map(alternativa => {
                  const marcadaErrada = alternativa.selecionada && !alternativa.correta;

                  return (
                    <div
                      key={alternativa.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${alternativa.correta ? C.ciano : marcadaErrada ? C.indigo : C.linha}`,
                        background: alternativa.correta ? C.claroCiano : marcadaErrada ? C.claroIndigo : '#FFFFFF',
                        fontSize: 14,
                        color: C.azul
                      }}
                    >
                      <span>
                        {alternativa.selecionada ? '● ' : '○ '}
                        {alternativa.texto}
                      </span>

                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {alternativa.selecionada && (
                          <span style={etiqueta(marcadaErrada ? C.indigo : C.azul, '#FFFFFF')}>Sua resposta</span>
                        )}
                        {alternativa.correta && (
                          <span style={etiqueta(C.ciano, C.azul)}>✓ Resposta correta</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default RevisaoRespostas;
