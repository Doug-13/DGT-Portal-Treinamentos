import * as React from 'react';

import {
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  IConfigAssinatura,
  ISignatarioConfig,
  PROVEDORES_ASSINATURA,
  PapelSignatario,
  configAssinaturaPadrao,
  validarConfigAssinatura
} from '../../services/fluxo/assinaturaFluxo';

// ============================================================
// CONFIGURAÇÃO DA ASSINATURA DIGITAL (tarefa de sistema)
// ============================================================

export interface IEditorAssinaturaProps {
  config?: IConfigAssinatura;
  editavel: boolean;
  nomeTarefa: string;
  metadados: IFluxoMetadado[];
  usuarios: Array<{ id: string; nome: string; email?: string }>;
  onAlterar: (config: IConfigAssinatura) => void;
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO2 = '#64748B';

const entrada: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: '32px', border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px', padding: '4px 8px', fontSize: '13px', color: COR_AZUL, fontFamily: 'inherit'
};

const titulo: React.CSSProperties = {
  fontSize: '11px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: COR_AZUL, margin: '10px 0 4px'
};

const pequeno = (perigo = false): React.CSSProperties => ({
  minHeight: '30px', padding: '0 10px', borderRadius: '6px', border: `1px solid ${perigo ? '#B42318' : COR_BORDA}`,
  background: '#FFFFFF', color: perigo ? '#B42318' : COR_AZUL, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer'
});

const PAPEIS: Array<{ valor: PapelSignatario; nome: string }> = [
  { valor: 'assinar', nome: 'Assina' },
  { valor: 'aprovar', nome: 'Aprova' },
  { valor: 'testemunha', nome: 'Testemunha' }
];

const EditorAssinatura: React.FC<IEditorAssinaturaProps> = ({ config, editavel, nomeTarefa, metadados, usuarios, onAlterar }) => {

  const atual: IConfigAssinatura = config || configAssinaturaPadrao();
  const alterar = (parcial: Partial<IConfigAssinatura>): void => onAlterar({ ...atual, ...parcial });
  const alterarSignatario = (indice: number, parcial: Partial<ISignatarioConfig>): void =>
    alterar({ signatarios: atual.signatarios.map((item, i) => (i === indice ? { ...item, ...parcial } : item)) });

  const camposUsuario = metadados.filter(item => item.tipo === 'usuario');
  const camposSituacao = metadados.filter(item => item.tipo === 'texto' || item.tipo === 'lista');
  const camposLink = metadados.filter(item => item.tipo === 'texto' || item.tipo === 'textoLongo');
  const problemas = validarConfigAssinatura(nomeTarefa || 'Assinatura', atual, metadados);

  return (
    <div style={{ padding: '10px 12px', border: `1px dashed ${COR_BORDA}`, borderRadius: '8px', background: '#FAFBFC', color: COR_AZUL, fontSize: '13px' }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <label>
          <div style={titulo}>Provedor</div>
          <select value={atual.provedor} disabled={!editavel} onChange={e => alterar({ provedor: e.target.value as IConfigAssinatura['provedor'] })} style={entrada}>
            {PROVEDORES_ASSINATURA.map(item => <option key={item.valor} value={item.valor}>{item.nome}</option>)}
          </select>
        </label>
        <label>
          <div style={titulo}>O que é assinado</div>
          <select value={atual.documento} disabled={!editavel} onChange={e => alterar({ documento: e.target.value as IConfigAssinatura['documento'] })} style={entrada}>
            <option value="arquivoRevisao">Arquivo da revisão (documentos)</option>
            <option value="anexosRegistro">PDFs anexados ao registro (ambientes)</option>
          </select>
        </label>
      </div>

      <div style={titulo}>Signatários (usuários do portal)</div>
      {atual.signatarios.map((item, indice) => (
        <div key={indice} style={{ display: 'grid', gridTemplateColumns: '24px 120px minmax(0, 1fr) 120px auto', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
          <strong style={{ textAlign: 'center' }}>{indice + 1}</strong>
          <select aria-label="Origem do signatário" value={item.origem} disabled={!editavel} onChange={e => alterarSignatario(indice, { origem: e.target.value as ISignatarioConfig['origem'], campo: undefined, usuarioId: undefined, usuarioNome: undefined })} style={entrada}>
            <option value="campo">Campo Usuário</option>
            <option value="usuario">Pessoa fixa</option>
          </select>
          {item.origem === 'campo'
            ? (
              <select aria-label="Campo do signatário" value={item.campo || ''} disabled={!editavel} onChange={e => alterarSignatario(indice, { campo: e.target.value })} style={entrada}>
                <option value="">Selecione o campo...</option>
                {camposUsuario.map(campo => <option key={campo.chave} value={campo.chave}>{campo.rotulo}</option>)}
              </select>
            )
            : (
              <select
                aria-label="Pessoa do signatário"
                value={item.usuarioId || ''}
                disabled={!editavel}
                onChange={e => {
                  const usuario = usuarios.find(u => u.id === e.target.value);
                  alterarSignatario(indice, { usuarioId: e.target.value, usuarioNome: usuario ? usuario.nome : undefined });
                }}
                style={entrada}
              >
                <option value="">Selecione a pessoa...</option>
                {usuarios.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            )}
          <select aria-label="Papel" value={item.papel} disabled={!editavel} onChange={e => alterarSignatario(indice, { papel: e.target.value as PapelSignatario })} style={entrada}>
            {PAPEIS.map(papel => <option key={papel.valor} value={papel.valor}>{papel.nome}</option>)}
          </select>
          {editavel ? <button type="button" aria-label="Remover signatário" style={pequeno(true)} onClick={() => alterar({ signatarios: atual.signatarios.filter((_s, i) => i !== indice) })}>✕</button> : <span />}
        </div>
      ))}
      {editavel && (
        <button type="button" style={{ ...pequeno(), marginTop: '6px' }} onClick={() => alterar({ signatarios: atual.signatarios.concat({ origem: camposUsuario.length > 0 ? 'campo' : 'usuario', papel: 'assinar' }) })}>
          + Signatário
        </button>
      )}
      {camposUsuario.length === 0 && (
        <div style={{ fontSize: '11.5px', color: COR_TEXTO2, marginTop: '4px' }}>Para assinar quem foi escolhido no registro, crie um metadado do tipo Usuário.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
          <input type="checkbox" checked={atual.ordemSequencial} disabled={!editavel} onChange={() => alterar({ ordemSequencial: !atual.ordemSequencial })} />
          Assinam um de cada vez, na ordem da lista
        </label>
        <label>
          <div style={titulo}>Prazo (dias)</div>
          <input type="number" min={1} max={90} value={atual.prazoDias} disabled={!editavel} onChange={e => alterar({ prazoDias: Number(e.target.value) || 1 })} style={{ ...entrada, width: '90px' }} />
        </label>
      </div>

      <label>
        <div style={titulo}>Mensagem aos signatários (opcional)</div>
        <textarea value={atual.mensagem || ''} rows={2} disabled={!editavel} onChange={e => alterar({ mensagem: e.target.value })} style={{ ...entrada, resize: 'vertical' }} />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <label>
          <div style={titulo}>Campo da situação (opcional)</div>
          <select value={atual.campoSituacao || ''} disabled={!editavel} onChange={e => alterar({ campoSituacao: e.target.value || undefined })} style={entrada}>
            <option value="">(nenhum: só segue quando assinado)</option>
            {camposSituacao.map(campo => <option key={campo.chave} value={campo.chave}>{campo.rotulo}</option>)}
          </select>
          <span style={{ fontSize: '11.5px', color: COR_TEXTO2 }}>Recebe assinado/recusado/expirado/cancelado; com ele o fluxo segue também na recusa — use uma decisão depois.</span>
        </label>
        <label>
          <div style={titulo}>Campo do link do arquivo assinado (opcional)</div>
          <select value={atual.campoLink || ''} disabled={!editavel} onChange={e => alterar({ campoLink: e.target.value || undefined })} style={entrada}>
            <option value="">(nenhum)</option>
            {camposLink.map(campo => <option key={campo.chave} value={campo.chave}>{campo.rotulo}</option>)}
          </select>
        </label>
      </div>

      {problemas.length > 0 && (
        <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '6px', background: '#FDE7E9', color: '#8A1C14', fontSize: '12.5px' }}>
          {problemas.map(item => <div key={item}>• {item}</div>)}
        </div>
      )}
      <div style={{ fontSize: '11.5px', color: COR_TEXTO2, marginTop: '8px' }}>
        O envio e o retorno são feitos pelo Power Automate (docs/assinatura-digital.md); o token do provedor fica só lá.
      </div>
    </div>
  );
};

export default EditorAssinatura;
