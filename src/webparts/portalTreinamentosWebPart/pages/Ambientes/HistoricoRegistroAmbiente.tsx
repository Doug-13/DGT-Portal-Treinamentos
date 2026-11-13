import * as React from 'react';

import {
  CategoriaPassoFluxo
} from '../../models/Documento';

import {
  IFluxoHistorico
} from '../../models/Fluxo';

import {
  ESTILO_PASSO_FLUXO,
  IEstiloPasso,
  categoriaDoPasso
} from '../../services/fluxo/categoriaPasso';

// ============================================================
// HISTÓRICO DO REGISTRO DE AMBIENTE — linha do tempo completa
//
// Mesmo visual do "Histórico da tramitação" dos Documentos:
// faixa colorida por tipo de passo, ícone, data, etapa, ação,
// quem executou e o comentário/valores informados.
// Ações administrativas ganham a cor própria (âmbar) e o selo
// "administrativo". Nenhum evento é apagado.
// ============================================================

export interface IHistoricoRegistroAmbienteProps {
  historico: IFluxoHistorico[];
}

const COR_AZUL = '#202A44';

const ESTILO_ADMINISTRATIVO: IEstiloPasso = { cor: '#9A6700', fundo: '#FFF4D6', icone: '⚑', rotulo: 'Administrativo' };
const ESTILO_CANCELAMENTO: IEstiloPasso = { cor: '#64748B', fundo: '#F1F5F9', icone: '⊘', rotulo: 'Cancelamento' };

const CATEGORIAS_LEGENDA: CategoriaPassoFluxo[] = ['inicio', 'aprovado', 'reprovado', 'avanco', 'fim'];

const ehAdministrativo = (passo: IFluxoHistorico): boolean =>
  !!passo.comoAdministrador || passo.acaoChave === 'edicaoAdministrativa';

const ehCancelamento = (passo: IFluxoHistorico): boolean =>
  /cancel/i.test(passo.acaoChave || '');

const estiloDoPasso = (passo: IFluxoHistorico): IEstiloPasso => {
  if (ehCancelamento(passo)) {
    return ESTILO_CANCELAMENTO;
  }
  if (ehAdministrativo(passo)) {
    return ESTILO_ADMINISTRATIVO;
  }
  return ESTILO_PASSO_FLUXO[categoriaDoPasso(passo)] || ESTILO_PASSO_FLUXO.avanco;
};

const formatarDataHora = (valor: string): string => {
  if (!valor) {
    return '-';
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return valor;
  }
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Etiqueta: React.FC<{ estilo: IEstiloPasso }> = ({ estilo }) => (
  <span
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '999px',
      background: estilo.fundo, color: estilo.cor, fontSize: '11px', fontWeight: 700
    }}
  >
    {estilo.icone} {estilo.rotulo}
  </span>
);

const HistoricoRegistroAmbiente: React.FC<IHistoricoRegistroAmbienteProps> = ({ historico }) => {

  // Mais recente primeiro (o motor já grava assim; a ordenação garante).
  const eventos = React.useMemo(
    () => historico.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')),
    [historico]
  );

  return (
    <div>
      <div style={{ color: '#64748B', fontSize: '13px', marginBottom: '14px' }}>
        Todos os eventos do registro, do mais recente para o mais antigo. Nenhum registro é apagado.
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
          {CATEGORIAS_LEGENDA.map(categoria => <Etiqueta key={categoria} estilo={ESTILO_PASSO_FLUXO[categoria]} />)}
          <Etiqueta estilo={ESTILO_ADMINISTRATIVO} />
          <Etiqueta estilo={ESTILO_CANCELAMENTO} />
        </span>
      </div>

      {eventos.length === 0
        ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: '12px' }}>
            Nenhum evento registrado ainda.
          </div>
        )
        : (
          <section aria-label="Histórico do registro" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ background: COR_AZUL, color: '#FFFFFF', padding: '12px 20px', fontSize: '13px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Histórico da tramitação
            </div>
            <ol style={{ listStyle: 'none', margin: 0, padding: '4px 20px 12px' }}>
              {eventos.map(passo => {
                const estilo = estiloDoPasso(passo);
                return (
                  <li
                    key={passo.id}
                    data-historico={passo.id}
                    style={{ padding: '10px 0 10px 12px', borderBottom: '1px solid #E5E7EB', borderLeft: `4px solid ${estilo.cor}`, marginBottom: '2px' }}
                  >
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12.5px', color: COR_AZUL }}>
                      <span
                        title={estilo.rotulo}
                        aria-hidden="true"
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%',
                          background: estilo.fundo, color: estilo.cor, border: `1.5px solid ${estilo.cor}`, fontSize: '11px', fontWeight: 800
                        }}
                      >
                        {estilo.icone}
                      </span>
                      <strong>{formatarDataHora(passo.data)}</strong>
                      <span>{passo.elementoNome}</span>
                      {ehAdministrativo(passo) && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: ESTILO_ADMINISTRATIVO.cor, background: ESTILO_ADMINISTRATIVO.fundo, borderRadius: '5px', padding: '1px 6px' }}>
                          administrativo
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: estilo.cor, marginTop: '2px' }}>
                      {passo.acaoRotulo}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#334155' }}>
                      {passo.sistema
                        ? <>Automático{passo.executadoPorNome && passo.executadoPorNome !== 'Sistema' && <> · ação de <strong>{passo.executadoPorNome}</strong></>}</>
                        : <>Executado por <strong>{passo.executadoPorNome || 'usuário não identificado'}</strong></>}
                    </div>
                    {passo.comentario && (
                      <div
                        style={{
                          marginTop: '6px', padding: '6px 10px', background: '#F2F2F2', borderLeft: '3px solid #05C3DD',
                          borderRadius: '4px', fontSize: '13px', color: COR_AZUL, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                        }}
                      >
                        {passo.comentario}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
    </div>
  );
};

export default HistoricoRegistroAmbiente;
