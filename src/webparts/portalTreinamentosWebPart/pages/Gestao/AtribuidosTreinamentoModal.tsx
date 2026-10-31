import * as React from 'react';

import StatusBadge from
  '../../components/common/StatusBadge';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  AtribuicoesTreinamentoService,
  IAtribuicaoTreinamento
} from '../../services/AtribuicoesTreinamentoService';

// ============================================================
// PESSOAS ATRIBUÍDAS AO TREINAMENTO (modal)
//
// Aberto pelo menu ⋮ da Gestão de treinamentos.
// - Lista todas as pessoas com o treinamento atribuído, com
//   status, origem, trilha, prazos, conclusão e nota.
// - "Remover atribuição": desativa o registro (nunca apaga) e
//   exige motivo. Atribuições concluídas não podem ser removidas.
// ============================================================

export interface IAtribuidosTreinamentoModalProps {
  treinamento?: {
    id: string;
    nome: string;
    codigo: string;
    ativo: boolean;
  };
  dataverseService: DataverseService;
  // Somente perfis que podem atribuir também podem remover.
  podeRemover: boolean;
  responsavelId?: string;
  responsavelNome?: string;
  onFechar: () => void;
}

const cores = {
  azul: '#0B5CAB',
  azulEscuro: '#0B2D4D',
  branco: '#FFFFFF',
  texto: '#18324A',
  textoSecundario: '#66788A',
  borda: '#D8E2EC',
  fundo: '#F6F9FC',
  verde: '#13795B',
  verdeClaro: '#E7F5EE',
  vermelho: '#B42318',
  vermelhoClaro: '#FDE7E9',
  ambar: '#6A4B00',
  ambarClaro: '#FFF4CE'
};

const botao: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: `1px solid ${cores.borda}`,
  background: cores.branco,
  color: cores.texto,
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer'
};

const botaoPerigo: React.CSSProperties = {
  ...botao,
  borderColor: cores.vermelho,
  color: cores.vermelho
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 10px',
  fontSize: '12px',
  fontWeight: 700,
  color: cores.textoSecundario,
  borderBottom: `1px solid ${cores.borda}`,
  whiteSpace: 'nowrap'
};

const td: React.CSSProperties = {
  padding: '10px 10px',
  fontSize: '13px',
  borderBottom: `1px solid ${cores.borda}`,
  verticalAlign: 'top'
};

const formatarData = (
  valor: string
): string => {

  if (!valor) {
    return '-';
  }

  // Datas "somente data" (yyyy-mm-dd) não devem sofrer fuso.
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-');
    return `${d}/${m}/${a}`;
  }

  const data =
    new Date(valor);

  return isNaN(data.getTime())
    ? '-'
    : data.toLocaleDateString('pt-BR');
};

type Filtro = 'ativas' | 'pendentes' | 'concluidas' | 'removidas' | 'todas';

const ehPendente = (
  item: IAtribuicaoTreinamento
): boolean =>
  item.ativo &&
  !item.concluida;

const AtribuidosTreinamentoModal: React.FC<IAtribuidosTreinamentoModalProps> = (
  props
) => {

  const service =
    React.useMemo(
      () =>
        new AtribuicoesTreinamentoService(
          props.dataverseService
        ),
      [
        props.dataverseService
      ]
    );

  const [itens, setItens] =
    React.useState<IAtribuicaoTreinamento[]>([]);

  const [carregando, setCarregando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  const [mensagem, setMensagem] =
    React.useState('');

  const [filtro, setFiltro] =
    React.useState<Filtro>('ativas');

  const [pesquisa, setPesquisa] =
    React.useState('');

  // Atribuição em confirmação de remoção.
  const [removendo, setRemovendo] =
    React.useState<IAtribuicaoTreinamento | undefined>(undefined);

  const [motivo, setMotivo] =
    React.useState('');

  const [processando, setProcessando] =
    React.useState(false);

  const [erroRemocao, setErroRemocao] =
    React.useState('');

  const treinamentoId =
    props.treinamento?.id || '';

  const carregar =
    React.useCallback(
      async (): Promise<void> => {

        if (!treinamentoId) {
          return;
        }

        setCarregando(true);
        setErro('');

        try {
          setItens(
            await service.listarPorTreinamento(
              treinamentoId
            )
          );
        } catch (e) {
          setErro(
            e instanceof Error
              ? e.message
              : 'Erro ao carregar as pessoas atribuídas.'
          );
        } finally {
          setCarregando(false);
        }
      },
      [
        service,
        treinamentoId
      ]
    );

  React.useEffect(
    () => {
      if (treinamentoId) {
        setFiltro('ativas');
        setPesquisa('');
        setMensagem('');
        setRemovendo(undefined);
        setMotivo('');
        setErroRemocao('');
        setItens([]);
        carregar().catch((e: unknown) => console.error(e));
      }
    },
    [
      treinamentoId,
      carregar
    ]
  );

  const contagem =
    React.useMemo(
      () => ({
        ativas:
          itens.filter(i => i.ativo).length,
        pendentes:
          itens.filter(ehPendente).length,
        concluidas:
          itens.filter(i => i.ativo && i.concluida).length,
        removidas:
          itens.filter(i => !i.ativo).length,
        todas:
          itens.length
      }),
      [
        itens
      ]
    );

  const visiveis =
    React.useMemo(
      () => {

        const termo =
          pesquisa
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        return itens
          .filter(item => {
            switch (filtro) {
              case 'ativas': return item.ativo;
              case 'pendentes': return ehPendente(item);
              case 'concluidas': return item.ativo && item.concluida;
              case 'removidas': return !item.ativo;
              default: return true;
            }
          })
          .filter(item => {
            if (!termo) {
              return true;
            }

            const alvo =
              `${item.usuarioNome} ${item.usuarioEmail} ${item.trilha} ${item.origem}`
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

            return alvo.indexOf(termo) >= 0;
          });
      },
      [
        itens,
        filtro,
        pesquisa
      ]
    );

  if (!props.treinamento) {
    return null;
  }

  const confirmarRemocao =
    async (): Promise<void> => {

      if (!removendo) {
        return;
      }

      setProcessando(true);
      setErroRemocao('');

      try {

        const retorno =
          await service.remover({
            atribuicaoId:
              removendo.id,
            motivo,
            responsavelId:
              props.responsavelId,
            responsavelNome:
              props.responsavelNome,
            treinamentoNome:
              props.treinamento?.nome
          });

        setMensagem(
          `Atribuição de ${removendo.usuarioNome} removida. O registro foi mantido no histórico.` +
          (retorno.avisoAuditoria ? ` ${retorno.avisoAuditoria}` : '')
        );

        setRemovendo(undefined);
        setMotivo('');

        await carregar();

      } catch (e) {

        setErroRemocao(
          e instanceof Error
            ? e.message
            : 'Erro ao remover a atribuição.'
        );

      } finally {

        setProcessando(false);
      }
    };

  const filtros: Array<{ id: Filtro; rotulo: string }> = [
    { id: 'ativas', rotulo: 'Ativas' },
    { id: 'pendentes', rotulo: 'Pendentes' },
    { id: 'concluidas', rotulo: 'Concluídas' },
    { id: 'removidas', rotulo: 'Removidas' },
    { id: 'todas', rotulo: 'Todas' }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pessoas atribuídas ao treinamento"
      onClick={() => {
        if (!processando) {
          props.onFechar();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 45, 77, 0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflowY: 'auto'
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1080px',
          background: cores.branco,
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(11, 45, 77, 0.25)',
          color: cores.texto
        }}
      >

        {/* Cabeçalho */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${cores.borda}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            alignItems: 'flex-start'
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                color: cores.textoSecundario,
                fontWeight: 600,
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}
            >
              Pessoas atribuídas
            </div>

            <h2
              style={{
                margin: '4px 0 0',
                fontSize: '19px',
                color: cores.azulEscuro
              }}
            >
              {props.treinamento.nome}
            </h2>

            <div
              style={{
                marginTop: '4px',
                fontSize: '13px',
                color: cores.textoSecundario,
                fontWeight: 600
              }}
            >
              {props.treinamento.codigo}
              {!props.treinamento.ativo && (
                <span style={{ marginLeft: '8px', color: cores.ambar }}>
                  · Treinamento desativado (colaboradores veem apenas o certificado)
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => { carregar().catch((e: unknown) => console.error(e)); }}
              disabled={carregando || processando}
              style={{ ...botao, opacity: carregando ? 0.6 : 1 }}
            >
              Atualizar
            </button>

            <button
              type="button"
              onClick={props.onFechar}
              disabled={processando}
              style={botao}
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Filtros + pesquisa */}
        <div
          style={{
            padding: '14px 24px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
            borderBottom: `1px solid ${cores.borda}`,
            background: cores.fundo
          }}
        >
          {filtros.map(item => {
            const ativo = filtro === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFiltro(item.id)}
                style={{
                  ...botao,
                  padding: '6px 12px',
                  background: ativo ? cores.azulEscuro : cores.branco,
                  color: ativo ? cores.branco : cores.texto,
                  borderColor: ativo ? cores.azulEscuro : cores.borda
                }}
              >
                {item.rotulo} ({contagem[item.id]})
              </button>
            );
          })}

          <input
            value={pesquisa}
            onChange={event => setPesquisa(event.target.value)}
            placeholder="Pesquisar por nome, e-mail, trilha ou origem"
            style={{
              marginLeft: 'auto',
              minWidth: '260px',
              padding: '8px 12px',
              border: `1px solid ${cores.borda}`,
              borderRadius: '8px',
              fontSize: '13px'
            }}
          />
        </div>

        {/* Corpo */}
        <div style={{ padding: '20px 24px 26px' }}>

          {mensagem && (
            <div
              style={{
                padding: '12px 14px',
                background: cores.verdeClaro,
                color: cores.verde,
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px'
              }}
            >
              {mensagem}
            </div>
          )}

          {erro && (
            <div
              style={{
                padding: '12px 14px',
                background: cores.vermelhoClaro,
                color: cores.vermelho,
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px'
              }}
            >
              {erro}
            </div>
          )}

          {/* Confirmação de remoção */}
          {removendo && (
            <div
              style={{
                padding: '16px',
                border: `1px solid ${cores.vermelho}`,
                background: '#FFF8F8',
                borderRadius: '10px',
                marginBottom: '16px'
              }}
            >
              <strong style={{ color: cores.vermelho }}>
                Remover a atribuição de {removendo.usuarioNome}?
              </strong>

              <div
                style={{
                  marginTop: '6px',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: cores.texto
                }}
              >
                O treinamento deixa de aparecer para o colaborador. O registro
                não é apagado: fica marcado como removido, com o motivo, e
                continua consultável no filtro “Removidas”. Se precisar, é
                possível atribuir de novo depois.
              </div>

              <label
                style={{
                  display: 'block',
                  marginTop: '12px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Motivo da remoção *
              </label>

              <textarea
                rows={3}
                value={motivo}
                onChange={event => setMotivo(event.target.value)}
                placeholder="Ex.: atribuído por engano; colaborador mudou de função; desligado da área..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: '6px',
                  padding: '10px 12px',
                  border: `1px solid ${cores.borda}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  resize: 'vertical'
                }}
              />

              {erroRemocao && (
                <div
                  style={{
                    marginTop: '10px',
                    color: cores.vermelho,
                    fontSize: '13px'
                  }}
                >
                  {erroRemocao}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  disabled={processando || motivo.trim().length < 5}
                  onClick={() => { confirmarRemocao().catch((e: unknown) => console.error(e)); }}
                  style={{
                    ...botao,
                    background: cores.vermelho,
                    borderColor: cores.vermelho,
                    color: cores.branco,
                    opacity: processando || motivo.trim().length < 5 ? 0.6 : 1
                  }}
                >
                  {processando ? 'Removendo...' : 'Confirmar remoção'}
                </button>

                <button
                  type="button"
                  disabled={processando}
                  onClick={() => {
                    setRemovendo(undefined);
                    setMotivo('');
                    setErroRemocao('');
                  }}
                  style={botao}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {carregando && (
            <div style={{ color: cores.textoSecundario, fontSize: '14px' }}>
              Carregando pessoas atribuídas...
            </div>
          )}

          {!carregando && !erro && visiveis.length === 0 && (
            <div
              style={{
                padding: '22px',
                textAlign: 'center',
                color: cores.textoSecundario,
                background: cores.fundo,
                borderRadius: '10px',
                fontSize: '14px'
              }}
            >
              {itens.length === 0
                ? 'Ninguém tem este treinamento atribuído.'
                : 'Nenhuma atribuição neste filtro.'}
            </div>
          )}

          {!carregando && visiveis.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse'
                }}
              >
                <thead>
                  <tr>
                    <th style={th}>Colaborador</th>
                    <th style={th}>Status</th>
                    <th style={th}>Origem / trilha</th>
                    <th style={th}>Atribuído em</th>
                    <th style={th}>Prazo</th>
                    <th style={th}>Conclusão</th>
                    <th style={th}>Nota</th>
                    <th style={th}>Validade</th>
                    {props.podeRemover && <th style={th} />}
                  </tr>
                </thead>

                <tbody>
                  {visiveis.map(item => (
                    <tr
                      key={item.id}
                      style={{
                        opacity: item.ativo ? 1 : 0.65
                      }}
                    >
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>
                          {item.usuarioNome}
                        </div>
                        {item.usuarioEmail && (
                          <div style={{ color: cores.textoSecundario, fontSize: '12px' }}>
                            {item.usuarioEmail}
                          </div>
                        )}
                      </td>

                      <td style={td}>
                        <StatusBadge status={item.status} />
                        {item.revisaoTreinada && (
                          <div style={{ color: cores.textoSecundario, fontSize: '12px', marginTop: '4px' }}>
                            {item.revisaoTreinada}
                          </div>
                        )}
                      </td>

                      <td style={td}>
                        <div>{item.origem}</div>
                        {item.trilha && (
                          <div style={{ color: cores.textoSecundario, fontSize: '12px' }}>
                            {item.trilha}
                          </div>
                        )}
                      </td>

                      <td style={td}>{formatarData(item.dataAtribuicao)}</td>
                      <td style={td}>{formatarData(item.dataLimite)}</td>
                      <td style={td}>{formatarData(item.dataConclusao)}</td>
                      <td style={td}>
                        {item.nota !== undefined && !isNaN(item.nota)
                          ? `${item.nota}%`
                          : '-'}
                      </td>
                      <td style={td}>{formatarData(item.dataValidade)}</td>

                      {props.podeRemover && (
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {item.ativo && !item.concluida && (
                            <button
                              type="button"
                              disabled={processando}
                              onClick={() => {
                                setRemovendo(item);
                                setMotivo('');
                                setErroRemocao('');
                                setMensagem('');
                              }}
                              style={botaoPerigo}
                            >
                              Remover
                            </button>
                          )}

                          {item.ativo && item.concluida && (
                            <span
                              title="Atribuição concluída é evidência do treinamento e mantém o certificado; não pode ser removida."
                              style={{ color: cores.textoSecundario, fontSize: '12px' }}
                            >
                              Concluído
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AtribuidosTreinamentoModal;
