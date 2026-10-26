import * as React from 'react';

import {
  OrcamentoService
} from '../../services/orcamento/OrcamentoService';

import {
  GRUPOS_ORCAMENTO,
  PLANO_CONTAS
} from '../../services/orcamento/planoContasOrcamento';

import {
  ITENS_DRE,
  nomeDaReferencia
} from '../../services/orcamento/dreOrcamento';

import {
  IRegraCalculo,
  REGRAS_PLANILHA_2027,
  descreverRegra,
  nomeContaDoPlano,
  referenciasDaRegra,
  validarRegra
} from '../../services/orcamento/calculoOrcamento';

import {
  COR,
  CaixaMensagem,
  FONTE,
  Selo,
  botao,
  campo,
  cartao,
  explicarErro,
  formatarValor
} from './orcamentoComum';

// ============================================================
// REGRAS DE CÁLCULO (Administrador)
//
// "Conta DESTINO = PERCENTUAL% × soma da BASE", mês a mês, com as
// fórmulas da planilha Orçamento 2027 (ex.: (-) PIS = 1,65% × (Receita
// bruta − perdas − créditos); CSLL = 9% × LAIR).
//
// A base soma valores COM SINAL (receitas +, custos/despesas −) e pode
// misturar grupos, contas e linhas da DRE (seções e resultados).
//
// "Importar regras da planilha" cria (ou atualiza) as 11 regras da aba
// ORÇAMENTO 2027 já com os percentuais e as bases da planilha.
//
// As linhas calculadas ficam bloqueadas na planilha do gestor e são
// recalculadas a cada digitação. Planilhas ENVIADAS mantêm os valores.
// ============================================================

export interface IRegrasCalculoViewProps {
  servico: OrcamentoService;
  regras: IRegraCalculo[];
  onSalvo: () => Promise<void>;
}

const regraVazia = (ordem: number): IRegraCalculo => ({
  id: '',
  nome: '',
  contaDestino: '',
  contaDestinoNome: '',
  grupoDestino: '',
  tipoBase: 'Misto',
  base: [],
  percentual: 0,
  ordem,
  ativo: true
});

// "1,65" → 1.65 · "0,9250%" → 0.925 (até 4 casas decimais).
const converterPercentual = (entrada: string): number => {
  let textoLimpo = (entrada || '').replace(/%/g, '').replace(/\s/g, '');
  if (!textoLimpo) {
    return 0;
  }
  if (textoLimpo.indexOf(',') >= 0) {
    textoLimpo = textoLimpo.replace(/\./g, '').replace(',', '.');
  }
  const valor = Number(textoLimpo);
  return isFinite(valor) ? Math.round(valor * 10000) / 10000 : NaN;
};

const formatarPercentual = (valor: number): string =>
  (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

// Linhas da DRE que podem ser base (seções e resultados).
const LINHAS_DRE = ITENS_DRE.filter(item => item.tipo === 'secao' || item.tipo === 'resultado');

const mesmaDestino = (a: Pick<IRegraCalculo, 'contaDestino' | 'grupoDestino'>, b: Pick<IRegraCalculo, 'contaDestino' | 'grupoDestino'>): boolean =>
  a.contaDestino === b.contaDestino &&
  (!a.grupoDestino || !b.grupoDestino || a.grupoDestino === b.grupoDestino);

const RegrasCalculoView: React.FC<IRegrasCalculoViewProps> = (props) => {

  const [editando, setEditando] = React.useState<IRegraCalculo | undefined>(undefined);
  const [percentualTexto, setPercentualTexto] = React.useState('');
  const [buscaConta, setBuscaConta] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');

  const proximaOrdem = (): number =>
    props.regras.reduce((maior, regra) => Math.max(maior, regra.ordem), 0) + 10;

  // Abre para edição já no formato 'Misto' (converte regras antigas).
  const abrir = (regra: IRegraCalculo): void => {
    setEditando({ ...regra, tipoBase: 'Misto', base: referenciasDaRegra(regra), grupoDestino: regra.grupoDestino || '' });
    setPercentualTexto(formatarPercentual(regra.percentual));
    setBuscaConta('');
    setErro('');
    setAviso('');
  };

  const percentualConvertido = converterPercentual(percentualTexto);

  const regraAtual: IRegraCalculo | undefined =
    editando && {
      ...editando,
      grupoDestino: editando.grupoDestino || undefined,
      contaDestinoNome: nomeContaDoPlano(editando.contaDestino, editando.grupoDestino || undefined),
      percentual: isNaN(percentualConvertido) ? -1 : percentualConvertido
    };

  const problemas = regraAtual ? validarRegra(regraAtual, props.regras) : [];

  const salvar = async (): Promise<void> => {
    if (!regraAtual || problemas.length > 0) {
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await props.servico.salvarRegra(regraAtual);
      await props.onSalvo();
      setEditando(undefined);
      setAviso(`✓ Regra de ${regraAtual.contaDestinoNome} salva.`);
    } catch (falha) {
      setErro(explicarErro(falha));
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (regra: IRegraCalculo): Promise<void> => {
    const nova = { ...regra, ativo: !regra.ativo };
    const problemasNova = validarRegra(nova, props.regras);
    if (nova.ativo && problemasNova.length > 0) {
      setErro(`Não foi possível ativar: ${problemasNova.join(' ')}`);
      return;
    }
    setErro('');
    try {
      await props.servico.salvarRegra(nova);
      await props.onSalvo();
      setAviso(`✓ Regra de ${regra.contaDestinoNome || nomeContaDoPlano(regra.contaDestino)} ${nova.ativo ? 'ativada' : 'desativada'}.`);
    } catch (falha) {
      setErro(explicarErro(falha));
    }
  };

  // Cria ou atualiza as regras da planilha Orçamento 2027.
  const importarPlanilha = async (): Promise<void> => {
    const existentes = REGRAS_PLANILHA_2027.filter(modelo => props.regras.some(regra => mesmaDestino(regra, modelo))).length;
    if (!window.confirm(
      `Importar as ${REGRAS_PLANILHA_2027.length} regras da planilha Orçamento 2027 (impostos, comissões, amortização, CSLL, IR e Lei do Bem)?\n\n` +
      `${REGRAS_PLANILHA_2027.length - existentes} serão criadas e ${existentes} atualizadas com os percentuais e bases da planilha. ` +
      'Todas ficam ATIVAS.'
    )) {
      return;
    }
    setSalvando(true);
    setErro('');
    setAviso('');
    const falhas: string[] = [];
    // Regra existente da mesma conta é atualizada (não duplica).
    for (const modelo of REGRAS_PLANILHA_2027) {
      const atual = props.regras.filter(regra => mesmaDestino(regra, modelo))[0];
      try {
        await props.servico.salvarRegra({
          id: atual ? atual.id : '',
          nome: '',
          contaDestino: modelo.contaDestino,
          contaDestinoNome: nomeContaDoPlano(modelo.contaDestino, modelo.grupoDestino),
          grupoDestino: modelo.grupoDestino,
          tipoBase: 'Misto',
          base: modelo.base.slice(),
          percentual: modelo.percentual,
          ordem: modelo.ordem,
          ativo: true
        });
      } catch (falha) {
        falhas.push(`${nomeContaDoPlano(modelo.contaDestino, modelo.grupoDestino)}: ${explicarErro(falha)}`);
      }
    }
    try {
      await props.onSalvo();
    } catch {
      // A lista é recarregada na próxima abertura.
    }
    setSalvando(false);
    if (falhas.length > 0) {
      setErro(`Algumas regras não foram gravadas:\n${falhas.join('\n')}`);
    } else {
      setAviso(`✓ ${REGRAS_PLANILHA_2027.length} regras da planilha Orçamento 2027 importadas e ativas. As planilhas em preenchimento são recalculadas ao abrir.`);
    }
  };

  const alternarRef = (ref: string): void => {
    if (!editando) {
      return;
    }
    const base =
      editando.base.indexOf(ref) >= 0
        ? editando.base.filter(valor => valor !== ref)
        : editando.base.concat([ref]);
    setEditando({ ...editando, base });
  };

  const contasFiltradas =
    PLANO_CONTAS.filter(item => {
      const termo = buscaConta.trim().toLowerCase();
      return !termo || item.conta.toLowerCase().indexOf(termo) >= 0 || item.codigo.indexOf(termo) >= 0 || item.grupo.toLowerCase().indexOf(termo) >= 0;
    });

  const rotulo: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 700, color: COR.azul, marginBottom: '6px' };
  const cabecalho: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '12px', color: COR.texto2, fontWeight: 700, textTransform: 'uppercase', borderBottom: `1px solid ${COR.borda}`, whiteSpace: 'nowrap' };
  const celula: React.CSSProperties = { padding: '10px', fontSize: '13.5px', color: COR.azul, borderBottom: `1px solid ${COR.borda}`, verticalAlign: 'top' };
  const chip = (marcado: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: COR.azul, padding: '6px 8px',
    border: `1px solid ${marcado ? COR.ciano : COR.borda}`, background: marcado ? '#F0FCFE' : '#FFFFFF', borderRadius: '6px', cursor: 'pointer'
  });

  const valorDestino = editando ? `${editando.grupoDestino || ''}|${editando.contaDestino}` : '';
  const modeloDaRegra = (regra: IRegraCalculo): typeof REGRAS_PLANILHA_2027[0] | undefined =>
    REGRAS_PLANILHA_2027.filter(modelo => mesmaDestino(regra, modelo))[0];

  return (
    <div style={{ fontFamily: FONTE }}>
      <CaixaMensagem tipo="erro" texto={erro} />
      <CaixaMensagem tipo="sucesso" texto={aviso} />

      <div style={{ ...cartao, fontSize: '13px', color: COR.texto2 }}>
        Cada regra calcula uma conta como <strong style={{ color: COR.azul }}>percentual da soma de outros itens</strong>, mês a mês,
        como as fórmulas da planilha Orçamento 2027 (ex.: <em>(-) PIS = 1,65% × (Receita bruta − perdas − créditos)</em>,{' '}
        <em>CSLL = 9% × Lucro antes do IRPJ/CSLL</em>). A base soma valores <strong style={{ color: COR.azul }}>com sinal</strong>:
        receitas positivas e custos/despesas negativos — por isso um crédito reduz o imposto e a Lei do Bem reduz a CSLL/IR.
        Na planilha do gestor a linha calculada fica bloqueada (ƒ) e é recalculada a cada digitação.
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => { importarPlanilha().catch(() => undefined); }} disabled={salvando} style={botao('principal', salvando)}>
          {salvando ? 'Importando...' : `Importar regras da planilha Orçamento 2027 (${REGRAS_PLANILHA_2027.length})`}
        </button>
        <button type="button" onClick={() => abrir(regraVazia(proximaOrdem()))} disabled={salvando} style={botao('secundario', salvando)}>
          + Nova regra
        </button>
      </div>

      {editando && regraAtual && (
        <div style={{ ...cartao, borderColor: COR.ciano, borderWidth: '2px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: COR.azul, marginBottom: '14px' }}>
            {editando.id ? 'Editar regra' : 'Nova regra'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '14px', marginBottom: '14px' }}>
            <label>
              <span style={rotulo}>Conta calculada *</span>
              <select
                value={valorDestino}
                onChange={evento => {
                  const [grupo, codigo] = evento.target.value.split('|');
                  setEditando({ ...editando, grupoDestino: grupo, contaDestino: codigo || '' });
                }}
                style={campo}
              >
                <option value="|">Escolha a conta...</option>
                {GRUPOS_ORCAMENTO.map(grupo => (
                  <optgroup key={grupo} label={grupo}>
                    {PLANO_CONTAS.filter(item => item.grupo === grupo).map(item => (
                      <option key={`${grupo}|${item.codigo}`} value={`${grupo}|${item.codigo}`}>
                        {item.conta} ({item.codigo})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              <span style={rotulo}>Percentual (%) *</span>
              <input type="text" inputMode="decimal" value={percentualTexto} onChange={evento => setPercentualTexto(evento.target.value)} placeholder="Ex.: 1,65" style={campo} />
            </label>
            <label>
              <span style={rotulo}>Ordem</span>
              <input
                type="number"
                value={editando.ordem}
                onChange={evento => setEditando({ ...editando, ordem: Number(evento.target.value) || 0 })}
                style={campo}
                title="Regras com ordem menor são calculadas antes (uma regra pode usar o resultado de outra). CSLL/IR por último."
              />
            </label>
          </div>

          <span style={rotulo}>Base do cálculo * <span style={{ fontWeight: 400, color: COR.texto2 }}>(soma com sinal dos itens marcados)</span></span>

          <div style={{ fontSize: '12.5px', fontWeight: 700, color: COR.texto2, margin: '6px 0' }}>Grupos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px', marginBottom: '10px' }}>
            {GRUPOS_ORCAMENTO.map(grupo => {
              const ref = `grupo:${grupo}`;
              return (
                <label key={ref} style={chip(editando.base.indexOf(ref) >= 0)}>
                  <input type="checkbox" checked={editando.base.indexOf(ref) >= 0} onChange={() => alternarRef(ref)} />
                  {grupo}
                </label>
              );
            })}
          </div>

          <div style={{ fontSize: '12.5px', fontWeight: 700, color: COR.texto2, margin: '6px 0' }}>Seções e resultados da DRE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px', marginBottom: '10px' }}>
            {LINHAS_DRE.map(item => {
              const ref = `linha:${item.id}`;
              return (
                <label key={ref} style={chip(editando.base.indexOf(ref) >= 0)}>
                  <input type="checkbox" checked={editando.base.indexOf(ref) >= 0} onChange={() => alternarRef(ref)} />
                  {item.nome}
                </label>
              );
            })}
          </div>

          <div style={{ fontSize: '12.5px', fontWeight: 700, color: COR.texto2, margin: '6px 0' }}>Contas</div>
          <input type="search" placeholder="Buscar conta para a base..." value={buscaConta} onChange={evento => setBuscaConta(evento.target.value)} style={{ ...campo, marginBottom: '6px' }} />
          <div style={{ maxHeight: '220px', overflowY: 'auto', border: `1px solid ${COR.borda}`, borderRadius: '6px', padding: '4px 8px', marginBottom: '10px' }}>
            {contasFiltradas.map(item => {
              const ref = `conta:${item.codigo}`;
              const destino = item.codigo === editando.contaDestino;
              return (
                <label key={`${item.grupo}|${item.codigo}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: COR.azul, padding: '4px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editando.base.indexOf(ref) >= 0} disabled={destino} onChange={() => alternarRef(ref)} />
                  <span>{item.conta} <span style={{ color: COR.texto2, fontSize: '12px' }}>· {item.codigo} · {item.grupo}</span></span>
                </label>
              );
            })}
          </div>

          {editando.base.length > 0 && (
            <div style={{ fontSize: '12.5px', color: COR.texto2, marginBottom: '10px' }}>
              Base: {editando.base.map(ref => nomeDaReferencia(ref)).join(' + ')}
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: COR.azul, marginBottom: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={editando.ativo} onChange={evento => setEditando({ ...editando, ativo: evento.target.checked })} />
            Regra ativa
          </label>

          {problemas.length === 0 && regraAtual.contaDestino && (
            <div style={{ fontSize: '13px', color: '#00707F', background: '#E0F7FA', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>
              <strong>{regraAtual.contaDestinoNome}</strong> = {descreverRegra(regraAtual)}.
              Exemplo: base de R$ 100.000,00 no mês → R$ {formatarValor(100000 * regraAtual.percentual / 100)}.
            </div>
          )}

          {problemas.length > 0 && (
            <div style={{ fontSize: '12.5px', color: COR.perigo, marginBottom: '12px' }}>
              {problemas.map(problema => <div key={problema}>• {problema}</div>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setEditando(undefined)} disabled={salvando} style={botao('secundario', salvando)}>Cancelar</button>
            <button type="button" onClick={() => { salvar().catch(() => undefined); }} disabled={salvando || problemas.length > 0} style={botao('principal', salvando || problemas.length > 0)}>
              {salvando ? 'Salvando...' : 'Salvar regra'}
            </button>
          </div>
        </div>
      )}

      <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
        {props.regras.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: COR.texto2, fontSize: '13.5px' }}>
            Nenhuma regra cadastrada. Clique em <strong>Importar regras da planilha Orçamento 2027</strong> para criar as regras da planilha.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTE }}>
            <thead>
              <tr>
                <th style={cabecalho}>Ordem</th>
                <th style={cabecalho}>Conta calculada</th>
                <th style={cabecalho}>Regra</th>
                <th style={cabecalho}>Situação</th>
                <th style={cabecalho} />
              </tr>
            </thead>
            <tbody>
              {props.regras.map(regra => {
                const modelo = modeloDaRegra(regra);
                return (
                  <tr key={regra.id} style={{ opacity: regra.ativo ? 1 : 0.65 }}>
                    <td style={{ ...celula, color: COR.texto2 }}>{regra.ordem}</td>
                    <td style={celula}>
                      <div style={{ fontWeight: 600 }}>{regra.contaDestinoNome || nomeContaDoPlano(regra.contaDestino, regra.grupoDestino)}</div>
                      <div style={{ fontSize: '12px', color: COR.texto2 }}>{regra.contaDestino}{regra.grupoDestino ? ` · ${regra.grupoDestino}` : ''}</div>
                    </td>
                    <td style={celula}>
                      {descreverRegra(regra)}
                      {modelo && (
                        <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '3px' }} title="Fórmula da aba ORÇAMENTO 2027">
                          Planilha: <code>{modelo.formula}</code>
                        </div>
                      )}
                    </td>
                    <td style={celula}>
                      {regra.ativo ? <Selo texto="Ativa" cor="#107C10" fundo="#E7F6EC" /> : <Selo texto="Desativada" cor="#64748b" fundo="#F1F5F9" />}
                    </td>
                    <td style={{ ...celula, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => abrir(regra)} style={{ ...botao('secundario'), marginRight: '6px' }}>Editar</button>
                      <button type="button" onClick={() => { alternarAtivo(regra).catch(() => undefined); }} style={botao('secundario')}>
                        {regra.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RegrasCalculoView;
