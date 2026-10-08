import * as React from 'react';

import {
  IAnaliseGoNoGo,
  ICriterioGoNoGo
} from '../../services/bom/BomService';

import {
  LIMITE_GO,
  LIMITE_GO_COM_RESTRICAO,
  calcularPontuacao,
  decisaoPorPontuacao,
  liberaSelecaoKit
} from '../../services/bom/esquemaBom';

import {
  COR,
  DECISAO,
  botao,
  campo,
  cartao,
  formatarNumero
} from './arquiteturaComum';

// ============================================================
// ETAPA 2 — MATRIZ GO/NO-GO
//
// Nota de 1 a 5 por critério; pontuação ponderada de 0 a 100.
//   80 ou mais → GO · 60 a 79 → GO com restrição · abaixo → NO-GO
// GO libera a seleção de kit; GO com restrição libera quando o
// parecer descreve as restrições. Cada "Registrar análise" cria
// um registro novo (o histórico nunca é alterado).
// ============================================================

export interface IMatrizGoNoGoEtapaProps {
  criterios: ICriterioGoNoGo[];
  analises: IAnaliseGoNoGo[];
  salvando: boolean;
  // Para o histórico do B.O.M. (opcionais)
  bomCriadoEm?: string;
  bomResponsavel?: string;
  onRegistrar: (
    notas: { [criterioId: string]: number },
    justificativas: { [criterioId: string]: string },
    parecer: string
  ) => Promise<void>;
}

const ESCALA = [
  'Muito desfavorável / alto risco',
  'Desfavorável',
  'Aceitável',
  'Favorável',
  'Muito favorável'
];

const formatarDataHora = (valor: string): string => {
  const data = new Date(valor);
  return isNaN(data.getTime())
    ? '—'
    : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Escala de cores das notas: 1 (vermelho) → 5 (verde)
const COR_NOTA: { [nota: number]: { cor: string; claro: string; texto: string } } = {
  1: { cor: '#D64545', claro: '#FDECEC', texto: '#FFFFFF' },
  2: { cor: '#EE7D3B', claro: '#FEF1E8', texto: '#FFFFFF' },
  3: { cor: '#E8B021', claro: '#FDF6E3', texto: '#3B2F05' },
  4: { cor: '#6DBB5E', claro: '#EEF8EC', texto: '#FFFFFF' },
  5: { cor: '#13A06F', claro: '#E6F6EF', texto: '#FFFFFF' }
};

// Cor da barra de pontuação conforme a decisão
const COR_DECISAO_BARRA: { [decisao: string]: string } = {
  GO: '#13A06F',
  'GO com restrição': '#EE8A12',
  'NO-GO': '#D64545'
};

const MatrizGoNoGoEtapa: React.FC<IMatrizGoNoGoEtapaProps> = ({
  criterios,
  analises,
  salvando,
  bomCriadoEm,
  bomResponsavel,
  onRegistrar
}) => {

  const ativos = criterios.filter(item => item.ativo);
  const ultima = analises[0];

  const notasIniciais = (): { [id: string]: number } => {
    const mapa: { [id: string]: number } = {};
    ativos.forEach(criterio => {
      const anterior = ultima ? ultima.notas.find(nota => nota.criterioId === criterio.id) : undefined;
      mapa[criterio.id] = anterior ? anterior.nota : 3;
    });
    return mapa;
  };

  const [notas, setNotas] = React.useState<{ [id: string]: number }>(notasIniciais);
  const [justificativas, setJustificativas] = React.useState<{ [id: string]: string }>({});
  const [parecer, setParecer] = React.useState<string>(ultima ? ultima.parecer : '');
  const [verHistorico, setVerHistorico] = React.useState<string>('');

  React.useEffect(() => {
    setNotas(notasIniciais());
    setParecer(ultima ? ultima.parecer : '');
    setJustificativas({});
  }, [criterios, analises]);

  const somaPesos =
    Math.round(ativos.reduce((soma, item) => soma + item.peso, 0) * 100) / 100;

  const pontuacao =
    calcularPontuacao(ativos.map(item => ({ nota: notas[item.id] || 3, peso: item.peso })));

  const decisao = decisaoPorPontuacao(pontuacao);
  const libera = liberaSelecaoKit(decisao, parecer);
  const exigeParecer = decisao === 'GO com restrição' && !parecer.trim();
  const pesosValidos = Math.abs(somaPesos - 100) < 0.01;

  // Onde a demanda perde pontos: (5 − nota) × peso × 0,2, por critério.
  const perdas =
    ativos
      .map(item => ({ nome: item.nome, perda: (5 - (notas[item.id] || 3)) * item.peso * 0.2 }))
      .filter(item => item.perda > 0)
      .sort((a, b) => b.perda - a.perda);

  const maiorPerda =
    perdas.length > 0 ? perdas[0].perda : 1;

  const totalPerdido =
    perdas.reduce((soma, item) => soma + item.perda, 0);

  const registrar = (): void => {
    if (!pesosValidos || salvando) {
      return;
    }
    onRegistrar(notas, justificativas, parecer).catch(() => undefined);
  };

  const estiloDecisao = DECISAO[decisao];

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: COR.texto2 }}>
        Nota de 1 a 5 por critério. A pontuação ponderada vai de 0 a 100: <strong>{LIMITE_GO} ou mais é GO</strong>,
        de {LIMITE_GO_COM_RESTRICAO} a {LIMITE_GO - 1} é <strong>GO com restrição</strong> e abaixo de {LIMITE_GO_COM_RESTRICAO} é <strong>NO-GO</strong>.
      </p>

      {
        !pesosValidos && (
          <div role="alert" style={{ ...cartao, background: '#FDE7E9', borderColor: '#B42318', fontSize: '13px' }}>
            Os pesos dos critérios ativos somam <strong>{formatarNumero(somaPesos)}%</strong>. Eles precisam somar 100% para registrar uma análise.
            Ajuste a tabela <strong>Critério Go/No-Go</strong> no Dataverse.
          </div>
        )
      }

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '16px', alignItems: 'start' }}>

        {/* Critérios */}
        <div style={{ ...cartao, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Critério', 'Nota', 'Peso', 'Pontos'].map(coluna => (
                  <th key={coluna} style={{ textAlign: coluna === 'Critério' ? 'left' : 'center', padding: '10px 12px', fontSize: '12px', color: COR.texto2, background: '#F8FAFC', borderBottom: `1px solid ${COR.borda}` }}>{coluna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {
                ativos.map(criterio => {
                  const nota = notas[criterio.id] || 3;
                  return (
                    <tr key={criterio.id}>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, verticalAlign: 'top' }}>
                        <strong style={{ display: 'block', fontSize: '13.5px', color: COR.azul }}>{criterio.nome}</strong>
                        <span style={{ fontSize: '12px', color: COR.texto2 }}>{criterio.descricao}</span>
                        <input
                          aria-label={`Justificativa de ${criterio.nome}`}
                          style={{ ...campo, marginTop: '6px', padding: '5px 8px', fontSize: '12px' }}
                          placeholder="Justificativa (opcional)"
                          value={justificativas[criterio.id] || ''}
                          onChange={e => setJustificativas({ ...justificativas, [criterio.id]: e.target.value })}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          {
                            [1, 2, 3, 4, 5].map(valor => (
                              <button
                                key={valor}
                                type="button"
                                aria-label={`Nota ${valor}`}
                                aria-pressed={nota === valor}
                                onClick={() => setNotas({ ...notas, [criterio.id]: valor })}
                                style={{
                                  width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px',
                                  border: `1.5px solid ${nota === valor ? COR_NOTA[valor].cor : COR_NOTA[valor].cor + '55'}`,
                                  background: nota === valor ? COR_NOTA[valor].cor : COR_NOTA[valor].claro,
                                  color: nota === valor ? COR_NOTA[valor].texto : COR_NOTA[valor].cor,
                                  boxShadow: nota === valor ? `0 3px 8px ${COR_NOTA[valor].cor}55` : 'none',
                                  transform: nota === valor ? 'translateY(-1px)' : 'none',
                                  transition: 'all .12s'
                                }}
                              >
                                {valor}
                              </button>
                            ))
                          }
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: COR_NOTA[nota].cor, marginTop: '5px' }}>{ESCALA[nota - 1]}</div>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, textAlign: 'center', verticalAlign: 'top', fontSize: '13px' }}>
                        {formatarNumero(criterio.peso)}%
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, textAlign: 'center', verticalAlign: 'top', fontSize: '13px', fontWeight: 700 }}>
                        {formatarNumero(nota * criterio.peso * 0.2)} / {formatarNumero(criterio.peso)}
                      </td>
                    </tr>
                  );
                })
              }
              <tr>
                <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Total</td>
                <td style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>{formatarNumero(pontuacao)} / 100</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Coluna da direita: resultado, perdas e histórico */}
        <div style={{ display: 'grid', gap: '14px' }}>

          {/* ---------- Resultado ---------- */}
          <div style={{ ...cartao, margin: 0, padding: '18px', borderRadius: '14px', boxShadow: '0 2px 10px rgba(11,45,77,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '12px', color: COR.texto2 }}>Pontuação</span>
                <div style={{ fontSize: '40px', fontWeight: 800, lineHeight: 1.05, color: COR.azul }}>
                  {formatarNumero(pontuacao)}
                  <span style={{ fontSize: '18px', fontWeight: 700, color: COR.texto2 }}> / 100</span>
                </div>
              </div>
              <span
                style={{
                  padding: '6px 12px',
                  borderRadius: '10px',
                  background: estiloDecisao.fundo,
                  color: estiloDecisao.cor,
                  fontSize: '13px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  marginTop: '14px'
                }}
              >
                {estiloDecisao.texto}
              </span>
            </div>

            {/* Barra preenchida até a nota, com marcas em 60 e 80 */}
            <div style={{ position: 'relative', margin: '16px 0 22px' }}>
              <div style={{ height: '12px', borderRadius: '999px', background: '#EEF2F6', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, pontuacao))}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: COR_DECISAO_BARRA[decisao] || COR.azul,
                    transition: 'width .25s'
                  }}
                />
              </div>
              {
                [LIMITE_GO_COM_RESTRICAO, LIMITE_GO].map(limite => (
                  <React.Fragment key={limite}>
                    <span style={{ position: 'absolute', left: `${limite}%`, top: '-4px', width: '2px', height: '20px', background: COR.azul, borderRadius: '2px', transform: 'translateX(-1px)' }} />
                    <span style={{ position: 'absolute', left: `${limite}%`, top: '20px', fontSize: '11px', fontWeight: 700, color: COR.texto2, transform: 'translateX(-50%)' }}>{limite}</span>
                  </React.Fragment>
                ))
              }
            </div>

            <label htmlFor="go-parecer" style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: COR.azul, margin: '0 0 6px' }}>
              Parecer {decisao === 'GO com restrição' ? <span style={{ fontWeight: 400, color: COR.texto2 }}>* obrigatório para GO com restrição</span> : ''}
            </label>
            <textarea
              id="go-parecer"
              rows={4}
              style={{ ...campo, resize: 'vertical', borderRadius: '10px', ...(exigeParecer ? { borderColor: '#EE8A12' } : {}) }}
              placeholder={decisao === 'GO com restrição' ? 'Descreva as restrições e condições para seguir…' : 'Observações da análise…'}
              value={parecer}
              onChange={e => setParecer(e.target.value)}
            />

            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600, background: libera ? '#E6F6EF' : exigeParecer ? '#FEF1E8' : '#FDECEC', color: libera ? '#0E7C56' : exigeParecer ? '#B45309' : '#B42318' }}>
              {
                libera
                  ? '✓ Ao registrar, a seleção de kit fica liberada.'
                  : exigeParecer
                    ? '! Preencha o parecer para liberar a seleção de kit.'
                    : '🔒 Com esta pontuação, a seleção de kit fica bloqueada.'
              }
            </div>

            <button type="button" style={{ ...botao('principal', salvando || !pesosValidos), width: '100%', marginTop: '12px', borderRadius: '10px', padding: '11px 14px' }} disabled={salvando || !pesosValidos} onClick={registrar}>
              {salvando ? 'Registrando…' : 'Registrar análise'}
            </button>
          </div>

          {/* ---------- Onde a demanda perde pontos ---------- */}
          <div style={{ ...cartao, margin: 0, padding: '18px', borderRadius: '14px', boxShadow: '0 2px 10px rgba(11,45,77,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: COR.azul }}>Onde a demanda perde pontos</h3>
              {totalPerdido > 0 && <span style={{ fontSize: '12px', fontWeight: 700, color: '#D64545' }}>−{formatarNumero(totalPerdido)} no total</span>}
            </div>
            {
              perdas.length === 0
                ? <p style={{ margin: 0, fontSize: '13px', color: '#0E7C56' }}>✓ Nenhuma perda: todos os critérios com nota máxima.</p>
                : perdas.map(item => (
                  <div key={item.nome} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) 42px', gap: '10px', alignItems: 'center', padding: '6px 0' }}>
                    <span style={{ fontSize: '12.5px', color: COR.azul, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.nome}>{item.nome}</span>
                    <span style={{ height: '8px', borderRadius: '999px', background: '#EEF2F6', overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: `${Math.max(6, (item.perda / maiorPerda) * 100)}%`, height: '100%', borderRadius: '999px', background: '#D64545' }} />
                    </span>
                    <strong style={{ fontSize: '12.5px', color: COR.azul, textAlign: 'right' }}>−{formatarNumero(item.perda)}</strong>
                  </div>
                ))
            }
          </div>

          {/* ---------- Histórico do B.O.M. ---------- */}
          <div style={{ ...cartao, margin: 0, padding: '18px', borderRadius: '14px', boxShadow: '0 2px 10px rgba(11,45,77,.06)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: COR.azul }}>Histórico</h3>

            <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
              {
                analises.map((analise, indice) => {
                  const estilo = DECISAO[analise.decisao];
                  return (
                    <li key={analise.id} style={{ position: 'relative', padding: '0 0 16px 22px', borderLeft: `2px solid ${COR.borda}`, marginLeft: '6px' }}>
                      <span style={{ position: 'absolute', left: '-7px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#FFFFFF', border: `2px solid ${estilo.cor}` }} />
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 9px', borderRadius: '999px', background: estilo.fundo, color: estilo.cor, fontSize: '12px', fontWeight: 800 }}>
                          {estilo.texto} · {formatarNumero(analise.pontuacao)}
                        </span>
                        {indice === 0 && <span style={{ fontSize: '10.5px', fontWeight: 800, color: COR.texto2, letterSpacing: '.04em' }}>VÁLIDA</span>}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '12.5px', color: COR.azul }}>
                        Análise Go/No-Go por <strong>{analise.avaliadorNome || '—'}</strong>
                      </div>
                      <div style={{ fontSize: '11.5px', color: COR.texto2 }}>{formatarDataHora(analise.data)}</div>
                      {analise.parecer && (
                        <div style={{ marginTop: '6px', padding: '6px 10px', background: '#F8FAFC', borderLeft: `3px solid ${estilo.cor}`, borderRadius: '4px', fontSize: '12.5px', whiteSpace: 'pre-wrap', color: '#334155' }}>
                          {analise.parecer}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setVerHistorico(verHistorico === analise.id ? '' : analise.id)}
                        style={{ marginTop: '6px', padding: 0, border: 0, background: 'transparent', color: '#0B5CAB', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {verHistorico === analise.id ? 'Ocultar notas ▴' : 'Ver notas ▾'}
                      </button>
                      {
                        verHistorico === analise.id && (
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', fontSize: '12px' }}>
                            <tbody>
                              {analise.notas.map(nota => (
                                <tr key={nota.criterioId}>
                                  <td style={{ padding: '3px 0', color: '#334155' }}>{nota.criterioNome}{nota.justificativa ? <span style={{ color: COR.texto2 }}> — {nota.justificativa}</span> : ''}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                                    <span style={{ display: 'inline-block', minWidth: '20px', padding: '1px 6px', borderRadius: '6px', background: (COR_NOTA[nota.nota] || COR_NOTA[3]).cor, color: (COR_NOTA[nota.nota] || COR_NOTA[3]).texto, fontWeight: 800 }}>{nota.nota}</span>
                                  </td>
                                  <td style={{ padding: '3px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatarNumero(nota.pontos)} / {formatarNumero(nota.peso)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      }
                    </li>
                  );
                })
              }

              {
                bomCriadoEm && (
                  <li style={{ position: 'relative', padding: '0 0 2px 22px', borderLeft: '2px solid transparent', marginLeft: '6px' }}>
                    <span style={{ position: 'absolute', left: '-5px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#0B5CAB' }} />
                    <div style={{ fontSize: '12.5px', color: COR.azul }}>
                      <strong>B.O.M. criado</strong>{bomResponsavel ? <> · responsável <strong>{bomResponsavel}</strong></> : null}
                    </div>
                    <div style={{ fontSize: '11.5px', color: COR.texto2 }}>{formatarDataHora(bomCriadoEm)}</div>
                  </li>
                )
              }
            </ol>

            {analises.length === 0 && !bomCriadoEm && (
              <p style={{ margin: 0, fontSize: '13px', color: COR.texto2 }}>Nenhum registro ainda.</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default MatrizGoNoGoEtapa;
