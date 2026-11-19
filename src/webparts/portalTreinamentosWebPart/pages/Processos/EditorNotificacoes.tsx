import * as React from 'react';

import {
  IFluxoAcao,
  IFluxoMetadado,
  IFluxoResponsavel,
  TipoResponsavelFluxo
} from '../../models/Fluxo';

import {
  CANAIS_NOTIFICACAO,
  CanalNotificacao,
  IConfigNotificacao,
  MARCADORES_NOTIFICACAO,
  MOMENTOS_NOTIFICACAO,
  MomentoNotificacao,
  configNotificacaoPadrao,
  validarConfigNotificacao
} from '../../services/fluxo/notificacaoFluxo';

// ============================================================
// NOTIFICAÇÕES DO FLUXO — CONFIGURAÇÃO
//
// modo 'atividade': aba "Notificações" da etapa com responsável.
//   Várias notificações; cada uma envia quando a atividade COMEÇA ou é
//   CONCLUÍDA (com filtro opcional pelo resultado da ação).
// modo 'evento': evento de notificação (círculo com carta). Envia ao
//   passar pelo evento; o fluxo não para.
//
// Destinatários usam os mesmos tipos de responsável do fluxo e são
// resolvidos na hora do envio. O envio é feito pelo Power Automate
// (docs/notificacoes-fluxo.md).
// ============================================================

export interface IEditorNotificacoesProps {
  modo: 'atividade' | 'evento';
  notificacoes?: IConfigNotificacao[];
  editavel: boolean;
  nomeElemento: string;
  metadados: IFluxoMetadado[];
  usuarios: Array<{ id: string; nome: string; email?: string }>;
  areas: Array<{ id: string; nome: string; sigla?: string }>;
  // Ações da atividade (filtro "só quando o resultado for...").
  acoes?: IFluxoAcao[];
  onAlterar: (notificacoes: IConfigNotificacao[]) => void;
}

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO2 = '#64748B';
const COR_ERRO = '#B42318';

const entrada: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: '32px', border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px', padding: '4px 8px', fontSize: '13px', color: COR_AZUL, fontFamily: 'inherit', background: '#FFFFFF'
};

const titulo: React.CSSProperties = {
  fontSize: '11px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: COR_AZUL, margin: '12px 0 4px'
};

const ajuda: React.CSSProperties = { fontSize: '12px', color: COR_TEXTO2, margin: '2px 0 6px' };

const pequeno = (perigo = false): React.CSSProperties => ({
  minHeight: '30px', padding: '0 10px', borderRadius: '6px', border: `1px solid ${perigo ? COR_ERRO : COR_BORDA}`,
  background: '#FFFFFF', color: perigo ? COR_ERRO : COR_AZUL, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer'
});

const cartao: React.CSSProperties = {
  border: `1px solid ${COR_BORDA}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '12px', background: '#FFFFFF'
};

const linhaFlex: React.CSSProperties = { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' };

// Tipos de destinatário oferecidos (mesma resolução das pendências).
const TIPOS_DESTINATARIO: Array<{ valor: TipoResponsavelFluxo; rotulo: string }> = [
  { valor: 'autorRevisao', rotulo: 'Autor da revisão' },
  { valor: 'gestorArea', rotulo: 'Gestores da área do documento' },
  { valor: 'area', rotulo: 'Área específica' },
  { valor: 'usuario', rotulo: 'Usuário específico' },
  { valor: 'campoUsuario', rotulo: 'Usuário de um metadado' }
];

const descricaoDestinatario = (
  responsavel: IFluxoResponsavel
): string => {
  const tipo = TIPOS_DESTINATARIO.find(item => item.valor === responsavel.tipo);
  const base = tipo ? tipo.rotulo : responsavel.descricao;
  if (responsavel.tipo === 'area') {
    return `${responsavel.somenteGestores ? 'Gestores da área' : 'Membros da área'} ${responsavel.referenciaNome || ''}`.trim();
  }
  if (responsavel.tipo === 'usuario' || responsavel.tipo === 'campoUsuario') {
    return `${base}: ${responsavel.referenciaNome || '(escolha)'}`;
  }
  return base;
};

const novoDestinatario = (
  tipo: TipoResponsavelFluxo
): IFluxoResponsavel => ({
  tipo,
  descricao: (TIPOS_DESTINATARIO.find(item => item.valor === tipo) || { rotulo: tipo }).rotulo,
  papelTeste: `notificacao-${tipo}`,
  somenteGestores: tipo === 'area' ? true : undefined
});

const EditorNotificacoes: React.FC<IEditorNotificacoesProps> = ({
  modo, notificacoes, editavel, nomeElemento, metadados, usuarios, areas, acoes = [], onAlterar
}) => {

  const lista: IConfigNotificacao[] =
    notificacoes && notificacoes.length > 0
      ? notificacoes
      : modo === 'evento' ? [configNotificacaoPadrao('evento')] : [];

  const [tipoNovo, setTipoNovo] = React.useState<{ [chave: string]: TipoResponsavelFluxo }>({});

  const camposUsuario = metadados.filter(item => item.tipo === 'usuario');

  const alterar = (indice: number, parcial: Partial<IConfigNotificacao>): void =>
    onAlterar(lista.map((item, i) => (i === indice ? { ...item, ...parcial } : item)));

  const alterarDestinatario = (indice: number, posicao: number, parcial: Partial<IFluxoResponsavel>): void =>
    alterar(indice, {
      destinatarios: lista[indice].destinatarios.map((item, i) => (i === posicao ? { ...item, ...parcial } : item))
    });

  const alternarCanal = (indice: number, canal: CanalNotificacao): void => {
    const canais = lista[indice].canais;
    alterar(indice, { canais: canais.indexOf(canal) >= 0 ? canais.filter(item => item !== canal) : canais.concat([canal]) });
  };

  const alternarResultado = (indice: number, resultado: string): void => {
    const atuais = lista[indice].resultados || [];
    alterar(indice, {
      resultados: atuais.indexOf(resultado) >= 0 ? atuais.filter(item => item !== resultado) : atuais.concat([resultado])
    });
  };

  const resultados = acoes
    .map(acao => ({ resultado: acao.resultado, rotulo: acao.rotulo }))
    .filter((item, i, todos) => item.resultado && todos.findIndex(outro => outro.resultado === item.resultado) === i);

  return (
    <div style={{ color: COR_AZUL, fontSize: '13px' }}>

      <p style={ajuda}>
        {modo === 'evento'
          ? 'Ao passar por este evento, o fluxo envia a notificação abaixo e segue em frente (não espera).'
          : 'Avise os responsáveis desta atividade por e-mail (e, se quiser, pelo Teams) quando ela começar ou for concluída. O envio é feito pelo Power Automate.'}
      </p>

      {lista.length === 0 && (
        <div style={{ ...cartao, color: COR_TEXTO2, textAlign: 'center' }}>
          Nenhuma notificação nesta atividade.
        </div>
      )}

      {lista.map((config, indice) => {

        const erros = validarConfigNotificacao(config, nomeElemento || 'esta etapa');
        const tipoEscolhido = tipoNovo[config.chave] || 'autorRevisao';

        return (
          <div key={config.chave} style={{ ...cartao, borderLeft: `4px solid ${config.ativa ? COR_CIANO : COR_BORDA}` }}>

            <div style={{ ...linhaFlex, justifyContent: 'space-between' }}>
              <label style={{ ...linhaFlex, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={config.ativa}
                  disabled={!editavel}
                  onChange={evento => alterar(indice, { ativa: evento.target.checked })}
                />
                ✉ {modo === 'evento' ? 'Notificação ativa' : `Notificação ${indice + 1}`}
              </label>
              {modo === 'atividade' && editavel && (
                <button type="button" style={pequeno(true)} onClick={() => onAlterar(lista.filter((_item, i) => i !== indice))}>
                  Remover
                </button>
              )}
            </div>

            {modo === 'atividade' && (
              <>
                <div style={titulo}>Quando enviar</div>
                <select
                  style={entrada}
                  value={config.momento}
                  disabled={!editavel}
                  onChange={evento => alterar(indice, { momento: evento.target.value as MomentoNotificacao })}
                >
                  {MOMENTOS_NOTIFICACAO.map(item => <option key={item.valor} value={item.valor}>{item.nome}</option>)}
                </select>

                {config.momento === 'aoConcluir' && resultados.length > 0 && (
                  <>
                    <p style={ajuda}>Só quando a ação for (nenhum marcado = qualquer ação):</p>
                    <div style={linhaFlex}>
                      {resultados.map(item => (
                        <label key={item.resultado} style={linhaFlex}>
                          <input
                            type="checkbox"
                            disabled={!editavel}
                            checked={(config.resultados || []).indexOf(item.resultado) >= 0}
                            onChange={() => alternarResultado(indice, item.resultado)}
                          />
                          {item.rotulo}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {modo === 'atividade' ? (
              <>
                <div style={titulo}>Quem recebe</div>
                <p style={{ ...ajuda, color: COR_AZUL }}>
                  Os <b>responsáveis desta atividade</b> (aba Responsáveis), por <b>e-mail</b>.
                  Se o responsável for uma área, todas as pessoas da área (ou só os gestores, se assim estiver configurado) recebem.
                </p>
                <label style={{ ...linhaFlex, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    disabled={!editavel}
                    checked={config.canais.indexOf('teams') >= 0}
                    onChange={evento => alterar(indice, { canais: evento.target.checked ? ['email', 'teams'] : ['email'] })}
                  />
                  Notificar também via Teams
                </label>
                <p style={ajuda}>Cada responsável recebe também uma mensagem no chat do Teams.</p>
              </>
            ) : (
              <>
              <div style={titulo}>Quem recebe</div>

              {config.destinatarios.map((destinatario, posicao) => (
                <div key={`${destinatario.tipo}-${posicao}`} style={{ ...linhaFlex, marginBottom: '6px' }}>
                  <span style={{ flex: '1 1 180px', fontWeight: 600 }}>{descricaoDestinatario(destinatario)}</span>

                  {destinatario.tipo === 'area' && (
                    <>
                      <select
                        style={{ ...entrada, flex: '1 1 160px', width: 'auto' }}
                        value={destinatario.referenciaId || ''}
                        disabled={!editavel}
                        onChange={evento => {
                          const area = areas.find(item => item.id === evento.target.value);
                          alterarDestinatario(indice, posicao, { referenciaId: area ? area.id : undefined, referenciaNome: area ? area.nome : undefined });
                        }}
                      >
                        <option value="">Escolha a área</option>
                        {areas.map(area => <option key={area.id} value={area.id}>{area.sigla ? `${area.sigla} — ${area.nome}` : area.nome}</option>)}
                      </select>
                      <label style={linhaFlex}>
                        <input
                          type="checkbox"
                          disabled={!editavel}
                          checked={!!destinatario.somenteGestores}
                          onChange={evento => alterarDestinatario(indice, posicao, { somenteGestores: evento.target.checked })}
                        />
                        Só gestores
                      </label>
                    </>
                  )}

                  {destinatario.tipo === 'usuario' && (
                    <select
                      style={{ ...entrada, flex: '1 1 180px', width: 'auto' }}
                      value={destinatario.referenciaId || ''}
                      disabled={!editavel}
                      onChange={evento => {
                        const usuario = usuarios.find(item => item.id === evento.target.value);
                        alterarDestinatario(indice, posicao, { referenciaId: usuario ? usuario.id : undefined, referenciaNome: usuario ? usuario.nome : undefined });
                      }}
                    >
                      <option value="">Escolha o usuário</option>
                      {usuarios.map(usuario => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
                    </select>
                  )}

                  {destinatario.tipo === 'campoUsuario' && (
                    <select
                      style={{ ...entrada, flex: '1 1 180px', width: 'auto' }}
                      value={destinatario.referenciaId || ''}
                      disabled={!editavel}
                      onChange={evento => {
                        const campo = camposUsuario.find(item => item.chave === evento.target.value);
                        alterarDestinatario(indice, posicao, { referenciaId: campo ? campo.chave : undefined, referenciaNome: campo ? campo.rotulo : undefined });
                      }}
                    >
                      <option value="">Escolha o campo Usuário</option>
                      {camposUsuario.map(campo => <option key={campo.chave} value={campo.chave}>{campo.rotulo}</option>)}
                    </select>
                  )}

                  {editavel && (
                    <button
                      type="button"
                      style={pequeno(true)}
                      title="Remover destinatário"
                      onClick={() => alterar(indice, { destinatarios: config.destinatarios.filter((_item, i) => i !== posicao) })}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {editavel && (
                <div style={{ ...linhaFlex, marginTop: '4px' }}>
                  <select
                    style={{ ...entrada, flex: '1 1 200px', width: 'auto' }}
                    value={tipoEscolhido}
                    onChange={evento => setTipoNovo({ ...tipoNovo, [config.chave]: evento.target.value as TipoResponsavelFluxo })}
                  >
                    {TIPOS_DESTINATARIO.map(item => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
                  </select>
                  <button
                    type="button"
                    style={pequeno()}
                    onClick={() => alterar(indice, { destinatarios: config.destinatarios.concat([novoDestinatario(tipoEscolhido)]) })}
                  >
                    + Adicionar destinatário
                  </button>
                </div>
              )}

              <div style={titulo}>E-mails adicionais (opcional)</div>
              <input
                style={entrada}
                value={config.emailsAdicionais || ''}
                disabled={!editavel}
                placeholder="ex.: qualidade@empresa.com.br; controladoria@empresa.com.br"
                onChange={evento => alterar(indice, { emailsAdicionais: evento.target.value })}
              />
              <p style={ajuda}>Somente caixas corporativas. Valem apenas para o canal E-mail.</p>

              <div style={titulo}>Canais</div>
              <div style={linhaFlex}>
                {CANAIS_NOTIFICACAO.map(canal => (
                  <label key={canal.valor} style={linhaFlex}>
                    <input
                      type="checkbox"
                      disabled={!editavel}
                      checked={config.canais.indexOf(canal.valor) >= 0}
                      onChange={() => alternarCanal(indice, canal.valor)}
                    />
                    {canal.nome}
                  </label>
                ))}
              </div>
              </>
            )}

            <div style={titulo}>Assunto</div>
            <input
              style={entrada}
              value={config.assunto}
              disabled={!editavel}
              onChange={evento => alterar(indice, { assunto: evento.target.value })}
            />

            <div style={titulo}>Mensagem</div>
            <textarea
              style={{ ...entrada, minHeight: '120px', resize: 'vertical' }}
              value={config.mensagem}
              disabled={!editavel}
              onChange={evento => alterar(indice, { mensagem: evento.target.value })}
            />

            <details style={{ marginTop: '6px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px', color: COR_TEXTO2 }}>Marcadores que podem ser usados no texto</summary>
              <div style={{ fontSize: '12px', color: COR_TEXTO2, marginTop: '4px' }}>
                {MARCADORES_NOTIFICACAO.map(item => (
                  <div key={item.marcador}><code>{item.marcador}</code> — {item.descricao}</div>
                ))}
                {metadados.length > 0 && (
                  <div style={{ marginTop: '4px' }}>
                    Campos deste processo: {metadados.map(item => <code key={item.chave} style={{ marginRight: '6px' }}>{`{campo:${item.chave}}`}</code>)}
                  </div>
                )}
              </div>
            </details>

            {erros.length > 0 && (
              <div style={{ marginTop: '8px', color: COR_ERRO, fontSize: '12px' }}>
                {erros.map(erro => <div key={erro}>• {erro}</div>)}
              </div>
            )}
          </div>
        );
      })}

      {modo === 'atividade' && editavel && (
        <button
          type="button"
          style={{ ...pequeno(), borderColor: COR_CIANO }}
          onClick={() => onAlterar(lista.concat([configNotificacaoPadrao('atividade')]))}
        >
          + Nova notificação
        </button>
      )}
    </div>
  );
};

export default EditorNotificacoes;
