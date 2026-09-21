import * as React from 'react';
import * as ReactDom from 'react-dom';

import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { AadHttpClient, MSGraphClientV3 } from '@microsoft/sp-http';

import PortalTreinamentos from './components/PortalTreinamentos';
import { IPortalTreinamentosProps } from './components/IPortalTreinamentosProps';

export interface IPortalTreinamentosWebPartProps {
}

export default class PortalTreinamentosWebPart
  extends BaseClientSideWebPart<IPortalTreinamentosWebPartProps> {

  public render(): void {
    this.domElement.style.width = '100%';
    this.domElement.style.maxWidth = 'none';
    this.domElement.style.margin = '0';
    this.domElement.style.padding = '0';

    this.renderPortal()
      .catch((error: unknown) => {
        console.error('Erro ao renderizar o Portal de Treinamentos:', error);
      });
  }

  private async renderPortal(): Promise<void> {
    try {
      const dataverseApiUrl: string =
        'https://orga1bd9fe9.api.crm2.dynamics.com/api/data/v9.2';

      const dataverseResource: string =
        'https://orga1bd9fe9.crm2.dynamics.com';

      const dataverseClient: AadHttpClient =
        await this.context.aadHttpClientFactory.getClient(
          dataverseResource
        );

      const graphClient:
        MSGraphClientV3 =
        await this.context
          .msGraphClientFactory
          .getClient(
            '3'
          );
      const element: React.ReactElement<IPortalTreinamentosProps> =
        React.createElement(
          PortalTreinamentos,
          {
            userName: this.context.pageContext.user.displayName,
            userEmail: this.context.pageContext.user.email,
            siteUrl: this.context.pageContext.web.absoluteUrl,
            dataverseClient,
            dataverseApiUrl,
            graphClient
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

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(
      this.domElement
    );
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
}

