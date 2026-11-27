import {
  EMAIL_DOCUMENTOS_FORNECEDORES,
  IFornecedor
} from './modeloFornecedores';

// ============================================================
// FORNECEDORES — PEDIDO DE DOCUMENTOS POR E-MAIL (botão do administrador)
//
// O pedido automático é o primeiro e-mail, enviado pelo Fluxo 1 quando a
// ficha chega. Depois disso, um novo pedido só sai pelo botão
// "Solicitar documentos" da aba Ficha (administrador do módulo).
//
// O portal não envia e-mail: grava uma linha na fila padrão
// (dgt_implemail, remetente "fornecedores") e o fluxo central envia.
// O protocolo vai no assunto para a resposta com os anexos cair no
// Fluxo 2. Nunca vai no e-mail: CNPJ, CPF ou dados bancários.
// ============================================================

export const TIPO_EMAIL_PEDIDO_DOCUMENTOS = 'fornecedorPedidoDocumentos';
export const REMETENTE_FORNECEDORES = 'fornecedores';

export const emailValido = (valor: string): boolean => {
  const v = (valor || '').trim();
  const partes = v.split('@');
  return partes.length === 2 && !!partes[0] && !/\s/.test(v) &&
    /^[^.]+(\.[^.]+)+$/.test(partes[1]);
};

// Destinatário: SEMPRE o "E-mail para pedidos / NF" da ficha, nunca os
// contatos principais. Remetente: SEMPRE fornecedores@ (dgt_remetente).
export const destinatarioPedido = (f: IFornecedor): string => (f.emailPedidos || '').trim();

export const assuntoPedidoDocumentos = (f: IFornecedor): string =>
  `[${f.protocolo}] Documentos para cadastro na DGT — ${f.razaoSocial}`.substring(0, 200);

const escapar = (valor: string): string =>
  (valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const corpoPedidoDocumentos = (f: IFornecedor, documentos: string[], observacao: string): string => {
  const itens = documentos.map(d => `<li>${escapar(d)}</li>`).join('');
  const obs = (observacao || '').trim();
  return [
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#202A44;line-height:1.5">',
    `<p>Olá,</p>`,
    `<p>Para dar andamento ao cadastro de <strong>${escapar(f.razaoSocial)}</strong> na DGT ` +
      `(protocolo <strong>${escapar(f.protocolo)}</strong>), precisamos dos documentos abaixo:</p>`,
    itens ? `<ul>${itens}</ul>` : '',
    obs ? `<p>${escapar(obs).replace(/\r?\n/g, '<br>')}</p>` : '',
    `<p><strong>Responda este e-mail com os arquivos anexados</strong> (ou envie para ` +
      `${escapar(EMAIL_DOCUMENTOS_FORNECEDORES)}), mantendo o protocolo <strong>${escapar(f.protocolo)}</strong> no assunto.</p>`,
    '<p>Obrigado,<br>Suprimentos — DGT</p>',
    '</div>'
  ].join('');
};

export interface IValidacaoPedido {
  ok: boolean;
  erro?: string;
}

export const validarPedidoDocumentos = (f: IFornecedor, documentos: string[]): IValidacaoPedido => {
  if (!(f.protocolo || '').trim()) {
    return { ok: false, erro: 'Fornecedor sem protocolo: a resposta não teria como ser vinculada a ele.' };
  }
  if (!emailValido(destinatarioPedido(f))) {
    return { ok: false, erro: 'O "E-mail para pedidos / NF" da ficha está vazio ou inválido. Corrija em "Editar dados da ficha".' };
  }
  if (documentos.length === 0) {
    return { ok: false, erro: 'Selecione ao menos um documento.' };
  }
  return { ok: true };
};
