import * as React from 'react';

import {
  EXTENSOES_MIDIA_ACEITAS,
  formatarTamanho
} from '../../services/MidiaTreinamentoService';

import {
  IReferenciaMidia
} from '../../utils/midiasImportacao';

// ============================================================
// IMAGENS DO JSON (tela "Revisar importação por JSON")
//
// Lista as imagens que o JSON pede ("midia:arquivo.png"), mostra
// quais já foram fornecidas e recebe os arquivos — soltos ou num
// .zip. A importação só é liberada com todas presentes.
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';

export interface IImagensImportacaoPainelProps {
  referencias: IReferenciaMidia[];
  arquivos: Record<string, File>;
  // false = não há como enviar imagens (falta SharePoint/Dataverse).
  envioDisponivel: boolean;
  processando: boolean;
  avisos: string[];
  onAdicionarArquivos: (arquivos: File[]) => void;
  onRemover: (chave: string) => void;
}

const ImagensImportacaoPainel: React.FC<IImagensImportacaoPainelProps> = ({
  referencias,
  arquivos,
  envioDisponivel,
  processando,
  avisos,
  onAdicionarArquivos,
  onRemover
}) => {

  const entrada =
    React.useRef<HTMLInputElement>(null);

  const [arrastando, setArrastando] =
    React.useState<boolean>(false);

  if (referencias.length === 0) {
    return null;
  }

  const encontradas =
    referencias.filter(item => !!arquivos[item.chave]).length;

  const completo =
    encontradas === referencias.length;

  const receber = (lista: FileList | null): void => {
    if (!lista || lista.length === 0 || processando) {
      return;
    }
    const itens: File[] = [];
    for (let indice = 0; indice < lista.length; indice++) {
      itens.push(lista[indice]);
    }
    onAdicionarArquivos(itens);
  };

  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '14px 16px',
        borderRadius: '12px',
        border: `1px solid ${completo ? COR_CIANO : COR_INDIGO}`,
        background: completo ? '#E6F9FC' : '#E8EAF8',
        color: COR_AZUL,
        fontSize: '13px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ fontSize: '14px' }}>
          Imagens do JSON — {encontradas} de {referencias.length} {completo ? '✓' : ''}
        </strong>
        <span style={{ color: '#5E6670', fontSize: '12px' }}>
          Serão enviadas para “Midias de Treinamento” ao confirmar a importação.
        </span>
      </div>

      {
        !envioDisponivel && (
          <div role="alert" style={{ marginTop: '8px', fontWeight: 600 }}>
            O envio de imagens não está disponível nesta tela (sem conexão com o SharePoint ou o Dataverse).
            Troque as referências “midia:” por endereços do SharePoint ou remova os conteúdos de imagem.
          </div>
        )
      }

      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {
          referencias.map(
            referencia => {
              const arquivo = arquivos[referencia.chave];
              return (
                <li
                  key={referencia.chave}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: '#FFFFFF',
                    border: `1px solid ${arquivo ? COR_BORDA : COR_INDIGO}`
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ fontWeight: 700, color: arquivo ? COR_AZUL : COR_INDIGO, width: '14px' }}
                  >
                    {arquivo ? '✓' : '!'}
                  </span>
                  <strong style={{ wordBreak: 'break-all' }}>{referencia.nome}</strong>
                  <span style={{ color: '#5E6670', fontSize: '12px' }}>
                    {referencia.usos.join(' · ')}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: arquivo ? COR_AZUL : COR_INDIGO, fontWeight: 600 }}>
                    {arquivo ? formatarTamanho(arquivo.size) : 'faltando'}
                  </span>
                  {
                    arquivo && (
                      <button
                        type="button"
                        disabled={processando}
                        onClick={() => onRemover(referencia.chave)}
                        title="Trocar este arquivo"
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${COR_BORDA}`,
                          background: '#FFFFFF',
                          color: COR_AZUL,
                          fontSize: '11.5px',
                          cursor: processando ? 'not-allowed' : 'pointer'
                        }}
                      >
                        trocar
                      </button>
                    )
                  }
                </li>
              );
            }
          )
        }
      </ul>

      {
        envioDisponivel && !completo && (
          <div
            onDragOver={evento => { evento.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={evento => {
              evento.preventDefault();
              setArrastando(false);
              receber(evento.dataTransfer.files);
            }}
            style={{
              marginTop: '10px',
              padding: '14px',
              borderRadius: '10px',
              border: `2px dashed ${arrastando ? COR_CIANO : COR_BORDA}`,
              background: arrastando ? '#E6F9FC' : '#FFFFFF',
              textAlign: 'center'
            }}
          >
            <input
              ref={entrada}
              type="file"
              multiple
              accept={`${EXTENSOES_MIDIA_ACEITAS},.zip`}
              style={{ display: 'none' }}
              onChange={evento => {
                receber(evento.target.files);
                evento.target.value = '';
              }}
            />
            Arraste aqui as imagens (ou o .zip com elas) ·{' '}
            <button
              type="button"
              disabled={processando}
              onClick={() => entrada.current && entrada.current.click()}
              style={{
                padding: 0,
                border: 0,
                background: 'transparent',
                color: COR_INDIGO,
                fontWeight: 700,
                textDecoration: 'underline',
                cursor: processando ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              escolher arquivos
            </button>
            <div style={{ color: '#5E6670', fontSize: '12px', marginTop: '4px' }}>
              Os arquivos são associados pelo nome. Várias imagens de uma vez são aceitas.
            </div>
          </div>
        )
      }

      {
        avisos.length > 0 && (
          <ul style={{ margin: '10px 0 0', paddingLeft: '18px', fontSize: '12.5px' }}>
            {avisos.map(item => <li key={item}>{item}</li>)}
          </ul>
        )
      }
    </div>
  );
};

export default ImagensImportacaoPainel;
