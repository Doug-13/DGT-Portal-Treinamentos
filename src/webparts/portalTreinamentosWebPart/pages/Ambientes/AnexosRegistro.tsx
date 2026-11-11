import * as React from 'react';

import {
  AnexosAmbienteService,
  IAnexoRegistro,
  IRegraAnexos
} from '../../services/ambientes/AnexosAmbienteService';

import {
  COR,
  botao,
  cartao,
  formatarDataHora
} from '../Orcamento/orcamentoComum';

// ============================================================
// ANEXOS DO REGISTRO (quadro da coluna esquerda)
//
// Lista os arquivos da pasta do registro no SharePoint. Na etapa que
// permite ("Anexo de arquivo" = Opcional/Obrigatório), o responsável
// inclui, substitui (o SharePoint guarda a versão anterior) e remove
// (vai para a lixeira, recuperável).
// ============================================================

export interface IAnexosRegistroProps {
  servico: AnexosAmbienteService;
  pasta: string;
  regra: IRegraAnexos;
  // Informa quantos anexos há (etapa com anexo obrigatório).
  onQuantidade?: (quantidade: number) => void;
}

const tamanhoLegivel = (bytes: number): string =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const AnexosRegistro: React.FC<IAnexosRegistroProps> = ({ servico, pasta, regra, onQuantidade }) => {

  const [anexos, setAnexos] = React.useState<IAnexoRegistro[] | undefined>(undefined);
  const [processando, setProcessando] = React.useState('');
  const [erro, setErro] = React.useState('');
  const entradaNovo = React.useRef<HTMLInputElement>(null);
  const entradaSubstituir = React.useRef<HTMLInputElement>(null);
  const [alvoSubstituir, setAlvoSubstituir] = React.useState<IAnexoRegistro | undefined>(undefined);

  const carregar = async (): Promise<void> => {
    try {
      const lista = await servico.listar(pasta);
      setAnexos(lista);
      setErro('');
      if (onQuantidade) {
        onQuantidade(lista.length);
      }
    } catch (falha) {
      setAnexos([]);
      setErro(falha instanceof Error ? falha.message : String(falha));
    }
  };

  React.useEffect(() => {
    setAnexos(undefined);
    carregar().catch(() => undefined);
  }, [pasta]);

  const enviar = async (arquivos: File[], substituir: boolean): Promise<void> => {
    setErro('');
    try {
      for (let i = 0; i < arquivos.length; i++) {
        setProcessando(`Enviando ${arquivos[i].name} (${i + 1}/${arquivos.length})...`);
        await servico.enviar(pasta, arquivos[i], substituir);
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setProcessando('');
      await carregar();
    }
  };

  const remover = async (anexo: IAnexoRegistro): Promise<void> => {
    if (!window.confirm(`Remover "${anexo.nome}"? Ele vai para a lixeira do SharePoint (pode ser recuperado).`)) {
      return;
    }
    setProcessando(`Removendo ${anexo.nome}...`);
    try {
      await servico.remover(anexo.caminho);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setProcessando('');
      await carregar();
    }
  };

  const ocupado = !!processando;

  return (
    <div style={{ ...cartao, marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <strong style={{ fontSize: '14px', color: COR.azul, flex: 1 }}>
          Anexos{anexos ? ` (${anexos.length})` : ''}
        </strong>
        {regra.podeEditar && (
          <button type="button" disabled={ocupado} onClick={() => entradaNovo.current && entradaNovo.current.click()} style={botao('secundario', ocupado)}>
            + Incluir arquivos
          </button>
        )}
      </div>

      <input
        ref={entradaNovo}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={evento => {
          const arquivos = evento.target.files ? Array.prototype.slice.call(evento.target.files) as File[] : [];
          evento.target.value = '';
          if (arquivos.length > 0) {
            enviar(arquivos, false).catch(() => undefined);
          }
        }}
      />
      <input
        ref={entradaSubstituir}
        type="file"
        style={{ display: 'none' }}
        onChange={evento => {
          const arquivo = evento.target.files && evento.target.files[0];
          evento.target.value = '';
          if (arquivo && alvoSubstituir) {
            // Substituir mantém o NOME do anexo (o SharePoint guarda a versão anterior).
            const renomeado = new File([arquivo], alvoSubstituir.nome, { type: arquivo.type });
            enviar([renomeado], true).catch(() => undefined);
          }
          setAlvoSubstituir(undefined);
        }}
      />

      {regra.obrigatorio && anexos && anexos.length === 0 && (
        <div style={{ fontSize: '12.5px', color: '#B54708', background: '#FFFAEB', borderRadius: '6px', padding: '6px 10px', marginBottom: '8px' }}>
          Esta etapa exige ao menos um anexo para concluir.
        </div>
      )}

      {!anexos && <div style={{ fontSize: '12.5px', color: COR.texto2 }}>Carregando anexos...</div>}
      {anexos && anexos.length === 0 && !erro && <div style={{ fontSize: '12.5px', color: COR.texto2 }}>Nenhum anexo.</div>}

      {anexos && anexos.map(anexo => (
        <div key={anexo.caminho} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderTop: `1px solid ${COR.borda}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={anexo.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 700, color: '#0874CE', wordBreak: 'break-word' }}>
              {anexo.nome}
            </a>
            <div style={{ fontSize: '11.5px', color: COR.texto2 }}>
              {tamanhoLegivel(anexo.tamanho)} · {anexo.modificadoPor ? `${anexo.modificadoPor} · ` : ''}{formatarDataHora(anexo.modificadoEm)}
            </div>
          </div>
          {regra.podeEditar && (
            <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button
                type="button"
                disabled={ocupado}
                title="Enviar uma nova versão (a anterior fica no histórico de versões do SharePoint)"
                onClick={() => { setAlvoSubstituir(anexo); if (entradaSubstituir.current) { entradaSubstituir.current.click(); } }}
                style={{ ...botao('secundario', ocupado), padding: '4px 8px', fontSize: '12px' }}
              >
                Substituir
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => { remover(anexo).catch(() => undefined); }}
                style={{ ...botao('secundario', ocupado), padding: '4px 8px', fontSize: '12px', color: '#B42318' }}
              >
                Remover
              </button>
            </span>
          )}
        </div>
      ))}

      {processando && <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '6px' }}>{processando}</div>}
      {erro && <div style={{ fontSize: '12.5px', color: '#B42318', marginTop: '6px' }}>{erro}</div>}
      {!regra.podeEditar && anexos && (
        <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '6px' }}>Nesta etapa os anexos são só para consulta.</div>
      )}
    </div>
  );
};

export default AnexosRegistro;
