import * as React from 'react';

import EtapaHHBom from '../../../pages/Arquitetura/EtapaHHBom';

import {
  gravarEnvelopeComponente,
  lerEnvelopeComponente
} from '../../../services/fluxo/valorComponente';

import {
  IPropsComponenteNativo
} from './tiposComponente';

import {
  IDadosComponenteHH,
  envelopeDoHH,
  kitDoRegistro,
  lerCusto
} from './calculoHHEnvelope';

// ============================================================
// COMPONENTE NATIVO "Cálculo de HH"
//
// A MESMA tela da etapa 4 da Arquitetura, ligada à Seleção de kit do
// registro (parâmetro campoKit). Grava o resultado e as versões de HH
// usadas. Em modo somente leitura mostra o que foi gravado.
// ============================================================

const ComponenteCalculoHH: React.FC<IPropsComponenteNativo> = (props) => {

  const parametros = props.parametros || {};
  const valores = props.valoresRegistro || {};
  const kit = kitDoRegistro(valores[parametros.campoKit || '']);
  const envelope = lerEnvelopeComponente(props.valor);
  const gravado = envelope && envelope.dados ? envelope.dados as IDadosComponenteHH : undefined;

  const custoFixo = !!parametros.campoCusto;
  const custoInicial = custoFixo ? lerCusto(valores[parametros.campoCusto || '']) : (gravado ? gravado.custoTotal : 0);
  const exigirCusto = parametros.exigirCusto === 'sim';

  // Somente leitura: mostra o que foi GRAVADO (versões de HH da época).
  if (props.somenteLeitura && gravado) {
    return (
      <div style={{ fontSize: '13px', color: '#202A44' }}>
        <div style={{ marginBottom: '6px' }}>
          Kit: <strong>{gravado.kit || `${gravado.pontos} ponto(s)`}</strong>
          {gravado.custoTotal > 0 && <> · custo total R$ {gravado.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ background: '#F7F9FB', textAlign: 'left' }}>
              {['Área', 'Versão de HH', 'HH por ponto', 'HH dos pontos', 'Analista', 'Suprimentos'].map(titulo => <th key={titulo} style={{ padding: '6px 8px' }}>{titulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {gravado.areas.map(area => (
              <tr key={area.area} style={{ borderTop: '1px solid #E5E7EB' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700 }}>{area.nome}</td>
                <td style={{ padding: '6px 8px' }}>v{area.versao} · {area.mesReferencia}</td>
                <td style={{ padding: '6px 8px' }}>R$ {area.hhPorPonto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style={{ padding: '6px 8px', fontWeight: 700 }}>R$ {area.hhPontos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style={{ padding: '6px 8px' }}>{gravado.custoTotal > 0 ? `${area.horasAnalista.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : '—'}</td>
                <td style={{ padding: '6px 8px' }}>{gravado.custoTotal > 0 ? `${area.horasSuprimentos.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!parametros.campoKit) {
    return <div style={{ fontSize: '13px', color: '#B42318' }}>Configure o parâmetro “Campo com a Seleção de kit” deste componente.</div>;
  }

  return (
    <EtapaHHBom
      dataverseService={props.dataverseService}
      pontosInformados={kit.pontos}
      resumoKitTexto={kit.resumo || 'nenhum ponto selecionado ainda'}
      custoInicial={custoInicial}
      custoFixo={custoFixo}
      somenteLeitura={props.somenteLeitura}
      onCalculado={(custoTotal, vigentes) => {
        const novo = gravarEnvelopeComponente(envelopeDoHH(kit, custoTotal, vigentes, exigirCusto));
        // Evita regravar o mesmo resultado (calculadoEm muda a cada vez).
        const atual = lerEnvelopeComponente(props.valor);
        const semData = (texto?: string): string => (texto || '').replace(/"calculadoEm":"[^"]*"/, '');
        if (!atual || semData(JSON.stringify(atual)) !== semData(novo)) {
          props.onAlterar(novo);
        }
      }}
    />
  );
};

export default ComponenteCalculoHH;
