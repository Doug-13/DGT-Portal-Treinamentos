import * as React from 'react';

import {
  GRUPOS_ORCAMENTO,
  IContaOrcamento,
  PLANO_CONTAS
} from '../../services/orcamento/planoContasOrcamento';

import {
  COR,
  FONTE,
  botao,
  campo
} from './orcamentoComum';

// ============================================================
// ADICIONAR LINHA — escolhe a conta no plano de contas
//
// A mesma conta pode entrar mais de uma vez (ex.: duas licenças de
// software diferentes), cada uma com a sua descrição. O modal fica
// aberto para incluir várias contas seguidas.
// ============================================================

export interface IAdicionarLinhaModalProps {
  // Códigos já presentes na planilha (só para sinalizar).
  codigosNaPlanilha: string[];
  // Grupos que a área preenche (vazio/undefined = todos).
  gruposPermitidos?: string[];
  // Contas calculadas por regra: só podem existir uma vez.
  codigosCalculados?: string[];
  // Contas do modelo que não estão na planilha.
  quantidadeFaltantes?: number;
  onIncluirFaltantes?: () => void;
  onAdicionar: (conta: IContaOrcamento, descricao: string) => void;
  onFechar: () => void;
}

const normalizar = (valor: string): string =>
  valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const AdicionarLinhaModal: React.FC<IAdicionarLinhaModalProps> = (props) => {

  const [busca, setBusca] = React.useState('');
  const [grupo, setGrupo] = React.useState('');
  const [descricao, setDescricao] = React.useState('');
  const [ultimaIncluida, setUltimaIncluida] = React.useState('');

  const permitidos = props.gruposPermitidos && props.gruposPermitidos.length > 0
    ? props.gruposPermitidos
    : undefined;

  const gruposVisiveis =
    GRUPOS_ORCAMENTO.filter(item => !permitidos || permitidos.indexOf(item) >= 0);

  const resultados =
    React.useMemo(() => {
      const termo = normalizar(busca.trim());
      return PLANO_CONTAS.filter(item =>
        (!permitidos || permitidos.indexOf(item.grupo) >= 0) &&
        (!grupo || item.grupo === grupo) &&
        (!termo ||
          normalizar(item.conta).indexOf(termo) >= 0 ||
          item.codigo.indexOf(termo) >= 0 ||
          normalizar(item.grupo).indexOf(termo) >= 0)
      );
    }, [busca, grupo, permitidos]);

  const { onFechar } = props;

  React.useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') {
        onFechar();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const adicionar = (conta: IContaOrcamento): void => {
    props.onAdicionar(conta, descricao.trim());
    setUltimaIncluida(`${conta.codigo} ${conta.conta}`);
    setDescricao('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar linha ao orçamento"
      onClick={props.onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, .45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: FONTE
      }}
    >
      <div
        onClick={evento => evento.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '760px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(15,23,42,.25)'
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${COR.borda}` }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: COR.azul }}>
            Adicionar linha
          </div>
          <div style={{ fontSize: '13px', color: COR.texto2, marginTop: '4px' }}>
            Escolha a conta do plano de contas. Você pode incluir várias seguidas; os valores são preenchidos na tabela.
            {permitidos && ' Aparecem só os grupos configurados para a sua área.'}
          </div>
        </div>

        <div style={{ padding: '14px 22px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px' }}>
          <input
            type="search"
            autoFocus
            placeholder="Buscar por conta, código ou grupo..."
            value={busca}
            onChange={evento => setBusca(evento.target.value)}
            style={campo}
            aria-label="Buscar conta"
          />
          <select
            value={grupo}
            onChange={evento => setGrupo(evento.target.value)}
            style={campo}
            aria-label="Filtrar por grupo"
          >
            <option value="">Todos os grupos</option>
            {gruposVisiveis.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Descrição da linha (opcional) — ex.: Licença do sistema X"
            value={descricao}
            maxLength={400}
            onChange={evento => setDescricao(evento.target.value)}
            style={{ ...campo, gridColumn: '1 / -1' }}
            aria-label="Descrição da linha"
          />
        </div>

        <div style={{ overflowY: 'auto', padding: '0 22px', flex: 1 }}>
          {resultados.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: COR.texto2, fontSize: '13px' }}>
              Nenhuma conta encontrada.
            </div>
          )}
          {resultados.map(item => {
            const jaExiste = props.codigosNaPlanilha.indexOf(item.codigo) >= 0;
            return (
              <div
                key={`${item.grupo}|${item.codigo}|${item.conta}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '9px 0',
                  borderBottom: `1px solid ${COR.borda}`
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: COR.azul }}>
                    {item.conta}
                  </div>
                  <div style={{ fontSize: '12px', color: COR.texto2 }}>
                    {item.codigo} · {item.grupo}
                    {jaExiste && (
                      <span style={{ marginLeft: '8px', color: '#0F6CBD', fontWeight: 700 }}>
                        já na planilha
                      </span>
                    )}
                  </div>
                </div>
                {jaExiste && (props.codigosCalculados || []).indexOf(item.codigo) >= 0 ? (
                  <span style={{ fontSize: '12px', color: '#00707F', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    ƒ calculada
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => adicionar(item)}
                    style={botao(jaExiste ? 'secundario' : 'principal')}
                  >
                    {jaExiste ? '+ Outra linha' : '+ Adicionar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: '14px 22px',
            borderTop: `1px solid ${COR.borda}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ flex: 1, fontSize: '12.5px', color: '#107C10', fontWeight: 600 }}>
            {ultimaIncluida ? `✓ Incluída: ${ultimaIncluida}` : ''}
          </div>
          {!!props.quantidadeFaltantes && props.onIncluirFaltantes && (
            <button
              type="button"
              onClick={() => {
                if (props.onIncluirFaltantes) {
                  props.onIncluirFaltantes();
                }
                setUltimaIncluida(`${props.quantidadeFaltantes} conta(s) do modelo`);
              }}
              style={botao('secundario')}
              title="Inclui de volta todas as contas da planilha modelo que não estão na sua planilha"
            >
              Incluir as contas que faltam ({props.quantidadeFaltantes})
            </button>
          )}
          <button type="button" onClick={props.onFechar} style={botao('secundario')}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdicionarLinhaModal;
