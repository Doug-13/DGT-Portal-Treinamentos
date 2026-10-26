import * as React from 'react';

import {
  IImagemInventario,
  IInventarioMidias,
  IModuloGestaoMidia,
  ITreinamentoGestaoMidia,
  MidiaGestaoService
} from '../../services/MidiaGestaoService';

import {
  EXTENSOES_MIDIA_ACEITAS,
  formatarTamanho,
  validarArquivoMidia
} from '../../services/MidiaTreinamentoService';

// ============================================================
// MÍDIAS DO TREINAMENTO
//
// Mostra todas as imagens do treinamento — as enviadas pelo portal e
// as "avulsas" (URLs coladas antes das mídias) — com onde cada uma é
// usada, e permite substituir, desativar (só sem uso) e trazer as
// avulsas para o portal.
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO_2 = '#5E6670';

type Filtro = 'todas' | 'emUso' | 'semUso' | 'avulsas' | 'quebradas';

export interface IMidiasTreinamentoModalProps {
  servico: MidiaGestaoService;
  treinamento: ITreinamentoGestaoMidia & { nome?: string };
  modulos: IModuloGestaoMidia[];
  enviadoPor: string;
  // alterou = true quando algum conteúdo foi modificado (recarregar).
  onFechar: (alterou: boolean) => void;
}

const nomeDoEndereco = (
  url: string
): string => {
  const ultimo = url.replace(/[?#].*$/, '').split('/').pop() || url;
  try {
    return decodeURIComponent(ultimo);
  } catch {
    return ultimo;
  }
};

const formatarData = (
  iso: string
): string => {
  const data = new Date(iso);
  return isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
};

const Selo: React.FC<{ texto: string; tipo: 'ok' | 'neutro' | 'atencao' }> = ({ texto, tipo }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 700,
      color: tipo === 'atencao' ? COR_INDIGO : COR_AZUL,
      background: tipo === 'ok' ? '#E6F9FC' : tipo === 'atencao' ? '#E8EAF8' : '#F2F2F2',
      border: tipo === 'ok' ? `1px solid ${COR_CIANO}` : '1px solid transparent'
    }}
  >
    {texto}
  </span>
);

const botao = (
  principal: boolean,
  desabilitado: boolean
): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: '6px',
  border: principal ? 0 : `1px solid ${COR_AZUL}`,
  background: desabilitado ? '#CBD5E1' : principal ? COR_AZUL : '#FFFFFF',
  color: principal || desabilitado ? '#FFFFFF' : COR_AZUL,
  fontSize: '12px',
  fontWeight: 700,
  cursor: desabilitado ? 'not-allowed' : 'pointer'
});

const MidiasTreinamentoModal: React.FC<IMidiasTreinamentoModalProps> = ({
  servico,
  treinamento,
  modulos,
  enviadoPor,
  onFechar
}) => {

  const [inventario, setInventario] =
    React.useState<IInventarioMidias | undefined>(undefined);

  const [carregando, setCarregando] =
    React.useState<boolean>(true);

  const [erro, setErro] =
    React.useState<string>('');

  const [mensagem, setMensagem] =
    React.useState<string>('');

  const [filtro, setFiltro] =
    React.useState<Filtro>('todas');

  // Chave da imagem em processamento (bloqueia os botões).
  const [processando, setProcessando] =
    React.useState<string>('');

  // Imagens cuja miniatura não carregou.
  const [quebradas, setQuebradas] =
    React.useState<Record<string, boolean>>({});

  const alterou =
    React.useRef<boolean>(false);

  const entradaArquivo =
    React.useRef<HTMLInputElement>(null);

  const alvoSubstituicao =
    React.useRef<IImagemInventario | undefined>(undefined);

  const carregar = React.useCallback(
    async (): Promise<void> => {
      setCarregando(true);
      setErro('');
      try {
        setInventario(await servico.inventariar(treinamento, modulos));
        setQuebradas({});
      } catch (error) {
        console.error(error);
        setErro(error instanceof Error ? error.message : 'Não foi possível carregar as imagens do treinamento.');
      } finally {
        setCarregando(false);
      }
    },
    [servico, treinamento, modulos]
  );

  React.useEffect(
    () => {
      carregar().catch((error: unknown) => console.error(error));
    },
    [carregar]
  );

  const executar = async (
    item: IImagemInventario,
    acao: () => Promise<string>
  ): Promise<void> => {
    setProcessando(item.chave);
    setErro('');
    setMensagem('');
    try {
      setMensagem(await acao());
      await carregar();
    } catch (error) {
      console.error(error);
      setErro(error instanceof Error ? error.message : 'Não foi possível concluir a ação.');
    } finally {
      setProcessando('');
    }
  };

  const desativar = (item: IImagemInventario): void => {
    if (!window.confirm(`Desativar a imagem "${item.midia ? item.midia.nome : item.url}"? Ela sai da galeria do treinamento. O arquivo continua no SharePoint (revisões antigas não são afetadas).`)) {
      return;
    }
    executar(item, async () => {
      await servico.desativar(item);
      return 'Imagem desativada.';
    }).catch((error: unknown) => console.error(error));
  };

  const pedirArquivo = (item: IImagemInventario): void => {
    alvoSubstituicao.current = item;
    if (entradaArquivo.current) {
      entradaArquivo.current.value = '';
      entradaArquivo.current.click();
    }
  };

  const substituir = (arquivo: File | undefined): void => {
    const item = alvoSubstituicao.current;
    alvoSubstituicao.current = undefined;
    if (!arquivo || !item) {
      return;
    }
    const invalido = validarArquivoMidia(arquivo);
    if (invalido) {
      setErro(invalido);
      return;
    }
    executar(item, async () => {
      const resultado = await servico.substituir(item, arquivo, treinamento, enviadoPor);
      alterou.current = alterou.current || resultado.trocados > 0;
      return `Imagem substituída por “${resultado.nova.nome}” em ${resultado.trocados} lugar(es).`;
    }).catch((error: unknown) => console.error(error));
  };

  const trazer = (item: IImagemInventario): void => {
    executar(item, async () => {
      const resultado = await servico.trazerParaOPortal(item, treinamento, enviadoPor);
      alterou.current = alterou.current || resultado.trocados > 0;
      return `Imagem trazida para o portal (“${resultado.nova.nome}”) e atualizada em ${resultado.trocados} lugar(es).`;
    }).catch((error: unknown) => console.error(error));
  };

  const todas: IImagemInventario[] =
    inventario ? inventario.gerenciadas.concat(inventario.avulsas) : [];

  const contagem = {
    todas: todas.length,
    emUso: todas.filter(item => item.usos.length > 0).length,
    semUso: inventario ? inventario.gerenciadas.filter(item => item.usos.length === 0).length : 0,
    avulsas: inventario ? inventario.avulsas.length : 0,
    quebradas: todas.filter(item => quebradas[item.chave]).length
  };

  const visiveis =
    todas.filter(
      item =>
        filtro === 'todas' ||
        (filtro === 'emUso' && item.usos.length > 0) ||
        (filtro === 'semUso' && !!item.midia && item.usos.length === 0) ||
        (filtro === 'avulsas' && !item.midia) ||
        (filtro === 'quebradas' && quebradas[item.chave])
    );

  const ocupado = !!processando;

  const abaFiltro = (chave: Filtro, rotulo: string, quantidade: number): React.ReactElement => (
    <button
      key={chave}
      type="button"
      onClick={() => setFiltro(chave)}
      aria-pressed={filtro === chave}
      style={{
        padding: '6px 12px',
        borderRadius: '20px',
        border: filtro === chave ? `1px solid ${COR_CIANO}` : `1px solid ${COR_BORDA}`,
        background: filtro === chave ? '#E6F9FC' : '#FFFFFF',
        color: COR_AZUL,
        fontSize: '12.5px',
        fontWeight: filtro === chave ? 700 : 600,
        cursor: 'pointer'
      }}
    >
      {rotulo} ({quantidade})
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mídias do treinamento"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '20px',
        overflowY: 'auto',
        background: 'rgba(15,23,42,.55)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '980px',
          padding: '24px',
          background: '#FFFFFF',
          borderRadius: '16px',
          marginBottom: '40px',
          color: COR_AZUL
        }}
      >
        <input
          ref={entradaArquivo}
          type="file"
          accept={EXTENSOES_MIDIA_ACEITAS}
          style={{ display: 'none' }}
          onChange={evento => substituir((evento.target.files && evento.target.files[0]) || undefined)}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>Mídias do treinamento</h2>
            <div style={{ color: COR_TEXTO_2, fontSize: '13px' }}>
              {treinamento.codigo}{treinamento.nome ? ` — ${treinamento.nome}` : ''} · imagens dos conteúdos e da capa
            </div>
          </div>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onFechar(alterou.current)}
            style={botao(false, ocupado)}
          >
            Fechar
          </button>
        </div>

        <p style={{ fontSize: '12.5px', color: COR_TEXTO_2, lineHeight: 1.5, margin: '12px 0' }}>
          Substituir troca a imagem em todos os conteúdos que a usam. Desativar só é possível sem uso.
          Nenhum arquivo é apagado do SharePoint: revisões já publicadas continuam mostrando a imagem da época.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {abaFiltro('todas', 'Todas', contagem.todas)}
          {abaFiltro('emUso', 'Em uso', contagem.emUso)}
          {abaFiltro('semUso', 'Sem uso', contagem.semUso)}
          {abaFiltro('avulsas', 'Fora das mídias', contagem.avulsas)}
          {contagem.quebradas > 0 && abaFiltro('quebradas', 'Não carregam', contagem.quebradas)}
        </div>

        {
          erro && (
            <div role="alert" style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COR_INDIGO}`, background: '#E8EAF8', fontSize: '13px' }}>
              {erro}
            </div>
          )
        }

        {
          mensagem && !erro && (
            <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COR_CIANO}`, background: '#E6F9FC', fontSize: '13px', fontWeight: 600 }}>
              ✓ {mensagem}
            </div>
          )
        }

        {
          carregando && !inventario
            ? <div style={{ padding: '20px', color: COR_TEXTO_2 }}>Lendo os conteúdos do treinamento...</div>
            : visiveis.length === 0
              ? <div style={{ padding: '20px', color: COR_TEXTO_2 }}>Nenhuma imagem neste filtro.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {
                    visiveis.map(
                      item => {
                        const emProcesso = processando === item.chave;
                        const quebrada = !!quebradas[item.chave];
                        const ativosEmUso = item.usos.filter(uso => uso.conteudoAtivo).length;

                        return (
                          <div
                            key={item.chave}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '120px minmax(0, 1fr)',
                              gap: '14px',
                              padding: '12px',
                              borderRadius: '10px',
                              border: `1px solid ${quebrada ? COR_INDIGO : COR_BORDA}`,
                              opacity: emProcesso ? 0.6 : 1
                            }}
                          >
                            <div
                              style={{
                                width: '120px',
                                height: '84px',
                                borderRadius: '6px',
                                background: '#F2F2F2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                              }}
                            >
                              {
                                quebrada
                                  ? <span style={{ fontSize: '11px', color: COR_INDIGO, textAlign: 'center', padding: '4px' }}>não carrega</span>
                                  : (
                                    <img
                                      src={item.url}
                                      alt=""
                                      loading="lazy"
                                      onError={() => setQuebradas(atual => ({ ...atual, [item.chave]: true }))}
                                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    />
                                  )
                              }
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <strong style={{ fontSize: '13.5px', wordBreak: 'break-all' }}>
                                  {item.midia ? item.midia.nome : nomeDoEndereco(item.url)}
                                </strong>
                                {
                                  item.midia
                                    ? <Selo texto="Mídia do portal" tipo="ok" />
                                    : <Selo texto="Fora das mídias" tipo="atencao" />
                                }
                                {
                                  item.usos.length === 0
                                    ? <Selo texto="Sem uso" tipo="neutro" />
                                    : <Selo texto={`${item.usos.length} uso(s)${ativosEmUso < item.usos.length ? ` · ${item.usos.length - ativosEmUso} em conteúdo inativo` : ''}`} tipo="neutro" />
                                }
                                {quebrada && <Selo texto="Imagem não carrega" tipo="atencao" />}
                              </div>

                              <div style={{ fontSize: '12px', color: COR_TEXTO_2, marginTop: '3px' }}>
                                {
                                  item.midia
                                    ? `${formatarTamanho(item.midia.tamanhoBytes)} · enviada em ${formatarData(item.midia.criadoEm)}${item.midia.enviadoPor ? ` por ${item.midia.enviadoPor}` : ''}`
                                    : 'URL colada manualmente (anterior às mídias do portal)'
                                }
                              </div>

                              {
                                item.usos.length > 0 && (
                                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12.5px' }}>
                                    {
                                      item.usos.map(
                                        (uso, indice) => (
                                          <li key={`${uso.conteudoId || 'capa'}-${uso.campo}-${indice}`}>
                                            {uso.moduloTitulo ? `${uso.moduloTitulo} · ` : ''}{uso.conteudoTitulo}
                                            {!uso.conteudoAtivo ? ' (inativo)' : ''}
                                          </li>
                                        )
                                      )
                                    }
                                  </ul>
                                )
                              }

                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                {
                                  !item.midia && item.usos.length > 0 && (
                                    <button
                                      type="button"
                                      disabled={ocupado}
                                      onClick={() => trazer(item)}
                                      title="Copia o arquivo para a biblioteca de mídias e atualiza os conteúdos."
                                      style={botao(true, ocupado)}
                                    >
                                      Trazer para o portal
                                    </button>
                                  )
                                }
                                {
                                  item.usos.length > 0 && (
                                    <button
                                      type="button"
                                      disabled={ocupado}
                                      onClick={() => pedirArquivo(item)}
                                      title="Envia um novo arquivo e troca a imagem em todos os lugares listados."
                                      style={botao(!!item.midia, ocupado)}
                                    >
                                      Substituir
                                    </button>
                                  )
                                }
                                {
                                  item.midia && (
                                    <button
                                      type="button"
                                      disabled={ocupado || item.usos.length > 0}
                                      onClick={() => desativar(item)}
                                      title={item.usos.length > 0 ? 'Em uso: substitua ou retire dos conteúdos antes.' : 'Remove da galeria do treinamento.'}
                                      style={botao(false, ocupado || item.usos.length > 0)}
                                    >
                                      Desativar
                                    </button>
                                  )
                                }
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ alignSelf: 'center', fontSize: '12px', color: COR_INDIGO }}
                                >
                                  abrir
                                </a>
                                {emProcesso && <span style={{ alignSelf: 'center', fontSize: '12px' }}>Processando...</span>}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )
                  }
                </div>
              )
        }
      </div>
    </div>
  );
};

export default MidiasTreinamentoModal;
