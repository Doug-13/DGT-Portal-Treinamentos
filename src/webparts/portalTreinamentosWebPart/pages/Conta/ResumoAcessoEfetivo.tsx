import * as React from 'react';

import {
  PerfilAcesso
} from '../../services/AutorizacaoService';

import {
  ChaveModuloPortal,
  MODULOS_PORTAL
} from '../../utils/modulosPortal';

// ============================================================
// RESUMO DO ACESSO EFETIVO
//
// Combina perfil do portal + papéis por área + módulos e mostra,
// em linguagem simples, o que a pessoa consegue fazer. Usado na
// tela "Usuários e acessos" e em "Meu perfil".
// ============================================================

export interface IVinculoResumo {
  areaId: string;
  areaNome: string;
  perfil: string;
}

export interface IResumoAcessoEfetivoProps {
  perfil: PerfilAcesso;
  vinculos: IVinculoResumo[];
  modulos?: ChaveModuloPortal[];
}

const COR_AZUL = '#202A44';

const Linha: React.FC<{ ok: boolean; titulo: string; detalhe?: string }> = ({ ok, titulo, detalhe }) => (
  <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: 800,
        background: ok ? '#E7F6EC' : '#F1F5F9', color: ok ? '#107C10' : '#94A3B8', border: `1.5px solid ${ok ? '#107C10' : '#CBD5E1'}`
      }}
    >
      {ok ? '✓' : '–'}
    </span>
    <span style={{ fontSize: '13px', color: ok ? COR_AZUL : '#94A3B8' }}>
      <strong style={{ fontWeight: ok ? 700 : 500 }}>{titulo}</strong>
      {detalhe && <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>{detalhe}</span>}
    </span>
  </li>
);

export const ResumoAcessoEfetivo: React.FC<IResumoAcessoEfetivoProps> = ({
  perfil,
  vinculos,
  modulos
}) => {

  const admin = perfil === 'Administrador';

  const gestorEm =
    vinculos.filter(item => item.perfil !== 'Membro').map(item => item.areaNome);

  const membroEm =
    vinculos.filter(item => item.perfil === 'Membro').map(item => item.areaNome);

  const gestaoGlobal = admin || perfil === 'Gestor';
  const gestaoDeArea = gestaoGlobal || gestorEm.length > 0;
  const conteudo = admin || perfil === 'Editor';

  const moduloLiberado = (chave: ChaveModuloPortal): boolean =>
    admin || !modulos || modulos.length === 0 || modulos.indexOf(chave) >= 0;

  const escopo =
    gestaoGlobal ? 'todas as áreas' : gestorEm.join(', ');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '12px 14px' }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Módulos</div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {MODULOS_PORTAL.map(modulo => (
            <Linha key={modulo.chave} ok={moduloLiberado(modulo.chave)} titulo={modulo.nome} />
          ))}
        </ul>
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Pode fazer</div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <Linha ok={true} titulo="Fazer os próprios treinamentos e consultar documentos" detalhe={membroEm.length > 0 ? `Membro em: ${membroEm.join(', ')}` : undefined} />
          <Linha ok={gestaoDeArea} titulo="Acompanhar equipe e atribuir treinamentos" detalhe={gestaoDeArea ? `Em: ${escopo}` : undefined} />
          <Linha ok={gestaoDeArea} titulo="Aprovar documentos" detalhe={gestaoDeArea ? `Áreas em que é Gestor: ${gestorEm.join(', ') || (admin ? 'todas' : '—')}` : undefined} />
          <Linha ok={gestaoDeArea} titulo="Gerenciar usuários e papéis" detalhe={gestaoDeArea ? `Em: ${escopo}` : undefined} />
          <Linha ok={conteudo} titulo="Manter conteúdo (treinamentos, trilhas, avaliações, documentos)" />
          <Linha ok={admin} titulo="Administrar o portal (perfis, módulos, áreas, configurações)" />
        </ul>
      </div>
    </div>
  );
};

export default ResumoAcessoEfetivo;
