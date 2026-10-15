import * as React from 'react';

import {
  OrcamentoService
} from '../../services/orcamento/OrcamentoService';

import {
  TipoBaseRegra
} from '../../services/orcamento/esquemaOrcamento';

import {
  GRUPOS_ORCAMENTO,
  PLANO_CONTAS
} from '../../services/orcamento/planoContasOrcamento';

import {
  IRegraCalculo,
  REGRAS_SUGERIDAS,
  descreverRegra,
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
// "Conta DESTINO = PERCENTUAL% × soma da BASE", mês a mês.
// Ex.: (-) PIS = 1,65% de Receita bruta.
//
// As linhas calculadas ficam bloqueadas na planilha do gestor e são
// recalculadas a cada digitação. Alterar uma regra recalcula as
// planilhas em preenchimento/devolvidas na próxima vez que forem
// abertas (o gestor salva); planilhas ENVIADAS mantêm os valores.
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
  tipoBase: 'Grupo',
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

const RegrasCalculoView: React.FC<IRegrasCalculoViewProps> = (props) => {

  const [editando, setEditando] = React.useState<IRegraCalculo | undefined>(undefined);
  const [percentualTexto, setPercentualTexto] = React.useState('');
  const [buscaConta, setBuscaConta] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');

  const proximaOrdem = (): number =>
    props.regras.reduce((maior, regra) => Math.max(maior, regra.ordem), 0) + 10;

  const abrir = (regra: IRegraCalculo): void => {
    setEditando({ ...regra, base: regra.base.slice() });
    setPercentualTexto(formatarPercentual(regra.percentual));
    setBuscaConta('');
    setErro('');
    setAviso('');
  };

  const nomeConta = (codigo: string): string => {
    const conta = PLANO_CONTAS.filter(item => item.codigo === codigo)[0];
    return conta ? conta.conta : codigo;
  };

  const percentualConvertido = converterPercentual(percentualTexto);

  const regraAtual: IRegraCalculo | undefined =
    editando && {
      ...editando,
      contaDestinoNome: nomeConta(editando.contaDestino),
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
      setAviso(`✓ Regra de ${regra.contaDestinoNome || nomeConta(regra.contaDestino)} ${nova.ativo ? 'ativada' : 'desativada'}.`);
    } catch (falha) {
      setErro(explicarErro(falha));
    }
  };

  const criarSugeridas = async (): Promise<void> => {
    const faltantes =
      REGRAS_SUGERIDAS.filter(sugestao => !props.regras.some(regra => regra.contaDestino === sugestao.contaDestino));
    if (faltantes.length === 0) {
      setAviso('As regras sugeridas já existem.');
      return;
    }
    if (!window.confirm(`Criar ${faltantes.length} regra(s) sugerida(s) (impostos sobre a Receita bruta)? Elas são criadas DESATIVADAS e com 0% — informe as alíquotas corretas e ative.`)) {
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      for (const sugestao of faltantes) {
        await props.servico.salvarRegra({
          ...regraVazia(sugestao.ordem),
          contaDestino: sugestao.contaDestino,
          contaDestinoNome: nomeConta(sugestao.contaDestino),
          tipoBase: sugestao.tipoBase,
          base: sugestao.base.slice(),
          ativo: false
        });
      }
      await props.onSalvo();
      setAviso(`✓ ${faltantes.length} regra(s) sugerida(s) criada(s), desativadas. Edite cada uma para informar a alíquota.`);
    } catch (falha) {
      setErro(explicarErro(falha));
    } finally {
      setSalvando(false);
    }
  };

  const alternarBase = (item: string): void => {
    if (!editando) {
      return;
    }
    const base =
      editando.base.indexOf(item) >= 0
        ? editando.base.filter(valor => valor !== item)
        : editando.base.concat([item]);
    setEditando({ ...editando, base });
  };

  const trocarTipoBase = (tipo: TipoBaseRegra): void => {
    if (editando && editando.tipoBase !== tipo) {
      setEditando({ ...editando, tipoBase: tipo, base: [] });
    }
  };

  const contasFiltradas =
    PLANO_CONTAS.filter(item => {
      const termo = buscaConta.trim().toLowerCase();
      return !termo || item.conta.toLowerCase().indexOf(termo) >= 0 || item.codigo.indexOf(termo) >= 0 || item.grupo.toLowerCase().indexOf(termo) >= 0;
    });

  const rotulo: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: COR.azul,
    marginBottom: '6px'
  };

  const cabecalho: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: '12px',
    color: COR.texto2,
    fontWeight: 700,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${COR.borda}`,
    whiteSpace: 'nowrap'
  };

  const celula: React.CSSProperties = {
    padding: '10px',
    fontSize: '13.5px',
    color: COR.azul,
    borderBottom: `1px solid ${COR.borda}`,
    verticalAlign: 'top'
  };

  return (
    <div style={{ fontFamily: FONTE }}>
      <CaixaMensagem tipo="erro" texto={erro} />
      <CaixaMensagem tipo="sucesso" texto={aviso} />

      <div style={{ ...cartao, fontSize: '13px', color: COR.texto2 }}>
        Cada regra calcula uma conta como <strong style={{ color: COR.azul }}>percentual da soma de outras</strong>, mês a mês, dentro da
        mesma planilha (ex.: <em>(-) PIS = 1,65% de Receita bruta</em>). Na planilha do gestor a linha calculada fica bloqueada (ƒ) e é
        recalculada a cada digitação. As regras valem para planilhas em preenchimento ou devolvidas; planilhas já enviadas mantêm os
        valores gravados até serem devolvidas.
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => abrir(regraVazia(proximaOrdem()))} disabled={salvando} style={botao('principal', salvando)}>
          + Nova regra
        </button>
        <button type="button" onClick={() => { criarSugeridas().catch(() => undefined); }} disabled={salvando} style={botao('secundario', salvando)}>
          Criar regras sugeridas (impostos sobre vendas)
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
                value={editando.contaDestino}
                onChange={evento => setEditando({ ...editando, contaDestino: evento.target.value })}
                style={campo}
              >
                <option value="">Escolha a conta...</option>
                {GRUPOS_ORCAMENTO.map(grupo => (
                  <optgroup key={grupo} label={grupo}>
                    {PLANO_CONTAS.filter(item => item.grupo === grupo).map(item => (
                      <option key={`${grupo}|${item.codigo}|${item.conta}`} value={item.codigo}>
                        {item.conta} ({item.codigo})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              <span style={rotulo}>Percentual (%) *</span>
              <input
                type="text"
                inputMode="decimal"
                value={percentualTexto}
                onChange={evento => setPercentualTexto(evento.target.value)}
                placeholder="Ex.: 1,65"
                style={campo}
              />
            </label>
            <label>
              <span style={rotulo}>Ordem</span>
              <input
                type="number"
                value={editando.ordem}
                onChange={evento => setEditando({ ...editando, ordem: Number(evento.target.value) || 0 })}
                style={campo}
                title="Regras com ordem menor são calculadas antes (uma regra pode usar o resultado de outra)."
              />
            </label>
          </div>

          <span style={rotulo}>Base do cálculo *</span>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', fontSize: '13px', color: COR.azul }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="radio" checked={editando.tipoBase === 'Grupo'} onChange={() => trocarTipoBase('Grupo')} />
              Grupos inteiros
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="radio" checked={editando.tipoBase === 'Contas'} onChange={() => trocarTipoBase('Contas')} />
              Contas específicas
            </label>
          </div>

          {editando.tipoBase === 'Grupo' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px', marginBottom: '14px' }}>
              {GRUPOS_ORCAMENTO.map(grupo => (
                <label key={grupo} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: COR.azul, padding: '6px 8px', border: `1px solid ${editando.base.indexOf(grupo) >= 0 ? COR.ciano : COR.borda}`, borderRadius: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editando.base.indexOf(grupo) >= 0} onChange={() => alternarBase(grupo)} />
                  {grupo}
                </label>
              ))}
            </div>
          ) : (
            <div style={{ marginBottom: '14px' }}>
              <input
                type="search"
                placeholder="Buscar conta para a base..."
                value={buscaConta}
                onChange={evento => setBuscaConta(evento.target.value)}
                style={{ ...campo, marginBottom: '6px' }}
              />
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: `1px solid ${COR.borda}`, borderRadius: '6px', padding: '4px 8px' }}>
                {contasFiltradas.map(item => (
                  <label key={`${item.grupo}|${item.codigo}|${item.conta}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: COR.azul, padding: '4px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editando.base.indexOf(item.codigo) >= 0}
                      disabled={item.codigo === editando.contaDestino}
                      onChange={() => alternarBase(item.codigo)}
                    />
                    <span>{item.conta} <span style={{ color: COR.texto2, fontSize: '12px' }}>· {item.codigo} · {item.grupo}</span></span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '4px' }}>{editando.base.length} conta(s) selecionada(s)</div>
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
            <button
              type="button"
              onClick={() => { salvar().catch(() => undefined); }}
              disabled={salvando || problemas.length > 0}
              style={botao('principal', salvando || problemas.length > 0)}
            >
              {salvando ? 'Salvando...' : 'Salvar regra'}
            </button>
          </div>
        </div>
      )}

      <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
        {props.regras.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: COR.texto2, fontSize: '13.5px' }}>
            Nenhuma regra cadastrada. Todas as contas são digitadas pelo gestor.
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
              {props.regras.map(regra => (
                <tr key={regra.id} style={{ opacity: regra.ativo ? 1 : 0.65 }}>
                  <td style={{ ...celula, color: COR.texto2 }}>{regra.ordem}</td>
                  <td style={celula}>
                    <div style={{ fontWeight: 600 }}>{regra.contaDestinoNome || nomeConta(regra.contaDestino)}</div>
                    <div style={{ fontSize: '12px', color: COR.texto2 }}>{regra.contaDestino}</div>
                  </td>
                  <td style={celula}>{descreverRegra(regra)}</td>
                  <td style={celula}>
                    {regra.ativo
                      ? <Selo texto="Ativa" cor="#107C10" fundo="#E7F6EC" />
                      : <Selo texto="Desativada" cor="#64748b" fundo="#F1F5F9" />}
                  </td>
                  <td style={{ ...celula, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => abrir(regra)} style={{ ...botao('secundario'), marginRight: '6px' }}>Editar</button>
                    <button type="button" onClick={() => { alternarAtivo(regra).catch(() => undefined); }} style={botao('secundario')}>
                      {regra.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RegrasCalculoView;
