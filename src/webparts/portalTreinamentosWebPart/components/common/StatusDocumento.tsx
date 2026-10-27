import * as React from 'react';

// ============================================================
// STATUS E ETAPA DE DOCUMENTOS — IDENTIFICAÇÃO VISUAL
//
// Cada situação tem cor + ícone + rótulo, para que o status seja
// reconhecido mesmo sem depender só da cor:
//
//   ✓ Vigente      verde     publicado e em vigor
//   ✎ Elaboração   índigo    sendo escrito/ajustado
//   ⟳ Revisão      ciano     em análise técnica
//   ⏳ Aprovação    âmbar     aguardando decisão do gestor
//   ⊘ Cancelada    cinza     encerrada sem publicação
//   ✕ Obsoleta     vermelho  substituída por revisão mais nova
//   ■ Concluído    verde-cinza  fluxo terminado, sem ação pendente
//
// O texto exibido continua sendo o status original (ex.: "Elaboração"),
// para não afetar filtros, pesquisa e exportações.
// ============================================================

export type CategoriaStatusDocumento =
  | 'vigente'
  | 'elaboracao'
  | 'revisao'
  | 'aprovacao'
  | 'cancelada'
  | 'obsoleta'
  | 'concluido'
  | 'etapa'
  | 'indefinido';

export interface IEstiloStatusDocumento {
  categoria: CategoriaStatusDocumento;
  cor: string;
  fundo: string;
  borda: string;
  icone: string;
  dica: string;
}

export const ESTILOS_STATUS_DOCUMENTO:
  Record<CategoriaStatusDocumento, IEstiloStatusDocumento> = {
  vigente: {
    categoria: 'vigente',
    cor: '#067647',
    fundo: '#ECFDF3',
    borda: '#ABEFC6',
    icone: '✓',
    dica: 'Publicado e em vigor. Não há ação pendente.'
  },
  elaboracao: {
    categoria: 'elaboracao',
    cor: '#3E4DA8',
    fundo: '#EEF0FB',
    borda: '#C5CBF0',
    icone: '✎',
    dica: 'Revisão sendo elaborada.'
  },
  revisao: {
    categoria: 'revisao',
    cor: '#05737E',
    fundo: '#E6F9FC',
    borda: '#9EE7F1',
    icone: '⟳',
    dica: 'Revisão em análise técnica.'
  },
  aprovacao: {
    categoria: 'aprovacao',
    cor: '#B54708',
    fundo: '#FFFAEB',
    borda: '#FEDF89',
    icone: '⏳',
    dica: 'Aguardando aprovação.'
  },
  cancelada: {
    categoria: 'cancelada',
    cor: '#475467',
    fundo: '#F2F4F7',
    borda: '#D0D5DD',
    icone: '⊘',
    dica: 'Revisão cancelada (não foi publicada).'
  },
  obsoleta: {
    categoria: 'obsoleta',
    cor: '#B42318',
    fundo: '#FEF3F2',
    borda: '#FECDCA',
    icone: '✕',
    dica: 'Substituída por uma revisão mais nova.'
  },
  concluido: {
    categoria: 'concluido',
    cor: '#3B6E57',
    fundo: '#F1F6F3',
    borda: '#CFE1D6',
    icone: '■',
    dica: 'Fluxo concluído. Não há ação pendente.'
  },
  etapa: {
    categoria: 'etapa',
    cor: '#202A44',
    fundo: '#EDF0F5',
    borda: '#D9D9D6',
    icone: '→',
    dica: 'Etapa do fluxo do processo.'
  },
  indefinido: {
    categoria: 'indefinido',
    cor: '#5E6670',
    fundo: '#F2F2F2',
    borda: '#D9D9D6',
    icone: '•',
    dica: ''
  }
};

const normalizar = (
  valor?: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// Status do treinamento do usuário (a ação que ele precisa tomar).
export const ESTILOS_STATUS_TREINAMENTO: Record<string, IEstiloStatusDocumento> = {
  'Vencido': {
    categoria: 'obsoleta',
    cor: '#B42318',
    fundo: '#FEF3F2',
    borda: '#FECDCA',
    icone: '!',
    dica: 'Validade expirada: refaça o treinamento (reciclagem).'
  },
  'Reprovado': {
    categoria: 'obsoleta',
    cor: '#C4320A',
    fundo: '#FFF6ED',
    borda: '#FDDCAB',
    icone: '✕',
    dica: 'Reprovado na avaliação: faça uma nova tentativa.'
  },
  'Em andamento': {
    categoria: 'aprovacao',
    cor: '#B54708',
    fundo: '#FFFAEB',
    borda: '#FEDF89',
    icone: '▶',
    dica: 'Treinamento iniciado: continue de onde parou.'
  },
  'Disponível': {
    categoria: 'revisao',
    cor: '#05737E',
    fundo: '#E6F9FC',
    borda: '#9EE7F1',
    icone: '★',
    dica: 'Liberado para você: pode iniciar.'
  },
  'Concluído': {
    categoria: 'vigente',
    cor: '#067647',
    fundo: '#ECFDF3',
    borda: '#ABEFC6',
    icone: '✓',
    dica: 'Concluído.'
  }
};

// Status do documento ou da revisão (dgt_status).
export const estiloStatusDocumento = (
  status?: string
): IEstiloStatusDocumento => {

  const valor =
    normalizar(status);

  if (!valor) {
    return ESTILOS_STATUS_DOCUMENTO.indefinido;
  }

  if (valor.indexOf('vigente') >= 0 || valor.indexOf('publicad') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.vigente;
  }

  if (valor.indexOf('aprov') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.aprovacao;
  }

  if (valor.indexOf('revis') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.revisao;
  }

  if (valor.indexOf('elabor') >= 0 || valor.indexOf('rascunho') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.elaboracao;
  }

  if (valor.indexOf('cancel') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.cancelada;
  }

  if (valor.indexOf('obsolet') >= 0 || valor.indexOf('substitu') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.obsoleta;
  }

  if (valor.indexOf('conclu') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.concluido;
  }

  return ESTILOS_STATUS_DOCUMENTO.indefinido;
};

// Etapa do fluxo do processo: a cor segue a natureza da etapa pelo
// nome (ex.: "Aprovação do gestor" → âmbar; "Revisão técnica" → ciano).
export const estiloEtapaFluxo = (
  nomeEtapa?: string
): IEstiloStatusDocumento => {

  const valor =
    normalizar(nomeEtapa);

  if (valor.indexOf('aprov') >= 0 || valor.indexOf('homolog') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.aprovacao;
  }

  if (
    valor.indexOf('revis') >= 0 ||
    valor.indexOf('parecer') >= 0 ||
    valor.indexOf('analis') >= 0 ||
    valor.indexOf('valida') >= 0
  ) {
    return ESTILOS_STATUS_DOCUMENTO.revisao;
  }

  if (valor.indexOf('public') >= 0 || valor.indexOf('vigent') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.vigente;
  }

  if (valor.indexOf('elabor') >= 0 || valor.indexOf('redig') >= 0 || valor.indexOf('ajust') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.elaboracao;
  }

  if (valor.indexOf('conclu') >= 0) {
    return ESTILOS_STATUS_DOCUMENTO.concluido;
  }

  return ESTILOS_STATUS_DOCUMENTO.etapa;
};

const estiloPilula = (
  estilo: IEstiloStatusDocumento,
  destaque: boolean
): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '3px 10px 3px 8px',
  borderRadius: '999px',
  background: estilo.fundo,
  color: estilo.cor,
  border: destaque ? '1.5px solid #05C3DD' : `1px solid ${estilo.borda}`,
  boxShadow: destaque ? '0 0 0 2px rgba(5, 195, 221, 0.18)' : 'none',
  fontSize: '11.5px',
  fontWeight: 700,
  lineHeight: '16px',
  whiteSpace: 'nowrap'
});

const Icone: React.FC<{ estilo: IEstiloStatusDocumento }> = ({ estilo }) => (
  <span
    aria-hidden="true"
    style={{
      width: '15px',
      height: '15px',
      minWidth: '15px',
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: estilo.cor,
      color: '#FFFFFF',
      fontSize: '9px',
      fontWeight: 800,
      lineHeight: 1
    }}
  >
    {estilo.icone}
  </span>
);

// Selo do status do documento/revisão.
export const StatusDocumentoBadge:
  React.FC<{
    status?: string;
    // Texto exibido no lugar do status (ex.: "Publicado").
    rotulo?: string;
    dica?: string;
    // Estilo pronto (ex.: ESTILOS_STATUS_TREINAMENTO['Vencido']).
    estiloFixo?: IEstiloStatusDocumento;
  }> = ({
    status,
    rotulo,
    dica,
    estiloFixo
  }) => {

    const estilo =
      estiloFixo || estiloStatusDocumento(status);

    const texto =
      rotulo || status || '-';

    return (
      <span
        title={dica || estilo.dica || texto}
        style={estiloPilula(estilo, false)}
      >
        <Icone estilo={estilo} />
        {texto}
      </span>
    );
  };

// Selo da etapa atual do fluxo. "aguardandoVoce" destaca a etapa
// (contorno ciano) — é a única situação que representa pendência.
export const EtapaFluxoBadge:
  React.FC<{
    etapa: string;
    aguardandoVoce?: boolean;
    encerrado?: boolean;
    dica?: string;
  }> = ({
    etapa,
    aguardandoVoce = false,
    encerrado = false,
    dica
  }) => {

    const estilo =
      encerrado
        ? ESTILOS_STATUS_DOCUMENTO.concluido
        : estiloEtapaFluxo(etapa);

    const titulo =
      [
        dica,
        aguardandoVoce ? 'Esta etapa está aguardando você.' : '',
        !dica ? estilo.dica : ''
      ]
        .filter(item => !!item)
        .join(' ');

    return (
      <span
        title={titulo || etapa}
        style={estiloPilula(estilo, aguardandoVoce)}
      >
        <Icone estilo={estilo} />
        {etapa}
        {
          aguardandoVoce &&
          (
            <span
              style={{
                marginLeft: '2px',
                padding: '0 6px',
                borderRadius: '8px',
                background: '#05C3DD',
                color: '#202A44',
                fontSize: '9.5px',
                fontWeight: 800,
                letterSpacing: '0.02em'
              }}
            >
              SUA VEZ
            </span>
          )
        }
      </span>
    );
  };
