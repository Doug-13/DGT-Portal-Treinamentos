import * as React from 'react';

import {
  IConfigAvaliacao,
  ICriterioAvaliacao,
  IFaixaAvaliacao,
  ROTULOS_ESCALA_PADRAO,
  configAvaliacaoPadrao,
  corDaNota,
  validarConfigAvaliacao
} from '../../services/fluxo/valorAvaliacao';

// ============================================================
// CONFIGURAÇÃO DO CAMPO "AVALIAÇÃO" (Processos → Metadados)
//
// Critérios (nome, descrição, peso) · escala de notas e rótulos ·
// cálculo (ponderado 0–100 ou soma) · faixas da sinaleira ·
// justificativa obrigatória para notas baixas.
// ============================================================

export interface IEditorAvaliacaoProps {
  config?: IConfigAvaliacao;
  editavel: boolean;
  rotuloCampo: string;
  onAlterar: (config: IConfigAvaliacao) => void;
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO2 = '#64748B';

const CORES_FAIXA: Array<{ cor: string; nome: string }> = [
  { cor: '#107C10', nome: 'Verde' },
  { cor: '#B45309', nome: 'Amarelo/laranja' },
  { cor: '#B42318', nome: 'Vermelho' },
  { cor: '#0F6CBD', nome: 'Azul' },
  { cor: '#6B4FBB', nome: 'Roxo' },
  { cor: '#64748B', nome: 'Cinza' }
];

const entrada: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '32px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '13px',
  color: COR_AZUL,
  fontFamily: 'inherit'
};

const pequeno = (perigo = false): React.CSSProperties => ({
  minHeight: '30px',
  padding: '0 10px',
  borderRadius: '6px',
  border: `1px solid ${perigo ? '#B42318' : COR_BORDA}`,
  background: '#FFFFFF',
  color: perigo ? '#B42318' : COR_AZUL,
  fontWeight: 700,
  fontSize: '12.5px',
  cursor: 'pointer'
});

const titulo: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: COR_AZUL,
  margin: '12px 0 6px'
};

const gerarChave = (texto: string, existentes: string[]): string => {
  const base =
    (texto || 'criterio')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((parte, indice) => (indice === 0 ? parte.toLowerCase() : parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase()))
      .join('')
      .replace(/^[^a-z]+/, '')
      .substring(0, 40) || 'criterio';
  let chave = base;
  let numero = 2;
  while (existentes.indexOf(chave) >= 0) {
    chave = `${base}${numero}`;
    numero++;
  }
  return chave;
};

const EditorAvaliacao: React.FC<IEditorAvaliacaoProps> = ({ config, editavel, rotuloCampo, onAlterar }) => {

  const atual: IConfigAvaliacao = config || configAvaliacaoPadrao();
  const alterar = (parcial: Partial<IConfigAvaliacao>): void => onAlterar({ ...atual, ...parcial });

  const alterarCriterio = (indice: number, parcial: Partial<ICriterioAvaliacao>): void =>
    alterar({ criterios: atual.criterios.map((item, posicao) => (posicao === indice ? { ...item, ...parcial } : item)) });

  const alterarFaixa = (indice: number, parcial: Partial<IFaixaAvaliacao>): void =>
    alterar({ faixas: atual.faixas.map((item, posicao) => (posicao === indice ? { ...item, ...parcial } : item)) });

  const somaPesos = atual.criterios.reduce((soma, item) => soma + (Number(item.peso) || 0), 0);
  const problemas = validarConfigAvaliacao(rotuloCampo || 'avaliação', atual);

  const notas: number[] = [];
  for (let nota = atual.escala.minimo; nota <= atual.escala.maximo && notas.length < 11; nota++) {
    notas.push(nota);
  }

  return (
    <div style={{ marginTop: '10px', padding: '10px 12px', border: `1px dashed ${COR_BORDA}`, borderRadius: '8px', background: '#FAFBFC', color: COR_AZUL }}>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
        <strong style={{ fontSize: '13px', flex: 1 }}>Configuração da avaliação</strong>
        {editavel && (
          <button
            type="button"
            style={pequeno()}
            onClick={() => { if (window.confirm('Substituir a configuração pelo modelo Go/No-Go (8 critérios, escala 1–5, faixas GO / GO com restrição / NO-GO)?')) { onAlterar(configAvaliacaoPadrao()); } }}
          >
            Usar modelo Go/No-Go
          </button>
        )}
      </div>

      {/* Critérios */}
      <div style={titulo}>Critérios</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(160px, 1.4fr) 80px auto', gap: '6px', alignItems: 'center', fontSize: '11.5px', color: COR_TEXTO2, fontWeight: 700 }}>
        <span>Nome</span><span>Descrição</span><span>Peso</span><span />
      </div>
      {atual.criterios.map((criterio, indice) => (
        <div key={`${criterio.chave}-${indice}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(160px, 1.4fr) 80px auto', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
          <input
            aria-label="Nome do critério"
            value={criterio.rotulo}
            disabled={!editavel}
            onChange={evento => alterarCriterio(indice, { rotulo: evento.target.value })}
            style={entrada}
          />
          <input
            aria-label="Descrição do critério"
            value={criterio.descricao || ''}
            disabled={!editavel}
            onChange={evento => alterarCriterio(indice, { descricao: evento.target.value })}
            style={entrada}
          />
          <input
            aria-label="Peso"
            type="number"
            min={0}
            value={criterio.peso}
            disabled={!editavel}
            onChange={evento => alterarCriterio(indice, { peso: Number(evento.target.value) })}
            style={entrada}
          />
          {editavel
            ? <button type="button" aria-label={`Remover ${criterio.rotulo}`} style={pequeno(true)} onClick={() => alterar({ criterios: atual.criterios.filter((_item, posicao) => posicao !== indice) })}>✕</button>
            : <span />}
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
        {editavel && (
          <button
            type="button"
            style={pequeno()}
            onClick={() => alterar({ criterios: atual.criterios.concat({ chave: gerarChave('Novo critério', atual.criterios.map(item => item.chave)), rotulo: 'Novo critério', peso: 10 }) })}
          >
            + Critério
          </button>
        )}
        <span style={{ fontSize: '12px', color: COR_TEXTO2 }}>
          Soma dos pesos: <strong>{somaPesos}</strong>
          {atual.calculo !== 'soma' ? ' (no cálculo ponderado os pesos viram percentuais: não precisam somar 100)' : ''}
        </span>
      </div>

      {/* Escala */}
      <div style={titulo}>Escala de notas</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <span>De</span>
        <input
          aria-label="Nota mínima"
          type="number"
          min={0}
          max={9}
          value={atual.escala.minimo}
          disabled={!editavel}
          onChange={evento => alterar({ escala: { ...atual.escala, minimo: Math.round(Number(evento.target.value)) } })}
          style={{ ...entrada, width: '64px' }}
        />
        <span>a</span>
        <input
          aria-label="Nota máxima"
          type="number"
          min={1}
          max={10}
          value={atual.escala.maximo}
          disabled={!editavel}
          onChange={evento => alterar({ escala: { ...atual.escala, maximo: Math.round(Number(evento.target.value)) } })}
          style={{ ...entrada, width: '64px' }}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
        {notas.map((nota, posicao) => {
          const cor = corDaNota(nota, atual.escala.minimo, atual.escala.maximo);
          const rotulos = atual.escala.rotulos || [];
          return (
            <label key={nota} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: cor, color: '#FFFFFF', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{nota}</span>
              <input
                aria-label={`Rótulo da nota ${nota}`}
                value={rotulos[posicao] || ''}
                placeholder={notas.length === 5 ? ROTULOS_ESCALA_PADRAO[posicao] : 'Rótulo (opcional)'}
                disabled={!editavel}
                onChange={evento => {
                  const novos = notas.map((_n, i) => (i === posicao ? evento.target.value : (rotulos[i] || '')));
                  alterar({ escala: { ...atual.escala, rotulos: novos } });
                }}
                style={{ ...entrada, width: '150px' }}
              />
            </label>
          );
        })}
      </div>

      {/* Cálculo */}
      <div style={titulo}>Cálculo da pontuação</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="radio" name={`calculo-${rotuloCampo}`} checked={atual.calculo !== 'soma'} disabled={!editavel} onChange={() => alterar({ calculo: 'ponderada' })} />
          <span><strong>Ponderado (0 a 100)</strong> — cada critério vale o seu peso em %; nota máxima = pontos cheios.</span>
        </label>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="radio" name={`calculo-${rotuloCampo}`} checked={atual.calculo === 'soma'} disabled={!editavel} onChange={() => alterar({ calculo: 'soma' })} />
          <span><strong>Soma</strong> — soma de nota × peso de todos os critérios (as faixas usam esse total).</span>
        </label>
      </div>

      {/* Faixas */}
      <div style={titulo}>Faixas de resultado (sinaleira)</div>
      <div style={{ fontSize: '12px', color: COR_TEXTO2, marginBottom: '4px' }}>
        A pontuação cai na faixa de maior mínimo atingido. A <strong>chave</strong> é o que as decisões do fluxo comparam
        (ex.: caminho “quando avaliação = nogo”).
      </div>
      {atual.faixas.map((faixa, indice) => (
        <div key={`${faixa.chave}-${indice}`} style={{ display: 'grid', gridTemplateColumns: '18px minmax(120px, 1fr) 120px 90px 150px auto', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
          <span aria-hidden="true" style={{ width: '14px', height: '14px', borderRadius: '50%', background: faixa.cor }} />
          <input aria-label="Nome da faixa" value={faixa.rotulo} disabled={!editavel} onChange={evento => alterarFaixa(indice, { rotulo: evento.target.value })} style={entrada} />
          <input aria-label="Chave da faixa" value={faixa.chave} disabled={!editavel} onChange={evento => alterarFaixa(indice, { chave: evento.target.value.replace(/[^A-Za-z0-9]/g, '') })} style={entrada} />
          <input aria-label="Pontuação mínima" type="number" min={0} value={faixa.minimo} disabled={!editavel} onChange={evento => alterarFaixa(indice, { minimo: Number(evento.target.value) })} style={entrada} />
          <select aria-label="Cor da faixa" value={faixa.cor} disabled={!editavel} onChange={evento => alterarFaixa(indice, { cor: evento.target.value })} style={{ ...entrada, color: faixa.cor, fontWeight: 700 }}>
            {CORES_FAIXA.map(item => <option key={item.cor} value={item.cor}>{item.nome}</option>)}
          </select>
          {editavel
            ? <button type="button" aria-label={`Remover faixa ${faixa.rotulo}`} style={pequeno(true)} onClick={() => alterar({ faixas: atual.faixas.filter((_item, posicao) => posicao !== indice) })}>✕</button>
            : <span />}
        </div>
      ))}
      <div style={{ fontSize: '11.5px', color: COR_TEXTO2, marginTop: '2px' }}>Colunas: nome · chave · a partir de (pontos) · cor</div>
      {editavel && (
        <button type="button" style={{ ...pequeno(), marginTop: '6px' }} onClick={() => alterar({ faixas: atual.faixas.concat({ chave: `faixa${atual.faixas.length + 1}`, rotulo: 'Nova faixa', minimo: 50, cor: '#0F6CBD' }) })}>
          + Faixa
        </button>
      )}

      {/* Justificativa */}
      <div style={titulo}>Justificativa</div>
      <label style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
        Obrigatória para notas até
        <select
          aria-label="Justificativa obrigatória até a nota"
          value={atual.justificativaAte === undefined ? '' : String(atual.justificativaAte)}
          disabled={!editavel}
          onChange={evento => alterar({ justificativaAte: evento.target.value === '' ? undefined : Number(evento.target.value) })}
          style={{ ...entrada, width: 'auto' }}
        >
          <option value="">(nunca obrigatória)</option>
          {notas.map(nota => <option key={nota} value={nota}>{nota}</option>)}
        </select>
      </label>

      {problemas.length > 0 && (
        <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '6px', background: '#FDE7E9', color: '#8A1C14', fontSize: '12.5px' }}>
          {problemas.map(item => <div key={item}>• {item}</div>)}
        </div>
      )}
    </div>
  );
};

export default EditorAvaliacao;
