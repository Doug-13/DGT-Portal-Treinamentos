import * as React from 'react';

import {
  IContextoAcesso,
  descreverPerfil,
  ehGestorEmAlgumaArea
} from '../../services/AutorizacaoService';

import {
  ResumoAcessoEfetivo
} from './ResumoAcessoEfetivo';

// ============================================================
// MEU PERFIL (menu do nome do usuário, no topo)
// Dados do usuário logado, papéis por área e o que ele acessa.
// ============================================================

export interface IMeuPerfilPageProps {
  contexto?: IContextoAcesso;
  fotoUrl?: string;
  onIrParaUsuarios: () => void;
  onVoltar: () => void;
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#E5E7EB';

const MeuPerfilPage: React.FC<IMeuPerfilPageProps> = ({
  contexto,
  fotoUrl,
  onIrParaUsuarios,
  onVoltar
}) => {

  if (!contexto) {
    return <p style={{ fontSize: '13px' }}>Carregando seu perfil…</p>;
  }

  const vinculos = contexto.vinculosArea || [];

  return (
    <section style={{ fontFamily: "Barlow, Arial, 'Segoe UI', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: COR_AZUL }}>Meu perfil</h1>
        <button type="button" onClick={onVoltar} style={{ background: '#FFFFFF', color: COR_AZUL, border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '6px 14px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>← Voltar</button>
      </div>

      <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap', background: '#FFFFFF', border: `1px solid ${COR_BORDA}`, borderRadius: '12px', padding: '18px 20px', marginBottom: '16px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', background: '#EDF0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 700, color: COR_AZUL, flexShrink: 0 }}>
          {fotoUrl ? <img src={fotoUrl} alt={contexto.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (contexto.nome || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: COR_AZUL }}>{contexto.nome}</div>
          <div style={{ fontSize: '13px', color: '#64748b', overflowWrap: 'anywhere' }}>{contexto.email}</div>
          <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 700, color: '#0F6CBD' }}>{descreverPerfil(contexto)}</div>
        </div>
        {
          ehGestorEmAlgumaArea(contexto) && (
            <button type="button" onClick={onIrParaUsuarios} style={{ background: '#0877c9', color: '#FFFFFF', border: 0, borderRadius: '6px', padding: '8px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              Usuários e acessos →
            </button>
          )
        }
      </div>

      <div style={{ background: '#FFFFFF', border: `1px solid ${COR_BORDA}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: '15px', color: COR_AZUL }}>Minhas áreas</h2>
        {
          vinculos.length === 0
            ? <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Você ainda não está vinculado a nenhuma área. Fale com o gestor da sua área ou com um administrador.</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {vinculos.map(item => (
                    <tr key={item.areaId}>
                      <td style={{ padding: '8px 0', borderBottom: `1px solid ${COR_BORDA}`, fontSize: '13px', fontWeight: 600, color: COR_AZUL }}>{item.areaNome}</td>
                      <td style={{ padding: '8px 0', borderBottom: `1px solid ${COR_BORDA}`, fontSize: '13px', textAlign: 'right' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: item.perfil === 'Membro' ? '#F1F5F9' : '#E8F2FF', color: item.perfil === 'Membro' ? '#334155' : '#0F6CBD' }}>{item.perfil}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: '15px', color: COR_AZUL }}>O que eu acesso</h2>
        <ResumoAcessoEfetivo perfil={contexto.perfil} vinculos={vinculos} modulos={contexto.modulosPermitidos} />
      </div>

      <p style={{ fontSize: '12px', color: '#64748b' }}>
        Precisa de outro acesso? Fale com o gestor da sua área. Perfil no portal e módulos são definidos por um administrador.
      </p>
    </section>
  );
};

export default MeuPerfilPage;
