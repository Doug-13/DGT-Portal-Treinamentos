// export interface IPortalTreinamentosProps {
//   description: string;
//   userName: string;
//   userEmail: string;
//   siteUrl: string;
// }


import { AadHttpClient } from '@microsoft/sp-http';

export interface IPortalTreinamentosProps {
  userName: string;
  userEmail: string;
  siteUrl: string;

  dataverseClient: AadHttpClient;
  dataverseApiUrl: string;
}