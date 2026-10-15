import * as React from 'react';

import {
  ILinhaOrcamento,
  totalLinha
} from '../../services/orcamento/OrcamentoService';

import {
  NOMES_MESES
} from '../../services/orcamento/esquemaOrcamento';

import {
  COR,
  FONTE,
  agruparLinhas,
  converterValor,
  formatarValor,
  somar,
  somarMeses
} from './orcamentoComum';

// ============================================================
// TABELA DO ORÇAMENTO (Conta × meses × Total do ano)
//
// • Período exibido: 1º semestre, 2º semestre ou ano inteiro. O
//   "Total (ano)" é sempre dos 12 meses.
// • A tabela rola DENTRO da própria caixa (vertical e horizontal),
//   com cabeçalho, rodapé e coluna da conta fixos — a página e o menu
//   lateral não se movem.
// • Os botões da linha (⇉ preencher todos os meses e ✕ remover) ficam
//   na coluna da conta, sempre visíveis.
// • Valores aceitam "1.234,56" ou "1234,56". Colar uma linha copiada
//   do Excel (valores separados por TAB) preenche os meses a partir da
//   célula onde colou.
// • Linhas CALCULADAS por regra (ex.: impostos) ficam bloqueadas.
// • Linhas DESTACADAS (ex.: alteradas depois da devolução) recebem
//   uma etiqueta e fundo azul claro.
// ============================================================

export type PeriodoTabela = 'sem1' | 'sem2' | 'ano';

const MESES_DO_PERIODO: { [periodo: string]: number[] } = {
  sem1: [0, 1, 2, 3, 4, 5],
  sem2: [6, 7, 8, 9, 10, 11],
  ano: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

export interface ITabelaOrcamentoProps {
  linhas: ILinhaOrcamento[];
  somenteLeitura: boolean;
  ano: number;
  // Período ao abrir (padrão: 1º semestre na edição, ano inteiro na
  // consulta).
  periodoInicial?: PeriodoTabela;
  // Chaves das linhas com alteração ainda não salva (destaque).
  chavesAlteradas?: string[];
  // Código da conta → descrição da regra que a calcula.
  calculadas?: { [codigo: string]: string };
  // Chave da linha → etiqueta (ex.: "alterada após a devolução").
  destacadas?: { [chave: string]: string };
  onAlterarValor?: (chave: string, mes: number, valor: number) => void;
  onColarValores?: (chave: string, mesInicial: number, valores: number[]) => void;
  onAlterarDescricao?: (chave: string, descricao: string) => void;
  onRepetirJaneiro?: (chave: string) => void;
  onRemover?: (chave: string) => void;
}

const LARGURA_CONTA = 320;
const LARGURA_MES = 108;
const LARGURA_TOTAL = 124;

const celula: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: `1px solid ${COR.borda}`,
  fontSize: '13px',
  color: COR.azul,
  fontFamily: FONTE,
  whiteSpace: 'nowrap'
};

const celulaNumero: React.CSSProperties = {
  ...celula,
  textAlign: 'right',
  width: `${LARGURA_MES}px`,
  minWidth: `${LARGURA_MES}px`
};

const celulaTotal: React.CSSProperties = {
  ...celulaNumero,
  width: `${LARGURA_TOTAL}px`,
  minWidth: `${LARGURA_TOTAL}px`,
  fontWeight: 700
};

// Primeira coluna fixa ao rolar para o lado.
const colunaFixa = (fundo: string): React.CSSProperties => ({
  position: 'sticky',
  left: 0,
  zIndex: 1,
  background: fundo,
  width: `${LARGURA_CONTA}px`,
  minWidth: `${LARGURA_CONTA}px`,
  maxWidth: `${LARGURA_CONTA}px`,
  boxShadow: `1px 0 0 ${COR.borda}`
});

// Cabeçalho fixo no topo da caixa ao rolar para baixo.
const cabecalhoFixo: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: '#F1F5F9',
  fontWeight: 700
};

// Rodapé (total geral) fixo na base da caixa.
const rodapeFixo: React.CSSProperties = {
  position: 'sticky',
  bottom: 0,
  zIndex: 2,
  background: COR.azul,
  color: '#FFFFFF',
  fontWeight: 700,
  borderBottom: 0
};

const botaoLinha = (cor: string, borda: string): React.CSSProperties => ({
  border: `1px solid ${borda}`,
  background: '#FFFFFF',
  borderRadius: '5px',
  cursor: 'pointer',
  padding: '2px 7px',
  fontSize: '12px',
  lineHeight: '18px',
  color: cor,
  fontFamily: FONTE
});

// ------------------------------------------------------------
// Campo de valor: mostra formatado; ao focar, edita o número.
// ------------------------------------------------------------

interface ICampoValorProps {
  valor: number;
  rotulo: string;
  onConfirmar: (valor: number) => void;
  onColar?: (valores: number[]) => void;
}

const CampoValor: React.FC<ICampoValorProps> = (props) => {

  const [editando, setEditando] = React.useState(false);
  const [textoCampo, setTextoCampo] = React.useState('');
  const [invalido, setInvalido] = React.useState(false);

  const confirmar = (): void => {
    const convertido = converterValor(textoCampo);
    if (isNaN(convertido)) {
      setInvalido(true);
      return;
    }
    setInvalido(false);
    setEditando(false);
    if (convertido !== props.valor) {
      props.onConfirmar(convertido);
    }
  };

  const aoColar = (evento: React.ClipboardEvent<HTMLInputElement>): void => {
    if (!props.onColar) {
      return;
    }
    const colado = evento.clipboardData.getData('text') || '';
    // Só trata colagem de várias células (linha do Excel).
    if (colado.indexOf('\t') < 0) {
      return;
    }
    evento.preventDefault();
    const valores =
      colado
        .replace(/\r?\n$/, '')
        .split(/\r?\n/)[0]
        .split('\t')
        .map(parte => converterValor(parte));
    if (valores.some(valor => isNaN(valor))) {
      setInvalido(true);
      return;
    }
    setEditando(false);
    setInvalido(false);
    props.onColar(valores);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={props.rotulo}
      title={invalido ? 'Valor inválido. Use, por exemplo, 1.234,56' : props.rotulo}
      value={editando ? textoCampo : (props.valor ? formatarValor(props.valor) : '')}
      placeholder="0,00"
      onFocus={evento => {
        setEditando(true);
        setTextoCampo(props.valor ? formatarValor(props.valor) : '');
        const alvo = evento.currentTarget;
        window.setTimeout(() => alvo.select(), 0);
      }}
      onChange={evento => {
        setTextoCampo(evento.target.value);
        setInvalido(false);
      }}
      onBlur={confirmar}
      onPaste={aoColar}
      onKeyDown={evento => {
        if (evento.key === 'Enter') {
          (evento.currentTarget as HTMLInputElement).blur();
        }
        if (evento.key === 'Escape') {
          setEditando(false);
          setInvalido(false);
        }
      }}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 6px',
        border: `1px solid ${invalido ? COR.perigo : COR.borda}`,
        borderRadius: '5px',
        textAlign: 'right',
        fontSize: '13px',
        fontFamily: FONTE,
        color: COR.azul,
        background: invalido ? '#FDE7E9' : '#FFFFFF'
      }}
    />
  );
};

// ------------------------------------------------------------
// Linha (memorizada: só redesenha quando a própria linha muda)
// ------------------------------------------------------------

interface ILinhaTabelaProps {
  linha: ILinhaOrcamento;
  alterada: boolean;
  calculo?: string;
  destaque?: string;
  somenteLeitura: boolean;
  ano: number;
  // Índices dos meses exibidos (0 = janeiro).
  meses: number[];
  onAlterarValor?: (chave: string, mes: number, valor: number) => void;
  onColarValores?: (chave: string, mesInicial: number, valores: number[]) => void;
  onAlterarDescricao?: (chave: string, descricao: string) => void;
  onRepetirJaneiro?: (chave: string) => void;
  onRemover?: (chave: string) => void;
}

function LinhaTabelaBase(props: ILinhaTabelaProps): JSX.Element {

  const { linha, alterada, calculo, destaque } = props;

  const fundo = alterada ? COR.alterado : destaque ? '#EAF4FF' : calculo ? '#F8FAFC' : '#FFFFFF';

  return (
    <tr>

      <td style={{ ...celula, ...colunaFixa(fundo), whiteSpace: 'normal' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11.5px', color: COR.texto2 }}>
              {linha.codigo}
              {alterada && (
                <span style={{ marginLeft: '6px', color: '#B45309', fontWeight: 700 }}>• não salvo</span>
              )}
              {destaque && (
                <span style={{ marginLeft: '6px', color: '#0F6CBD', fontWeight: 700 }}>• {destaque}</span>
              )}
            </div>
            <div style={{ fontWeight: 600, lineHeight: 1.25 }}>
              {linha.conta}
            </div>
          </div>

          {/* Ações da linha: sempre visíveis, junto da conta */}
          {!props.somenteLeitura && (
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              {!calculo && (
                <button
                  type="button"
                  title="Preencher todos os meses com o valor de janeiro"
                  aria-label={`Preencher todos os meses de ${linha.conta} com o valor de janeiro`}
                  onClick={() => props.onRepetirJaneiro && props.onRepetirJaneiro(linha.chave)}
                  style={botaoLinha(COR.azul, COR.borda)}
                >
                  ⇉
                </button>
              )}
              <button
                type="button"
                title="Remover esta linha"
                aria-label={`Remover ${linha.conta}`}
                onClick={() => props.onRemover && props.onRemover(linha.chave)}
                style={botaoLinha(COR.perigo, '#F3C1C1')}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {calculo && (
          <div
            title="Valor calculado automaticamente pela regra configurada pelo Administrador"
            style={{ display: 'inline-block', marginTop: '3px', padding: '1px 8px', borderRadius: '999px', background: '#E0F7FA', color: '#00707F', fontSize: '11px', fontWeight: 700 }}
          >
            ƒ calculado: {calculo}
          </div>
        )}

        {props.somenteLeitura ? (
          linha.descricao && (
            <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '2px' }}>
              {linha.descricao}
            </div>
          )
        ) : (
          <input
            type="text"
            value={linha.descricao}
            maxLength={400}
            placeholder="Descrição / justificativa (opcional)"
            aria-label={`Descrição de ${linha.conta}`}
            onChange={evento =>
              props.onAlterarDescricao &&
              props.onAlterarDescricao(linha.chave, evento.target.value)
            }
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginTop: '4px',
              padding: '4px 6px',
              border: `1px solid ${COR.borda}`,
              borderRadius: '5px',
              fontSize: '12px',
              fontFamily: FONTE,
              color: COR.azul,
              background: '#FFFFFF'
            }}
          />
        )}
      </td>

      {props.meses.map(mes => {
        const valor = linha.valores[mes];
        return (
          <td key={mes} style={{ ...celulaNumero, background: fundo, padding: props.somenteLeitura || calculo ? celula.padding : '4px', color: calculo ? '#00707F' : COR.azul }}>
            {props.somenteLeitura || calculo ? (
              valor ? formatarValor(valor) : <span style={{ color: '#CBD5E1' }}>0,00</span>
            ) : (
              <CampoValor
                valor={valor}
                rotulo={`${linha.conta} — ${NOMES_MESES[mes]}/${props.ano}`}
                onConfirmar={novo =>
                  props.onAlterarValor &&
                  props.onAlterarValor(linha.chave, mes, novo)
                }
                onColar={valores =>
                  props.onColarValores &&
                  props.onColarValores(linha.chave, mes, valores)
                }
              />
            )}
          </td>
        );
      })}

      <td style={{ ...celulaTotal, background: fundo }}>
        {formatarValor(totalLinha(linha))}
      </td>
    </tr>
  );
}

const LinhaTabela = React.memo(LinhaTabelaBase);

// ------------------------------------------------------------
// Tabela
// ------------------------------------------------------------

const ROTULOS_PERIODO: Array<{ chave: PeriodoTabela; rotulo: string }> = [
  { chave: 'sem1', rotulo: '1º semestre (Jan–Jun)' },
  { chave: 'sem2', rotulo: '2º semestre (Jul–Dez)' },
  { chave: 'ano', rotulo: 'Ano inteiro' }
];

const TabelaOrcamento: React.FC<ITabelaOrcamentoProps> = (props) => {

  const [periodo, setPeriodo] = React.useState<PeriodoTabela>(
    props.periodoInicial || (props.somenteLeitura ? 'ano' : 'sem1')
  );

  const meses = MESES_DO_PERIODO[periodo];

  const grupos =
    React.useMemo(
      () => agruparLinhas(props.linhas),
      [props.linhas]
    );

  const totaisGerais =
    React.useMemo(
      () => somarMeses(props.linhas),
      [props.linhas]
    );

  const alteradas = props.chavesAlteradas || [];

  const sufixoAno = String(props.ano).substring(2);

  return (
    <div style={{ fontFamily: FONTE }}>

      {/* Período exibido */}
      <div role="group" aria-label="Meses exibidos" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span style={{ fontSize: '12.5px', color: COR.texto2, fontWeight: 600, marginRight: '4px' }}>Exibir:</span>
        {ROTULOS_PERIODO.map(item => {
          const ativo = item.chave === periodo;
          return (
            <button
              key={item.chave}
              type="button"
              aria-pressed={ativo}
              onClick={() => setPeriodo(item.chave)}
              style={{
                padding: '5px 12px',
                borderRadius: '999px',
                border: `1px solid ${ativo ? COR.azulAcao : COR.borda}`,
                background: ativo ? '#E8F2FF' : '#FFFFFF',
                color: ativo ? COR.azulAcao : COR.texto2,
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: FONTE
              }}
            >
              {item.rotulo}
            </button>
          );
        })}
        {periodo !== 'ano' && (
          <span style={{ fontSize: '12px', color: COR.texto2 }}>
            · a coluna Total (ano) soma os 12 meses
          </span>
        )}
      </div>

      {/* A tabela rola dentro desta caixa: a página não se move. */}
      <div
        style={{
          overflow: 'auto',
          maxHeight: '68vh',
          maxWidth: '100%',
          border: `1px solid ${COR.borda}`,
          borderRadius: '10px',
          background: '#FFFFFF'
        }}
      >
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            width: '100%',
            fontFamily: FONTE
          }}
        >
          <thead>
            <tr>
              <th style={{ ...celula, ...colunaFixa('#F1F5F9'), ...cabecalhoFixo, left: 0, textAlign: 'left', zIndex: 3 }}>
                Conta
              </th>
              {meses.map(mes => (
                <th key={mes} style={{ ...celulaNumero, ...cabecalhoFixo }}>
                  {NOMES_MESES[mes]}/{sufixoAno}
                </th>
              ))}
              <th style={{ ...celulaTotal, ...cabecalhoFixo }}>
                Total (ano)
              </th>
            </tr>
          </thead>

          <tbody>
            {grupos.map(grupo => (
              <React.Fragment key={grupo.grupo}>

                {/* Subtotal do grupo */}
                <tr>
                  <td style={{ ...celula, ...colunaFixa(COR.fundoGrupo), fontWeight: 700, whiteSpace: 'normal' }}>
                    {grupo.grupo}
                  </td>
                  {meses.map(mes => (
                    <td key={mes} style={{ ...celulaNumero, background: COR.fundoGrupo, fontWeight: 700 }}>
                      {formatarValor(grupo.totais[mes])}
                    </td>
                  ))}
                  <td style={{ ...celulaTotal, background: COR.fundoGrupo }}>
                    {formatarValor(grupo.total)}
                  </td>
                </tr>

                {grupo.linhas.map(linha => (
                  <LinhaTabela
                    key={linha.chave}
                    linha={linha}
                    alterada={alteradas.indexOf(linha.chave) >= 0}
                    calculo={props.calculadas ? props.calculadas[linha.codigo] : undefined}
                    destaque={props.destacadas ? props.destacadas[linha.chave] : undefined}
                    somenteLeitura={props.somenteLeitura}
                    ano={props.ano}
                    meses={meses}
                    onAlterarValor={props.onAlterarValor}
                    onColarValores={props.onColarValores}
                    onAlterarDescricao={props.onAlterarDescricao}
                    onRepetirJaneiro={props.onRepetirJaneiro}
                    onRemover={props.onRemover}
                  />
                ))}
              </React.Fragment>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td style={{ ...celula, ...colunaFixa(COR.azul), ...rodapeFixo, left: 0, zIndex: 3 }}>
                TOTAL GERAL
              </td>
              {meses.map(mes => (
                <td key={mes} style={{ ...celulaNumero, ...rodapeFixo }}>
                  {formatarValor(totaisGerais[mes])}
                </td>
              ))}
              <td style={{ ...celulaTotal, ...rodapeFixo }}>
                {formatarValor(somar(totaisGerais))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TabelaOrcamento;
