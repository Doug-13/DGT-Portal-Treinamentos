import * as React from 'react';

import {
  IDemandaBom
} from '../../services/bom/BomService';

import {
  OPCOES_BOM
} from '../../services/bom/esquemaBom';

import {
  COR,
  botao,
  campo,
  cartao,
  chip,
  rotulo
} from './arquiteturaComum';

// ============================================================
// ETAPA 1 — DADOS DA DEMANDA
//
// Campos marcados com * são obrigatórios para concluir a etapa e
// liberar a Matriz Go/No-Go. Dá para salvar um rascunho incompleto.
// ============================================================

export interface IUsuarioOpcao {
  id: string;
  nome: string;
}

export interface IDadosDemandaEtapaProps {
  demanda: IDemandaBom;
  usuarios: IUsuarioOpcao[];
  // Membros da área ARQ (aparecem primeiro como responsáveis).
  membrosArea: string[];
  // Já existe análise Go/No-Go: o canal fica travado.
  canalTravado: boolean;
  salvando: boolean;
  onSalvar: (
    demanda: IDemandaBom,
    responsaveis: string[],
    principalId: string,
    concluir: boolean
  ) => Promise<void>;
}

const chaves = (mapa: Record<string, number>): string[] => Object.keys(mapa);

type ErroCampo =
  | 'nome' | 'cliente' | 'canal' | 'tipoEntrega' | 'dataEntrada'
  | 'prazoEntrega' | 'responsaveis' | 'solucoes' | 'prazoOrdem';

const NOME_ERRO: Record<ErroCampo, string> = {
  nome: 'Projeto/demanda',
  cliente: 'Cliente',
  canal: 'Canal',
  tipoEntrega: 'Tipo de entrega',
  dataEntrada: 'Data de entrada',
  prazoEntrega: 'Prazo de entrega',
  responsaveis: 'Responsáveis',
  solucoes: 'Soluções de interesse',
  prazoOrdem: 'O prazo deve ser igual ou posterior à data de entrada'
};

const Secao: React.FC<{ titulo: string }> = ({ titulo, children }) => (
  <div style={{ ...cartao }}>
    <h3 style={{ margin: '0 0 14px', fontSize: '15px', color: COR.azul }}>{titulo}</h3>
    {children}
  </div>
);

const Grade: React.FC<{ minimo?: number }> = ({ minimo = 220, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${minimo}px, 1fr))`, gap: '12px 16px', marginBottom: '12px' }}>
    {children}
  </div>
);

const DadosDemandaEtapa: React.FC<IDadosDemandaEtapaProps> = ({
  demanda,
  usuarios,
  membrosArea,
  canalTravado,
  salvando,
  onSalvar
}) => {

  const [d, setD] = React.useState<IDemandaBom>(demanda);
  const [responsaveis, setResponsaveis] = React.useState<string[]>(
    demanda.responsaveis.filter(item => item.ativo).map(item => item.usuarioId)
  );
  const [principal, setPrincipal] = React.useState<string>(
    (demanda.responsaveis.find(item => item.ativo && item.principal) || demanda.responsaveis.find(item => item.ativo) || { usuarioId: '' }).usuarioId
  );
  const [erros, setErros] = React.useState<ErroCampo[]>([]);

  React.useEffect(() => {
    setD(demanda);
    setResponsaveis(demanda.responsaveis.filter(item => item.ativo).map(item => item.usuarioId));
    setErros([]);
  }, [demanda]);

  const alterar = <K extends keyof IDemandaBom>(chave: K, valor: IDemandaBom[K]): void =>
    setD(atual => ({ ...atual, [chave]: valor }));

  const validar = (): ErroCampo[] => {
    const lista: ErroCampo[] = [];
    if (!d.nome.trim() || d.nome === 'Nova demanda (sem título)') lista.push('nome');
    if (!d.cliente.trim()) lista.push('cliente');
    if (!d.canal) lista.push('canal');
    if (!d.tipoEntrega) lista.push('tipoEntrega');
    if (!d.dataEntrada) lista.push('dataEntrada');
    if (!d.prazoEntrega) lista.push('prazoEntrega');
    if (d.dataEntrada && d.prazoEntrega && d.prazoEntrega < d.dataEntrada) lista.push('prazoOrdem');
    if (responsaveis.length === 0) lista.push('responsaveis');
    if (d.solucoes.length === 0) lista.push('solucoes');
    return lista;
  };

  const erro = (chave: ErroCampo): React.CSSProperties =>
    erros.indexOf(chave) >= 0 ? { borderColor: '#B42318', background: '#FFF8F8' } : {};

  const salvar = (concluir: boolean): void => {
    const lista = concluir ? validar() : [];
    setErros(lista);
    if (lista.length > 0) {
      window.scrollTo(0, 0);
      return;
    }
    const principalFinal =
      responsaveis.indexOf(principal) >= 0 ? principal : (responsaveis[0] || '');
    onSalvar(
      { ...d, cadastroCompleto: concluir ? true : d.cadastroCompleto },
      responsaveis,
      principalFinal,
      concluir
    ).catch(() => undefined);
  };

  const alternarResponsavel = (id: string): void =>
    setResponsaveis(atual => atual.indexOf(id) >= 0 ? atual.filter(item => item !== id) : atual.concat([id]));

  const alternarSolucao = (nome: string): void =>
    alterar('solucoes', d.solucoes.indexOf(nome) >= 0 ? d.solucoes.filter(item => item !== nome) : d.solucoes.concat([nome]));

  const opcoesResponsaveis =
    usuarios
      .slice()
      .sort((a, b) => {
        const aa = membrosArea.indexOf(a.id) >= 0 ? 0 : 1;
        const bb = membrosArea.indexOf(b.id) >= 0 ? 0 : 1;
        return aa - bb || a.nome.localeCompare(b.nome);
      })
      .filter(item => membrosArea.length === 0 || membrosArea.indexOf(item.id) >= 0 || responsaveis.indexOf(item.id) >= 0);

  const Escolha: React.FC<{ chave: keyof IDemandaBom; mapa: Record<string, number>; travado?: boolean; erroCampo?: ErroCampo }> = ({ chave, mapa, travado, erroCampo }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {
        chaves(mapa).map(opcao => (
          <button
            key={opcao}
            type="button"
            disabled={travado || salvando}
            aria-pressed={d[chave] === opcao}
            onClick={() => alterar(chave, opcao as never)}
            style={{ ...chip(d[chave] === opcao), ...(erroCampo ? erro(erroCampo) : {}), opacity: travado ? 0.6 : 1 }}
          >
            {d[chave] === opcao ? '✓ ' : ''}{opcao}
          </button>
        ))
      }
    </div>
  );

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: COR.texto2 }}>
        Preencha as informações da demanda antes da análise Go/No-Go. Campos com <strong>*</strong> são obrigatórios
        para concluir a etapa. Canal e soluções de interesse serão usados na seleção de kit.
      </p>

      {
        erros.length > 0 && (
          <div role="alert" style={{ ...cartao, background: '#FDE7E9', borderColor: '#B42318', color: COR.azul, fontSize: '13px' }}>
            <strong>Faltam campos obrigatórios:</strong> {erros.map(item => NOME_ERRO[item]).join(' · ')}
          </div>
        )
      }

      <Secao titulo="Identificação">
        <Grade minimo={260}>
          <div>
            <label style={rotulo} htmlFor="dm-nome">Projeto / demanda *</label>
            <input id="dm-nome" style={{ ...campo, ...erro('nome') }} value={d.nome === 'Nova demanda (sem título)' ? '' : d.nome} placeholder="Ex.: PREFEITURA DE XYZ - VIDEOMONITORAMENTO" onChange={e => alterar('nome', e.target.value)} />
          </div>
          <div>
            <label style={rotulo} htmlFor="dm-cliente">Cliente *</label>
            <input id="dm-cliente" style={{ ...campo, ...erro('cliente') }} value={d.cliente} placeholder="Ex.: Prefeitura Municipal de XYZ" onChange={e => alterar('cliente', e.target.value)} />
          </div>
          <div>
            <label style={rotulo} htmlFor="dm-cigam">Código do cliente no CIGAM</label>
            <input id="dm-cigam" style={campo} value={d.codigoCigam} onChange={e => alterar('codigoCigam', e.target.value)} />
          </div>
        </Grade>
        <Grade>
          <div>
            <label style={rotulo} htmlFor="dm-mun">Município</label>
            <input id="dm-mun" style={campo} value={d.municipio} onChange={e => alterar('municipio', e.target.value)} />
          </div>
          <div>
            <span style={rotulo}>UF</span>
            <Escolha chave="uf" mapa={OPCOES_BOM.uf} />
          </div>
          <div>
            <label style={rotulo} htmlFor="dm-crm">Nº da oportunidade no CRM</label>
            <input id="dm-crm" style={campo} value={d.numeroCrm} onChange={e => alterar('numeroCrm', e.target.value)} />
          </div>
        </Grade>
        <Grade>
          <div>
            <span style={rotulo}>Canal *</span>
            <Escolha chave="canal" mapa={OPCOES_BOM.canal} travado={canalTravado} erroCampo="canal" />
            {canalTravado && <span style={{ fontSize: '11px', color: COR.texto2 }}>Travado: a demanda já tem análise Go/No-Go.</span>}
          </div>
          <div>
            <label style={rotulo} htmlFor="dm-exec">Executivo de vendas</label>
            <select id="dm-exec" style={campo} value={d.executivoVendasId} onChange={e => alterar('executivoVendasId', e.target.value)}>
              <option value="">Selecione…</option>
              {usuarios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </div>
        </Grade>
        <div>
          <span style={rotulo}>Modalidade</span>
          <Escolha chave="modalidade" mapa={OPCOES_BOM.modalidade} />
        </div>
      </Secao>

      <Secao titulo="Responsáveis e prazos">
        <span style={rotulo}>Responsáveis na Arquitetura de Soluções *</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
          {
            opcoesResponsaveis.map(item => {
              const marcado = responsaveis.indexOf(item.id) >= 0;
              return (
                <button key={item.id} type="button" disabled={salvando} aria-pressed={marcado} onClick={() => alternarResponsavel(item.id)} style={{ ...chip(marcado), ...erro('responsaveis') }}>
                  {marcado ? '✓ ' : ''}{item.nome}{marcado && principal === item.id ? ' · principal' : ''}
                </button>
              );
            })
          }
        </div>
        {
          responsaveis.length > 1 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ ...rotulo, display: 'inline', marginRight: '8px' }} htmlFor="dm-principal">Responsável principal</label>
              <select id="dm-principal" style={{ ...campo, width: 'auto' }} value={principal} onChange={e => setPrincipal(e.target.value)}>
                {responsaveis.map(id => <option key={id} value={id}>{(usuarios.find(item => item.id === id) || { nome: id }).nome}</option>)}
              </select>
            </div>
          )
        }
        <Grade>
          <div>
            <label style={rotulo} htmlFor="dm-ent">Data de entrada *</label>
            <input id="dm-ent" type="date" style={{ ...campo, ...erro('dataEntrada') }} value={d.dataEntrada} onChange={e => alterar('dataEntrada', e.target.value)} />
          </div>
          <div>
            <label style={rotulo} htmlFor="dm-prazo">Prazo de entrega *</label>
            <input id="dm-prazo" type="date" style={{ ...campo, ...erro('prazoEntrega'), ...erro('prazoOrdem') }} value={d.prazoEntrega} onChange={e => alterar('prazoEntrega', e.target.value)} />
          </div>
          <div>
            <label style={rotulo} htmlFor="dm-obs">Etapa / observação</label>
            <input id="dm-obs" style={campo} value={d.observacaoEtapa} placeholder="Ex.: aguardando cotação inicial" onChange={e => alterar('observacaoEtapa', e.target.value)} />
          </div>
        </Grade>
        <div>
          <span style={rotulo}>Status da demanda</span>
          <Escolha chave="statusDemanda" mapa={OPCOES_BOM.statusDemanda} />
        </div>
      </Secao>

      <Secao titulo="Escopo">
        <div style={{ marginBottom: '12px' }}>
          <span style={rotulo}>Tipo de entrega *</span>
          <Escolha chave="tipoEntrega" mapa={OPCOES_BOM.tipoEntrega} erroCampo="tipoEntrega" />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <span style={rotulo}>Soluções de interesse *</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {
              chaves(OPCOES_BOM.solucoesInteresse).map(nome => {
                const marcado = d.solucoes.indexOf(nome) >= 0;
                return (
                  <button key={nome} type="button" disabled={salvando} aria-pressed={marcado} onClick={() => alternarSolucao(nome)} style={{ ...chip(marcado), ...erro('solucoes') }}>
                    {marcado ? '✓ ' : ''}{nome}
                  </button>
                );
              })
            }
          </div>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <span style={rotulo}>Tipo de projeto</span>
          <Escolha chave="tipoProjeto" mapa={OPCOES_BOM.tipoProjeto} />
        </div>
        <Grade>
          <div>
            <label style={rotulo} htmlFor="dm-pontos">Pontos estimados</label>
            <input id="dm-pontos" type="number" min={0} style={campo} value={d.pontosEstimados === undefined ? '' : d.pontosEstimados} onChange={e => alterar('pontosEstimados', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <label style={rotulo} htmlFor="dm-link">Link do edital ou termo de referência</label>
            <input id="dm-link" type="url" style={campo} value={d.linkEdital} placeholder="https://… (SharePoint ou site do órgão)" onChange={e => alterar('linkEdital', e.target.value)} />
          </div>
        </Grade>
        <label style={rotulo} htmlFor="dm-escopo">Descrição do escopo</label>
        <textarea id="dm-escopo" rows={4} style={{ ...campo, resize: 'vertical' }} value={d.escopo} onChange={e => alterar('escopo', e.target.value)} />
        <p style={{ margin: '10px 0 0', fontSize: '12px', color: COR.texto2 }}>
          Dados pessoais sensíveis (CPF, CNPJ, dados bancários) não devem ser informados aqui. O cliente é identificado pelo nome e pelo código no CIGAM.
        </p>
      </Secao>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" style={botao('secundario', salvando)} disabled={salvando} onClick={() => salvar(false)}>
          Salvar rascunho
        </button>
        <button type="button" style={botao('principal', salvando)} disabled={salvando} onClick={() => salvar(true)}>
          {salvando ? 'Salvando…' : d.cadastroCompleto ? 'Salvar alterações' : 'Concluir e ir para o Go/No-Go →'}
        </button>
      </div>
    </div>
  );
};

export default DadosDemandaEtapa;
