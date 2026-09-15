import { DataverseService, IDataverseRecord } from './DataverseService';

export class TreinamentoService {
  constructor(private readonly dataverse: DataverseService) {}

  public getCatalogo(): Promise<IDataverseRecord[]> {
    return this.dataverse.getTreinamentos();
  }

  public getAtribuicoesUsuario(): Promise<IDataverseRecord[]> {
    return this.dataverse.getUsuarioTreinamentos();
  }

  public iniciar(usuarioTreinamentoId: string): Promise<void> {
    return this.dataverse.iniciarUsuarioTreinamento(usuarioTreinamentoId);
  }
}
