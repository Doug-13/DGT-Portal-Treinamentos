// Tipos do gerador de e-mails do painel (painelEmails.js).
export interface IUsuarioEmail {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

export interface IEmailMontado {
  para: string;
  assunto: string;
  html: string;
}

export declare const TIPOS_EMAIL: string[][];

export declare function dadosDosEmails(
  baldes: Record<string, unknown>,
  tipos: Record<string, unknown>,
  usuarios: IUsuarioEmail[]
): { projetos: Array<{ id: string; nome: string }>; destinatarios: Record<string, unknown> };

export declare function previaDoEmail(
  baldes: Record<string, unknown>,
  tipos: Record<string, unknown>,
  tipo: string,
  link: string,
  nome: string,
  cliente: boolean,
  agora: Date
): string;

export declare function montarEmails(
  baldes: Record<string, unknown>,
  tipos: Record<string, unknown>,
  tipo: string,
  usuarios: IUsuarioEmail[],
  link: string,
  soPara: { nome: string; email: string } | undefined,
  agora: Date
): { emails: IEmailMontado[]; pulados: number };
