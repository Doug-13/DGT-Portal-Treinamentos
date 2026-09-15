export enum TipoModulo {
  Documento = 100000000,
  Video = 100000001,
  Pagina = 100000002,
  ConteudoHtml = 100000003,
  LinkExterno = 100000004,
  Outro = 100000005
}

export enum StatusUsuarioModulo {
  NaoIniciado = 100000000,
  EmAndamento = 100000001,
  Concluido = 100000002
}

export interface IModuloTreinamento {
  id: string;
  titulo: string;
  descricao: string;
  ordem: number;
  duracaoMin: number;
  tipoModulo: number;
  tipoModuloNome: string;
  obrigatorio: boolean;
  ativo: boolean;
  urlConteudo: string;
  usuarioModuloId: string;
  statusModulo: number;
  statusModuloNome: string;
  dataInicio: string;
  dataConclusao: string;
}
