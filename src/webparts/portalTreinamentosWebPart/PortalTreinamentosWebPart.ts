import * as React from 'react';
import * as ReactDom from 'react-dom';

import { Version } from '@microsoft/sp-core-library';

import {
  BaseClientSideWebPart
} from '@microsoft/sp-webpart-base';

import {
  AadHttpClient
} from '@microsoft/sp-http';

import PortalTreinamentos
  from './components/PortalTreinamentos';

import {
  IPortalTreinamentosProps
} from './components/IPortalTreinamentosProps';


export interface IPortalTreinamentosWebPartProps {
}


export default class PortalTreinamentosWebPart
  extends BaseClientSideWebPart<IPortalTreinamentosWebPartProps> {

  /**
   * Método padrão chamado pelo SPFx.
   *
   * Como precisamos buscar o AadHttpClient de forma assíncrona,
   * o render apenas chama renderPortal().
   */
  public render(): void {

    void this.renderPortal();

  }


  /**
   * Monta o portal já com o cliente autenticado
   * para acessar o Dataverse.
   */
  private async renderPortal(): Promise<void> {

    try {

      /**
       * Endpoint da Web API do Dataverse.
       */
      const dataverseApiUrl: string =
        'https://orga1bd9fe9.api.crm2.dynamics.com/api/data/v9.2';


      /**
       * Recurso usado pelo Entra ID para obter o token.
       *
       * IMPORTANTE:
       * Não colocar /api/data/v9.2 aqui.
       */
      const dataverseResource: string =
        'https://orga1bd9fe9.crm2.dynamics.com';


      console.log(
        'Obtendo cliente autenticado do Dataverse...'
      );


      /**
       * O SPFx solicita um token OAuth
       * através do contexto do usuário logado.
       */
      const dataverseClient: AadHttpClient =
        await this.context.aadHttpClientFactory.getClient(
          dataverseResource
        );


      console.log(
        'Cliente Dataverse obtido com sucesso.'
      );


      /**
       * Cria o componente React
       * passando os dados do usuário e
       * as configurações do Dataverse.
       */
      const element:
        React.ReactElement<IPortalTreinamentosProps> =
        React.createElement(
          PortalTreinamentos,
          {

            userName:
              this.context.pageContext.user.displayName,

            userEmail:
              this.context.pageContext.user.email,

            siteUrl:
              this.context.pageContext.web.absoluteUrl,

            dataverseClient:
              dataverseClient,

            dataverseApiUrl:
              dataverseApiUrl

          }
        );


      ReactDom.render(
        element,
        this.domElement
      );


    } catch (error) {

      console.error(
        'Erro ao inicializar conexão com Dataverse:',
        error
      );


      /**
       * Mostramos algo simples na tela
       * caso a conexão falhe.
       */
      this.domElement.innerHTML = `
        <div style="
          padding:20px;
          font-family:Segoe UI,Arial,sans-serif;
          color:#8a1c1c;
          background:#fff4f4;
          border:1px solid #f0c5c5;
          border-radius:6px;
        ">
          <strong>
            Não foi possível inicializar o Portal de Treinamentos.
          </strong>

          <br/><br/>

          Verifique o console do navegador para mais detalhes.
        </div>
      `;

    }

  }


  /**
   * Remove o componente React
   * quando o WebPart é desmontado.
   */
  protected onDispose(): void {

    ReactDom.unmountComponentAtNode(
      this.domElement
    );

  }


  /**
   * Versão dos dados da propriedade
   * do WebPart.
   */
  protected get dataVersion(): Version {

    return Version.parse('1.0');

  }

}