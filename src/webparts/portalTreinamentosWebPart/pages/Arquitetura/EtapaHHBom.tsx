import * as React from 'react';

import { DataverseService } from '../../services/DataverseService';
import { hhParaBom, nomeAreaBom } from '../../services/hh/calculoHH';
import {
  IComplementosHH,
  IIntegracaoHH,
  IManutencaoHH,
  totalIntegracao,
  totalIntegracaoSemBdi,
  totalManutencao
} from '../../services/hh/complementosHH';
import { carregarHHVigente, IVersaoHH } from '../../services/hh/HHService';
import { AREAS_HH, IDadosHH } from '../../services/hh/modeloHH';
import { IResultadoBom } from '../../services/bom/montadorBom';

import { COR, botao, formatarDataHora } from './arquiteturaComum';

// ============================================================
// ETAPA 4 — CÁLCULO DE HH (prévia no B.O.M.)
//
// Usa a versão VIGENTE de cada área (menu Cálculo de HH):
//   HH dos pontos = pontos do kit × HH por ponto/localidade
//   Alocação no projeto = custo total × % Analista / % Suprimentos
// A regra final de composição com o B.O.M. (quais áreas somam, como
// o Suporte entra) será fechada com a terceira planilha.
// ============================================================

const moeda = (v: number): string => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: number, c = 1): string => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: c });

export interface IEtapaHHBomProps {
  dataverseService?: DataverseService;
  resumoKit?: IResultadoBom;
  // Arquitetura: volta para a Seleção de kit. Sem ele, o botão some.
  aoVoltarKit?: () => void;
  // ---- Uso como componente de fluxo (opcionais) ----
  // Pontos quando não há resumoKit (vêm da Seleção de kit do registro).
  pontosInformados?: number;
  resumoKitTexto?: string;
  custoInicial?: number;
  // Custo vem de outro campo do registro (não editável aqui).
  custoFixo?: boolean;
  somenteLeitura?: boolean;
  // Avisa a cada mudança (custo ou HH vigente carregado); o fluxo grava.
  onCalculado?: (custoTotal: number, vigentes: Record<string, { versao: IVersaoHH; dados: IDadosHH }>) => void;
  // ---- Integração e contrato de manutenção (Arquitetura) ----
  // Com onAlterarComplementos (e sem somenteLeitura) as perguntas são
  // editáveis; só com complementos, aparecem para leitura.
  complementos?: IComplementosHH;
  onAlterarComplementos?: (complementos: IComplementosHH) => void;
}

// ------------------------------------------------------------
// Campo numérico pt-BR (1.234,56): guarda o texto enquanto digita.
// ------------------------------------------------------------

const lerNumero = (texto: string): number => {
  const limpo = texto.replace(/[^\d,.-]/g, '');
  const normal = limpo.indexOf(',') >= 0 ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return Math.max(0, Number(normal) || 0);
};

const textoNumero = (v: number, casas: number): string =>
  v ? v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : '';

const CampoNumero: React.FC<{
  valor: number;
  casas?: number;
  rotulo: string;
  prefixo?: string;
  sufixo?: string;
  desabilitado?: boolean;
  aoMudar: (v: number) => void;
}> = ({ valor, casas = 0, rotulo, prefixo, sufixo, desabilitado, aoMudar }) => {
  const [texto, setTexto] = React.useState(textoNumero(valor, casas));
  const [editando, setEditando] = React.useState(false);
  React.useEffect(() => {
    if (!editando) {
      setTexto(textoNumero(valor, casas));
    }
  }, [valor]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
      {prefixo && <span style={{ fontSize: '12.5px', color: COR.texto2 }}>{prefixo}</span>}
      <input
        aria-label={rotulo}
        value={texto}
        disabled={desabilitado}
        inputMode="decimal"
        onFocus={() => setEditando(true)}
        onChange={e => { setTexto(e.target.value); aoMudar(lerNumero(e.target.value)); }}
        onBlur={() => { setEditando(false); setTexto(textoNumero(lerNumero(texto), casas)); }}
        style={{ border: `1px solid ${COR.borda}`, borderRadius: '6px', padding: '7px 10px', fontSize: '14px', width: '130px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: desabilitado ? COR.fundo : '#FFFFFF', color: COR.azul }}
      />
      {sufixo && <span style={{ fontSize: '12.5px', color: COR.texto2 }}>{sufixo}</span>}
    </span>
  );
};

const SimNao: React.FC<{ valor?: boolean; desabilitado?: boolean; rotulo: string; aoMudar: (v: boolean) => void }> = ({ valor, desabilitado, rotulo, aoMudar }) => (
  <div role="radiogroup" aria-label={rotulo} style={{ display: 'inline-flex', background: COR.fundo, border: `1px solid ${COR.borda}`, borderRadius: '8px', padding: '3px', gap: '3px' }}>
    {[{ v: true, t: 'Sim' }, { v: false, t: 'Não' }].map(o => (
      <button
        key={o.t}
        type="button"
        role="radio"
        aria-checked={valor === o.v}
        disabled={desabilitado}
        onClick={() => aoMudar(o.v)}
        style={{
          border: 0, borderRadius: '6px', padding: '5px 16px', fontWeight: 700, fontSize: '13px',
          background: valor === o.v ? COR.azul : 'transparent', color: valor === o.v ? '#FFFFFF' : COR.azul,
          cursor: desabilitado ? 'default' : 'pointer'
        }}
      >
        {o.t}
      </button>
    ))}
  </div>
);

const formatarCustoInicial = (valor?: number): string =>
  valor && valor > 0 ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

const EtapaHHBom: React.FC<IEtapaHHBomProps> = ({
  dataverseService, resumoKit, aoVoltarKit, pontosInformados, resumoKitTexto, custoInicial, custoFixo, somenteLeitura, onCalculado,
  complementos, onAlterarComplementos
}) => {

  const [vigentes, setVigentes] = React.useState<Record<string, { versao: IVersaoHH; dados: IDadosHH }> | undefined>(undefined);
  const [custo, setCusto] = React.useState(formatarCustoInicial(custoInicial));

  React.useEffect(() => {
    carregarHHVigente(dataverseService).then(setVigentes).catch(() => setVigentes({}));
  }, [dataverseService]);

  // Custo vindo de outro campo: acompanha o valor recebido.
  React.useEffect(() => {
    if (custoFixo) {
      setCusto(formatarCustoInicial(custoInicial));
    }
  }, [custoFixo, custoInicial]);

  const pontos = resumoKit ? resumoKit.totais.pontos : (pontosInformados || 0);
  const custoTotal = Number(custo.replace(/\./g, '').replace(',', '.')) || 0;

  // Componente de fluxo: repassa o cálculo (com o HH vigente já lido).
  React.useEffect(() => {
    if (onCalculado && vigentes && !somenteLeitura) {
      onCalculado(custoTotal, vigentes);
    }
  }, [vigentes, custoTotal, pontos]);
  const areas = AREAS_HH.filter(a => vigentes && vigentes[a.chave]);
  const celula: React.CSSProperties = { padding: '9px 12px', borderBottom: `1px solid ${COR.borda}`, fontSize: '14px', color: COR.azul, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const cab: React.CSSProperties = { ...celula, background: COR.azul, color: '#FFFFFF', fontWeight: 600, fontSize: '12.5px', textTransform: 'uppercase' };

  // ---------------- integração e manutenção ----------------

  const editavel = !!onAlterarComplementos && !somenteLeitura;
  const comp: IComplementosHH = complementos || {};
  const integracao = comp.integracao;
  const manutencao = comp.manutencao;

  const mudarIntegracao = (parcial: Partial<IIntegracaoHH>): void => {
    if (!onAlterarComplementos) {
      return;
    }
    const atual: IIntegracaoHH = integracao || { tem: false, horas: 0, valorHora: 0, bdi: 0 };
    onAlterarComplementos({ ...comp, integracao: { ...atual, ...parcial } });
  };

  const mudarManutencao = (parcial: Partial<IManutencaoHH>): void => {
    if (!onAlterarComplementos) {
      return;
    }
    // Nº de pontos começa com os pontos do kit.
    const atual: IManutencaoHH = manutencao || { tem: false, pontos: pontos, valorPonto: 0 };
    onAlterarComplementos({ ...comp, manutencao: { ...atual, ...parcial } });
  };

  const totalInt = totalIntegracao(integracao);
  const totalMan = totalManutencao(manutencao);

  const pergunta = (titulo: string, ajuda: string, valor: boolean | undefined, aoMudar: (v: boolean) => void, colunas: string[], linha: React.ReactNode, rodape?: React.ReactNode): React.ReactElement => (
    <div style={{ border: `1px solid ${COR.borda}`, borderRadius: '12px', padding: '14px 16px', background: valor ? '#FFFFFF' : COR.fundo }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <strong style={{ fontSize: '14.5px', color: COR.azul }}>{titulo}</strong>
          <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '2px' }}>{ajuda}</div>
        </div>
        {editavel
          ? <SimNao valor={valor} rotulo={titulo} aoMudar={aoMudar} />
          : <strong style={{ fontSize: '13.5px', color: valor === undefined ? '#B45309' : COR.azul }}>{valor === undefined ? 'Não respondido' : valor ? 'Sim' : 'Não'}</strong>}
      </div>
      {valor && (
        <div style={{ overflowX: 'auto', marginTop: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
            <thead>
              <tr>{colunas.map(t => <th key={t} style={{ ...cab, fontSize: '11.5px' }}>{t}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{linha}</tr>
            </tbody>
          </table>
          {rodape}
        </div>
      )}
    </div>
  );

  const renderizarComplementos = (): React.ReactElement => (
    <div style={{ marginTop: '18px' }}>
      <h4 style={{ margin: '0 0 10px', color: COR.azul, fontSize: '15px' }}>Integração e manutenção</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '12px' }}>
        {pergunta(
          'Tem integração?',
          'Desenvolvimento de integração com sistemas do cliente ou de terceiros, com a taxa BDI.',
          integracao ? integracao.tem : undefined,
          v => mudarIntegracao({ tem: v }),
          ['Nº de horas', 'Valor HH desenvolvimento', 'Taxa BDI', 'Total'],
          <>
            <td style={celula}><CampoNumero rotulo="Nº de horas" valor={integracao ? integracao.horas : 0} casas={0} sufixo="h" desabilitado={!editavel} aoMudar={v => mudarIntegracao({ horas: v })} /></td>
            <td style={celula}><CampoNumero rotulo="Valor HH desenvolvimento" valor={integracao ? integracao.valorHora : 0} casas={2} prefixo="R$" desabilitado={!editavel} aoMudar={v => mudarIntegracao({ valorHora: v })} /></td>
            <td style={celula}><CampoNumero rotulo="Taxa BDI" valor={integracao ? integracao.bdi : 0} casas={2} sufixo="%" desabilitado={!editavel} aoMudar={v => mudarIntegracao({ bdi: v })} /></td>
            <td style={{ ...celula, fontWeight: 800 }}>{moeda(totalInt)}</td>
          </>,
          <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '6px' }}>
            Total = horas × valor HH × (1 + BDI): {moeda(totalIntegracaoSemBdi(integracao))} + {num(integracao ? integracao.bdi : 0, 2)}% de BDI
          </div>
        )}
        {pergunta(
          'Tem contrato de manutenção?',
          'Manutenção dos pontos instalados.',
          manutencao ? manutencao.tem : undefined,
          v => mudarManutencao({ tem: v }),
          ['Nº de pontos', 'Valor ponto', 'Total'],
          <>
            <td style={celula}><CampoNumero rotulo="Nº de pontos" valor={manutencao ? manutencao.pontos : 0} casas={0} desabilitado={!editavel} aoMudar={v => mudarManutencao({ pontos: v })} /></td>
            <td style={celula}><CampoNumero rotulo="Valor ponto" valor={manutencao ? manutencao.valorPonto : 0} casas={2} prefixo="R$" desabilitado={!editavel} aoMudar={v => mudarManutencao({ valorPonto: v })} /></td>
            <td style={{ ...celula, fontWeight: 800 }}>{moeda(totalMan)}</td>
          </>,
          <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '6px' }}>
            Total = pontos × valor do ponto
            {resumoKit && manutencao && manutencao.pontos !== pontos ? ` · o kit tem ${pontos} ponto(s)` : ''}
          </div>
        )}
      </div>
      {(totalInt > 0 || totalMan > 0) && (
        <div style={{ marginTop: '10px', fontSize: '13.5px', color: COR.azul, textAlign: 'right' }}>
          Integração + manutenção: <strong>{moeda(totalInt + totalMan)}</strong>
        </div>
      )}
      {comp.atualizadoPor && comp.atualizadoEm && (
        <div style={{ marginTop: '6px', fontSize: '12px', color: COR.texto2, textAlign: 'right' }}>
          Respostas salvas por {comp.atualizadoPor} · {formatarDataHora(comp.atualizadoEm)}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '14px', padding: '18px 20px' }}>
      <h3 style={{ margin: '0 0 6px', color: COR.azul }}>Cálculo de HH — prévia</h3>
      <p style={{ fontSize: '13.5px', color: COR.texto2, margin: '0 0 14px', lineHeight: 1.5 }}>
        Valores da versão vigente de cada área (menu <strong>Cálculo de HH</strong>) aplicados a este B.O.M. A regra final de composição
        com o B.O.M. será fechada quando a terceira planilha ficar pronta.
      </p>

      {!resumoKit && resumoKitTexto && (
        <div style={{ fontSize: '13px', color: COR.azul, background: COR.fundo, borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
          Kit deste registro: <strong>{resumoKitTexto}</strong>
        </div>
      )}

      {resumoKit && (
        <div style={{ fontSize: '13px', color: COR.azul, background: COR.fundo, borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
          Kit deste B.O.M.: <strong>{resumoKit.totais.pontos}</strong> ponto(s) · <strong>{resumoKit.totais.camerasVideo}</strong> câmera(s) de vídeo ·{' '}
          <strong>{resumoKit.totais.camerasOcr}</strong> OCR/LPR · <strong>{resumoKit.totais.leitoras}</strong> leitora(s)
        </div>
      )}

      {!vigentes && <div style={{ color: COR.texto2, fontSize: '13.5px' }}>Carregando o HH vigente…</div>}

      {vigentes && areas.length === 0 && (
        <div style={{ color: COR.texto2, fontSize: '13.5px', marginBottom: '12px' }}>
          Nenhuma área com HH publicado ainda (ou sem permissão de leitura nas tabelas de HH). Publique uma versão no menu Cálculo de HH.
        </div>
      )}

      {areas.length > 0 && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: COR.azul, marginBottom: '12px', flexWrap: 'wrap' }}>
            Custo total do projeto (B.O.M), para a alocação de horas:
            <input value={custo} disabled={!!somenteLeitura || !!custoFixo} onChange={e => setCusto(e.target.value)} placeholder="Ex.: 250.000,00" inputMode="decimal" style={{ border: `1px solid ${COR.borda}`, borderRadius: '6px', padding: '7px 10px', fontSize: '14px', width: '160px', textAlign: 'right' }} />
            <span style={{ fontSize: '12.5px', color: COR.texto2 }}>
              {onCalculado ? (custoFixo ? '(vem de outro campo do registro)' : '(gravado com o resultado)') : '(simulação; não é gravado)'}
            </span>
          </label>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
              <thead>
                <tr>
                  {['Área', 'Versão', 'HH por ponto', 'Pontos', 'HH dos pontos', '% fixo', 'Analista de Projetos', 'Suprimentos'].map((t, i) => (
                    <th key={t} style={{ ...cab, textAlign: i < 2 ? 'left' : 'right' }}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {areas.map(a => {
                  const v = (vigentes as Record<string, { versao: IVersaoHH; dados: IDadosHH }>)[a.chave];
                  const r = hhParaBom(a.chave, v.dados, pontos, custoTotal);
                  return (
                    <tr key={a.chave}>
                      <td style={{ ...celula, textAlign: 'left', fontWeight: 700 }}>{nomeAreaBom(a.chave, a.nome)}</td>
                      <td style={{ ...celula, textAlign: 'left', fontSize: '12.5px', color: COR.texto2 }}>v{v.versao.versao} · {v.versao.mesReferencia}</td>
                      <td style={celula}>{moeda(r.hhPorPonto)}</td>
                      <td style={celula}>{pontos}</td>
                      <td style={{ ...celula, fontWeight: 700 }}>{moeda(r.hhPontos)}</td>
                      <td style={celula}>{num(r.pctFixo * 100, 2)}%</td>
                      <td style={celula}>{custoTotal ? `${moeda(r.valorAnalista)} · ${num(r.horasAnalista)} h` : '—'}</td>
                      <td style={celula}>{custoTotal ? `${moeda(r.valorSuprimentos)} · ${num(r.horasSuprimentos)} h` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(complementos || onAlterarComplementos) && renderizarComplementos()}

      {aoVoltarKit && (
        <button type="button" style={{ ...botao('secundario'), marginTop: '14px' }} onClick={aoVoltarKit}>← Ver / ajustar a Seleção de kit</button>
      )}
    </div>
  );
};

export default EtapaHHBom;
