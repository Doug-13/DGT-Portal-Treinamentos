import * as React from 'react';

import {
  EXTENSOES_MIDIA_ACEITAS,
  formatarTamanho,
  IMidiaTreinamento,
  ITreinamentoMidia,
  MidiaTreinamentoService,
  TAMANHO_MAXIMO_MIDIA_BYTES,
  validarArquivoMidia
} from '../../services/MidiaTreinamentoService';

// ============================================================
// IMAGEM DO CONTEÚDO — ENVIAR PELO PORTAL OU ESCOLHER UMA JÁ ENVIADA
//
// Substitui o "subir no SharePoint e colar a URL": o arquivo vai
// para a biblioteca "Midias de Treinamento" com nome único e o
// endereço é preenchido sozinho no campo URL do conteúdo.
// ============================================================

export interface IContextoMidiasEditor {
  servico: MidiaTreinamentoService;
  treinamento: ITreinamentoMidia;
  enviadoPor: string;
}

export interface ISeletorMidiaImagemProps {
  contexto: IContextoMidiasEditor;
  urlAtual: string;
  desabilitado?: boolean;
  onSelecionar: (url: string) => void;
}

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';

const mesmaUrl = (
  a: string,
  b: string
): boolean => {
  const normalizar = (valor: string): string => {
    try {
      return decodeURI((valor || '').trim()).toLowerCase();
    } catch {
      return (valor || '').trim().toLowerCase();
    }
  };
  return !!a && !!b && normalizar(a) === normalizar(b);
};

const SeletorMidiaImagem: React.FC<ISeletorMidiaImagemProps> = ({
  contexto,
  urlAtual,
  desabilitado = false,
  onSelecionar
}) => {

  const entradaArquivo =
    React.useRef<HTMLInputElement>(null);

  const [enviando, setEnviando] =
    React.useState<boolean>(false);

  const [erro, setErro] =
    React.useState<string>('');

  const [mensagem, setMensagem] =
    React.useState<string>('');

  const [arrastando, setArrastando] =
    React.useState<boolean>(false);

  const [galeriaAberta, setGaleriaAberta] =
    React.useState<boolean>(false);

  const [midias, setMidias] =
    React.useState<IMidiaTreinamento[] | undefined>(undefined);

  const [carregandoGaleria, setCarregandoGaleria] =
    React.useState<boolean>(false);

  const [previaComErro, setPreviaComErro] =
    React.useState<boolean>(false);

  React.useEffect(
    () => setPreviaComErro(false),
    [urlAtual]
  );

  const carregarGaleria = React.useCallback(
    async (): Promise<void> => {

      setCarregandoGaleria(true);
      setErro('');

      try {
        setMidias(
          await contexto.servico.listar(contexto.treinamento.id)
        );
      } catch (error) {
        console.error(error);
        setErro(error instanceof Error ? error.message : 'Não foi possível carregar as imagens do treinamento.');
        setMidias([]);
      } finally {
        setCarregandoGaleria(false);
      }
    },
    [contexto]
  );

  const enviar = async (
    arquivo: File | undefined
  ): Promise<void> => {

    if (!arquivo || enviando || desabilitado) {
      return;
    }

    setErro('');
    setMensagem('');

    const invalido =
      validarArquivoMidia(arquivo);

    if (invalido) {
      setErro(invalido);
      return;
    }

    setEnviando(true);

    try {

      const midia =
        await contexto.servico.enviar(
          arquivo,
          contexto.treinamento,
          contexto.enviadoPor
        );

      onSelecionar(midia.url);

      setMidias(atual => (atual ? [midia].concat(atual) : atual));

      setMensagem(`“${midia.nome}” enviada (${formatarTamanho(midia.tamanhoBytes)}). Salve o conteúdo para concluir.`);

    } catch (error) {
      console.error(error);
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.');
    } finally {
      setEnviando(false);

      if (entradaArquivo.current) {
        entradaArquivo.current.value = '';
      }
    }
  };

  const bloqueado =
    enviando || desabilitado;

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '12px',
        border: `1px dashed ${arrastando ? COR_CIANO : COR_BORDA}`,
        borderRadius: '10px',
        background: arrastando ? '#E6F9FC' : '#F8FAFC',
        color: COR_AZUL,
        fontSize: '13px'
      }}
      onDragOver={evento => {
        evento.preventDefault();
        if (!bloqueado) {
          setArrastando(true);
        }
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={evento => {
        evento.preventDefault();
        setArrastando(false);
        const arquivo = evento.dataTransfer.files && evento.dataTransfer.files[0];
        enviar(arquivo).catch((error: unknown) => console.error(error));
      }}
    >
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

        <input
          ref={entradaArquivo}
          type="file"
          accept={EXTENSOES_MIDIA_ACEITAS}
          style={{ display: 'none' }}
          onChange={evento => {
            const arquivo = evento.target.files && evento.target.files[0];
            enviar(arquivo || undefined).catch((error: unknown) => console.error(error));
          }}
        />

        <button
          type="button"
          disabled={bloqueado}
          onClick={() => entradaArquivo.current && entradaArquivo.current.click()}
          style={{
            padding: '8px 12px',
            border: 0,
            borderRadius: '8px',
            background: bloqueado ? '#CBD5E1' : COR_AZUL,
            color: '#FFFFFF',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: bloqueado ? 'not-allowed' : 'pointer'
          }}
        >
          {enviando ? 'Enviando...' : '⇪ Enviar imagem do computador'}
        </button>

        <button
          type="button"
          disabled={bloqueado}
          onClick={() => {
            const abrir = !galeriaAberta;
            setGaleriaAberta(abrir);
            if (abrir && midias === undefined) {
              carregarGaleria().catch((error: unknown) => console.error(error));
            }
          }}
          style={{
            padding: '8px 12px',
            border: `1px solid ${COR_AZUL}`,
            borderRadius: '8px',
            background: '#FFFFFF',
            color: COR_AZUL,
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: bloqueado ? 'not-allowed' : 'pointer'
          }}
        >
          {galeriaAberta ? 'Ocultar imagens já enviadas' : 'Escolher imagem já enviada'}
        </button>

        <span style={{ color: '#64748B', fontSize: '12px' }}>
          ou arraste a imagem para cá · PNG, JPG, GIF ou WEBP até {formatarTamanho(TAMANHO_MAXIMO_MIDIA_BYTES)}
        </span>
      </div>

      {
        erro && (
          <div
            role="alert"
            style={{
              marginTop: '10px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: `1px solid ${COR_INDIGO}`,
              background: '#E8EAF8',
              fontSize: '12.5px'
            }}
          >
            {erro}
          </div>
        )
      }

      {
        mensagem && !erro && (
          <div style={{ marginTop: '10px', fontSize: '12.5px', fontWeight: 600 }}>
            ✓ {mensagem}
          </div>
        )
      }

      {
        // Prévia da imagem atual do conteúdo.
        urlAtual && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            {
              previaComErro
                ? (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${COR_INDIGO}`,
                      background: '#E8EAF8',
                      fontSize: '12.5px'
                    }}
                  >
                    A imagem deste endereço não pôde ser exibida (o arquivo pode ter sido excluído ou o link
                    não é o endereço direto). Envie a imagem novamente pelo botão acima.
                  </div>
                )
                : (
                  <img
                    src={urlAtual}
                    alt="Prévia da imagem do conteúdo"
                    onError={() => setPreviaComErro(true)}
                    style={{
                      maxWidth: '220px',
                      maxHeight: '140px',
                      borderRadius: '6px',
                      border: `1px solid ${COR_BORDA}`,
                      background: '#FFFFFF',
                      objectFit: 'contain'
                    }}
                  />
                )
            }
          </div>
        )
      }

      {
        galeriaAberta && (
          <div style={{ marginTop: '12px' }}>
            {
              carregandoGaleria
                ? <span style={{ color: '#64748B' }}>Carregando imagens do treinamento...</span>
                : (midias || []).length === 0
                  ? (
                    !erro && (
                      <span style={{ color: '#64748B' }}>
                        Nenhuma imagem enviada para este treinamento ainda.
                      </span>
                    )
                  )
                  : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: '8px'
                      }}
                    >
                      {
                        (midias || []).map(
                          midia => {
                            const selecionada = mesmaUrl(midia.url, urlAtual);
                            return (
                              <button
                                key={midia.id || midia.url}
                                type="button"
                                disabled={bloqueado}
                                title={`${midia.nome} · ${formatarTamanho(midia.tamanhoBytes)}`}
                                onClick={() => {
                                  onSelecionar(midia.url);
                                  setMensagem(`“${midia.nome}” selecionada. Salve o conteúdo para concluir.`);
                                  setErro('');
                                }}
                                style={{
                                  padding: '6px',
                                  borderRadius: '8px',
                                  border: selecionada ? `2px solid ${COR_CIANO}` : `1px solid ${COR_BORDA}`,
                                  background: selecionada ? '#E6F9FC' : '#FFFFFF',
                                  cursor: bloqueado ? 'not-allowed' : 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <img
                                  src={midia.url}
                                  alt={midia.nome}
                                  loading="lazy"
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    height: '80px',
                                    objectFit: 'contain',
                                    background: '#F2F2F2',
                                    borderRadius: '4px'
                                  }}
                                />
                                <span
                                  style={{
                                    display: 'block',
                                    marginTop: '4px',
                                    fontSize: '11px',
                                    color: COR_AZUL,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                >
                                  {selecionada ? '✓ ' : ''}{midia.nome}
                                </span>
                              </button>
                            );
                          }
                        )
                      }
                    </div>
                  )
            }
          </div>
        )
      }
    </div>
  );
};

export default SeletorMidiaImagem;
