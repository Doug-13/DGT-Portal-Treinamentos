import * as React from 'react';

import {
  EVENTO_TESTE,
  IAviso,
  IPreferenciasAvisos,
  PREFERENCIAS_PADRAO,
  ROTULO_TIPO_AVISO,
  TipoAviso,
  gravarPreferencias,
  lerHistorico,
  lerPreferencias,
  limparHistorico
} from '../../services/notificacoes/preferenciasNotificacoes';

// ============================================================
// MEU PERFIL → AVISOS
//
// O usuário escolhe quais avisos aparecem no canto da tela, onde,
// por quanto tempo, com ou sem som e de quanto em quanto tempo o
// portal procura novidades. Fica gravado NESTE navegador.
// ============================================================

export interface IPreferenciasAvisosProps {
  email: string;
}

const COR_AZUL = '#202A44';
const COR_TEXTO_2 = '#64748B';
const COR_BORDA = '#E5E7EB';

const TIPOS: TipoAviso[] = ['fluxo', 'treinamentos', 'orcamento', 'licitacoes'];

const dataHora = (valor: string): string => {
  const data = new Date(valor);
  if (isNaN(data.getTime())) {
    return '';
  }
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const PreferenciasAvisos: React.FC<IPreferenciasAvisosProps> = ({ email }) => {

  const [preferencias, setPreferencias] = React.useState<IPreferenciasAvisos>(() => lerPreferencias(email));
  const [historico, setHistorico] = React.useState<IAviso[]>(() => lerHistorico(email));
  const [salvo, setSalvo] = React.useState(false);

  React.useEffect(() => {
    setPreferencias(lerPreferencias(email));
    setHistorico(lerHistorico(email));
  }, [email]);

  const alterar = (parcial: Partial<IPreferenciasAvisos>): void => {
    const novas = { ...preferencias, ...parcial, tipos: { ...preferencias.tipos, ...(parcial.tipos || {}) } };
    setPreferencias(novas);
    gravarPreferencias(email, novas);
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 1800);
  };

  const campo: React.CSSProperties = {
    padding: '7px 10px',
    border: `1px solid ${COR_BORDA}`,
    borderRadius: '6px',
    fontSize: '13px',
    color: COR_AZUL,
    background: '#FFFFFF',
    fontFamily: 'inherit'
  };

  const rotulo: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 700, color: COR_TEXTO_2, marginBottom: '4px' };

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${COR_BORDA}`, borderRadius: '10px', padding: '14px 16px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: COR_AZUL, cursor: 'pointer' }}>
          <input type="checkbox" checked={preferencias.ativo} onChange={evento => alterar({ ativo: evento.target.checked })} />
          Mostrar avisos no canto da tela
        </label>
        <div style={{ flex: 1 }} />
        {salvo && <span style={{ fontSize: '12px', color: '#107C10', fontWeight: 700 }}>✓ Salvo</span>}
        <button
          type="button"
          disabled={!preferencias.ativo}
          onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_TESTE))}
          style={{ ...campo, cursor: preferencias.ativo ? 'pointer' : 'not-allowed', fontWeight: 700, opacity: preferencias.ativo ? 1 : 0.5 }}
        >
          Testar aviso
        </button>
      </div>

      <div style={{ opacity: preferencias.ativo ? 1 : 0.5, pointerEvents: preferencias.ativo ? 'auto' : 'none' }}>
        <span style={rotulo}>Avisar quando houver</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '6px', marginBottom: '12px' }}>
          {TIPOS.map(tipo => (
            <label
              key={tipo}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                fontSize: '13px',
                color: COR_AZUL,
                padding: '7px 9px',
                borderRadius: '8px',
                border: `1px solid ${preferencias.tipos[tipo] ? '#05C3DD' : COR_BORDA}`,
                background: preferencias.tipos[tipo] ? '#F0FCFE' : '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <input type="checkbox" checked={preferencias.tipos[tipo]} onChange={evento => alterar({ tipos: { [tipo]: evento.target.checked } as IPreferenciasAvisos['tipos'] })} />
              {ROTULO_TIPO_AVISO[tipo]}
            </label>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '6px' }}>
          <label>
            <span style={rotulo}>Posição</span>
            <select value={preferencias.posicao} onChange={evento => alterar({ posicao: evento.target.value as IPreferenciasAvisos['posicao'] })} style={{ ...campo, width: '100%' }}>
              <option value="inferiorDireito">Canto inferior direito</option>
              <option value="superiorDireito">Canto superior direito</option>
            </select>
          </label>
          <label>
            <span style={rotulo}>Tempo na tela</span>
            <select value={String(preferencias.duracaoSegundos)} onChange={evento => alterar({ duracaoSegundos: Number(evento.target.value) })} style={{ ...campo, width: '100%' }}>
              <option value="6">6 segundos</option>
              <option value="12">12 segundos</option>
              <option value="30">30 segundos</option>
              <option value="0">Até eu fechar</option>
            </select>
          </label>
          <label>
            <span style={rotulo}>Procurar novidades a cada</span>
            <select value={String(preferencias.intervaloMinutos)} onChange={evento => alterar({ intervaloMinutos: Number(evento.target.value) })} style={{ ...campo, width: '100%' }}>
              <option value="1">1 minuto</option>
              <option value="2">2 minutos</option>
              <option value="5">5 minutos</option>
              <option value="10">10 minutos</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', fontSize: '13px', color: COR_AZUL, cursor: 'pointer', paddingBottom: '8px' }}>
            <input type="checkbox" checked={preferencias.som} onChange={evento => alterar({ som: evento.target.checked })} />
            Tocar um som
          </label>
        </div>

        <div style={{ fontSize: '11.5px', color: COR_TEXTO_2, marginBottom: '12px' }}>
          As preferências ficam gravadas neste navegador. Em outro computador, o padrão é: todos os avisos, canto inferior direito, 12 segundos, sem som.{' '}
          <button
            type="button"
            onClick={() => alterar({ ...PREFERENCIAS_PADRAO })}
            style={{ border: 0, background: 'transparent', color: '#0F6CBD', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '11.5px', fontFamily: 'inherit' }}
          >
            Voltar ao padrão
          </button>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${COR_BORDA}`, paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ ...rotulo, marginBottom: 0, flex: 1 }}>Últimos avisos</span>
          {historico.length > 0 && (
            <button
              type="button"
              onClick={() => { limparHistorico(email); setHistorico([]); }}
              style={{ border: 0, background: 'transparent', color: COR_TEXTO_2, cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}
            >
              Limpar
            </button>
          )}
        </div>
        {historico.length === 0 ? (
          <div style={{ fontSize: '12.5px', color: COR_TEXTO_2 }}>Nenhum aviso ainda.</div>
        ) : (
          historico.map(aviso => (
            <div key={`${aviso.id}-${aviso.data}`} style={{ display: 'flex', gap: '10px', padding: '6px 0', borderTop: `1px solid #F1F5F9`, fontSize: '12.5px' }}>
              <span style={{ minWidth: '92px', color: COR_TEXTO_2 }}>{dataHora(aviso.data)}</span>
              <span style={{ flex: 1, color: COR_AZUL }}>
                <strong>{aviso.titulo}</strong>
                {aviso.detalhe && <span style={{ color: COR_TEXTO_2 }}> · {aviso.detalhe}</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PreferenciasAvisos;
