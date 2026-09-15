import { DataverseService } from './DataverseService';

export class AvaliacaoService {
  constructor(private readonly dataverse: DataverseService) {}

  public getDataverseService(): DataverseService {
    return this.dataverse;
  }
}
