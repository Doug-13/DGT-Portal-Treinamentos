import * as React from 'react';

import EstadoPagina from
  './EstadoPagina';

export interface IPortalErrorBoundaryProps {
  children:
    React.ReactNode;
}

interface IPortalErrorBoundaryState {
  erro:
    Error | null;
}

export default class PortalErrorBoundary
  extends React.Component<
    IPortalErrorBoundaryProps,
    IPortalErrorBoundaryState
  > {

  public constructor(
    props:
      IPortalErrorBoundaryProps
  ) {
    super(
      props
    );

    this.state = {
      erro: null
    };
  }

  public static getDerivedStateFromError(
    erro:
      Error
  ): IPortalErrorBoundaryState {
    return {
      erro
    };
  }

  public componentDidCatch(
    erro:
      Error,
    info:
      React.ErrorInfo
  ): void {

    console.error(
      'Erro não tratado no Portal de Treinamentos:',
      erro,
      info
    );
  }

  public render():
    React.ReactNode {

    if (
      this.state.erro
    ) {
      return (
        <EstadoPagina
          tipo="erro"
          titulo="O portal encontrou um erro inesperado"
          mensagem={
            this.state.erro.message
          }
          acaoTexto="Tentar novamente"
          onAcao={() => {
            this.setState({
              erro: null
            });
          }}
        />
      );
    }

    return this.props.children;
  }
}
