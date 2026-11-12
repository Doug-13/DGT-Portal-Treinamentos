import * as React from 'react';

import {
  FornecedoresService
} from '../../services/fornecedores/FornecedoresService';

import {
  CATEGORIAS_FORNECEDOR,
  ITipoDocumentoFornecedor,
  TIPOS_SUGERIDOS,
  VISIBILIDADES,
  Visibilidade
} from '../../services/fornecedores/modeloFornecedores';

import {
  Aviso,
  COR,
  Interruptor,
  Modal,
  Selo,
  ajuda,
  botao,
  campo,
  celula,
  celulaCabecalho,
  rotulo
} from '../Kits/kitsComum';

// ============================================================
// FORNECEDORES — TIPOS DE DOCUMENTO (Administrador do módulo)
//
// Define o que se exige de cada categoria, se tem validade, a validade
// padrão sugerida e a visibilidade (Interno / Externo). Tipo não é
// apagado: desative para deixar de exigir (os documentos já
// registrados continuam no histórico).
// ============================================================

const novoTipo = (ordem: number): ITipoDocumentoFornecedor => ({
  id: '', nome: '', descricao: '', categorias: [], obrigatorio: false, exigeValidade: true,
  validadeDias: undefined, visibilidade: 'Interno', ordem, ativo: true
});

const EditarTipoModal: React.FC<{
  tipo: ITipoDocumentoFornecedor;
  fechar: () => void;
  salvar: (t: ITipoDocumentoFornecedor) => Promise<void>;
}> = ({ tipo, fechar, salvar }) => {

  const [t, setT] = React.useState<ITipoDocumentoFornecedor>(tipo);
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const mudar = (parcial: Partial<ITipoDocumentoFornecedor>): void => setT(atual => ({ ...atual, ...parcial }));

  const alternarCategoria = (c: string): void => {
    const lista = t.categorias.indexOf(c) >= 0 ? t.categorias.filter(x => x !== c) : t.categorias.concat([c]);
    mudar({ categorias: lista });
  };

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await salvar(t);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo={tipo.id ? 'Editar tipo de documento' : 'Novo tipo de documento'}
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={640}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando || !t.nome.trim())} disabled={gravando || !t.nome.trim()} onClick={() => { confirmar().catch(() => undefined); }}>
            {gravando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      <label style={rotulo} htmlFor="tipo-nome">Nome</label>
      <input id="tipo-nome" style={campo} value={t.nome} onChange={e => mudar({ nome: e.target.value })} />

      <div style={{ marginTop: '10px' }}>
        <label style={rotulo} htmlFor="tipo-desc">Descrição / orientação</label>
        <textarea id="tipo-desc" style={{ ...campo, resize: 'vertical' }} rows={2} value={t.descricao} onChange={e => mudar({ descricao: e.target.value })} />
      </div>

      <div style={{ marginTop: '12px' }}>
        <span style={rotulo}>Categorias</span>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          {CATEGORIAS_FORNECEDOR.map(c => (
            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px' }}>
              <input type="checkbox" checked={t.categorias.indexOf(c) >= 0} onChange={() => alternarCategoria(c)} /> {c}
            </label>
          ))}
        </div>
        <div style={ajuda}>Nenhuma marcada = vale para todas as categorias.</div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '14px' }}>
        <Interruptor marcado={t.obrigatorio} aoMudar={v => mudar({ obrigatorio: v })} texto="Obrigatório" />
        <Interruptor marcado={t.exigeValidade} aoMudar={v => mudar({ exigeValidade: v })} texto="Exige validade" />
        <Interruptor marcado={t.ativo} aoMudar={v => mudar({ ativo: v })} texto="Ativo" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 14px', marginTop: '14px' }}>
        <div>
          <label style={rotulo} htmlFor="tipo-validade">Validade padrão (dias)</label>
          <input id="tipo-validade" style={campo} inputMode="numeric" value={t.validadeDias ? String(t.validadeDias) : ''}
            onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); mudar({ validadeDias: isNaN(n) ? undefined : n }); }} />
          <div style={ajuda}>Só sugere a data; quem registra confere no documento.</div>
        </div>
        <div>
          <label style={rotulo} htmlFor="tipo-visibilidade">Visibilidade</label>
          <select id="tipo-visibilidade" style={campo} value={t.visibilidade} onChange={e => mudar({ visibilidade: e.target.value as Visibilidade })}>
            {VISIBILIDADES.map(v => <option key={v.valor} value={v.valor}>{v.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="tipo-ordem">Ordem</label>
          <input id="tipo-ordem" style={campo} inputMode="numeric" value={String(t.ordem || '')}
            onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); mudar({ ordem: isNaN(n) ? 0 : n }); }} />
        </div>
      </div>
    </Modal>
  );
};

const TiposDocumentoView: React.FC<{
  servico: FornecedoresService;
  tipos: ITipoDocumentoFornecedor[];
  podeEditar: boolean;
  aoAlterar: (aviso: string) => Promise<void>;
}> = ({ servico, tipos, podeEditar, aoAlterar }) => {

  const [editando, setEditando] = React.useState<ITipoDocumentoFornecedor | undefined>(undefined);
  const [importando, setImportando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const faltamSugeridos = TIPOS_SUGERIDOS.filter(s =>
    !tipos.some(t => t.nome.trim().toLowerCase() === s.nome.trim().toLowerCase())).length;

  const importar = async (): Promise<void> => {
    if (!window.confirm(`Criar ${faltamSugeridos} tipo(s) sugerido(s)? Os que já existem (mesmo nome) não são duplicados. Confira validades e obrigatoriedade depois.`)) {
      return;
    }
    setImportando(true);
    setErro('');
    try {
      const n = await servico.importarTiposSugeridos(tipos);
      await aoAlterar(`${n} tipo(s) de documento criado(s). Revise obrigatoriedade e validade de cada um.`);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setImportando(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ flex: 1, minWidth: '240px', fontSize: '13.5px', color: COR.texto2, lineHeight: 1.5 }}>
          O que se exige de cada categoria de fornecedor. As pendências da Visão geral saem daqui.
        </div>
        {podeEditar && faltamSugeridos > 0 && (
          <button type="button" style={botao('secundario', importando)} disabled={importando} onClick={() => { importar().catch(() => undefined); }}>
            {importando ? 'Criando…' : `Criar sugestões (${faltamSugeridos})`}
          </button>
        )}
        {podeEditar && (
          <button type="button" style={botao('principal')} onClick={() => setEditando(novoTipo((tipos.length + 1) * 10))}>+ Novo tipo</button>
        )}
        {!podeEditar && <Selo tom="cinza">somente consulta</Selo>}
      </div>

      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      {tipos.length === 0
        ? <Aviso tipo="info">Nenhum tipo cadastrado.{podeEditar ? ' Use "Criar sugestões" para começar pela Ficha de Cadastramento (RTC) e pelo relatório de due diligence.' : ''}</Aviso>
        : (
          <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
              <thead>
                <tr>
                  <th style={celulaCabecalho}>Documento</th>
                  <th style={celulaCabecalho}>Categorias</th>
                  <th style={celulaCabecalho}>Exigência</th>
                  <th style={celulaCabecalho}>Validade padrão</th>
                  <th style={celulaCabecalho}>Visibilidade</th>
                  {podeEditar && <th style={celulaCabecalho} />}
                </tr>
              </thead>
              <tbody>
                {tipos.map(t => (
                  <tr key={t.id} style={{ opacity: t.ativo ? 1 : 0.5 }}>
                    <td style={celula}>
                      <div style={{ fontWeight: 600 }}>{t.nome}</div>
                      {t.descricao && <div style={{ fontSize: '12px', color: COR.texto2 }}>{t.descricao}</div>}
                      {!t.ativo && <div style={{ fontSize: '12px', color: COR.texto2 }}>inativo</div>}
                    </td>
                    <td style={celula}>{t.categorias.length === 0 ? 'Todas' : t.categorias.join(', ')}</td>
                    <td style={celula}>{t.obrigatorio ? 'Obrigatório' : 'Opcional'}{t.exigeValidade ? ' · com validade' : ''}</td>
                    <td style={celula}>{t.validadeDias ? `${t.validadeDias} dias` : '—'}</td>
                    <td style={celula}><Selo tom={t.visibilidade === 'Externo' ? 'azul' : 'cinza'}>{t.visibilidade}</Selo></td>
                    {podeEditar && (
                      <td style={{ ...celula, textAlign: 'right' }}>
                        <button type="button" style={botao('secundario')} onClick={() => setEditando({ ...t, categorias: t.categorias.slice() })}>Editar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {editando && (
        <EditarTipoModal
          tipo={editando}
          fechar={() => setEditando(undefined)}
          salvar={async t => {
            await servico.salvarTipo(t);
            setEditando(undefined);
            await aoAlterar(`Tipo "${t.nome}" salvo.`);
          }}
        />
      )}
    </div>
  );
};

export default TiposDocumentoView;
