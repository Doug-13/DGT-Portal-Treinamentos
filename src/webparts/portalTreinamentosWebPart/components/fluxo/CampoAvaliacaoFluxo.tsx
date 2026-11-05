import * as React from 'react';

import {
  IConfigAvaliacao,
  calcularAvaliacao,
  corDaNota,
  gravarValorAvaliacao,
  lerValorAvaliacao,
  rotuloDaNota
} from '../../services/fluxo/valorAvaliacao';

// ============================================================
// CAMPO AVALIAÇÃO (visual da Matriz Go/No-Go)
//
// Esquerda: critérios × notas (botões coloridos vermelho → verde),
//           peso, pontos e justificativa por critério.
// Direita:  pontuação, selo da faixa (sinaleira), barra com os
//           marcadores das faixas e "Onde perde pontos".
// ============================================================

export interface ICampoAvaliacaoFluxoProps {
  id: string;
  rotulo: string;
  config?: IConfigAvaliacao;
  valor: string;
  desabilitado?: boolean;
  onAlterar?: (valor: string) => void;
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#E5E7EB';
const COR_TEXTO2 = '#64748B';
const FONTE = "Barlow, Arial, 'Segoe UI', sans-serif";

const tingir = (cor: string, alfa: number): string => {
  const valor = /^#([0-9a-f]{6})$/i.exec(cor || '');
  if (!valor) {
    return `rgba(100, 116, 139, ${alfa})`;
  }
  const numero = parseInt(valor[1], 16);
  return `rgba(${(numero >> 16) & 255}, ${(numero >> 8) & 255}, ${numero & 255}, ${alfa})`;
};

const formatar = (valor: number): string =>
  valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const CampoAvaliacaoFluxo: React.FC<ICampoAvaliacaoFluxoProps> = ({
  id,
  rotulo,
  config,
  valor,
  desabilitado = false,
  onAlterar
}) => {

  if (!config || config.criterios.length === 0) {
    return (
      <div style={{ fontSize: '13px', color: '#B42318', fontFamily: FONTE }}>
        A avaliação “{rotulo}” não tem critérios configurados (Processos → Metadados).
      </div>
    );
  }

  const lido = lerValorAvaliacao(valor);
  const notas = lido ? lido.notas : {};
  const justificativas = (lido && lido.justificativas) || {};
  const resultado = calcularAvaliacao(config, notas);
  const ponderada = config.calculo !== 'soma';
  const somaPesos = config.criterios.reduce((total, item) => total + (Number(item.peso) || 0), 0) || 1;

  const alterar = (novasNotas: Record<string, number>, novasJustificativas: Record<string, string>): void => {
    if (onAlterar && !desabilitado) {
      onAlterar(gravarValorAvaliacao(config, novasNotas, novasJustificativas));
    }
  };

  const notasPossiveis: number[] = [];
  for (let nota = config.escala.minimo; nota <= config.escala.maximo; nota++) {
    notasPossiveis.push(nota);
  }

  // Legenda das faixas: "80 ou mais é GO, de 60 a 79 é ..., abaixo de 60 é NO-GO".
  const faixasOrdenadas = config.faixas.slice().sort((a, b) => b.minimo - a.minimo);
  const legenda = faixasOrdenadas.map((faixa, indice) => {
    const acima = faixasOrdenadas[indice - 1];
    if (indice === 0) {
      return `${formatar(faixa.minimo)} ou mais é ${faixa.rotulo}`;
    }
    if (faixa.minimo <= 0) {
      return `abaixo de ${formatar(acima.minimo)} é ${faixa.rotulo}`;
    }
    return `de ${formatar(faixa.minimo)} a ${formatar(acima.minimo - 0.1)} é ${faixa.rotulo}`;
  }).join(', ');

  const perdas = resultado.itens.filter(item => item.perdidos > 0).sort((a, b) => b.perdidos - a.perdidos);
  const maiorPerda = perdas.length > 0 ? perdas[0].perdidos : 1;
  const faixa = resultado.faixa;

  return (
    <div id={id} style={{ fontFamily: FONTE, color: COR_AZUL }}>
      <div style={{ fontSize: '12.5px', color: COR_TEXTO2, marginBottom: '8px' }}>
        Nota de {config.escala.minimo} a {config.escala.maximo} por critério.{' '}
        {ponderada ? 'A pontuação ponderada vai de 0 a 100' : `A pontuação é a soma de nota × peso (máximo ${formatar(resultado.maximo)})`}: {legenda}.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-start' }}>

        {/* Critérios */}
        <div style={{ flex: '1 1 520px', minWidth: 0, border: `1px solid ${COR_BORDA}`, borderRadius: '10px', overflowX: 'auto', background: '#FFFFFF' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F7F9FB', color: COR_TEXTO2, fontSize: '11.5px', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Critério</th>
                <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center' }}>Nota</th>
                <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center' }}>Peso</th>
                <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center' }}>Pontos</th>
              </tr>
            </thead>
            <tbody>
              {config.criterios.map((criterio, indice) => {
                const item = resultado.itens[indice];
                const nota = notas[criterio.chave];
                const exigeJustificativa =
                  config.justificativaAte !== undefined && typeof nota === 'number' && nota <= config.justificativaAte;
                return (
                  <tr key={criterio.chave} style={{ borderTop: `1px solid ${COR_BORDA}`, verticalAlign: 'top' }}>
                    <td style={{ padding: '10px', minWidth: '220px' }}>
                      <strong style={{ display: 'block', fontSize: '13.5px' }}>{criterio.rotulo}</strong>
                      {criterio.descricao && <span style={{ display: 'block', fontSize: '12px', color: COR_TEXTO2 }}>{criterio.descricao}</span>}
                      <input
                        type="text"
                        aria-label={`Justificativa de ${criterio.rotulo}`}
                        value={justificativas[criterio.chave] || ''}
                        disabled={desabilitado}
                        placeholder={exigeJustificativa ? 'Justificativa (obrigatória para esta nota)' : 'Justificativa (opcional)'}
                        onChange={evento => alterar(notas, { ...justificativas, [criterio.chave]: evento.target.value })}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          marginTop: '6px',
                          padding: '5px 8px',
                          border: `1px solid ${exigeJustificativa && !(justificativas[criterio.chave] || '').trim() ? '#B42318' : COR_BORDA}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontFamily: FONTE,
                          background: desabilitado ? '#F8FAFC' : '#FFFFFF'
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div role="radiogroup" aria-label={`Nota de ${criterio.rotulo}`} style={{ display: 'inline-flex', gap: '4px' }}>
                        {notasPossiveis.map(opcao => {
                          const cor = corDaNota(opcao, config.escala.minimo, config.escala.maximo);
                          const marcada = nota === opcao;
                          return (
                            <button
                              key={opcao}
                              type="button"
                              role="radio"
                              aria-checked={marcada}
                              title={rotuloDaNota(config, opcao) || String(opcao)}
                              disabled={desabilitado}
                              onClick={() => {
                                const novas = { ...notas };
                                if (marcada) {
                                  delete novas[criterio.chave];
                                } else {
                                  novas[criterio.chave] = opcao;
                                }
                                alterar(novas, justificativas);
                              }}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '6px',
                                border: `1px solid ${marcada ? cor : tingir(cor, 0.45)}`,
                                background: marcada ? cor : tingir(cor, 0.08),
                                color: marcada ? '#FFFFFF' : cor,
                                fontWeight: 800,
                                fontSize: '13px',
                                cursor: desabilitado ? 'default' : 'pointer',
                                boxShadow: marcada ? `0 0 0 3px ${tingir(cor, 0.18)}` : 'none',
                                fontFamily: FONTE
                              }}
                            >
                              {opcao}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 700, minHeight: '15px', marginTop: '4px', color: typeof nota === 'number' ? corDaNota(nota, config.escala.minimo, config.escala.maximo) : COR_TEXTO2 }}>
                        {typeof nota === 'number' ? rotuloDaNota(config, nota) : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {ponderada ? `${formatar((Number(criterio.peso) || 0) / somaPesos * 100)}%` : `× ${formatar(Number(criterio.peso) || 0)}`}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {item.nota !== undefined ? `${formatar(item.pontos)} / ${formatar(item.maximo)}` : `— / ${formatar(item.maximo)}`}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: `1px solid ${COR_BORDA}`, background: '#F7F9FB' }}>
                <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '12px' }}>Total</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>{formatar(resultado.total)} / {formatar(resultado.maximo)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Resultado */}
        <div style={{ flex: '1 1 260px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '10px', padding: '14px 16px', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '12px', color: COR_TEXTO2 }}>Pontuação</div>
                <div>
                  <strong style={{ fontSize: '34px', lineHeight: 1.1 }}>{formatar(resultado.total)}</strong>
                  <span style={{ fontSize: '15px', color: COR_TEXTO2 }}> / {formatar(resultado.maximo)}</span>
                </div>
              </div>
              {faixa
                ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', background: tingir(faixa.cor, 0.12), color: faixa.cor, fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap' }}>
                    <span aria-hidden="true" style={{ width: '10px', height: '10px', borderRadius: '50%', background: faixa.cor }} />
                    {faixa.rotulo}
                  </span>
                )
                : (
                  <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#F1F5F9', color: COR_TEXTO2, fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {resultado.itens.filter(item => item.nota === undefined).length} critério(s) sem nota
                  </span>
                )}
            </div>

            {/* Barra com os marcadores das faixas */}
            <div style={{ position: 'relative', height: '8px', borderRadius: '999px', background: '#EEF2F6', marginTop: '14px' }}>
              <div style={{ width: `${resultado.percentual}%`, height: '100%', borderRadius: '999px', background: faixa ? faixa.cor : '#94A3B8', transition: 'width .2s' }} />
              {config.faixas.filter(item => item.minimo > 0).map(item => {
                const posicao = ponderada ? item.minimo : (resultado.maximo > 0 ? (item.minimo / resultado.maximo) * 100 : 0);
                return (
                  <span key={item.chave} title={`${item.rotulo} a partir de ${formatar(item.minimo)}`} style={{ position: 'absolute', left: `${Math.min(100, posicao)}%`, top: '-4px', width: '2px', height: '16px', background: COR_AZUL }} />
                );
              })}
            </div>
            <div style={{ position: 'relative', height: '16px', fontSize: '10.5px', color: COR_TEXTO2 }}>
              {config.faixas.filter(item => item.minimo > 0).map(item => {
                const posicao = ponderada ? item.minimo : (resultado.maximo > 0 ? (item.minimo / resultado.maximo) * 100 : 0);
                return <span key={item.chave} style={{ position: 'absolute', left: `${Math.min(100, posicao)}%`, transform: 'translateX(-50%)', top: '2px' }}>{formatar(item.minimo)}</span>;
              })}
            </div>

            {/* Sinaleira */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
              {faixasOrdenadas.map(item => {
                const ativa = !!faixa && faixa.chave === item.chave;
                return (
                  <span key={item.chave} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: ativa ? 800 : 500, color: ativa ? item.cor : COR_TEXTO2 }}>
                    <span aria-hidden="true" style={{ width: '12px', height: '12px', borderRadius: '50%', background: ativa ? item.cor : tingir(item.cor, 0.25), boxShadow: ativa ? `0 0 0 3px ${tingir(item.cor, 0.2)}` : 'none' }} />
                    {item.rotulo}
                  </span>
                );
              })}
            </div>
          </div>

          {perdas.length > 0 && (
            <div style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '10px', padding: '12px 16px', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px' }}>Onde perde pontos</strong>
                <span style={{ fontSize: '12px', color: '#B42318', fontWeight: 700 }}>−{formatar(perdas.reduce((soma, item) => soma + item.perdidos, 0))} no total</span>
              </div>
              {perdas.map(item => (
                <div key={item.chave} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px 40px', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.rotulo}</span>
                  <span style={{ height: '6px', borderRadius: '999px', background: '#FDE7E9', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(item.perdidos / maiorPerda) * 100}%`, borderRadius: '999px', background: '#D13438' }} />
                  </span>
                  <span style={{ textAlign: 'right', color: '#B42318', fontWeight: 700 }}>−{formatar(item.perdidos)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampoAvaliacaoFluxo;
