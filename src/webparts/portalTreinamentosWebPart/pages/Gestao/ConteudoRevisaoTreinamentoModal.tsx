import * as React from 'react';

import {
  IConteudoRevisaoTreinamento
} from '../../services/TreinamentoConteudoRevisaoService';

// ============================================================
// CONTEÚDO DO TREINAMENTO EM UMA REVISÃO (somente consulta)
//
// Mesma lógica dos documentos:
//   obsoleta → faixa vermelha "Revisão obsoleta — não utilizar" e
//              marca d'água; disponível só para consulta;
//   vigente  → conteúdo em uso;
//   rascunho → revisão em andamento (ainda não publicada).
// ============================================================

export type SituacaoConteudoRevisao =
  | 'obsoleta'
  | 'vigente'
  | 'rascunho';

export interface IConteudoRevisaoTreinamentoModalProps {
  titulo: string;
  situacao: SituacaoConteudoRevisao;
  // Ex.: "Substituída pela Rev.02 em 10/11/2026."
  substituicao?: string;
  revisaoVigente?: string;

  carregando: boolean;
  erro?: string;
  conteudo?: IConteudoRevisaoTreinamento;

  onFechar: () => void;
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  azul10: '#EDF0F5',
  borda: '#E2E8F0',
  textoSec: '#64748B',
  vermelho: '#B42318',
  verde: '#15803D'
};

// Conteúdo dos módulos pode vir em HTML: mostra só o texto.
const somenteTexto = (valor: string): string =>
  (valor || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const dataBr = (valor?: string): string => {
  if (!valor) {
    return '-';
  }
  const d = new Date(valor);
  return isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR');
};

const rotulo: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: COR.textoSec,
  marginBottom: '4px'
};

const bloco: React.CSSProperties = {
  border: `1px solid ${COR.borda}`,
  borderRadius: '8px',
  padding: '12px 14px',
  background: '#FFFFFF'
};

const ConteudoRevisaoTreinamentoModal: React.FC<IConteudoRevisaoTreinamentoModalProps> = ({
  titulo,
  situacao,
  substituicao,
  revisaoVigente,
  carregando,
  erro,
  conteudo,
  onFechar
}) => {

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

  const obsoleta = situacao === 'obsoleta';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
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
          position: 'relative',
          width: '100%',
          maxWidth: '1000px',
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
          <div style={{ fontWeight: 700, fontSize: '16px' }}>{titulo}</div>
          <button
            type="button"
            onClick={onFechar}
            style={{ border: '1px solid #FFFFFF', background: 'transparent', color: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Fechar
          </button>
        </div>

        {/* faixa de situação */}
        {obsoleta && (
          <div style={{ background: COR.vermelho, color: '#FFFFFF', padding: '12px 20px', fontSize: '13px', lineHeight: 1.5 }}>
            <strong style={{ display: 'block', fontSize: '14px', letterSpacing: '.4px', textTransform: 'uppercase' }}>
              ⚠ Revisão obsoleta — não utilizar
            </strong>
            {substituicao ? `${substituicao} ` : ''}
            Disponível apenas para consulta do histórico.
            {revisaoVigente ? ` A revisão em vigor é a ${revisaoVigente}.` : ''}
          </div>
        )}

        {situacao === 'rascunho' && (
          <div style={{ background: '#E6F9FC', color: COR.azul, padding: '12px 20px', fontSize: '13px' }}>
            <strong>Revisão em andamento.</strong> Conteúdo atual do treinamento, ainda não publicado.
          </div>
        )}

        {situacao === 'vigente' && (
          <div style={{ background: '#E7F6EC', color: COR.verde, padding: '12px 20px', fontSize: '13px' }}>
            <strong>Revisão vigente.</strong> Conteúdo em uso pelos colaboradores.
          </div>
        )}

        <div style={{ position: 'relative', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* marca d'água da revisão obsoleta */}
          {obsoleta && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                overflow: 'hidden',
                zIndex: 1
              }}
            >
              <span
                style={{
                  transform: 'rotate(-28deg)',
                  fontSize: '96px',
                  fontWeight: 800,
                  letterSpacing: '.08em',
                  color: 'rgba(180, 35, 24, .08)',
                  whiteSpace: 'nowrap'
                }}
              >
                OBSOLETA
              </span>
            </div>
          )}

          {carregando && <div style={{ color: COR.textoSec }}>Carregando o conteúdo da revisão...</div>}

          {!carregando && erro && <div style={{ color: COR.vermelho }}>{erro}</div>}

          {!carregando && !erro && !conteudo && (
            <div style={{ color: COR.textoSec }}>
              O conteúdo desta revisão não foi registrado. O registro passou a ser feito na
              publicação das revisões; revisões publicadas antes disso têm apenas os dados
              da alteração (motivo, alterações e datas).
            </div>
          )}

          {!carregando && conteudo && (
            <>
              <div style={{ fontSize: '12px', color: COR.textoSec }}>
                Conteúdo registrado em {dataBr(conteudo.registradoEm)} · {conteudo.revisao}
                {conteudo.resumido ? ' · textos dos módulos omitidos por tamanho' : ''}
              </div>

              {/* dados */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                <div style={{ ...bloco, gridColumn: '1 / -1' }}>
                  <div style={rotulo}>Treinamento</div>
                  <div style={{ fontWeight: 700, color: COR.azul }}>
                    {conteudo.treinamento.codigo} — {conteudo.treinamento.nome}
                  </div>
                  {conteudo.treinamento.descricao && (
                    <div style={{ marginTop: '6px', fontSize: '13.5px', whiteSpace: 'pre-wrap' }}>
                      {conteudo.treinamento.descricao}
                    </div>
                  )}
                </div>
                <div style={bloco}>
                  <div style={rotulo}>Carga horária</div>
                  <div>{conteudo.treinamento.cargaHorariaMin} min</div>
                </div>
                <div style={bloco}>
                  <div style={rotulo}>Nota mínima</div>
                  <div>{conteudo.treinamento.notaMinima}%</div>
                </div>
                <div style={bloco}>
                  <div style={rotulo}>Validade</div>
                  <div>{conteudo.treinamento.validadeMeses > 0 ? `${conteudo.treinamento.validadeMeses} meses` : 'Sem vencimento'}</div>
                </div>
              </div>

              {/* módulos */}
              <div style={bloco}>
                <div style={rotulo}>Módulos ({conteudo.modulos.length})</div>
                {conteudo.modulos.length === 0 && <div style={{ color: COR.textoSec }}>Nenhum módulo.</div>}
                {conteudo.modulos.map((modulo, indice) => (
                  <details key={`${indice}-${modulo.titulo}`} style={{ borderTop: indice > 0 ? `1px solid ${COR.borda}` : 'none', padding: '8px 0' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: COR.azul }}>
                      {indice + 1}. {modulo.titulo}
                      <span style={{ fontWeight: 400, color: COR.textoSec, fontSize: '12.5px' }}>
                        {' · '}{modulo.tipo}
                        {modulo.duracaoMin ? ` · ${modulo.duracaoMin} min` : ''}
                        {modulo.obrigatorio ? '' : ' · opcional'}
                        {modulo.conteudos.length > 0 ? ` · ${modulo.conteudos.length} conteúdo(s)` : ''}
                      </span>
                    </summary>

                    <div style={{ padding: '8px 0 0 16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px' }}>
                      {modulo.descricao && <div style={{ whiteSpace: 'pre-wrap' }}>{modulo.descricao}</div>}
                      {modulo.urlConteudo && (
                        <div>Conteúdo: <a href={modulo.urlConteudo} target="_blank" rel="noopener noreferrer">{modulo.urlConteudo}</a></div>
                      )}
                      {modulo.conteudos.map((item, i) => (
                        <div key={i} style={{ background: COR.azul10, borderRadius: '6px', padding: '8px 10px' }}>
                          <div style={{ fontWeight: 700, fontSize: '12.5px', color: COR.indigo }}>
                            {item.tipo}{item.titulo ? ` — ${item.titulo}` : ''}
                          </div>
                          {item.conteudo && (
                            <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{somenteTexto(item.conteudo)}</div>
                          )}
                          {item.url && (
                            <div style={{ marginTop: '4px' }}>
                              <a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>

              {/* avaliação */}
              <div style={bloco}>
                <div style={rotulo}>Avaliação</div>
                {!conteudo.avaliacao && <div style={{ color: COR.textoSec }}>Nenhuma avaliação.</div>}
                {conteudo.avaliacao && (
                  <>
                    <div style={{ fontSize: '13.5px', marginBottom: '8px' }}>
                      <strong>{conteudo.avaliacao.nome}</strong>
                      <span style={{ color: COR.textoSec }}>
                        {' · '}{conteudo.avaliacao.questoes.length} questão(ões)
                        {conteudo.avaliacao.sortearQuestoes && conteudo.avaliacao.quantidadeQuestoes > 0
                          ? ` · sorteia ${conteudo.avaliacao.quantidadeQuestoes}`
                          : ''}
                        {' · '}nota mínima {conteudo.avaliacao.notaMinima}%
                        {' · '}{conteudo.avaliacao.tentativasPermitidas || 'tentativas ilimitadas'}{conteudo.avaliacao.tentativasPermitidas ? ' tentativa(s)' : ''}
                        {conteudo.avaliacao.tempoLimiteMin ? ` · ${conteudo.avaliacao.tempoLimiteMin} min` : ''}
                      </span>
                    </div>

                    <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px' }}>
                      {conteudo.avaliacao.questoes.map((questao, i) => (
                        <li key={i}>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{somenteTexto(questao.enunciado)}</div>
                          <ul style={{ margin: '4px 0 0', paddingLeft: '18px', listStyle: 'none' }}>
                            {questao.alternativas.map((alternativa, j) => (
                              <li key={j} style={{ color: alternativa.correta ? COR.verde : undefined, fontWeight: alternativa.correta ? 700 : 400 }}>
                                {alternativa.correta ? '✓ ' : '○ '}{somenteTexto(alternativa.texto)}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConteudoRevisaoTreinamentoModal;
