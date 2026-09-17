import { DataverseService } from './DataverseService';

export class DocumentoService {
  constructor(private readonly dataverse: DataverseService) {}

  public getDataverseService(): DataverseService {
    return this.dataverse;
  }
}

