import * as React from 'react';

import {
  IColunaTabela,
  IFluxoMetadado,
  TipoCampoFluxo,
  TipoColunaTabela
} from '../../models/Fluxo';

import {
  gerarChave
} from '../../services/fluxo/bpmn/bpmnConversao';

import {
  estiloBotaoPequeno,
  estiloEntradaPainel,
  estiloRotuloPainel
} from './PainelPropriedadesFluxo';

// ============================================================
// METADADOS DO PROCESSO
//
// Pertencem ao PROCESSO (valem para todas as versões do fluxo).
// A ORDEM desta lista é a ordem em que os campos aparecem nas
// etapas e no documento. Use ↑ ↓ para reordenar.
// ============================================================

export interface IPainelMetadadosProps {
  metadados: IFluxoMetadado[];
  editavel: boolean;
  onAlterar: (metadados: IFluxoMetadado[]) => void;

  // Quantas etapas usam cada metadado (para avisar antes de excluir
  // e para travar a chave).
  usoPorChave: Record<string, number>;

  // Pré-visualização de campos do tipo Componente (dados reais).
  dataverseService?: DataverseService;
}

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
import EditorAvaliacao from './EditorAvaliacao';

import EditorComponente from './EditorComponente';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  configAvaliacaoPadrao
} from '../../services/fluxo/valorAvaliacao';

import {
  TIPOS_CONDICAO_EXIBICAO,
  descreverRegraExibicao
} from '../../services/fluxo/regraExibicao';

// ------------------------------------------------------------
// Regra de exibição do campo ("exibir só quando"): vale para todas as
// atividades que exibem o campo.
// ------------------------------------------------------------
const RegraExibicao: React.FC<{
  metadado: IFluxoMetadado;
  metadados: IFluxoMetadado[];
  editavel: boolean;
  onAlterar: (regra: { campo: string; valor: string } | undefined) => void;
}> = ({ metadado, metadados, editavel, onAlterar }) => {

  const regra = metadado.exibirQuando;
  const [aberta, setAberta] = React.useState(false);
  const candidatos = metadados.filter(item => item.chave !== metadado.chave && TIPOS_CONDICAO_EXIBICAO.indexOf(item.tipo) >= 0);
  const alvo = regra ? metadados.find(item => item.chave === regra.campo) : undefined;
  const pequeno: React.CSSProperties = { border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: '#0874CE', fontWeight: 700, fontSize: '11.5px' };
  const campoMenor: React.CSSProperties = { minHeight: '28px', fontSize: '12px', border: '1px solid #D9D9D6', borderRadius: '6px', padding: '2px 6px', maxWidth: '220px' };

  const valorPadrao = (chave: string): string => {
    const outro = metadados.find(item => item.chave === chave);
    return outro && outro.tipo === 'simNao' ? 'sim' : outro && outro.tipo === 'lista' && outro.opcoes && outro.opcoes.length > 0 ? outro.opcoes[0] : '';
  };

  if (!regra && !aberta) {
    return editavel && candidatos.length > 0
      ? <button type="button" style={{ ...pequeno, marginTop: '3px' }} onClick={() => setAberta(true)}>+ Regra de exibição</button>
      : null;
  }

  if (regra && !aberta) {
    return (
      <div style={{ marginTop: '3px', fontSize: '11.5px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        <span style={{ padding: '1px 6px', borderRadius: '999px', background: '#EEF4FA', color: '#0F4C81', fontWeight: 800, fontSize: '10.5px' }}>condicional</span>
        <span>{descreverRegraExibicao(regra, metadados)}</span>
        {editavel && <button type="button" style={pequeno} onClick={() => setAberta(true)}>alterar</button>}
      </div>
    );
  }

  const atual = regra || { campo: candidatos[0] ? candidatos[0].chave : '', valor: candidatos[0] ? valorPadrao(candidatos[0].chave) : '' };

  return (
    <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', fontSize: '12px', background: '#F5F7FA', borderRadius: '6px', padding: '6px 8px' }}>
      <span>Exibir só quando</span>
      <select
        aria-label={`Campo da regra de exibição de ${metadado.rotulo}`}
        value={atual.campo}
        disabled={!editavel}
        onChange={evento => onAlterar({ campo: evento.target.value, valor: valorPadrao(evento.target.value) })}
        style={campoMenor}
      >
        {candidatos.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}
      </select>
      <span>for</span>
      {alvo && alvo.tipo === 'simNao'
        ? (
          <select aria-label={`Valor da regra de exibição de ${metadado.rotulo}`} value={atual.valor} disabled={!editavel} onChange={evento => onAlterar({ campo: atual.campo, valor: evento.target.value })} style={campoMenor}>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        )
        : alvo && alvo.tipo === 'lista'
          ? (
            <select aria-label={`Valor da regra de exibição de ${metadado.rotulo}`} value={atual.valor} disabled={!editavel} onChange={evento => onAlterar({ campo: atual.campo, valor: evento.target.value })} style={campoMenor}>
              {(alvo.opcoes || []).map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
            </select>
          )
          : (
            <input aria-label={`Valor da regra de exibição de ${metadado.rotulo}`} value={atual.valor} disabled={!editavel} onChange={evento => onAlterar({ campo: atual.campo, valor: evento.target.value })} style={{ ...campoMenor, width: '120px' }} />
          )}
      {!regra && editavel && (
        <button type="button" style={pequeno} onClick={() => { onAlterar(atual); setAberta(false); }}>aplicar</button>
      )}
      {regra && <button type="button" style={pequeno} onClick={() => setAberta(false)}>ok</button>}
      {editavel && (
        <button type="button" style={{ ...pequeno, color: '#B42318' }} onClick={() => { onAlterar(undefined); setAberta(false); }}>
          {regra ? 'remover regra' : 'cancelar'}
        </button>
      )}
    </div>
  );
};

const COR_BORDA = '#D9D9D6';

const TIPOS: Array<{ valor: TipoCampoFluxo; rotulo: string }> = [
  { valor: 'texto', rotulo: 'Texto curto' },
  { valor: 'textoLongo', rotulo: 'Texto longo' },
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'data', rotulo: 'Data' },
  { valor: 'simNao', rotulo: 'Sim / Não' },
  { valor: 'lista', rotulo: 'Lista de opções' },
  { valor: 'tabela', rotulo: 'Tabela' },
  // Matriz de critérios com nota, peso e faixas (Go/No-Go).
  { valor: 'avaliacao', rotulo: 'Avaliação (critérios com nota e peso)' },
  // Tela personalizada: nativa do portal ou HTML isolado.
  { valor: 'componente', rotulo: 'Componente (tela nativa ou HTML)' },
  { valor: 'usuario', rotulo: 'Usuário (busca na plataforma)' },
  { valor: 'documento', rotulo: 'Documento referenciado' },
  { valor: 'documentos', rotulo: 'Documentos referenciados (vários)' },
  { valor: 'area', rotulo: 'Área (cadastradas no portal)' }
];

// Colunas da tabela: os mesmos tipos dos metadados (exceto Tabela).
const TIPOS_COLUNA: Array<{ valor: TipoColunaTabela; rotulo: string }> = [
  { valor: 'texto', rotulo: 'Texto curto' },
  { valor: 'textoLongo', rotulo: 'Texto longo' },
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'data', rotulo: 'Data' },
  { valor: 'simNao', rotulo: 'Sim / Não' },
  { valor: 'lista', rotulo: 'Lista de opções' },
  { valor: 'usuario', rotulo: 'Usuário (busca na plataforma)' },
  { valor: 'documento', rotulo: 'Documento referenciado' },
  { valor: 'documentos', rotulo: 'Documentos referenciados (vários)' },
  { valor: 'area', rotulo: 'Área (cadastradas no portal)' }
];

const lerOpcoes = (
  texto: string
): string[] =>
  texto.split(';').map(item => item.trim()).filter(item => item.length > 0);

const mover = <T,>(
  lista: T[],
  de: number,
  para: number
): T[] => {

  if (para < 0 || para >= lista.length) {
    return lista;
  }

  const copia =
    lista.slice();

  const [item] =
    copia.splice(de, 1);

  copia.splice(para, 0, item);

  return copia;
};

const botaoSeta = (
  rotulo: string,
  titulo: string,
  desabilitado: boolean,
  acao: () => void
): React.ReactElement => (
  <button
    type="button"
    title={titulo}
    aria-label={titulo}
    disabled={desabilitado}
    onClick={acao}
    style={{
      ...estiloBotaoPequeno(false),
      minHeight: '28px',
      minWidth: '28px',
      padding: 0,
      opacity: desabilitado ? 0.35 : 1,
      cursor: desabilitado ? 'default' : 'pointer'
    }}
  >
    {rotulo}
  </button>
);

// ------------------------------------------------------------
// Colunas de um metadado tabela
// ------------------------------------------------------------

const EditorColunas: React.FC<{
  colunas: IColunaTabela[];
  editavel: boolean;
  chaveFixa: boolean;
  rotuloTabela: string;
  onAlterar: (colunas: IColunaTabela[]) => void;
}> = ({ colunas, editavel, chaveFixa, rotuloTabela, onAlterar }) => {

  const alterar = (
    indice: number,
    parcial: Partial<IColunaTabela>
  ): void => {
    onAlterar(
      colunas.map(
        (coluna, posicao) => posicao === indice ? { ...coluna, ...parcial } : coluna
      )
    );
  };

  return (
    <div
      style={{
        marginTop: '8px',
        marginLeft: '64px',
        padding: '10px 12px',
        borderLeft: `3px solid ${COR_CIANO}`,
        background: '#F7FBFC',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <div style={{ ...estiloRotuloPainel, marginBottom: 0 }}>Colunas da tabela</div>

      {
        colunas.length === 0 && (
          <div style={{ fontSize: '12.5px' }}>
            Adicione as colunas que cada linha da tabela vai ter (ex.: Item, Quantidade, Data de entrega).
          </div>
        )
      }

      {
        colunas.map(
          (coluna, indice) => (
            <div
              key={`coluna-${indice}`}
              style={{ display: 'grid', gridTemplateColumns: '64px 1.4fr 1fr 1.4fr 110px 32px', gap: '6px', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px' }}>
                {botaoSeta('↑', `Subir a coluna ${coluna.rotulo}`, !editavel || indice === 0, () => onAlterar(mover(colunas, indice, indice - 1)))}
                {botaoSeta('↓', `Descer a coluna ${coluna.rotulo}`, !editavel || indice === colunas.length - 1, () => onAlterar(mover(colunas, indice, indice + 1)))}
              </div>

              <input
                type="text"
                aria-label={`Nome da coluna ${indice + 1} de ${rotuloTabela}`}
                value={coluna.rotulo}
                disabled={!editavel}
                onChange={evento => {
                  const rotulo = evento.target.value;
                  alterar(
                    indice,
                    chaveFixa
                      ? { rotulo }
                      : {
                        rotulo,
                        chave: gerarChave(
                          rotulo,
                          colunas.filter((_item, posicao) => posicao !== indice).map(item => item.chave)
                        )
                      }
                  );
                }}
                style={{ ...estiloEntradaPainel, minHeight: '32px' }}
              />

              <select
                aria-label={`Tipo da coluna ${coluna.rotulo}`}
                value={coluna.tipo}
                disabled={!editavel}
                onChange={evento => alterar(indice, { tipo: evento.target.value as TipoColunaTabela })}
                style={{ ...estiloEntradaPainel, minHeight: '32px' }}
              >
                {
                  TIPOS_COLUNA.map(
                    tipo => <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>
                  )
                }
              </select>

              <input
                type="text"
                aria-label={`Opções da coluna ${coluna.rotulo}`}
                value={(coluna.opcoes || []).join('; ')}
                disabled={
                  !editavel ||
                  (coluna.tipo !== 'lista' && coluna.tipo !== 'documento' && coluna.tipo !== 'documentos')
                }
                title={
                  coluna.tipo === 'documento' || coluna.tipo === 'documentos'
                    ? 'Tipos de documento aceitos (ex.: POP; IT). Vazio = todos, exceto treinamentos (TRN).'
                    : undefined
                }
                placeholder={
                  coluna.tipo === 'lista'
                    ? 'Opções separadas por ;'
                    : coluna.tipo === 'documento' || coluna.tipo === 'documentos'
                      ? 'Tipos aceitos (ex.: POP; IT)'
                      : '—'
                }
                onChange={evento => alterar(indice, { opcoes: lerOpcoes(evento.target.value) })}
                style={{ ...estiloEntradaPainel, minHeight: '32px' }}
              />

              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={!!coluna.obrigatoria}
                  disabled={!editavel}
                  onChange={evento => alterar(indice, { obrigatoria: evento.target.checked || undefined })}
                />
                Obrigatória
              </label>

              {
                editavel
                  ? (
                    <button
                      type="button"
                      aria-label={`Excluir a coluna ${coluna.rotulo}`}
                      onClick={() => onAlterar(colunas.filter((_item, posicao) => posicao !== indice))}
                      style={{ ...estiloBotaoPequeno(false), minHeight: '28px', padding: 0 }}
                    >
                      ×
                    </button>
                  )
                  : <span />
              }
            </div>
          )
        )
      }

      {
        editavel && (
          <div>
            <button
              type="button"
              onClick={() =>
                onAlterar([
                  ...colunas,
                  {
                    chave: gerarChave('coluna', colunas.map(item => item.chave)),
                    rotulo: `Coluna ${colunas.length + 1}`,
                    tipo: 'texto'
                  }
                ])
              }
              style={estiloBotaoPequeno(false)}
            >
              + Coluna
            </button>
          </div>
        )
      }
    </div>
  );
};

// ------------------------------------------------------------
// Lista de metadados
// ------------------------------------------------------------

const PainelMetadados: React.FC<IPainelMetadadosProps> = ({
  metadados,
  editavel,
  onAlterar,
  usoPorChave,
  dataverseService
}) => {

  const alterar = (
    indice: number,
    parcial: Partial<IFluxoMetadado>
  ): void => {
    onAlterar(
      metadados.map(
        (item, posicao) => posicao === indice ? { ...item, ...parcial } : item
      )
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: COR_AZUL }}>

      {
        metadados.length === 0 && (
          <div style={{ fontSize: '13.5px' }}>
            Nenhum metadado. Crie campos como “Número da não conformidade”, “Valor do pedido”,
            “Exige retreinamento?” ou uma tabela de itens, para usar nas etapas e nas decisões.
          </div>
        )
      }

      {
        metadados.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '820px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '64px 1.6fr 1fr 1.6fr 1.4fr 40px', gap: '8px' }}>
                <span style={estiloRotuloPainel}>Ordem</span>
                <span style={estiloRotuloPainel}>Nome do campo</span>
                <span style={estiloRotuloPainel}>Tipo</span>
                <span style={estiloRotuloPainel} title="Lista de opções: valores separados por ;. Documento referenciado: tipos de documento aceitos (ex.: POP; IT; MAP); vazio = todos, exceto treinamentos (TRN).">Opções / tipos aceitos (separados por ;)</span>
                <span style={estiloRotuloPainel}>Ajuda</span>
                <span />
              </div>

              {
                metadados.map(
                  (metadado, indice) => {

                    const uso =
                      usoPorChave[metadado.chave] || 0;

                    return (
                      <div
                        key={`metadado-${indice}`}
                        style={{ paddingBottom: '8px', borderBottom: `1px dashed ${COR_BORDA}` }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '64px 1.6fr 1fr 1.6fr 1.4fr 40px', gap: '8px', alignItems: 'start' }}>

                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', minHeight: '36px' }}>
                            {botaoSeta('↑', `Subir ${metadado.rotulo}`, !editavel || indice === 0, () => onAlterar(mover(metadados, indice, indice - 1)))}
                            {botaoSeta('↓', `Descer ${metadado.rotulo}`, !editavel || indice === metadados.length - 1, () => onAlterar(mover(metadados, indice, indice + 1)))}
                          </div>

                          <div>
                            <input
                              type="text"
                              aria-label="Nome do campo"
                              value={metadado.rotulo}
                              disabled={!editavel}
                              onChange={evento => {
                                const rotulo = evento.target.value;

                                // Enquanto nenhuma etapa usa o campo, a chave
                                // acompanha o nome; depois disso fica fixa.
                                alterar(
                                  indice,
                                  uso
                                    ? { rotulo }
                                    : {
                                      rotulo,
                                      chave: gerarChave(
                                        rotulo,
                                        metadados.filter((_item, posicao) => posicao !== indice).map(item => item.chave)
                                      )
                                    }
                                );
                              }}
                              style={estiloEntradaPainel}
                            />
                            <div style={{ fontSize: '11.5px', marginTop: '2px' }}>
                              {indice + 1}º · chave: {metadado.chave}
                              {uso ? ` · usado em ${uso} etapa(s)` : ''}
                            </div>
                            <RegraExibicao
                              metadado={metadado}
                              metadados={metadados}
                              editavel={editavel}
                              onAlterar={exibirQuando => alterar(indice, { exibirQuando })}
                            />
                          </div>

                          <select
                            aria-label="Tipo do campo"
                            value={metadado.tipo}
                            disabled={!editavel}
                            onChange={evento => {
                              const tipo = evento.target.value as TipoCampoFluxo;
                              alterar(
                                indice,
                                tipo === 'avaliacao' && !metadado.avaliacao
                                  ? { tipo, avaliacao: configAvaliacaoPadrao() }
                                  : tipo === 'componente' && !metadado.componente
                                  ? { tipo, componente: { tipo: 'nativo', nativo: 'montadorBom', parametros: {} } }
                                  : tipo === 'tabela' && (!metadado.colunas || metadado.colunas.length === 0)
                                  ? {
                                    tipo,
                                    colunas: [
                                      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatoria: true }
                                    ]
                                  }
                                  : { tipo }
                              );
                            }}
                            style={estiloEntradaPainel}
                          >
                            {
                              TIPOS.map(
                                tipo => <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>
                              )
                            }
                          </select>

                          <input
                            type="text"
                            aria-label={metadado.tipo === 'documento' || metadado.tipo === 'documentos' ? 'Tipos de documento aceitos' : 'Opções da lista'}
                            title={
                              metadado.tipo === 'documento' || metadado.tipo === 'documentos'
                                ? 'Tipos de documento que podem ser referenciados (ex.: POP; IT; MAP). Vazio = todos, exceto treinamentos (TRN). Para aceitar treinamentos, inclua TRN.'
                                : undefined
                            }
                            value={(metadado.opcoes || []).join('; ')}
                            disabled={
                              !editavel ||
                              (metadado.tipo !== 'lista' && metadado.tipo !== 'documento' && metadado.tipo !== 'documentos')
                            }
                            placeholder={
                              metadado.tipo === 'lista'
                                ? 'Ex.: Baixo; Médio; Alto'
                                : metadado.tipo === 'documento' || metadado.tipo === 'documentos'
                                  ? 'Tipos aceitos (ex.: POP; IT) — vazio = todos, exceto TRN'
                                  : '—'
                            }
                            onChange={evento => alterar(indice, { opcoes: lerOpcoes(evento.target.value) })}
                            style={estiloEntradaPainel}
                          />

                          <input
                            type="text"
                            aria-label="Texto de ajuda"
                            value={metadado.ajuda || ''}
                            disabled={!editavel}
                            onChange={evento => alterar(indice, { ajuda: evento.target.value || undefined })}
                            style={estiloEntradaPainel}
                          />

                          {
                            editavel
                              ? (
                                <button
                                  type="button"
                                  aria-label={`Excluir o campo ${metadado.rotulo}`}
                                  onClick={() => {
                                    if (
                                      uso > 0 &&
                                      !window.confirm(`O campo "${metadado.rotulo}" é usado em ${uso} etapa(s). Excluir mesmo assim? Ele deixa de aparecer nessas etapas.`)
                                    ) {
                                      return;
                                    }

                                    onAlterar(metadados.filter((_item, posicao) => posicao !== indice));
                                  }}
                                  style={estiloBotaoPequeno(false)}
                                >
                                  ×
                                </button>
                              )
                              : <span />
                          }
                        </div>

                        {
                          metadado.tipo === 'componente' && (
                            <EditorComponente
                              config={metadado.componente}
                              editavel={editavel}
                              rotuloCampo={metadado.rotulo}
                              metadados={metadados}
                              dataverseService={dataverseService}
                              onAlterar={componente => alterar(indice, { componente })}
                            />
                          )
                        }

                        {
                          metadado.tipo === 'avaliacao' && (
                            <EditorAvaliacao
                              config={metadado.avaliacao}
                              editavel={editavel}
                              rotuloCampo={metadado.rotulo}
                              onAlterar={avaliacao => alterar(indice, { avaliacao })}
                            />
                          )
                        }

                        {
                          metadado.tipo === 'tabela' && (
                            <EditorColunas
                              colunas={metadado.colunas || []}
                              editavel={editavel}
                              chaveFixa={uso > 0}
                              rotuloTabela={metadado.rotulo}
                              onAlterar={colunas => alterar(indice, { colunas })}
                            />
                          )
                        }
                      </div>
                    );
                  }
                )
              }
            </div>
          </div>
        )
      }

      {
        editavel && (
          <div>
            <button
              type="button"
              onClick={() => {
                const chave =
                  gerarChave('novo campo', metadados.map(item => item.chave));

                onAlterar([
                  ...metadados,
                  {
                    chave,
                    rotulo: 'Novo campo',
                    tipo: 'texto'
                  }
                ]);
              }}
              style={estiloBotaoPequeno(true)}
            >
              + Metadado
            </button>
          </div>
        )
      }

      <div style={{ fontSize: '12px', lineHeight: '17px' }}>
        Os metadados pertencem ao processo e valem para todas as versões do fluxo. A ordem acima é a
        ordem em que os campos aparecem nas etapas e no documento. A chave acompanha o nome até o campo
        ser usado em alguma etapa; depois fica fixa.
      </div>
    </div>
  );
};

export default PainelMetadados;
