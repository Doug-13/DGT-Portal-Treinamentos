export class UsuarioService {
  public primeiroNome(nomeCompleto: string): string {
    const nome = (nomeCompleto || '').trim();
    return nome ? nome.split(' ')[0] : 'Colaborador';
  }

  public urlFotoSharePoint(siteUrl: string, email: string): string {
    if (!siteUrl || !email) return '';
    return `${siteUrl}/_layouts/15/userphoto.aspx?size=M&accountname=${encodeURIComponent(email)}`;
  }
}
