import * as React from 'react';

import {
  SPHttpClient
} from '@microsoft/sp-http';

import {
  AnexosBomService,
  BIBLIOTECA_ARQUITETURA,
  IAnexoBom,
  PASTA_GO_NO_GO
} from '../../services/bom/AnexosBomService';

import {
  COR,
  botao
} from './arquiteturaComum';

// ============================================================
// GO/NO-GO — DOCUMENTOS ANEXADOS (edital, TR, planilhas, e-mails…)
// ============================================================

export interface IAnexosGoNoGoProps {
  numeroBom: string;
  spHttpClient?: SPHttpClient;
  siteUrl?: string;
  somenteLeitura?: boolean;
}

const tamanhoTexto = (bytes: number): string =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const dataHora = (valor: string): string => {
  const d = new Date(valor);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const AnexosGoNoGo: React.FC<IAnexosGoNoGoProps> = ({
  numeroBom,
  spHttpClient,
  siteUrl,
  somenteLeitura
}) => {

  const servico = React.useMemo(
    () => (spHttpClient && siteUrl ? new AnexosBomService(spHttpClient, siteUrl) : undefined),
    [spHttpClient, siteUrl]
  );

  const [anexos, setAnexos] = React.useState<IAnexoBom[]>([]);
  const [carregando, setCarregando] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const entrada = React.useRef<HTMLInputElement>(null);

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico || !numeroBom) {
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      setAnexos(await servico.listar(numeroBom));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível listar os anexos.');
    } finally {
      setCarregando(false);
    }
  }, [servico, numeroBom]);

  React.useEffect(() => {
    carregar().catch(e => console.error(e));
  }, [carregar]);

  const enviar = async (arquivos: FileList | null): Promise<void> => {
    if (!servico || !arquivos || arquivos.length === 0) {
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      for (let i = 0; i < arquivos.length; i++) {
        await servico.enviar(numeroBom, arquivos[i]);
      }
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setEnviando(false);
      if (entrada.current) {
        entrada.current.value = '';
      }
    }
  };

  const remover = async (anexo: IAnexoBom): Promise<void> => {
    if (!servico || !window.confirm(`Remover "${anexo.nome}"? O arquivo vai para a lixeira do site.`)) {
      return;
    }
    setErro('');
    try {
      await servico.remover(anexo);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível remover o anexo.');
    }
  };

  return (
    <div style={{ marginTop: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: COR.azul }}>
          Documentos anexados {anexos.length > 0 ? `(${anexos.length})` : ''}
        </span>
        {!somenteLeitura && servico && (
          <>
            <input
              ref={entrada}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => { enviar(e.target.files).catch(() => undefined); }}
            />
            <button
              type="button"
              disabled={enviando}
              onClick={() => entrada.current && entrada.current.click()}
              style={{ ...botao('secundario', enviando), minHeight: '30px', fontSize: '12.5px' }}
            >
              {enviando ? 'Enviando...' : '📎 Anexar documento'}
            </button>
          </>
        )}
      </div>

      {!servico && (
        <div style={{ fontSize: '12px', color: COR.texto2 }}>Anexos indisponíveis nesta tela (sem conexão com o SharePoint).</div>
      )}

      {erro && <div style={{ fontSize: '12px', color: '#B42318', marginBottom: '6px' }}>{erro}</div>}

      {servico && carregando && <div style={{ fontSize: '12px', color: COR.texto2 }}>Carregando anexos...</div>}

      {servico && !carregando && anexos.length === 0 && (
        <div style={{ fontSize: '12px', color: COR.texto2 }}>
          Nenhum documento anexado. Anexe o edital, o termo de referência ou outros documentos que embasam a análise.
        </div>
      )}

      {anexos.length > 0 && (
        <div style={{ border: `1px solid ${COR.borda}`, borderRadius: '8px', overflow: 'hidden' }}>
          {anexos.map((anexo, i) => (
            <div key={anexo.caminho} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderTop: i > 0 ? `1px solid ${COR.borda}` : 'none', fontSize: '12.5px' }}>
              <span aria-hidden="true">📄</span>
              <a href={anexo.url} target="_blank" rel="noopener noreferrer" style={{ color: COR.azul, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={anexo.nome}>
                {anexo.nome}
              </a>
              <span style={{ color: COR.texto2, whiteSpace: 'nowrap' }}>{tamanhoTexto(anexo.tamanho)} · {dataHora(anexo.enviadoEm)}</span>
              {!somenteLeitura && (
                <button type="button" onClick={() => { remover(anexo).catch(() => undefined); }} title="Remover anexo" style={{ border: 0, background: 'transparent', color: '#B42318', cursor: 'pointer', fontSize: '13px' }}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '11px', color: COR.texto2, marginTop: '4px' }}>
        Salvos no SharePoint, biblioteca “{BIBLIOTECA_ARQUITETURA}”, pasta {PASTA_GO_NO_GO}/{numeroBom}.
      </div>
    </div>
  );
};

export default AnexosGoNoGo;
