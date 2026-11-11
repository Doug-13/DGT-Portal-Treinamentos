import {
  lerValorUsuario
} from './valorUsuario';

// ============================================================
// TAREFA DE SISTEMA "ASSINATURA DIGITAL"
//
// O fluxo PARA na tarefa e registra uma chave única (instancia.
// assinatura). O portal garante um PEDIDO na tabela dgt_assinatura com
// essa chave (idempotente); o Power Automate envia ao provedor
// (Clicksign) e grava o retorno no pedido. Quando a situação fica
// final, o portal libera o fluxo:
//   assinado            → segue
//   recusado/expirado/  → segue se a etapa tiver "campo da situação"
//   cancelado             (uma decisão depois escolhe o caminho);
//                         senão fica parado (Reenviar ou liberar)
// Credenciais do provedor ficam SÓ no Power Automate.
// ============================================================

export const ACAO_ASSINATURA = 'assinaturaDigital';

export type ProvedorAssinatura = 'clicksign';

export const PROVEDORES_ASSINATURA: Array<{ valor: ProvedorAssinatura; nome: string }> = [
  { valor: 'clicksign', nome: 'Clicksign' }
];

// O que é assinado: o arquivo da revisão (documentos) ou os PDFs
// anexados ao registro (ambientes).
export type DocumentoAssinatura = 'arquivoRevisao' | 'anexosRegistro';

export type PapelSignatario = 'assinar' | 'aprovar' | 'testemunha';

export interface ISignatarioConfig {
  // 'campo' = pessoa de um campo Usuário do processo; 'usuario' = fixa.
  origem: 'campo' | 'usuario';
  campo?: string;
  usuarioId?: string;
  usuarioNome?: string;
  papel: PapelSignatario;
}

export interface IConfigAssinatura {
  provedor: ProvedorAssinatura;
  documento: DocumentoAssinatura;
  signatarios: ISignatarioConfig[];
  // Assinam um de cada vez, na ordem da lista.
  ordemSequencial: boolean;
  prazoDias: number;
  mensagem?: string;
  // Campo (texto ou lista) que recebe a situação final: assinado,
  // recusado, expirado ou cancelado — para decidir o caminho depois.
  campoSituacao?: string;
  // Campo (texto) que recebe o link do arquivo assinado.
  campoLink?: string;
}

export type SituacaoAssinatura = 'pendente' | 'enviado' | 'assinado' | 'recusado' | 'expirado' | 'cancelado' | 'erro';

export const SITUACOES_FINAIS: SituacaoAssinatura[] = ['assinado', 'recusado', 'expirado', 'cancelado'];

export const NOME_SITUACAO: Record<SituacaoAssinatura, string> = {
  pendente: 'Aguardando envio',
  enviado: 'Enviado para assinatura',
  assinado: 'Assinado',
  recusado: 'Recusado',
  expirado: 'Prazo expirado',
  cancelado: 'Cancelado',
  erro: 'Erro no envio'
};

// Marcação gravada na instância quando o fluxo para na assinatura.
export interface IAssinaturaNaInstancia {
  elementoId: string;
  chave: string;
  solicitadaEm: string;
}

export interface ISignatarioPedido {
  nome: string;
  email: string;
  papel: PapelSignatario;
  ordem: number;
  // Preenchidos pelo Power Automate.
  situacao?: string;
  assinadoEm?: string;
}

export const configAssinaturaPadrao = (): IConfigAssinatura => ({
  provedor: 'clicksign',
  documento: 'arquivoRevisao',
  signatarios: [],
  ordemSequencial: false,
  prazoDias: 10
});

// ------------------------------------------------------------
// Validação (publicação e pacote JSON)
// ------------------------------------------------------------

export const validarConfigAssinatura = (
  nome: string,
  config: IConfigAssinatura | undefined,
  metadados: Array<{ chave: string; tipo: string; opcoes?: string[] }>
): string[] => {
  if (!config) {
    return [`Configure a assinatura da tarefa "${nome}".`];
  }
  const erros: string[] = [];
  if (PROVEDORES_ASSINATURA.every(item => item.valor !== config.provedor)) {
    erros.push(`Assinatura "${nome}": escolha o provedor.`);
  }
  if (config.documento !== 'arquivoRevisao' && config.documento !== 'anexosRegistro') {
    erros.push(`Assinatura "${nome}": escolha o que será assinado.`);
  }
  if (!config.signatarios || config.signatarios.length === 0) {
    erros.push(`Assinatura "${nome}": inclua ao menos um signatário.`);
  }
  (config.signatarios || []).forEach((item, indice) => {
    if (item.origem === 'campo') {
      const campo = metadados.find(meta => meta.chave === item.campo);
      if (!campo || campo.tipo !== 'usuario') {
        erros.push(`Assinatura "${nome}": o signatário ${indice + 1} precisa de um campo do tipo Usuário.`);
      }
    } else if (!item.usuarioId) {
      erros.push(`Assinatura "${nome}": escolha a pessoa do signatário ${indice + 1}.`);
    }
  });
  if (!(config.prazoDias >= 1 && config.prazoDias <= 90)) {
    erros.push(`Assinatura "${nome}": prazo de 1 a 90 dias.`);
  }
  if (config.campoSituacao) {
    const campo = metadados.find(meta => meta.chave === config.campoSituacao);
    if (!campo || (campo.tipo !== 'texto' && campo.tipo !== 'lista')) {
      erros.push(`Assinatura "${nome}": o campo da situação precisa ser Texto ou Lista.`);
    } else if (campo.tipo === 'lista') {
      const faltam = SITUACOES_FINAIS.filter(item => (campo.opcoes || []).indexOf(item) < 0);
      if (faltam.length > 0) {
        erros.push(`Assinatura "${nome}": a lista "${campo.chave}" precisa ter as opções ${faltam.join(', ')}.`);
      }
    }
  }
  if (config.campoLink) {
    const campo = metadados.find(meta => meta.chave === config.campoLink);
    if (!campo || (campo.tipo !== 'texto' && campo.tipo !== 'textoLongo')) {
      erros.push(`Assinatura "${nome}": o campo do link precisa ser Texto.`);
    }
  }
  return erros;
};

// ------------------------------------------------------------
// Signatários do pedido (usuários do portal, com e-mail)
// ------------------------------------------------------------

export const resolverSignatarios = (
  config: IConfigAssinatura,
  valores: Record<string, string>,
  usuarios: Array<{ id: string; nome: string; email: string }>
): { signatarios: ISignatarioPedido[]; erros: string[] } => {
  const guid = (valor?: string): string => String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();
  const signatarios: ISignatarioPedido[] = [];
  const erros: string[] = [];
  config.signatarios.forEach(item => {
    let id = item.usuarioId;
    let rotulo = item.usuarioNome || 'signatário';
    if (item.origem === 'campo') {
      const valor = lerValorUsuario(valores[item.campo || '']);
      id = valor ? valor.id : undefined;
      rotulo = `campo "${item.campo}"`;
      if (!id) {
        erros.push(`O ${rotulo} (signatário) está vazio.`);
        return;
      }
    }
    const usuario = usuarios.find(u => guid(u.id) === guid(id));
    if (!usuario || !usuario.email) {
      erros.push(`Não foi encontrado o e-mail do signatário (${rotulo}).`);
      return;
    }
    // A mesma pessoa uma vez só (vale o primeiro papel).
    if (signatarios.some(s => s.email.toLowerCase() === usuario.email.toLowerCase())) {
      return;
    }
    signatarios.push({ nome: usuario.nome, email: usuario.email, papel: item.papel, ordem: signatarios.length + 1 });
  });
  return { signatarios, erros };
};

// Campos preenchidos ao liberar o fluxo.
export const valoresDaSituacao = (
  config: IConfigAssinatura,
  situacao: SituacaoAssinatura,
  linkAssinado?: string
): Record<string, string> => {
  const valores: Record<string, string> = {};
  if (config.campoSituacao) {
    valores[config.campoSituacao] = situacao;
  }
  if (config.campoLink && linkAssinado) {
    valores[config.campoLink] = linkAssinado;
  }
  return valores;
};

// Libera o fluxo com esta situação?
export const liberaComSituacao = (
  config: IConfigAssinatura,
  situacao: SituacaoAssinatura
): boolean =>
  situacao === 'assinado' || (!!config.campoSituacao && SITUACOES_FINAIS.indexOf(situacao) >= 0);
