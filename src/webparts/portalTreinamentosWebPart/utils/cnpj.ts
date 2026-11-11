// ============================================================
// CNPJ — validação, normalização e formatação
//
// Aceita o CNPJ numérico e o ALFANUMÉRICO (Receita Federal, a partir
// de julho/2026): 12 posições com letras maiúsculas ou números + 2
// dígitos verificadores numéricos. O cálculo do DV é o mesmo para os
// dois formatos: o valor de cada caractere é (código ASCII − 48), o
// que mantém 0–9 com o próprio valor e leva A–Z para 17–42.
//
// Usado SOMENTE no módulo Fornecedores, onde o CNPJ da empresa é o
// identificador do cadastro (coluna protegida dgt_fornecedor.dgt_cnpj).
// Em todo o resto do portal o CNPJ continua bloqueado (LGPD).
//
// ES2015: sem padStart/includes.
// ============================================================

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

// Remove pontuação e espaços; letras em maiúsculas.
export const normalizarCnpj = (valor: string): string =>
  String(valor || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');

const valorCaractere = (c: string): number =>
  c.charCodeAt(0) - 48;

const calcularDigito = (base: string, pesos: number[]): number => {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) {
    soma += valorCaractere(base.charAt(i)) * pesos[i];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
};

// Os dois dígitos verificadores de uma base de 12 posições.
export const calcularDvCnpj = (base12: string): string => {
  const base = normalizarCnpj(base12);
  if (!/^[0-9A-Z]{12}$/.test(base)) {
    return '';
  }
  const dv1 = calcularDigito(base, PESOS_DV1);
  const dv2 = calcularDigito(base + String(dv1), PESOS_DV2);
  return `${dv1}${dv2}`;
};

export const cnpjValido = (valor: string): boolean => {
  const cnpj = normalizarCnpj(valor);

  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) {
    return false;
  }

  // 00000000000000, 11111111111111... passam no cálculo, mas não existem.
  if (/^(.)\1{13}$/.test(cnpj)) {
    return false;
  }

  return calcularDvCnpj(cnpj.substring(0, 12)) === cnpj.substring(12);
};

// 00.000.000/0000-00 (também para o alfanumérico).
export const formatarCnpj = (valor: string): string => {
  const c = normalizarCnpj(valor);
  if (c.length !== 14) {
    return String(valor || '');
  }
  return `${c.substring(0, 2)}.${c.substring(2, 5)}.${c.substring(5, 8)}/${c.substring(8, 12)}-${c.substring(12)}`;
};

// Mostra só o necessário para identificar o cadastro em listas:
// raiz parcial e filial (ex.: 12.***.***/0001-**).
export const mascararCnpj = (valor: string): string => {
  const c = normalizarCnpj(valor);
  if (c.length !== 14) {
    return '';
  }
  return `${c.substring(0, 2)}.***.***/${c.substring(8, 12)}-**`;
};

// Mensagem para a tela (undefined = válido).
export const validarCnpjDigitado = (valor: string): string | undefined => {
  const c = normalizarCnpj(valor);
  if (!c) {
    return 'Informe o CNPJ.';
  }
  if (c.length !== 14) {
    return `O CNPJ tem 14 posições (foram digitadas ${c.length}).`;
  }
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) {
    return 'Os dois últimos caracteres do CNPJ (dígitos verificadores) são sempre números.';
  }
  return cnpjValido(c) ? undefined : 'CNPJ inválido: os dígitos verificadores não conferem.';
};
