import * as React from 'react';

import {
  COR,
  FONTE
} from './licitacoesEstilos';

// ============================================================
// LICITAÇÕES — SUGESTÕES DE TERMOS (clicar para incluir)
//
// Cada termo vira um botão. Clicar inclui o termo na caixa de texto
// (separado por vírgula); clicar de novo retira. "Adicionar todos"
// inclui o grupo inteiro de uma vez. A caixa de texto continua
// livre: dá para digitar outros termos normalmente.
// ============================================================

export interface IGrupoTermos {
  titulo?: string;
  termos: string[];
}

// Listas da DGT (videomonitoramento e segurança eletrônica).
export const SUGESTOES_ASSUNTO: IGrupoTermos[] = [
  { termos: ['videomonitoramento', 'monitoramento'] }
];

export const SUGESTOES_RELACIONADAS: IGrupoTermos[] = [
  {
    titulo: 'Segurança eletrônica',
    termos: ['controle de acesso', 'camera', 'cftv', 'ocr de placas', 'leitura ocr', 'seguranca eletronica', 'vigilancia eletronica', 'catraca', 'biometria']
  },
  {
    titulo: 'Videomonitoramento',
    termos: ['cftv', 'cercamento eletronico', 'muralha digital', 'reconhecimento facial', 'leitura de placa', 'video wall', 'videowall', 'camera', 'cameras', 'lpr']
  }
];

export const SUGESTOES_EXCLUIR: IGrupoTermos[] = [
  {
    termos: ['camera fria', 'refrigeracao', 'fotografica', 'monitoramento ambiental', 'qualidade da agua', 'cardiaco', 'holter', 'pressao arterial', 'rastreamento de frota']
  }
];

const normalizar = (texto: string): string =>
  (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// "a, b ,c" → ['a', 'b', 'c']
export const listaDoTexto = (texto: string): string[] =>
  (texto || '')
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

const textoDaLista = (lista: string[]): string => lista.join(', ');

export interface ISugestoesTermosProps {
  grupos: IGrupoTermos[];
  valor: string;
  onChange: (novo: string) => void;
  disabled?: boolean;
  // Cor de destaque (ex.: vermelho para "excluir").
  cor?: string;
  corFundo?: string;
}

const SugestoesTermos: React.FC<ISugestoesTermosProps> = ({
  grupos,
  valor,
  onChange,
  disabled = false,
  cor = '#047C8C',
  corFundo = COR.cianoClaro
}) => {

  const atuais = listaDoTexto(valor);
  const selecionados = new Set(atuais.map(normalizar));

  const alternar = (termo: string): void => {
    const chave = normalizar(termo);
    onChange(textoDaLista(
      selecionados.has(chave)
        ? atuais.filter(t => normalizar(t) !== chave)
        : atuais.concat(termo)
    ));
  };

  const adicionarGrupo = (termos: string[]): void => {
    const novos = termos.filter(t => !selecionados.has(normalizar(t)));
    onChange(textoDaLista(atuais.concat(novos)));
  };

  const removerGrupo = (termos: string[]): void => {
    const remover = new Set(termos.map(normalizar));
    onChange(textoDaLista(atuais.filter(t => !remover.has(normalizar(t)))));
  };

  const botaoGrupo: React.CSSProperties = {
    border: 0,
    background: 'transparent',
    color: COR.indigo,
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: FONTE,
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: '2px 4px'
  };

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {grupos.map((grupo, indice) => {
        const todos = grupo.termos.every(t => selecionados.has(normalizar(t)));
        return (
          <div key={grupo.titulo || indice} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {grupo.titulo && (
              <span style={{ fontSize: 11, fontWeight: 700, color: COR.textoSecundario, marginRight: 2 }}>{grupo.titulo}:</span>
            )}
            {grupo.termos.map(termo => {
              const ativo = selecionados.has(normalizar(termo));
              return (
                <button
                  key={termo}
                  type="button"
                  aria-pressed={ativo}
                  disabled={disabled}
                  onClick={() => alternar(termo)}
                  title={ativo ? 'Clique para retirar' : 'Clique para incluir'}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 999,
                    border: `1px solid ${ativo ? cor : COR.cinzaClaro}`,
                    background: ativo ? corFundo : '#ffffff',
                    color: ativo ? cor : COR.azul,
                    fontSize: 11.5,
                    fontWeight: ativo ? 700 : 500,
                    fontFamily: FONTE,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {ativo ? '✓ ' : '+ '}{termo}
                </button>
              );
            })}
            <button
              type="button"
              disabled={disabled}
              onClick={() => (todos ? removerGrupo(grupo.termos) : adicionarGrupo(grupo.termos))}
              style={botaoGrupo}
            >
              {todos ? '✕ Remover todos' : '⊕ Adicionar todos'}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default SugestoesTermos;
