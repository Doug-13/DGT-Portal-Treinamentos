import * as React from 'react';

import {
  GRUPOS_CUSTO,
  GrupoCusto,
  IColaboradorApoio,
  ICustoOperacional,
  ILancamentoHoras,
  TIPOS_CUSTO,
  TipoCusto
} from '../../services/hh/modeloHH';

import { Modal, botao, Aviso } from '../Kits/kitsComum';

import {
  BotaoMini,
  COR,
  EntradaNumero,
  EntradaTexto,
  LinhaIndicador,
  Secao,
  Tabela,
  campo,
  horas,
  moeda,
  novoId,
  numero,
  pct,
  td,
  tdTotal
} from './hhComum';

import { ISecaoHHProps } from './tiposTela';

// ============================================================
// HH — APOIO (Implantação): equipe que lança horas, custos
// operacionais, lançamentos de horas e resumo por projeto.
// ============================================================

const sel = (valor: string, opcoes: string[], aoMudar: (v: string) => void, rotulo: string, largura = '120px'): React.ReactElement => (
  <select aria-label={rotulo} value={valor} onChange={e => aoMudar(e.target.value)} style={{ ...campo, width: largura, minHeight: '32px', padding: '4px 6px', background: COR.cianoClaro }}>
    {opcoes.map(o => <option key={o} value={o}>{o || '—'}</option>)}
  </select>
);

const botaoAdicionar: React.CSSProperties = { border: 0, background: COR.azul, color: COR.branco, borderRadius: '6px', padding: '0 14px', minHeight: '34px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' };

// ------------------------------------------------------------
// Equipe e horas + custos operacionais + indicadores
// ------------------------------------------------------------

export const EquipeApoioHH: React.FC<ISecaoHHProps> = ({ dados, resultado, editavel, mudar }) => {
  const a = resultado.apoio;
  if (!a || !dados.apoio) {
    return null;
  }
  const familias = ['', ...dados.quadroPO.map(f => f.familia)];

  const mudarColab = (codigo: string, parcial: Partial<IColaboradorApoio>): void =>
    mudar(d => ({ ...d, apoio: { ...d.apoio!, colaboradores: d.apoio!.colaboradores.map(c => (c.codigo === codigo ? { ...c, ...parcial } : c)) } }));
  const mudarOp = (id: string, parcial: Partial<ICustoOperacional>): void =>
    mudar(d => ({ ...d, apoio: { ...d.apoio!, custosOperacionais: d.apoio!.custosOperacionais.map(o => (o.id === id ? { ...o, ...parcial } : o)) } }));

  const i = a.indicadores;

  return (
    <div>
      <Secao
        titulo="Equipe que lança horas"
        subtitulo="Códigos no lugar dos nomes (LGPD). Internos: salário médio da família × encargos (+ periculosidade). Terceiros: valor do contrato por modalidade. As horas vêm dos lançamentos."
        acoes={editavel && (
          <button type="button" style={botaoAdicionar} onClick={() => {
            const codigo = window.prompt('Código do colaborador (ex.: Interno 07 ou Terceiro 05):');
            if (codigo && !dados.apoio!.colaboradores.some(c => c.codigo === codigo.trim())) {
              mudar(d => ({ ...d, apoio: { ...d.apoio!, colaboradores: [...d.apoio!.colaboradores, { codigo: codigo.trim(), vinculo: /^terc/i.test(codigo) ? 'Terceiro' : 'Interno', atuacao: '', familia: '', periculosidade: false, modalidade: /^terc/i.test(codigo) ? 'Mensal' : '', valorContrato: 0, incluiHH: true, fracaoMes: 1 }] } }));
            }
          }}>+ Colaborador</button>
        )}
      >
        <Tabela minimo="1700px" colunas={[{ titulo: 'Código' }, { titulo: 'Vínculo' }, { titulo: 'Atuação' }, { titulo: 'Família (interno)' }, { titulo: 'Peric.' }, { titulo: 'Custo interno c/ encargos', direita: true }, { titulo: 'Modalidade (terceiro)' }, { titulo: 'Valor contrato', direita: true }, { titulo: 'Inclui no HH' }, { titulo: 'Fração do mês', direita: true }, { titulo: 'Custo no mês', direita: true }, { titulo: 'Horas lançadas', direita: true }, { titulo: 'Consideradas', direita: true }, { titulo: 'Em projeto', direita: true }, { titulo: 'Internas', direita: true }, { titulo: 'Dias', direita: true }, { titulo: 'h/dia', direita: true }, { titulo: '% projeto', direita: true }]}>
          {a.colaboradores.map(c => {
            const interno = c.vinculo === 'Interno';
            return (
              <tr key={c.codigo} style={{ opacity: c.incluiHH ? 1 : 0.6 }}>
                <td style={td(false, { fontWeight: 600, whiteSpace: 'nowrap' })} title={c.observacao}>{c.codigo}</td>
                <td style={td()}>{editavel ? sel(c.vinculo, ['Interno', 'Terceiro'], v => mudarColab(c.codigo, { vinculo: v as 'Interno' | 'Terceiro' }), 'Vínculo', '100px') : c.vinculo}</td>
                <td style={td()}>{editavel ? <EntradaTexto valor={c.atuacao} largura="150px" rotulo="Atuação" aoMudar={v => mudarColab(c.codigo, { atuacao: v })} /> : c.atuacao}</td>
                <td style={td()}>{interno ? (editavel ? sel(c.familia, familias, v => mudarColab(c.codigo, { familia: v }), 'Família', '190px') : c.familia) : '—'}</td>
                <td style={td()}><input type="checkbox" aria-label="Periculosidade" disabled={!editavel || !interno} checked={c.periculosidade} onChange={e => mudarColab(c.codigo, { periculosidade: e.target.checked })} /></td>
                <td style={td(true)}>{interno ? numero(c.custoInterno, 2) : '—'}</td>
                <td style={td()}>{!interno ? (editavel ? sel(c.modalidade, ['Mensal', 'Hora', 'Diária', ''], v => mudarColab(c.codigo, { modalidade: v as IColaboradorApoio['modalidade'] }), 'Modalidade', '100px') : c.modalidade) : '—'}</td>
                <td style={td(true)}>{!interno ? (editavel ? <EntradaNumero valor={c.valorContrato} largura="100px" rotulo="Valor do contrato" aoMudar={v => mudarColab(c.codigo, { valorContrato: v || 0 })} /> : numero(c.valorContrato, 2)) : '—'}</td>
                <td style={td()}><input type="checkbox" aria-label="Inclui no HH" disabled={!editavel} checked={c.incluiHH} onChange={e => mudarColab(c.codigo, { incluiHH: e.target.checked })} /></td>
                <td style={td(true)}>{editavel ? <EntradaNumero valor={c.fracaoMes} largura="64px" rotulo="Fração do mês" aoMudar={v => mudarColab(c.codigo, { fracaoMes: v || 0 })} /> : numero(c.fracaoMes, 2)}</td>
                <td style={td(true, { fontWeight: 600 })}>{numero(c.custoConsiderado, 2)}</td>
                <td style={td(true)}>{numero(c.horasLancadas, 1)}</td>
                <td style={td(true)}>{numero(c.horasConsideradas, 1)}</td>
                <td style={td(true)}>{numero(c.horasProjeto, 1)}</td>
                <td style={td(true)}>{numero(c.horasInternas, 1)}</td>
                <td style={td(true)}>{numero(c.dias, 0)}</td>
                <td style={td(true)}>{numero(c.mediaDia, 1)}</td>
                <td style={td(true)}>{pct(c.pctProjeto)}</td>
              </tr>
            );
          })}
          <tr>
            <td style={tdTotal()} colSpan={10}>Total</td>
            <td style={tdTotal(true)}>{numero(a.totaisColaboradores.custo, 2)}</td>
            <td style={tdTotal(true)}>{numero(a.totaisColaboradores.lancadas, 1)}</td>
            <td style={tdTotal(true)}>{numero(a.totaisColaboradores.consideradas, 1)}</td>
            <td style={tdTotal(true)}>{numero(a.totaisColaboradores.projeto, 1)}</td>
            <td style={tdTotal(true)}>{numero(a.totaisColaboradores.internas, 1)}</td>
            <td style={tdTotal(true)}>{numero(a.totaisColaboradores.dias, 0)}</td>
            <td style={tdTotal()} />
            <td style={tdTotal(true)}>{pct(a.totaisColaboradores.pctProjeto)}</td>
          </tr>
        </Tabela>
        {a.colaboradores.some(c => c.vinculo === 'Terceiro' && c.incluiHH && !c.valorContrato) && (
          <div style={{ marginTop: '10px', fontSize: '13px', color: COR.indigo, fontWeight: 600 }}>! Há terceiros sem valor de contrato: o custo deles entra como zero.</div>
        )}
      </Secao>

      <Secao
        titulo="Custos operacionais da equipe"
        subtitulo='Itens de "1° mês" são diluídos pelos meses da premissa; anuais ÷ 12. Entram no custo mensal da área pelo grupo.'
        acoes={editavel && (
          <button type="button" style={botaoAdicionar} onClick={() => mudar(d => ({ ...d, apoio: { ...d.apoio!, custosOperacionais: [...d.apoio!.custosOperacionais, { id: novoId('o'), item: 'Novo item', grupo: 'Despesas gerais', tipo: 'Recorrente', valor: 0, quantidade: 1 }] } }))}>+ Item</button>
        )}
      >
        <Tabela minimo="1100px" colunas={[{ titulo: 'Item', largura: '220px' }, { titulo: 'Grupo' }, { titulo: 'Tipo de custo' }, { titulo: 'Valor referência', direita: true }, { titulo: 'Qtd.', direita: true }, { titulo: '1º mês', direita: true }, { titulo: 'Anual', direita: true }, { titulo: 'Recorrente', direita: true }, { titulo: 'Mensal equivalente', direita: true }, { titulo: '' }]}>
          {a.operacionais.map(o => {
            const orig = dados.apoio!.custosOperacionais.filter(x => x.id === o.id)[0];
            return (
              <tr key={o.id}>
                <td style={td()}>
                  {editavel ? <EntradaTexto valor={o.item} rotulo="Item" aoMudar={v => mudarOp(o.id, { item: v })} /> : o.item}
                  {orig && orig.observacao && <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '2px' }}>{orig.observacao}</div>}
                </td>
                <td style={td()}>{editavel ? sel(o.grupo, GRUPOS_CUSTO, v => mudarOp(o.id, { grupo: v as GrupoCusto }), 'Grupo', '140px') : o.grupo}</td>
                <td style={td()}>{editavel ? sel(o.tipo, TIPOS_CUSTO, v => mudarOp(o.id, { tipo: v as TipoCusto }), 'Tipo', '120px') : o.tipo}</td>
                <td style={td(true)}>{editavel ? <EntradaNumero valor={o.valor} largura="100px" rotulo="Valor" aoMudar={v => mudarOp(o.id, { valor: v || 0 })} /> : numero(o.valor, 2)}</td>
                <td style={td(true)}>{editavel ? <EntradaNumero valor={o.quantidade} largura="60px" rotulo="Quantidade" aoMudar={v => mudarOp(o.id, { quantidade: v || 0 })} /> : numero(o.quantidade)}</td>
                <td style={td(true)}>{numero(o.primeiroMes, 2)}</td>
                <td style={td(true)}>{numero(o.anual, 2)}</td>
                <td style={td(true)}>{numero(o.recorrente, 2)}</td>
                <td style={td(true, { fontWeight: 600 })}>{numero(o.mensalEquivalente, 2)}</td>
                <td style={td(true)}>{editavel && <BotaoMini titulo="Remover item" aoClicar={() => mudar(d => ({ ...d, apoio: { ...d.apoio!, custosOperacionais: d.apoio!.custosOperacionais.filter(x => x.id !== o.id) } }))}>✕</BotaoMini>}</td>
              </tr>
            );
          })}
          <tr>
            <td style={tdTotal()} colSpan={5}>Total</td>
            <td style={tdTotal(true)}>{numero(a.totaisOperacionais.primeiroMes, 2)}</td>
            <td style={tdTotal(true)}>{numero(a.totaisOperacionais.anual, 2)}</td>
            <td style={tdTotal(true)}>{numero(a.totaisOperacionais.recorrente, 2)}</td>
            <td style={tdTotal(true)}>{numero(a.totaisOperacionais.mensalEquivalente, 2)}</td>
            <td style={tdTotal()} />
          </tr>
        </Tabela>
      </Secao>

      <Secao titulo={`Indicadores da equipe (${dados.premissas.mesReferencia})`}>
        <Tabela colunas={[{ titulo: 'Indicador' }, { titulo: 'Valor', direita: true, largura: '170px' }, { titulo: 'Como é calculado' }]}>
          <LinhaIndicador rotulo="Custo mensal dos internos (R$)" valor={moeda(i.custoInternos)} como="Salário médio da família × encargos (+ periculosidade)." />
          <LinhaIndicador rotulo="Custo mensal dos terceiros (R$)" valor={moeda(i.custoTerceiros)} como="Valor dos contratos." />
          <LinhaIndicador rotulo="Custo operacional mensal equivalente (R$)" valor={moeda(i.custoOperacional)} como="Veículos, equipamentos e viagens." />
          <LinhaIndicador rotulo="Custo mensal total da equipe (R$)" valor={moeda(i.custoTotalEquipe)} />
          <LinhaIndicador rotulo="Internos considerados (soma da fração do mês)" valor={numero(i.internosConsiderados, 2)} />
          <LinhaIndicador rotulo="Horas disponíveis dos internos" valor={horas(i.horasDisponiveisInternos)} como="Internos × dias úteis × jornada." />
          <LinhaIndicador rotulo="Horas consideradas" valor={horas(i.horasConsideradas)} como="Internos rateados na jornada + terceiros pelas horas lançadas." />
          <LinhaIndicador rotulo="Horas em projeto" valor={horas(i.horasProjeto)} como="Horas consideradas lançadas com ID de projeto." />
          <LinhaIndicador recuo rotulo="• dos internos" valor={horas(i.horasProjetoInternos)} />
          <LinhaIndicador recuo rotulo="• dos terceiros" valor={horas(i.horasProjetoTerceiros)} />
          <LinhaIndicador rotulo="Horas internas (sem projeto)" valor={horas(i.horasInternas)} como="Gestão, treinamento, reuniões e demais atividades." />
          <LinhaIndicador rotulo="% das horas em projeto (produtividade medida)" valor={pct(i.pctProjeto)} como={`Comparável à premissa de produtividade (${pct(dados.premissas.produtividade, 0)}).`} />
          <LinhaIndicador destaque rotulo="HH EFETIVO da equipe (R$/h)" valor={moeda(i.hhEfetivo)} como="Custo mensal total da equipe ÷ horas em projeto." />
          <LinhaIndicador recuo rotulo="• HH dos internos (R$/h)" valor={moeda(i.hhInternos)} como="Custo dos internos ÷ horas de projeto dos internos." />
          <LinhaIndicador recuo rotulo="• HH dos terceiros (R$/h)" valor={moeda(i.hhTerceiros)} como="Custo dos terceiros ÷ horas de projeto dos terceiros." />
          <LinhaIndicador recuo rotulo="• Custo operacional por hora em projeto (R$/h)" valor={moeda(i.custoOperacionalHora)} como="Custo operacional ÷ horas em projeto." />
        </Tabela>
      </Secao>
    </div>
  );
};

// ------------------------------------------------------------
// Lançamentos de horas
// ------------------------------------------------------------

// Lê linhas coladas do Excel (separadas por tabulação):
// Colaborador | Data | Projeto | Atividade | Início | Fim | [Considerar] | [Observação]
export const lerLancamentosColados = (texto: string): { lancamentos: ILancamentoHoras[]; erros: string[] } => {
  const lancamentos: ILancamentoHoras[] = [];
  const erros: string[] = [];
  const data = (v: string): string => {
    const t = v.trim();
    let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t);
    if (m) {
      const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${ano}-${('0' + m[2]).slice(-2)}-${('0' + m[1]).slice(-2)}`;
    }
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  };
  const hora = (v: string): string => {
    const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(v.trim());
    return m ? `${('0' + m[1]).slice(-2)}:${m[2]}${m[3] && m[3] !== '00' ? ':' + m[3] : ''}` : '';
  };
  texto.split(/\r?\n/).forEach((linha, i) => {
    if (!linha.trim()) {
      return;
    }
    const c = linha.split('\t');
    if (i === 0 && /colaborador/i.test(c[0])) {
      return;
    }
    const registro: ILancamentoHoras = {
      colaborador: (c[0] || '').trim(),
      data: data(c[1] || ''),
      projeto: (c[2] || '').trim(),
      atividade: (c[3] || '').trim(),
      inicio: hora(c[4] || ''),
      fim: hora(c[5] || ''),
      considerar: c[6] === undefined || c[6].trim() === '' ? true : /^(sim|s|1|true)$/i.test(c[6].trim()),
      observacao: (c[7] || '').trim()
    };
    if (!registro.colaborador || !registro.data || !registro.inicio || !registro.fim) {
      erros.push(`Linha ${i + 1}: colaborador, data, início e fim são obrigatórios.`);
      return;
    }
    lancamentos.push(registro);
  });
  return { lancamentos, erros };
};

const ImportarLancamentos: React.FC<{ codigos: string[]; aoFechar: () => void; aoImportar: (l: ILancamentoHoras[], substituir: boolean) => void }> = ({ codigos, aoFechar, aoImportar }) => {
  const [texto, setTexto] = React.useState('');
  const [substituir, setSubstituir] = React.useState(true);
  const lido = texto.trim() ? lerLancamentosColados(texto) : { lancamentos: [], erros: [] };
  const desconhecidos = lido.lancamentos.map(l => l.colaborador).filter((c, i, a) => codigos.indexOf(c) < 0 && a.indexOf(c) === i);
  return (
    <Modal
      titulo="Importar lançamentos de horas"
      subtitulo="Copie as linhas da planilha de horas e cole abaixo: Colaborador, Data, Projeto (ID CIGAM ou INTERNO), Atividade, Início, Fim e, opcionalmente, Considerar (Sim/Não) e Observação."
      largura={760}
      aoFechar={aoFechar}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>Cancelar</button>
          <button type="button" style={botao('principal', lido.lancamentos.length === 0)} disabled={lido.lancamentos.length === 0} onClick={() => { aoImportar(lido.lancamentos, substituir); aoFechar(); }}>Importar {lido.lancamentos.length} lançamentos</button>
        </>
      )}
    >
      <textarea aria-label="Lançamentos colados" rows={10} value={texto} onChange={e => setTexto(e.target.value)} placeholder={'Interno 01\t01/09/2026\t10809\tRelatório de instalação\t08:00\t12:00\tSim'} style={{ ...campo, fontFamily: 'Consolas, monospace', fontSize: '12.5px' }} />
      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '13.5px', color: COR.azul }}>
        <label><input type="radio" checked={substituir} onChange={() => setSubstituir(true)} /> Substituir os lançamentos atuais (novo mês)</label>
        <label><input type="radio" checked={!substituir} onChange={() => setSubstituir(false)} /> Acrescentar aos atuais</label>
      </div>
      {lido.erros.length > 0 && <Aviso tipo="alerta">{lido.erros.slice(0, 5).map(e => <div key={e}>{e}</div>)}{lido.erros.length > 5 && <div>… e mais {lido.erros.length - 5}.</div>}</Aviso>}
      {desconhecidos.length > 0 && (
        <Aviso tipo="alerta">
          Colaboradores fora da equipe: {desconhecidos.join(', ')}. Eles entram como internos sem custo. Use códigos (ex.: Interno 07), nunca nomes (LGPD), e cadastre-os em Equipe e horas.
        </Aviso>
      )}
    </Modal>
  );
};

export const LancamentosHH: React.FC<ISecaoHHProps> = ({ dados, resultado, editavel, mudar }) => {
  const a = resultado.apoio;
  const [colab, setColab] = React.useState('');
  const [busca, setBusca] = React.useState('');
  const [importar, setImportar] = React.useState(false);
  const [limite, setLimite] = React.useState(100);
  if (!a || !dados.apoio) {
    return null;
  }
  const termo = busca.trim().toLowerCase();
  const indices = a.lancamentos
    .map((l, i) => ({ l, i }))
    .filter(x => (!colab || x.l.colaborador === colab) && (!termo || `${x.l.projeto} ${x.l.atividade} ${x.l.data}`.toLowerCase().indexOf(termo) >= 0));
  const codigos = dados.apoio.colaboradores.map(c => c.codigo);

  return (
    <Secao
      titulo={`Lançamentos de horas (${a.lancamentos.length})`}
      subtitulo="Internos: as horas do dia são rateadas para a jornada (horas consideradas). Terceiros: valem as horas lançadas. Desmarque “Considerar” para tirar um lançamento do cálculo (ex.: lançamento de outro mês)."
      acoes={(
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select aria-label="Colaborador" value={colab} onChange={e => setColab(e.target.value)} style={{ ...campo, width: 'auto', minHeight: '34px' }}>
            <option value="">Todos</option>
            {codigos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input aria-label="Buscar" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Projeto, atividade ou data" style={{ ...campo, width: '200px', minHeight: '34px' }} />
          {editavel && <button type="button" style={botaoAdicionar} onClick={() => setImportar(true)}>Importar (colar do Excel)</button>}
        </div>
      )}
    >
      <Tabela minimo="1150px" colunas={[{ titulo: 'Colaborador' }, { titulo: 'Data' }, { titulo: 'Projeto' }, { titulo: 'Atividade' }, { titulo: 'Início' }, { titulo: 'Fim' }, { titulo: 'Horas', direita: true }, { titulo: 'Tipo' }, { titulo: 'Considerar' }, { titulo: 'h no dia', direita: true }, { titulo: 'Consideradas', direita: true }, { titulo: 'Observação' }]}>
        {indices.slice(0, limite).map(({ l, i }) => (
          <tr key={i} style={{ opacity: l.considerar ? 1 : 0.5 }}>
            <td style={td(false, { whiteSpace: 'nowrap' })}>{l.colaborador}</td>
            <td style={td(false, { whiteSpace: 'nowrap' })}>{l.data.split('-').reverse().join('/')}</td>
            <td style={td(false, { color: /^\d+$/.test(l.projeto) || l.tipo === 'Interno' ? COR.azul : COR.indigo, fontWeight: /^\d+$/.test(l.projeto) || l.tipo === 'Interno' ? 400 : 700 })}>{l.projeto}</td>
            <td style={td(false, { fontSize: '13px', maxWidth: '280px' })}>{l.atividade}</td>
            <td style={td()}>{l.inicio}</td>
            <td style={td()}>{l.fim}</td>
            <td style={td(true)}>{numero(l.horas, 2)}</td>
            <td style={td()}>{l.tipo}</td>
            <td style={td()}>
              <input type="checkbox" aria-label="Considerar" disabled={!editavel} checked={l.considerar} onChange={e => mudar(d => ({ ...d, apoio: { ...d.apoio!, lancamentos: d.apoio!.lancamentos.map((x, j) => (j === i ? { ...x, considerar: e.target.checked } : x)) } }))} />
            </td>
            <td style={td(true)}>{numero(l.horasDia, 2)}</td>
            <td style={td(true, { fontWeight: 600 })}>{numero(l.horasConsideradas, 2)}</td>
            <td style={td(false, { fontSize: '12.5px', color: COR.texto2 })}>{l.observacao}</td>
          </tr>
        ))}
      </Tabela>
      {indices.length > limite && (
        <button type="button" onClick={() => setLimite(limite + 200)} style={{ ...botao('secundario'), marginTop: '10px' }}>Mostrar mais ({indices.length - limite} restantes)</button>
      )}
      {importar && (
        <ImportarLancamentos
          codigos={codigos}
          aoFechar={() => setImportar(false)}
          aoImportar={(novos, substituir) => mudar(d => ({ ...d, apoio: { ...d.apoio!, lancamentos: substituir ? novos : [...d.apoio!.lancamentos, ...novos] } }))}
        />
      )}
    </Secao>
  );
};

// ------------------------------------------------------------
// Resumo por projeto
// ------------------------------------------------------------

export const ProjetosHH: React.FC<ISecaoHHProps> = ({ dados, resultado, editavel, mudar }) => {
  const a = resultado.apoio;
  if (!a || !dados.apoio) {
    return null;
  }
  const mudarProjeto = (projeto: string, parcial: { descricao?: string; valorBom?: number }): void =>
    mudar(d => {
      const existe = d.apoio!.projetos.some(p => p.projeto === projeto);
      const projetos = existe
        ? d.apoio!.projetos.map(p => (p.projeto === projeto ? { ...p, ...parcial } : p))
        : [...d.apoio!.projetos, { projeto, descricao: '', valorBom: 0, ...parcial }];
      return { ...d, apoio: { ...d.apoio!, projetos } };
    });
  const t = a.totaisProjetos;

  return (
    <Secao
      titulo={`Resumo por projeto (${dados.premissas.mesReferencia})`}
      subtitulo={`Horas consideradas por projeto × HH efetivo da equipe (${moeda(a.indicadores.hhEfetivo)}/h). Preencha o valor do B.O.M para comparar com a cobertura de ${pct(dados.premissas.pctAnalista, 0)}. Horas "INTERNO" ficam nas horas internas da equipe; IDs inválidos ("SEM ID", "??") devem ser corrigidos na origem.`}
    >
      <Tabela minimo="1200px" colunas={[{ titulo: 'Projeto (ID CIGAM)' }, { titulo: 'Descrição', largura: '260px' }, { titulo: 'Horas no mês', direita: true }, { titulo: 'Pessoas', direita: true }, { titulo: 'Custo no mês', direita: true }, { titulo: '% das horas', direita: true }, { titulo: 'Valor do B.O.M', direita: true }, { titulo: `Coberto pelos ${pct(dados.premissas.pctAnalista, 0)}`, direita: true }, { titulo: 'Saldo', direita: true }, { titulo: '% real HH/B.O.M', direita: true }]}>
        {a.projetos.map(p => (
          <tr key={p.projeto}>
            <td style={td(false, { fontWeight: 600, color: /^\d+$/.test(p.projeto) ? COR.azul : COR.indigo })}>{p.projeto}</td>
            <td style={td()}>{editavel ? <EntradaTexto valor={p.descricao} rotulo="Descrição" aoMudar={v => mudarProjeto(p.projeto, { descricao: v })} /> : p.descricao}</td>
            <td style={td(true)}>{numero(p.horas, 2)}</td>
            <td style={td(true)}>{numero(p.pessoas, 0)}</td>
            <td style={td(true)}>{numero(p.custo, 2)}</td>
            <td style={td(true)}>{pct(p.pctHoras)}</td>
            <td style={td(true)}>{editavel ? <EntradaNumero valor={p.valorBom} largura="110px" rotulo="Valor do B.O.M" aoMudar={v => mudarProjeto(p.projeto, { valorBom: v || 0 })} /> : numero(p.valorBom, 2)}</td>
            <td style={td(true)}>{p.valorBom ? numero(p.coberto, 2) : '—'}</td>
            <td style={td(true, { color: p.valorBom && p.saldo < 0 ? COR.indigo : COR.azul, fontWeight: p.valorBom && p.saldo < 0 ? 700 : 400 })}>{p.valorBom ? `${p.saldo < 0 ? '! ' : ''}${numero(p.saldo, 2)}` : '—'}</td>
            <td style={td(true)}>{p.valorBom ? pct(p.pctReal) : '—'}</td>
          </tr>
        ))}
        <tr>
          <td style={tdTotal()} colSpan={2}>Total</td>
          <td style={tdTotal(true)}>{numero(t.horas, 2)}</td>
          <td style={tdTotal()} />
          <td style={tdTotal(true)}>{numero(t.custo, 2)}</td>
          <td style={tdTotal(true)}>{pct(t.pctHoras)}</td>
          <td style={tdTotal(true)}>{numero(t.valorBom, 2)}</td>
          <td style={tdTotal(true)}>{numero(t.coberto, 2)}</td>
          <td style={tdTotal(true)}>{numero(t.saldo, 2)}</td>
          <td style={tdTotal(true)}>{t.valorBom ? pct(t.pctReal) : '—'}</td>
        </tr>
      </Tabela>
    </Secao>
  );
};
