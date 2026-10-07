import * as React from 'react';

import {
  PerfilAcesso
} from '../../services/AutorizacaoService';

import {
  ChaveModuloPortal,
  MODULOS_PORTAL,
  moduloLiberado as moduloLiberadoPara
} from '../../utils/modulosPortal';

import {
  calcularRegrasAcesso,
  ehPapelEditor,
  ehPapelGestor
} from '../../utils/regrasAcesso';

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

  const regras =
    calcularRegrasAcesso(perfil, vinculos, modulos);

  const admin = regras.admin;

  const gestorEm =
    vinculos.filter(item => ehPapelGestor(item.perfil)).map(item => item.areaNome);

  const editorEm =
    vinculos.filter(item => ehPapelEditor(item.perfil)).map(item => item.areaNome);

  const membroEm =
    vinculos.filter(item => item.perfil === 'Membro').map(item => item.areaNome);

  const moduloLiberado = (chave: ChaveModuloPortal): boolean =>
    moduloLiberadoPara(perfil, modulos, chave);

  const nomesEscopo =
    regras.escopoAreas === undefined
      ? 'todas as áreas'
      : gestorEm.concat(editorEm).filter((nome, i, lista) => lista.indexOf(nome) === i).join(', ') || '—';

  const modulosConteudo =
    [
      regras.podeGerenciarTreinamentos ? 'Treinamentos' : '',
      regras.podeGerenciarDocumentos ? 'Documentos' : '',
      regras.podeGerenciarProcessos ? 'Processos' : '',
      regras.podeGerenciarDashboards ? 'Dashboards de Indicadores' : ''
    ].filter(Boolean);

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
          <Linha ok={regras.podeVerEquipe} titulo="Acompanhar equipe e atribuir treinamentos" detalhe={regras.podeVerEquipe ? `Em: ${nomesEscopo}` : undefined} />
          <Linha ok={regras.podeAprovarDocumentos} titulo="Aprovar documentos" detalhe={regras.podeAprovarDocumentos ? (admin || perfil === 'Gestor' ? 'Todas as áreas' : `Áreas em que é Gestor: ${gestorEm.join(', ')}`) : undefined} />
          <Linha ok={modulosConteudo.length > 0} titulo="Criar e manter conteúdo" detalhe={modulosConteudo.length > 0 ? `Módulos: ${modulosConteudo.join(', ')}` : (regras.editor ? 'Nenhum módulo de conteúdo liberado' : undefined)} />
          <Linha ok={regras.podeGerenciarUsuarios} titulo="Cadastrar usuários e alterar acessos" />
          <Linha ok={admin} titulo="Administrar o portal (perfis, módulos, áreas, permissões)" />
        </ul>
      </div>
    </div>
  );
};

export default ResumoAcessoEfetivo;
