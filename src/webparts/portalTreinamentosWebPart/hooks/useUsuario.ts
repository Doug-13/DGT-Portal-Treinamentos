import * as React from 'react';

export interface IUseUsuarioResult {
  primeiroNome: string;
  fotoUsuario: string;
  erroFotoUsuario: boolean;
  registrarErroFoto: () => void;
}

export const useUsuario = (
  userName: string,
  userEmail: string,
  siteUrl: string
): IUseUsuarioResult => {
  const [erroFotoUsuario, setErroFotoUsuario] = React.useState<boolean>(false);

  const primeiroNome =
    userName && userName.trim() !== ''
      ? userName.trim().split(' ')[0]
      : 'Colaborador';

  const fotoUsuario =
    userEmail && siteUrl
      ? `${siteUrl}/_layouts/15/userphoto.aspx?size=M&accountname=${encodeURIComponent(userEmail)}`
      : '';

  React.useEffect(() => {
    setErroFotoUsuario(false);
  }, [userEmail, siteUrl]);

  return {
    primeiroNome,
    fotoUsuario,
    erroFotoUsuario,
    registrarErroFoto: () => setErroFotoUsuario(true)
  };
};

export default useUsuario;
