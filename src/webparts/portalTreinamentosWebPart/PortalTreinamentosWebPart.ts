import * as React from 'react';
import * as ReactDom from 'react-dom';

import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { AadHttpClient, MSGraphClientV3 } from '@microsoft/sp-http';

import PortalTreinamentos from './components/PortalTreinamentos';
import { IPortalTreinamentosProps } from './components/IPortalTreinamentosProps';
import {
  diagnosticarErro,
  registrarDiagnosticoNoConsole
} from './utils/diagnosticoDataverse';

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
            spHttpClient: this.context.spHttpClient,
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

      // Falha antes do portal abrir (normalmente token do Entra ID /
      // permissão de API não aprovada). Mostra o diagnóstico já aqui.
      const diagnostico =
        diagnosticarErro(error);

      registrarDiagnosticoNoConsole(
        diagnostico,
        {
          email: this.context.pageContext.user.email,
          pagina: 'inicialização do web part'
        }
      );

      const escapar = (valor: string): string =>
        (valor || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

      const passos =
        diagnostico.passos
          .map(passo => `<li>${escapar(passo)}</li>`)
          .join('');

      this.domElement.innerHTML = `
        <div style="max-width:820px;margin:20px auto;padding:20px 22px;font-family:Segoe UI,Arial,sans-serif;color:#1F2937;background:#ffffff;border:1px solid #f0c5c5;border-left:5px solid #B42318;border-radius:10px;">
          <div style="font-size:11px;font-weight:700;color:#B42318;text-transform:uppercase;">
            Não foi possível inicializar o Portal DGT · Origem: ${escapar(diagnostico.origem)}
          </div>
          <h2 style="margin:6px 0 4px;font-size:18px;color:#0A2845;">${escapar(diagnostico.titulo)}</h2>
          <p style="margin:0 0 8px;font-size:13px;color:#475569;line-height:1.5;">${escapar(diagnostico.explicacao)}</p>
          <p style="margin:0 0 6px;font-size:12.5px;"><strong>Quem resolve:</strong> ${escapar(diagnostico.responsavel)}</p>
          <ol style="margin:0 0 10px;padding-left:20px;font-size:12.5px;line-height:1.6;color:#334155;">${passos}</ol>
          <details style="font-size:12px;color:#475569;">
            <summary style="cursor:pointer;font-weight:700;">Detalhes técnicos</summary>
            <pre style="white-space:pre-wrap;word-break:break-word;background:#0F172A;color:#E2E8F0;padding:10px;border-radius:6px;">${escapar(diagnostico.mensagemOriginal)}</pre>
          </details>
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



