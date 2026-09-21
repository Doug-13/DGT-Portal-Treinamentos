import {
  AadHttpClient,
  MSGraphClientV3,
  SPHttpClient
} from '@microsoft/sp-http';

export interface IPortalTreinamentosProps {
  userName: string;
  userEmail: string;
  siteUrl: string;

  spHttpClient: SPHttpClient;

  dataverseClient: AadHttpClient;
  dataverseApiUrl: string;

  graphClient: MSGraphClientV3;
}
