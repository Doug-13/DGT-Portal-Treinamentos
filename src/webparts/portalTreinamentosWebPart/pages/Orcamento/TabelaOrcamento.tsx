import * as React from 'react';

import {
  ILinhaOrcamento
} from '../../services/orcamento/OrcamentoService';

import {
  NOMES_MESES
} from '../../services/orcamento/esquemaOrcamento';

import {
  CONTAS_MAE,
  PLANO_CONTAS
} from '../../services/orcamento/planoContasOrcamento';

import {
  IItemDre,
  ITENS_DRE,
  ResultadoDre,
  calcularDre,
  sinalDaConta,
  totalAnualDre,
  valoresComSinal
} from '../../services/orcamento/dreOrcamento';

import {
  calculoDaLinha
} from '../../services/orcamento/calculoOrcamento';

import {
  COR,
  FONTE,
  converterValor,
  formatarValor
} from './orcamentoComum';

// ============================================================
// TABELA DO ORÇAMENTO — no formato da aba "ORÇAMENTO 2027"
//
// • Mesma ordem e divisões da planilha: RECEITA BRUTA, DEDUÇÕES
//   (Impostos, Comissões), Receita Operacional Líquida, CUSTOS DE
//   OPERAÇÃO…, Lucro Bruto, DESPESAS OPERACIONAIS…, LAIR, CSLL, IR,
//   Lucro Líquido, Depreciações e Amortizações e EBITDA, com os %.
// • Linhas calculadas da DRE (resultados e %) em azul/verde, como na
//   planilha; não aceitam digitação.
// • Deduções, custos e despesas aparecem NEGATIVOS e em VERMELHO
//   (digita-se o valor positivo).
// • Conta "mãe" (ex.: 4.1.4.01.01.018 CUSTO MOD PROJETOS C/TAD) mostra
//   a soma dos subitens (6.1.1.01.*), separados por subdivisão.
// • Período: 1º semestre, 2º semestre ou ano. "Total (ano)" = 12 meses.
// • Rola dentro da caixa (cabeçalho, coluna da conta e rodapé fixos).
// • Colar uma linha do Excel (valores com TAB) preenche os meses.
// • Linhas calculadas por REGRA (ex.: impostos) ficam bloqueadas.
// ============================================================

export type PeriodoTabela = 'sem1' | 'sem2' | 'ano';

const MESES_DO_PERIODO: { [periodo: string]: number[] } = {
  sem1: [0, 1, 2, 3, 4, 5],
  sem2: [6, 7, 8, 9, 10, 11],
  ano: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

export interface ITabelaOrcamentoProps {
  // Linhas exibidas (podem estar filtradas).
  linhas: ILinhaOrcamento[];
  // Todas as linhas da planilha: usadas nos totais e resultados (padrão:
  // as exibidas).
  linhasTotais?: ILinhaOrcamento[];
  somenteLeitura: boolean;
  ano: number;
  // Período ao abrir (padrão: 1º semestre na edição, ano na consulta).
  periodoInicial?: PeriodoTabela;
  // Só seções, grupos e resultados (sem as contas).
  somenteTotais?: boolean;
  // Chaves das linhas com alteração ainda não salva (destaque).
  chavesAlteradas?: string[];
  // (grupo|código) → descrição da regra que calcula a conta.
  calculadas?: { [chave: string]: string };
  // Chave da linha → etiqueta (ex.: "alterada após a devolução").
  destacadas?: { [chave: string]: string };
  onAlterarValor?: (chave: string, mes: number, valor: number) => void;
  onColarValores?: (chave: string, mesInicial: number, valores: number[]) => void;
  onAlterarDescricao?: (chave: string, descricao: string) => void;
  onRepetirJaneiro?: (chave: string) => void;
  onRemover?: (chave: string) => void;
}

const LARGURA_CONTA = 340;
const LARGURA_MES = 108;
const LARGURA_TOTAL = 124;

// Cores da planilha.
const FUNDO_RESULTADO = '#DCE6F1';   // B8CCE4 suavizado
const FUNDO_PERCENTUAL = '#EBF1DE';  // D7E3BC suavizado
const FUNDO_SECAO = '#F2F2F2';

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

const cabecalhoFixo: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: '#F1F5F9',
  fontWeight: 700
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

// Valor com sinal: negativo em vermelho.
const Valor: React.FC<{ valor: number; percentual?: boolean; vazioClaro?: boolean }> = ({ valor, percentual, vazioClaro }) => {
  if (!valor && vazioClaro) {
    return <span style={{ color: '#CBD5E1' }}>{percentual ? '0,00%' : '0,00'}</span>;
  }
  return (
    <span style={{ color: valor < 0 ? COR.perigo : undefined }}>
      {percentual ? `${formatarValor(valor)}%` : formatarValor(valor)}
    </span>
  );
};

// ------------------------------------------------------------
// Campo de valor: mostra com sinal; ao focar, edita o valor digitado.
// ------------------------------------------------------------

interface ICampoValorProps {
  valor: number;
  // -1 = dedução/custo (exibido negativo).
  sinal?: number;
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
      title={
        invalido
          ? 'Valor inválido. Use, por exemplo, 1.234,56'
          : props.sinal === -1
            ? `${props.rotulo} — digite o valor positivo; por ser dedução/custo, aparece negativo.`
            : props.rotulo
      }
      value={editando ? textoCampo : (props.valor ? formatarValor(props.valor * (props.sinal || 1)) : '')}
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
        // Dedução: aparece negativa e em vermelho (digita-se positivo).
        color: !editando && props.valor * (props.sinal || 1) < 0 ? COR.perigo : COR.azul,
        background: invalido ? '#FDE7E9' : '#FFFFFF'
      }}
    />
  );
};

// ------------------------------------------------------------
// Linha (memorizada: só redesenha quando a própria linha muda)
// ------------------------------------------------------------

// ------------------------------------------------------------
// Linha de conta (memorizada)
// ------------------------------------------------------------

interface ILinhaTabelaProps {
  linha: ILinhaOrcamento;
  alterada: boolean;
  calculo?: string;
  destaque?: string;
  somenteLeitura: boolean;
  ano: number;
  meses: number[];
  // Subitem de conta mãe (recuo maior).
  subitem: boolean;
  onAlterarValor?: (chave: string, mes: number, valor: number) => void;
  onColarValores?: (chave: string, mesInicial: number, valores: number[]) => void;
  onAlterarDescricao?: (chave: string, descricao: string) => void;
  onRepetirJaneiro?: (chave: string) => void;
  onRemover?: (chave: string) => void;
}

function LinhaTabelaBase(props: ILinhaTabelaProps): JSX.Element {

  const { linha, alterada, calculo, destaque } = props;
  const sinal = sinalDaConta(linha.codigo);
  const fundo = alterada ? COR.alterado : destaque ? '#EAF4FF' : calculo ? '#F8FAFC' : '#FFFFFF';
  const comSinal = valoresComSinal(linha);
  const total = comSinal.reduce((soma, valor) => soma + valor, 0);

  return (
    <tr>
      <td style={{ ...celula, ...colunaFixa(fundo), whiteSpace: 'normal', paddingLeft: props.subitem ? '40px' : '22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11.5px', color: COR.texto2 }}>
              {linha.codigo}
              {sinal < 0 && <span title="Dedução/custo: aparece negativo" style={{ marginLeft: '6px', color: COR.perigo, fontWeight: 700 }}>(−)</span>}
              {alterada && <span style={{ marginLeft: '6px', color: '#B45309', fontWeight: 700 }}>• não salvo</span>}
              {destaque && <span style={{ marginLeft: '6px', color: '#0F6CBD', fontWeight: 700 }}>• {destaque}</span>}
            </div>
            <div style={{ fontWeight: 600, lineHeight: 1.25 }}>{linha.conta}</div>
          </div>
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
          linha.descricao && <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '2px' }}>{linha.descricao}</div>
        ) : (
          <input
            type="text"
            value={linha.descricao}
            maxLength={400}
            placeholder="Descrição / justificativa (opcional)"
            aria-label={`Descrição de ${linha.conta}`}
            onChange={evento => props.onAlterarDescricao && props.onAlterarDescricao(linha.chave, evento.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', marginTop: '4px', padding: '4px 6px', border: `1px solid ${COR.borda}`, borderRadius: '5px', fontSize: '12px', fontFamily: FONTE, color: COR.azul, background: '#FFFFFF' }}
          />
        )}
      </td>

      {props.meses.map(mes => (
        <td key={mes} style={{ ...celulaNumero, background: fundo, padding: props.somenteLeitura || calculo ? celula.padding : '4px' }}>
          {props.somenteLeitura || calculo ? (
            <Valor valor={comSinal[mes]} vazioClaro={true} />
          ) : (
            <CampoValor
              valor={linha.valores[mes]}
              sinal={sinal}
              rotulo={`${linha.conta} — ${NOMES_MESES[mes]}/${props.ano}`}
              onConfirmar={novo => props.onAlterarValor && props.onAlterarValor(linha.chave, mes, novo)}
              onColar={valores => props.onColarValores && props.onColarValores(linha.chave, mes, valores)}
            />
          )}
        </td>
      ))}

      <td style={{ ...celulaTotal, background: fundo }}>
        <Valor valor={Math.round(total * 100) / 100} />
      </td>
    </tr>
  );
}

const LinhaTabela = React.memo(LinhaTabelaBase);

// Ordem das contas no plano (para ordenar as linhas do grupo).
const ORDEM_PLANO: { [chave: string]: number } = {};
PLANO_CONTAS.forEach((conta, indice) => {
  ORDEM_PLANO[`${conta.grupo}|${conta.codigo}`] = indice;
  // Lançamento antigo direto na conta mãe: logo antes dos subitens.
  if (conta.pai && ORDEM_PLANO[`${conta.grupo}|${conta.pai}`] === undefined) {
    ORDEM_PLANO[`${conta.grupo}|${conta.pai}`] = indice - 0.5;
  }
});

const infoDoPlano = (grupo: string, codigo: string): { pai?: string; subdivisao?: string } => {
  const conta = PLANO_CONTAS.filter(item => item.grupo === grupo && item.codigo === codigo)[0];
  return conta ? { pai: conta.pai, subdivisao: conta.subdivisao } : {};
};

// ------------------------------------------------------------
// Tabela
// ------------------------------------------------------------

const ROTULOS_PERIODO: Array<{ chave: PeriodoTabela; rotulo: string }> = [
  { chave: 'sem1', rotulo: '1º semestre (Jan–Jun)' },
  { chave: 'sem2', rotulo: '2º semestre (Jul–Dez)' },
  { chave: 'ano', rotulo: 'Ano inteiro' }
];

const TabelaOrcamento: React.FC<ITabelaOrcamentoProps> = (props) => {

  // Grupos e contas mãe minimizados (mostram só a linha de total).
  const [recolhidos, setRecolhidos] = React.useState<string[]>([]);

  const alternarRecolhido = (chave: string): void =>
    setRecolhidos(atual => (atual.indexOf(chave) >= 0 ? atual.filter(item => item !== chave) : atual.concat([chave])));

  // Botão ▾/▸ ao lado do nome do grupo.
  const botaoRecolher = (chave: string, nome: string): React.ReactNode => {
    const recolhido = recolhidos.indexOf(chave) >= 0;
    return (
      <button
        type="button"
        onClick={() => alternarRecolhido(chave)}
        aria-expanded={!recolhido}
        aria-label={`${recolhido ? 'Expandir' : 'Minimizar'} ${nome}`}
        title={recolhido ? 'Expandir' : 'Minimizar'}
        style={{
          border: `1px solid ${COR.borda}`,
          background: '#FFFFFF',
          borderRadius: '5px',
          width: '22px',
          height: '22px',
          marginRight: '8px',
          cursor: 'pointer',
          color: COR.azul,
          fontSize: '11px',
          lineHeight: '18px',
          padding: 0,
          verticalAlign: 'middle',
          fontFamily: FONTE
        }}
      >
        {recolhido ? '▸' : '▾'}
      </button>
    );
  };

  const [periodo, setPeriodo] = React.useState<PeriodoTabela>(
    props.periodoInicial || (props.somenteLeitura ? 'ano' : 'sem1')
  );

  const meses = MESES_DO_PERIODO[periodo];
  const totais = props.linhasTotais || props.linhas;

  const dre: ResultadoDre = React.useMemo(() => calcularDre(totais), [totais]);

  // Linhas exibidas por grupo, na ordem do plano.
  const porGrupo = React.useMemo(() => {
    const mapa: { [grupo: string]: ILinhaOrcamento[] } = {};
    props.linhas.forEach(linha => {
      (mapa[linha.grupo] = mapa[linha.grupo] || []).push(linha);
    });
    Object.keys(mapa).forEach(grupo => {
      mapa[grupo].sort((a, b) => {
        const oa = ORDEM_PLANO[`${a.grupo}|${a.codigo}`];
        const ob = ORDEM_PLANO[`${b.grupo}|${b.codigo}`];
        return ((oa === undefined ? 99999 : oa) - (ob === undefined ? 99999 : ob)) || (a.ordem - b.ordem);
      });
    });
    return mapa;
  }, [props.linhas]);

  // Grupos que existem nas linhas, mas não no plano atual.
  const gruposForaDoPlano =
    Object.keys(porGrupo).filter(grupo => !ITENS_DRE.some(item => item.tipo === 'grupo' && item.id === grupo));

  const gruposComLinhas = (item: IItemDre): boolean =>
    item.tipo === 'grupo' ? !!porGrupo[item.id] && porGrupo[item.id].length > 0 : true;

  const alteradas = props.chavesAlteradas || [];
  const sufixoAno = String(props.ano).substring(2);

  const linhaTotal = (
    chave: string,
    rotulo: React.ReactNode,
    valores: number[],
    estilo: { fundo: string; negrito?: boolean; percentual?: boolean; recuo?: number; cor?: string }
  ): JSX.Element => {
    const total =
      estilo.percentual
        ? totalAnualDre(chave, dre)
        : Math.round(valores.reduce((soma, valor) => soma + valor, 0) * 100) / 100;
    return (
      <tr key={chave}>
        <td style={{ ...celula, ...colunaFixa(estilo.fundo), fontWeight: estilo.negrito ? 700 : 600, whiteSpace: 'normal', paddingLeft: `${8 + (estilo.recuo || 0) * 14}px`, color: estilo.cor || COR.azul }}>
          {rotulo}
        </td>
        {meses.map(mes => (
          <td key={mes} style={{ ...celulaNumero, background: estilo.fundo, fontWeight: estilo.negrito ? 700 : 600 }}>
            <Valor valor={valores[mes] || 0} percentual={estilo.percentual} />
          </td>
        ))}
        <td style={{ ...celulaTotal, background: estilo.fundo }}>
          <Valor valor={total} percentual={estilo.percentual} />
        </td>
      </tr>
    );
  };

  const renderContas = (grupo: string): React.ReactNode[] => {
    const linhas = porGrupo[grupo] || [];
    const saida: React.ReactNode[] = [];
    const paisMostrados: string[] = [];
    let subdivisaoAtual = '';

    linhas.forEach(linha => {
      const info = infoDoPlano(linha.grupo, linha.codigo);
      // Linha antiga lançada direto na conta mãe: fica sob a conta mãe.
      const pai = info.pai || (CONTAS_MAE[linha.codigo] ? linha.codigo : undefined);

      if (pai && paisMostrados.indexOf(pai) < 0) {
        paisMostrados.push(pai);
        subdivisaoAtual = '';
        const filhos = linhas.filter(item => {
          const infoFilho = infoDoPlano(item.grupo, item.codigo);
          return infoFilho.pai === pai;
        });
        const soma = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        (totais.filter(item => item.grupo === grupo && (infoDoPlano(item.grupo, item.codigo).pai === pai || item.codigo === pai)))
          .forEach(item => valoresComSinal(item).forEach((valor, mes) => { soma[mes] += valor; }));
        saida.push(linhaTotal(
          `pai-${grupo}-${pai}`,
          <span style={{ display: 'flex', alignItems: 'flex-start' }}>
            {!props.somenteTotais && botaoRecolher(`pai-${grupo}-${pai}`, CONTAS_MAE[pai] || pai)}
            <span>
              <span style={{ fontSize: '11.5px', color: COR.texto2, display: 'block' }}>{pai} · conta com subitens ({filhos.length})</span>
              {CONTAS_MAE[pai] || pai}
            </span>
          </span>,
          soma.map(valor => Math.round(valor * 100) / 100),
          { fundo: '#F8FAFC', negrito: true, recuo: 1 }
        ));
      }

      // Conta mãe minimizada: esconde os subitens.
      if (pai && recolhidos.indexOf(`pai-${grupo}-${pai}`) >= 0) {
        return;
      }

      // Lançamento antigo direto na conta mãe, zerado, com os subitens
      // na planilha: não aparece (a conta mãe é a soma dos subitens).
      if (
        CONTAS_MAE[linha.codigo] &&
        linha.valores.every(valor => !valor) &&
        linhas.some(item => infoDoPlano(item.grupo, item.codigo).pai === linha.codigo)
      ) {
        return;
      }

      if (!props.somenteTotais) {
        if (info.pai && info.subdivisao && info.subdivisao !== subdivisaoAtual) {
          subdivisaoAtual = info.subdivisao;
          saida.push(
            <tr key={`sub-${grupo}-${info.subdivisao}`}>
              <td colSpan={meses.length + 2} style={{ ...celula, background: '#FFFFFF', paddingLeft: '30px', fontSize: '11.5px', fontWeight: 700, color: '#0F4C81', textTransform: 'uppercase', letterSpacing: '.3px' }}>
                {info.subdivisao}
              </td>
            </tr>
          );
        }
        saida.push(
          <LinhaTabela
            key={linha.chave}
            linha={linha}
            alterada={alteradas.indexOf(linha.chave) >= 0}
            calculo={calculoDaLinha(props.calculadas, linha.grupo, linha.codigo)}
            destaque={props.destacadas ? props.destacadas[linha.chave] : undefined}
            somenteLeitura={props.somenteLeitura}
            ano={props.ano}
            meses={meses}
            subitem={!!pai}
            onAlterarValor={props.onAlterarValor}
            onColarValores={props.onColarValores}
            onAlterarDescricao={props.onAlterarDescricao}
            onRepetirJaneiro={props.onRepetirJaneiro}
            onRemover={props.onRemover}
          />
        );
      }
    });

    return saida;
  };

  return (
    <div style={{ fontFamily: FONTE }}>

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
        {!props.somenteTotais && (
          <>
            <span style={{ fontSize: '12.5px', color: COR.texto2, fontWeight: 600, margin: '0 4px 0 10px' }}>Grupos:</span>
            <button
              type="button"
              onClick={() => setRecolhidos(
                ITENS_DRE.filter(item => item.tipo === 'grupo').map(item => item.id)
                  .concat(Object.keys(CONTAS_MAE).map(codigo => `pai-Custos Diretos Locações Bens (sem amortização)-${codigo}`))
              )}
              style={{ padding: '5px 12px', borderRadius: '999px', border: `1px solid ${COR.borda}`, background: '#FFFFFF', color: COR.texto2, fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: FONTE }}
            >
              ▸ Minimizar todos
            </button>
            <button
              type="button"
              onClick={() => setRecolhidos([])}
              style={{ padding: '5px 12px', borderRadius: '999px', border: `1px solid ${COR.borda}`, background: '#FFFFFF', color: COR.texto2, fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: FONTE }}
            >
              ▾ Expandir todos
            </button>
            <button
              type="button"
              title="Minimiza os grupos sem nenhum valor lançado"
              onClick={() => setRecolhidos(
                ITENS_DRE
                  .filter(item => item.tipo === 'grupo' && (dre[item.id] || []).every(valor => !valor))
                  .map(item => item.id)
              )}
              style={{ padding: '5px 12px', borderRadius: '999px', border: `1px solid ${COR.borda}`, background: '#FFFFFF', color: COR.texto2, fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: FONTE }}
            >
              Minimizar os vazios
            </button>
          </>
        )}
        <span style={{ fontSize: '12px', color: COR.texto2 }}>
          · deduções, custos e despesas aparecem <span style={{ color: COR.perigo, fontWeight: 700 }}>negativos</span>
          {periodo !== 'ano' ? ' · Total (ano) soma os 12 meses' : ''}
        </span>
      </div>

      <div style={{ overflow: 'auto', maxHeight: '68vh', maxWidth: '100%', border: `1px solid ${COR.borda}`, borderRadius: '10px', background: '#FFFFFF' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontFamily: FONTE }}>
          <thead>
            <tr>
              <th style={{ ...celula, ...colunaFixa('#F1F5F9'), ...cabecalhoFixo, left: 0, textAlign: 'left', zIndex: 3 }}>Conta</th>
              {meses.map(mes => (
                <th key={mes} style={{ ...celulaNumero, ...cabecalhoFixo }}>{NOMES_MESES[mes]}/{sufixoAno}</th>
              ))}
              <th style={{ ...celulaTotal, ...cabecalhoFixo }}>Total (ano)</th>
            </tr>
          </thead>

          <tbody>
            {ITENS_DRE.filter(gruposComLinhas).map(item => {
              const valores = dre[item.id] || [];
              if (item.tipo === 'secao') {
                return linhaTotal(item.id, item.nome.toUpperCase() === item.nome ? item.nome : item.nome, valores, { fundo: FUNDO_SECAO, negrito: true });
              }
              if (item.tipo === 'resultado') {
                return linhaTotal(item.id, item.nome, valores, { fundo: FUNDO_RESULTADO, negrito: true, cor: '#1F3864' });
              }
              if (item.tipo === 'percentual') {
                return linhaTotal(item.id, item.nome, valores, { fundo: FUNDO_PERCENTUAL, negrito: true, percentual: true, cor: '#3B5323' });
              }
              return (
                <React.Fragment key={item.id}>
                  {linhaTotal(
                    item.id,
                    <span>{!props.somenteTotais && botaoRecolher(item.id, item.nome)}{item.nome}</span>,
                    valores,
                    { fundo: COR.fundoGrupo, negrito: true, recuo: item.nivel || 0 }
                  )}
                  {recolhidos.indexOf(item.id) < 0 && renderContas(item.id)}
                </React.Fragment>
              );
            })}

            {gruposForaDoPlano.map(grupo => {
              const valores = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
              (porGrupo[grupo] || []).forEach(linha => valoresComSinal(linha).forEach((valor, mes) => { valores[mes] += valor; }));
              return (
                <React.Fragment key={`fora-${grupo}`}>
                  {linhaTotal(`fora-${grupo}`, `${grupo} (fora do plano atual)`, valores, { fundo: '#FFF8E1', negrito: true })}
                  {renderContas(grupo)}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TabelaOrcamento;
