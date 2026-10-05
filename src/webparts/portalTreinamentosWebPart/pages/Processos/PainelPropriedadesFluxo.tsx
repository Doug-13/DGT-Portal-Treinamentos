import * as React from 'react';

import {
  DESCRICAO_TIPO_EVENTO_REVISAO,
  TipoEventoRevisao
} from '../../utils/numeracaoRevisao';

import {
  AcaoSistemaFluxo,
  IFluxoAcao,
  IFluxoCampo,
  IFluxoMetadado,
  IFluxoResponsavel,
  StatusDocumentoEtapa,
  TipoElementoFluxo,
  TipoResponsavelFluxo
} from '../../models/Fluxo';

import {
  gerarChave,
  IConfigElemento,
  IConfigTransicao
} from '../../services/fluxo/bpmn/bpmnConversao';

import {
  IElementoSelecionadoBpmn
} from '../../components/fluxo/bpmn/IModelerFluxo';

import CaminhosSaida, {
  FormCondicaoLigacao,
  IResultadoDisponivel,
  ISaidaElemento
} from './CaminhosSaida';

export type { IResultadoDisponivel, ISaidaElemento };

// ============================================================
// PAINEL DE PROPRIEDADES DO ELEMENTO SELECIONADO NO EDITOR
// ============================================================

// Parte do painel exibida (o modal mostra uma aba por vez).
export type SecaoPainelFluxo =
  | 'tudo'
  | 'geral'
  | 'responsaveis'
  | 'acoes'
  | 'campos'
  | 'caminhos';

export interface IPainelPropriedadesFluxoProps {
  secao?: SecaoPainelFluxo;

  // Opções para responsáveis do tipo Área e Usuário.
  areas?: Array<{ id: string; nome: string; sigla?: string }>;
  usuarios?: Array<{ id: string; nome: string; email?: string }>;

  // Conteúdo extra no fim da aba "campos" (editor de metadados).
  extraCampos?: React.ReactNode;

  selecionado?: IElementoSelecionadoBpmn;
  tipo?: TipoElementoFluxo;
  editavel: boolean;

  configElemento?: IConfigElemento;
  onAlterarElemento: (config: IConfigElemento) => void;

  configTransicao?: IConfigTransicao;
  onAlterarTransicao: (config: IConfigTransicao) => void;

  // Para ligações: o que pode ser escolhido como condição.
  tipoOrigem?: TipoElementoFluxo;
  resultadosDisponiveis: IResultadoDisponivel[];

  metadados: IFluxoMetadado[];

  onRenomear: (nome: string) => void;

  // Caminhos que saem do elemento selecionado (decisão ou etapa).
  saidas: ISaidaElemento[];
  onAlterarSaida: (id: string, config: IConfigTransicao) => void;
  onDefinirPadraoSaida: (id: string | undefined) => void;
  onRenomearSaida: (id: string, nome: string) => void;
  onSelecionarSaida: (id: string) => void;
}

const COR_AZUL = '#202A44';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';

export const estiloRotuloPainel: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: COR_AZUL,
  marginBottom: '4px'
};

export const estiloEntradaPainel: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '36px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '6px 8px',
  fontFamily: 'inherit',
  fontSize: '13.5px',
  color: COR_AZUL,
  background: '#FFFFFF'
};

const estiloGrupo: React.CSSProperties = {
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '10px 12px',
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px'
};

const estiloLegenda: React.CSSProperties = {
  ...estiloRotuloPainel,
  padding: '0 6px',
  marginBottom: 0
};

export const estiloBotaoPequeno = (
  principal: boolean
): React.CSSProperties => ({
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '6px',
  border: `2px solid ${COR_AZUL}`,
  background: principal ? COR_AZUL : '#FFFFFF',
  color: principal ? '#FFFFFF' : COR_AZUL,
  fontWeight: 700,
  fontSize: '12.5px',
  cursor: 'pointer'
});

// Tipos que o sistema sabe transformar em pessoas reais.
const TIPOS_RESPONSAVEL: Array<{ valor: TipoResponsavelFluxo; rotulo: string }> = [
  { valor: 'autorRevisao', rotulo: 'Autor da revisão' },
  { valor: 'gestorArea', rotulo: 'Gestor da área do documento' },
  { valor: 'area', rotulo: 'Área específica' },
  { valor: 'usuario', rotulo: 'Usuário específico' }
];

const DESCRICAO_PADRAO_RESPONSAVEL: Record<TipoResponsavelFluxo, string> = {
  autorRevisao: 'Autor da revisão',
  gestorArea: 'Gestor da área do documento',
  area: 'Membros da área',
  grupo: 'Grupo',
  funcao: 'Função',
  setor: 'Setor',
  usuario: 'Usuário'
};

const STATUS_DOCUMENTO: Array<{ valor: StatusDocumentoEtapa; rotulo: string }> = [
  { valor: 'Elaboração', rotulo: 'Elaboração' },
  { valor: 'Revisão', rotulo: 'Revisão' },
  { valor: 'Aprovação', rotulo: 'Aprovação' },
  { valor: 'Vigente', rotulo: 'Vigente (publica a revisão ao chegar nesta etapa)' }
];

const ACOES_SISTEMA: Array<{ valor: '' | AcaoSistemaFluxo; rotulo: string }> = [
  { valor: '', rotulo: 'Nenhuma (apenas segue o fluxo)' },
  { valor: 'publicarComRetreinamento', rotulo: 'Publicar a revisão e gerar retreinamento' },
  { valor: 'publicarSemRetreinamento', rotulo: 'Publicar a revisão sem retreinamento' }
];

type ModoCampo = 'oculto' | 'editavel' | 'obrigatorio' | 'leitura' | 'condicional';

const modoDoCampo = (
  campo: IFluxoCampo | undefined
): ModoCampo => {

  if (!campo) {
    return 'oculto';
  }

  if (campo.somenteLeitura) {
    return 'leitura';
  }

  if (campo.obrigatorioQuando) {
    return 'condicional';
  }

  return campo.obrigatorio ? 'obrigatorio' : 'editavel';
};

// Identifica o responsável no motor. Área/usuário entram pelo id
// (dois responsáveis iguais têm o mesmo papel).
const papelTesteDe = (
  responsavel: Pick<IFluxoResponsavel, 'tipo' | 'descricao' | 'referenciaId' | 'somenteGestores'>
): string =>
  responsavel.referenciaId
    ? `${responsavel.tipo}:${responsavel.referenciaId}${responsavel.somenteGestores ? ':gestores' : ''}`
    : `${responsavel.tipo}:${gerarChave(responsavel.descricao)}`;

const PainelPropriedadesFluxo: React.FC<IPainelPropriedadesFluxoProps> = ({
  selecionado,
  tipo,
  editavel,
  configElemento,
  onAlterarElemento,
  configTransicao,
  onAlterarTransicao,
  tipoOrigem,
  resultadosDisponiveis,
  metadados,
  onRenomear,
  saidas,
  onAlterarSaida,
  onDefinirPadraoSaida,
  onRenomearSaida,
  onSelecionarSaida,
  secao = 'tudo',
  extraCampos,
  areas = [],
  usuarios = []
}) => {

  const ver = (
    parte: SecaoPainelFluxo
  ): boolean =>
    secao === 'tudo' || secao === parte;


  // O nome é editado localmente e aplicado ao sair do campo, para
  // não gerar um "desfazer" a cada tecla no editor.
  const [nome, setNome] =
    React.useState<string>(selecionado ? selecionado.nome : '');

  React.useEffect(
    () => {
      setNome(selecionado ? selecionado.nome : '');
    },
    [selecionado?.id, selecionado?.nome]
  );

  if (!selecionado) {
    return (
      <div style={{ padding: '16px', fontSize: '13.5px', color: COR_AZUL, lineHeight: '20px' }}>
        <strong>Nenhum elemento selecionado.</strong>
        <br />
        Clique em uma etapa, decisão ou ligação no desenho para configurá-la.
        <ul style={{ margin: '10px 0 0', paddingLeft: '18px' }}>
          <li><strong>Etapa</strong>: responsável, prazo, botões e campos.</li>
          <li><strong>Tarefa de sistema</strong> (troque o tipo da etapa pela chave inglesa): ação automática, como publicar.</li>
          <li><strong>Decisão</strong>: escolhe o caminho; mostra todos os caminhos que saem dela e a condição de cada um.</li>
          <li><strong>Ligação</strong>: condição para seguir por ela.</li>
        </ul>
      </div>
    );
  }

  const campoNome = (
    <div>
      <label htmlFor="prop-nome" style={estiloRotuloPainel}>
        {selecionado.conexao ? 'Texto da ligação' : 'Nome'}
      </label>
      <input
        id="prop-nome"
        type="text"
        value={nome}
        disabled={!editavel}
        onChange={evento => setNome(evento.target.value)}
        onBlur={() => {
          if (nome !== selecionado.nome) {
            onRenomear(nome);
          }
        }}
        onKeyDown={evento => {
          if (evento.key === 'Enter') {
            (evento.target as HTMLInputElement).blur();
          }
        }}
        style={estiloEntradaPainel}
      />
    </div>
  );

  // ----------------------------------------------------------
  // LIGAÇÃO
  // ----------------------------------------------------------

  if (selecionado.conexao) {

    const config: IConfigTransicao =
      configTransicao || { tipoCondicao: 'sempre', padrao: false, excecao: false };

    const alterar = (
      parcial: Partial<IConfigTransicao>
    ): void => {
      onAlterarTransicao({ ...config, ...parcial });
    };

    return (
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', color: COR_AZUL }}>

        {campoNome}

        <FormCondicaoLigacao
          config={config}
          onAlterar={alterar}
          editavel={editavel}
          tipoOrigem={tipoOrigem}
          resultadosDisponiveis={resultadosDisponiveis}
          metadados={metadados}
          prefixoId="prop-ligacao"
        />

        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px' }}>
          <input
            type="checkbox"
            checked={config.padrao}
            disabled={!editavel}
            onChange={evento => alterar({ padrao: evento.target.checked })}
          />
          Caminho padrão (usado quando nenhuma condição for atendida)
        </label>

        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px' }}>
          <input
            type="checkbox"
            checked={config.excecao}
            disabled={!editavel}
            onChange={evento => alterar({ excecao: evento.target.checked })}
          />
          Caminho de devolução/reprovação (desenhado tracejado)
        </label>
      </div>
    );
  }

  // ----------------------------------------------------------
  // ELEMENTO NÃO SUPORTADO
  // ----------------------------------------------------------

  if (!tipo) {
    return (
      <div style={{ padding: '14px 16px', color: COR_AZUL, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {campoNome}
        <div style={{ border: `2px solid ${COR_INDIGO}`, borderRadius: '6px', padding: '10px 12px', fontSize: '13.5px' }}>
          Este tipo de elemento ainda não é suportado pelo motor do fluxo. Troque o tipo
          (chave inglesa no menu do elemento) por Etapa, Tarefa de sistema ou Decisão exclusiva, ou exclua-o.
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // INÍCIO, FIM, DECISÃO
  // ----------------------------------------------------------

  if (tipo === 'inicio' || tipo === 'fim' || tipo === 'gateway') {
    return (
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', color: COR_AZUL }}>
        {ver('geral') && campoNome}
        {
          tipo === 'gateway' && (
            <>
              {
                ver('geral') && (
                  <div style={{ fontSize: '12.5px', lineHeight: '18px', background: '#EDF0F5', borderRadius: '6px', padding: '8px 10px' }}>
                    A decisão não tem responsável: ela escolhe o caminho sozinha, conforme o botão
                    clicado na etapa anterior ou o valor de um campo.
                  </div>
                )
              }

              {ver('caminhos') && <fieldset style={estiloGrupo}>
                <legend style={estiloLegenda}>Para onde vai o documento</legend>
                <CaminhosSaida
                  saidas={saidas}
                  editavel={editavel}
                  tipoOrigem="gateway"
                  resultadosDisponiveis={resultadosDisponiveis}
                  metadados={metadados}
                  onAlterarSaida={onAlterarSaida}
                  onDefinirPadrao={onDefinirPadraoSaida}
                  onRenomearSaida={onRenomearSaida}
                  onSelecionarSaida={onSelecionarSaida}
                />
              </fieldset>}
            </>
          )
        }
      </div>
    );
  }

  const config: IConfigElemento =
    configElemento || { responsaveis: [], acoes: [], campos: [] };

  const alterar = (
    parcial: Partial<IConfigElemento>
  ): void => {
    onAlterarElemento({ ...config, ...parcial });
  };

  // ----------------------------------------------------------
  // TAREFA DE SISTEMA
  // ----------------------------------------------------------

  if (tipo === 'tarefaSistema') {
    return (
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', color: COR_AZUL }}>
        {campoNome}
        <div>
          <label htmlFor="prop-subtitulo" style={estiloRotuloPainel}>Texto no diagrama</label>
          <input
            id="prop-subtitulo"
            type="text"
            value={config.subtitulo || ''}
            disabled={!editavel}
            onChange={evento => alterar({ subtitulo: evento.target.value })}
            style={estiloEntradaPainel}
          />
        </div>
        <div>
          <label htmlFor="prop-acao-sistema" style={estiloRotuloPainel}>O que o sistema faz</label>
          <select
            id="prop-acao-sistema"
            value={config.acaoSistema || ''}
            disabled={!editavel}
            onChange={evento => alterar({ acaoSistema: (evento.target.value || undefined) as AcaoSistemaFluxo | undefined })}
            style={estiloEntradaPainel}
          >
            {
              ACOES_SISTEMA.map(
                item => <option key={item.valor} value={item.valor}>{item.rotulo}</option>
              )
            }
          </select>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            No modo de teste a ação é apenas simulada e registrada no histórico.
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // EVENTO DE REVISÃO
  // ----------------------------------------------------------

  if (tipo === 'eventoRevisao') {

    const tipoRevisao: TipoEventoRevisao =
      config.tipoRevisao || 'revisao';

    const EXEMPLOS: Record<TipoEventoRevisao, string> = {
      subrevisao: 'Rev.00 → Rev.00A → Rev.00B · Rev.01 → Rev.01A',
      revisao: 'Rev.00A → Rev.00 · Rev.00 → Rev.01A · Rev.01B → Rev.01',
      novaRevisao: 'Rev.00 → Rev.01A · Rev.00B → Rev.01A',
      fechar: 'Rev.00B → Rev.00 · Rev.00 continua Rev.00'
    };

    const USO: Record<TipoEventoRevisao, string> = {
      subrevisao: 'Use no caminho de ajustes/reprovação: cada volta gera uma nova letra.',
      revisao: 'Com letra, fecha no número aprovado (use na aprovação); sem letra, abre a próxima revisão em trabalho (use no "Revisar").',
      novaRevisao: 'Sempre abre a próxima revisão em trabalho, mesmo havendo letra.',
      fechar: 'Só fecha a sub-revisão e nunca avança o número (ex.: aprovação sem ajustes continua Rev.00).'
    };

    const exemplo =
      EXEMPLOS[tipoRevisao];

    return (
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', color: COR_AZUL }}>
        {campoNome}

        <fieldset style={estiloGrupo}>
          <legend style={estiloLegenda}>Numeração da revisão</legend>

          {
            (['subrevisao', 'revisao', 'novaRevisao', 'fechar'] as TipoEventoRevisao[]).map(
              opcao => (
                <label
                  key={opcao}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px', marginBottom: '6px' }}
                >
                  <input
                    type="radio"
                    name="prop-tipo-revisao"
                    checked={tipoRevisao === opcao}
                    disabled={!editavel}
                    onChange={() => alterar({ tipoRevisao: opcao })}
                  />
                  {DESCRICAO_TIPO_EVENTO_REVISAO[opcao]}
                </label>
              )
            )
          }

          <div style={{ fontSize: '12.5px', lineHeight: '18px', background: '#EDF0F5', borderRadius: '6px', padding: '8px 10px', marginTop: '4px' }}>
            Quando o documento passa por este evento, o número da revisão muda:
            <br />
            <strong>{exemplo}</strong>
            <br />
            {USO[tipoRevisao]}
          </div>
        </fieldset>

        <div style={{ fontSize: '12px', lineHeight: '17px' }}>
          Regra geral: revisão em trabalho sempre tem letra (o documento nasce Rev.00A) e revisão
          aprovada/publicada nunca tem letra. O evento não tem responsável e tem
          apenas uma saída; para escolher caminhos, use uma decisão depois dele.
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // ETAPA COM RESPONSÁVEL
  // ----------------------------------------------------------

  const alterarResponsavel = (
    indice: number,
    parcial: Partial<IFluxoResponsavel>
  ): void => {

    const responsaveis =
      config.responsaveis.map(
        (item, posicao) => {

          if (posicao !== indice) {
            return item;
          }

          const novo: IFluxoResponsavel = { ...item, ...parcial };

          if (parcial.tipo && parcial.tipo !== item.tipo) {
            novo.descricao = DESCRICAO_PADRAO_RESPONSAVEL[parcial.tipo];
            novo.referenciaId = undefined;
            novo.referenciaNome = undefined;
            novo.somenteGestores = parcial.tipo === 'area' ? true : undefined;
          }

          // Descrição automática ao escolher área/usuário.
          if (parcial.referenciaId !== undefined || parcial.somenteGestores !== undefined) {
            if (novo.tipo === 'area' && novo.referenciaNome) {
              novo.descricao = `${novo.somenteGestores ? 'Gestores' : 'Membros'} da área ${novo.referenciaNome}`;
            }
            if (novo.tipo === 'usuario' && novo.referenciaNome) {
              novo.descricao = novo.referenciaNome;
            }
          }

          novo.papelTeste = papelTesteDe(novo);

          return novo;
        }
      );

    alterar({ responsaveis });
  };

  const alterarAcao = (
    indice: number,
    parcial: Partial<IFluxoAcao>
  ): void => {
    alterar({
      acoes: config.acoes.map(
        (item, posicao) => {
          if (posicao !== indice) {
            return parcial.principal ? { ...item, principal: false } : item;
          }
          return { ...item, ...parcial };
        }
      )
    });
  };

  const alterarModoCampo = (
    metadado: IFluxoMetadado,
    modo: ModoCampo
  ): void => {

    const outros =
      config.campos.filter(item => item.chave !== metadado.chave);

    if (modo === 'oculto') {
      alterar({ campos: outros });
      return;
    }

    const atual =
      config.campos.find(item => item.chave === metadado.chave);

    const base: IFluxoCampo = {
      chave: metadado.chave,
      rotulo: metadado.rotulo,
      tipo: metadado.tipo,
      opcoes: metadado.opcoes,
      ajuda: metadado.ajuda,
      obrigatorio: false,
      validarNosResultados: atual ? atual.validarNosResultados : undefined
    };

    const novo: IFluxoCampo =
      modo === 'condicional' && atual
        ? atual
        : {
          ...base,
          obrigatorio: modo === 'obrigatorio',
          somenteLeitura: modo === 'leitura' ? true : undefined
        };

    // Mantém a ordem dos metadados.
    const campos =
      metadados
        .map(item => item.chave === metadado.chave ? novo : config.campos.find(campo => campo.chave === item.chave))
        .filter((campo): campo is IFluxoCampo => campo !== undefined);

    alterar({ campos });
  };

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', color: COR_AZUL }}>

{ver('geral') && (
<>
      {campoNome}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px', gap: '10px' }}>
        <div>
          <label htmlFor="prop-subtitulo" style={estiloRotuloPainel}>Texto no diagrama</label>
          <input
            id="prop-subtitulo"
            type="text"
            value={config.subtitulo || ''}
            disabled={!editavel}
            onChange={evento => alterar({ subtitulo: evento.target.value })}
            style={estiloEntradaPainel}
          />
        </div>
        <div>
          <label htmlFor="prop-prazo" style={estiloRotuloPainel}>Prazo (dias úteis)</label>
          <input
            id="prop-prazo"
            type="number"
            min={0}
            max={365}
            value={config.prazoDiasUteis === undefined ? '' : config.prazoDiasUteis}
            disabled={!editavel}
            onChange={evento => alterar({
              prazoDiasUteis: evento.target.value === '' ? undefined : Math.round(Number(evento.target.value))
            })}
            style={estiloEntradaPainel}
          />
        </div>
      </div>

      <div>
        <label htmlFor="prop-instrucoes" style={estiloRotuloPainel}>Instruções para o responsável</label>
        <textarea
          id="prop-instrucoes"
          rows={2}
          value={config.instrucoes || ''}
          disabled={!editavel}
          onChange={evento => alterar({ instrucoes: evento.target.value })}
          style={{ ...estiloEntradaPainel, minHeight: '56px' }}
        />
      </div>

      <div>
        <label htmlFor="prop-status-documento" style={estiloRotuloPainel}>Status do documento nesta etapa</label>
        <select
          id="prop-status-documento"
          value={config.statusDocumento || ''}
          disabled={!editavel}
          onChange={evento => alterar({ statusDocumento: (evento.target.value || undefined) as StatusDocumentoEtapa | undefined })}
          style={estiloEntradaPainel}
        >
          <option value="">Automático (Elaboração na 1ª etapa; depois Aprovação)</option>
          {
            STATUS_DOCUMENTO.map(
              item => <option key={item.valor} value={item.valor}>{item.rotulo}</option>
            )
          }
        </select>
        <div style={{ fontSize: '12px', marginTop: '4px' }}>
          É o status que aparece na lista de documentos e nos indicadores enquanto a revisão está nesta etapa.
        </div>

        {
          config.statusDocumento === 'Vigente' && (
            <div style={{ marginTop: '10px', padding: '10px 12px', background: '#E7F6EC', border: '1px solid #107C10', borderRadius: '6px' }}>
              <div style={estiloRotuloPainel}>Publicação nesta etapa</div>
              <div style={{ fontSize: '12px', lineHeight: '17px', marginTop: '6px' }}>
                Ao chegar nesta etapa, a revisão é <strong>publicada</strong>: fica vigente e a anterior vira obsoleta.
                <strong> O retreinamento é decidido pelo fluxo</strong>: com retreinamento quando o documento passou
                por uma etapa opcional de treinamento (ex.: “Revisar Treinamento”) ou quando a resposta sobre
                retreinamento foi “Sim”; caso contrário, sem retreinamento. O número perde a letra (Rev.01B → Rev.01) e
                <strong> o fluxo desta revisão termina aqui</strong> — os botões desta etapa não são usados.
                Para revisar depois, use <strong>“Criar nova revisão”</strong> no documento (nasce Rev.02A, com o próprio fluxo).
              </div>
            </div>
          )
        }
      </div>

</>
)}

      {/* RESPONSÁVEIS */}
      {ver('responsaveis') && <fieldset style={estiloGrupo}>
        <legend style={estiloLegenda}>Responsáveis</legend>

        {
          config.responsaveis.length === 0 && (
            <div style={{ fontSize: '12.5px', color: COR_INDIGO, fontWeight: 600 }}>
              Defina pelo menos um responsável.
            </div>
          )
        }

        {
          config.responsaveis.map(
            (responsavel, indice) => (
              <div key={`resp-${indice}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '8px', borderBottom: `1px dashed ${COR_BORDA}` }}>
                <select
                  aria-label={`Tipo do responsável ${indice + 1}`}
                  value={responsavel.tipo}
                  disabled={!editavel}
                  onChange={evento => alterarResponsavel(indice, { tipo: evento.target.value as TipoResponsavelFluxo })}
                  style={estiloEntradaPainel}
                >
                  {
                    TIPOS_RESPONSAVEL.map(
                      item => <option key={item.valor} value={item.valor}>{item.rotulo}</option>
                    )
                  }
                  {
                    !TIPOS_RESPONSAVEL.some(item => item.valor === responsavel.tipo) && (
                      <option value={responsavel.tipo}>
                        {DESCRICAO_PADRAO_RESPONSAVEL[responsavel.tipo]} (não suportado — troque o tipo)
                      </option>
                    )
                  }
                </select>

                {
                  responsavel.tipo === 'area' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        aria-label={`Área do responsável ${indice + 1}`}
                        value={responsavel.referenciaId || ''}
                        disabled={!editavel}
                        onChange={evento => {
                          const area = areas.find(item => item.id === evento.target.value);
                          alterarResponsavel(indice, {
                            referenciaId: area ? area.id : '',
                            referenciaNome: area ? area.nome : undefined
                          });
                        }}
                        style={{ ...estiloEntradaPainel, flex: '1 1 200px' }}
                      >
                        <option value="">Escolha a área...</option>
                        {
                          areas.map(
                            area => <option key={area.id} value={area.id}>{area.sigla ? `${area.sigla} — ` : ''}{area.nome}</option>
                          )
                        }
                      </select>
                      <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px' }}>
                        <input
                          type="checkbox"
                          checked={!!responsavel.somenteGestores}
                          disabled={!editavel}
                          onChange={evento => alterarResponsavel(indice, { somenteGestores: evento.target.checked })}
                        />
                        Somente gestores da área
                      </label>
                    </div>
                  )
                }

                {
                  responsavel.tipo === 'usuario' && (
                    <select
                      aria-label={`Usuário responsável ${indice + 1}`}
                      value={responsavel.referenciaId || ''}
                      disabled={!editavel}
                      onChange={evento => {
                        const usuario = usuarios.find(item => item.id === evento.target.value);
                        alterarResponsavel(indice, {
                          referenciaId: usuario ? usuario.id : '',
                          referenciaNome: usuario ? usuario.nome : undefined
                        });
                      }}
                      style={estiloEntradaPainel}
                    >
                      <option value="">Escolha o usuário...</option>
                      {
                        usuarios.map(
                          usuario => <option key={usuario.id} value={usuario.id}>{usuario.nome}{usuario.email ? ` (${usuario.email})` : ''}</option>
                        )
                      }
                    </select>
                  )
                }

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    aria-label={`Descrição do responsável ${indice + 1}`}
                    value={responsavel.descricao}
                    disabled={!editavel}
                    onChange={evento => alterarResponsavel(indice, { descricao: evento.target.value })}
                    placeholder="Como aparece para os usuários"
                    style={estiloEntradaPainel}
                  />
                  {
                    editavel && (
                      <button
                        type="button"
                        aria-label={`Remover responsável ${indice + 1}`}
                        onClick={() => alterar({ responsaveis: config.responsaveis.filter((_item, posicao) => posicao !== indice) })}
                        style={estiloBotaoPequeno(false)}
                      >
                        ×
                      </button>
                    )
                  }
                </div>
              </div>
            )
          )
        }

        {
          editavel && (
            <div>
              <button
                type="button"
                onClick={() => {
                  const novo: IFluxoResponsavel = {
                    tipo: 'autorRevisao',
                    descricao: DESCRICAO_PADRAO_RESPONSAVEL.autorRevisao,
                    papelTeste: ''
                  };
                  novo.papelTeste = papelTesteDe(novo);
                  alterar({ responsaveis: [...config.responsaveis, novo] });
                }}
                style={estiloBotaoPequeno(false)}
              >
                + Responsável
              </button>
            </div>
          )
        }

        <div style={{ fontSize: '12px', lineHeight: '17px' }}>
          <strong>Autor da revisão</strong>: quem criou a revisão (no primeiro cadastro, quem criou o documento).{' '}
          <strong>Gestor da área do documento</strong>: os Gestores da área do documento (Áreas e acessos).{' '}
          <strong>Área específica</strong>: membros (ou só gestores) da área escolhida.{' '}
          Qualquer um dos responsáveis pode executar a etapa; somente eles veem os botões.
        </div>
      </fieldset>}

      {/* AÇÕES */}
      {ver('acoes') && <fieldset style={estiloGrupo}>
        <legend style={estiloLegenda}>Botões (ações)</legend>

        {
          config.acoes.map(
            (acao, indice) => (
              <div key={`acao-${indice}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '8px', borderBottom: `1px dashed ${COR_BORDA}` }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    aria-label={`Texto do botão ${indice + 1}`}
                    value={acao.rotulo}
                    disabled={!editavel}
                    onChange={evento => alterarAcao(indice, { rotulo: evento.target.value })}
                    placeholder="Ex.: Aprovar"
                    style={estiloEntradaPainel}
                  />
                  {
                    editavel && config.acoes.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remover botão ${indice + 1}`}
                        onClick={() => alterar({ acoes: config.acoes.filter((_item, posicao) => posicao !== indice) })}
                        style={estiloBotaoPequeno(false)}
                      >
                        ×
                      </button>
                    )
                  }
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <label htmlFor={`acao-resultado-${indice}`} style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Resultado</label>
                  <input
                    id={`acao-resultado-${indice}`}
                    type="text"
                    value={acao.resultado}
                    disabled={!editavel}
                    onChange={evento => alterarAcao(indice, { resultado: gerarChave(evento.target.value) })}
                    style={{ ...estiloEntradaPainel, minHeight: '30px', fontSize: '12.5px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12.5px' }}>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="acao-principal"
                      checked={acao.principal}
                      disabled={!editavel}
                      onChange={() => alterarAcao(indice, { principal: true })}
                    />
                    Principal
                  </label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={acao.exigeComentario}
                      disabled={!editavel}
                      onChange={evento => alterarAcao(indice, { exigeComentario: evento.target.checked })}
                    />
                    Exige comentário
                  </label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!acao.dispensaCampos}
                      disabled={!editavel}
                      onChange={evento => alterarAcao(indice, { dispensaCampos: evento.target.checked || undefined })}
                    />
                    Não exige campos obrigatórios
                  </label>
                </div>
              </div>
            )
          )
        }

        {
          editavel && (
            <div>
              <button
                type="button"
                onClick={() => {
                  const resultados = config.acoes.map(item => item.resultado);
                  const resultado = gerarChave('nova ação', resultados);
                  alterar({
                    acoes: [
                      ...config.acoes,
                      {
                        chave: gerarChave(`acao ${resultado}`, config.acoes.map(item => item.chave)),
                        rotulo: 'Nova ação',
                        resultado,
                        principal: config.acoes.length === 0,
                        exigeComentario: false
                      }
                    ]
                  });
                }}
                style={estiloBotaoPequeno(false)}
              >
                + Botão
              </button>
            </div>
          )
        }

        <div style={{ fontSize: '12px', lineHeight: '17px' }}>
          Cada botão gera um <strong>resultado</strong>. Nas ligações que saem desta etapa
          (ou da decisão logo depois), escolha o resultado que leva a cada caminho.
        </div>
      </fieldset>}

      {/* CAMPOS */}
      {ver('campos') && <fieldset style={estiloGrupo}>
        <legend style={estiloLegenda}>Campos nesta etapa</legend>

        {
          metadados.length === 0
            ? (
              <div style={{ fontSize: '12.5px' }}>
                O processo ainda não tem metadados. Cadastre-os logo abaixo, em “Metadados do processo”.
              </div>
            )
            : metadados.map(
              metadado => {

                const campo =
                  config.campos.find(item => item.chave === metadado.chave);

                const modo =
                  modoDoCampo(campo);

                return (
                  <div key={metadado.chave} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px' }}>{metadado.rotulo}</span>
                    <select
                      aria-label={`Uso do campo ${metadado.rotulo}`}
                      value={modo}
                      disabled={!editavel}
                      onChange={evento => alterarModoCampo(metadado, evento.target.value as ModoCampo)}
                      style={{ ...estiloEntradaPainel, minHeight: '32px', fontSize: '12.5px' }}
                    >
                      <option value="oculto">Não exibir</option>
                      <option value="editavel">Opcional</option>
                      <option value="obrigatorio">Obrigatório</option>
                      <option value="leitura">Somente leitura</option>
                      {
                        modo === 'condicional' && (
                          <option value="condicional">Obrigatório com condição (modelo)</option>
                        )
                      }
                    </select>
                  </div>
                );
              }
            )
        }
      </fieldset>}

      {ver('campos') && extraCampos}

      {/* CAMINHOS DE SAÍDA */}
      {ver('caminhos') && <fieldset style={estiloGrupo}>
        <legend style={estiloLegenda}>Para onde vai o documento</legend>
        <CaminhosSaida
          saidas={saidas}
          editavel={editavel}
          tipoOrigem="tarefaHumana"
          resultadosDisponiveis={resultadosDisponiveis}
          metadados={metadados}
          onAlterarSaida={onAlterarSaida}
          onDefinirPadrao={onDefinirPadraoSaida}
          onRenomearSaida={onRenomearSaida}
          onSelecionarSaida={onSelecionarSaida}
        />
      </fieldset>}
    </div>
  );
};

export default PainelPropriedadesFluxo;
