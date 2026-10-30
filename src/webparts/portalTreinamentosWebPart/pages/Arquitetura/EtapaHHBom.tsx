import * as React from 'react';

import { DataverseService } from '../../services/DataverseService';
import { hhParaBom } from '../../services/hh/calculoHH';
import { carregarHHVigente, IVersaoHH } from '../../services/hh/HHService';
import { AREAS_HH, IDadosHH } from '../../services/hh/modeloHH';
import { IResultadoBom } from '../../services/bom/montadorBom';

import { COR, botao } from './arquiteturaComum';

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

const EtapaHHBom: React.FC<{
  dataverseService?: DataverseService;
  resumoKit?: IResultadoBom;
  aoVoltarKit: () => void;
}> = ({ dataverseService, resumoKit, aoVoltarKit }) => {

  const [vigentes, setVigentes] = React.useState<Record<string, { versao: IVersaoHH; dados: IDadosHH }> | undefined>(undefined);
  const [custo, setCusto] = React.useState('');

  React.useEffect(() => {
    carregarHHVigente(dataverseService).then(setVigentes).catch(() => setVigentes({}));
  }, [dataverseService]);

  const pontos = resumoKit ? resumoKit.totais.pontos : 0;
  const custoTotal = Number(custo.replace(/\./g, '').replace(',', '.')) || 0;
  const areas = AREAS_HH.filter(a => vigentes && vigentes[a.chave]);
  const celula: React.CSSProperties = { padding: '9px 12px', borderBottom: `1px solid ${COR.borda}`, fontSize: '14px', color: COR.azul, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const cab: React.CSSProperties = { ...celula, background: COR.azul, color: '#FFFFFF', fontWeight: 600, fontSize: '12.5px', textTransform: 'uppercase' };

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '14px', padding: '18px 20px' }}>
      <h3 style={{ margin: '0 0 6px', color: COR.azul }}>Cálculo de HH — prévia</h3>
      <p style={{ fontSize: '13.5px', color: COR.texto2, margin: '0 0 14px', lineHeight: 1.5 }}>
        Valores da versão vigente de cada área (menu <strong>Cálculo de HH</strong>) aplicados a este B.O.M. A regra final de composição
        com o B.O.M. será fechada quando a terceira planilha ficar pronta.
      </p>

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
            <input value={custo} onChange={e => setCusto(e.target.value)} placeholder="Ex.: 250.000,00" inputMode="decimal" style={{ border: `1px solid ${COR.borda}`, borderRadius: '6px', padding: '7px 10px', fontSize: '14px', width: '160px', textAlign: 'right' }} />
            <span style={{ fontSize: '12.5px', color: COR.texto2 }}>(simulação; não é gravado)</span>
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
                      <td style={{ ...celula, textAlign: 'left', fontWeight: 700 }}>{a.nome}</td>
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

      <button type="button" style={{ ...botao('secundario'), marginTop: '14px' }} onClick={aoVoltarKit}>← Ver / ajustar a Seleção de kit</button>
    </div>
  );
};

export default EtapaHHBom;
