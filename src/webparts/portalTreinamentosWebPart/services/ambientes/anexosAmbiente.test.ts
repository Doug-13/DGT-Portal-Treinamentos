import {
  IFluxoElemento
} from '../../models/Fluxo';

import {
  bibliotecaPadrao,
  pastaDoRegistro,
  regraAnexosEtapa,
  segmentoSeguro
} from './AnexosAmbienteService';

// ============================================================
// TESTES — anexos dos registros de ambiente
// ============================================================

const etapa = (anexoArquivo?: IFluxoElemento['anexoArquivo']): IFluxoElemento =>
  ({ id: 'e', tipo: 'tarefaHumana', nome: 'Etapa', responsaveis: [], acoes: [], campos: [], posicao: { x: 0, y: 0, largura: 1, altura: 1 }, anexoArquivo });

describe('Anexos de ambiente', () => {

  it('ambiente sem anexos: quadro escondido', () => {
    expect(regraAnexosEtapa(false, etapa('obrigatorio'), 'emAndamento', true)).toEqual({ visivel: false, podeEditar: false, obrigatorio: false });
  });

  it('etapa "Não": só consulta; "Opcional": inclui/altera; "Obrigatório": idem e exige', () => {
    expect(regraAnexosEtapa(true, etapa(undefined), 'emAndamento', true)).toEqual({ visivel: true, podeEditar: false, obrigatorio: false });
    expect(regraAnexosEtapa(true, etapa('opcional'), 'emAndamento', true)).toEqual({ visivel: true, podeEditar: true, obrigatorio: false });
    expect(regraAnexosEtapa(true, etapa('obrigatorio'), 'emAndamento', true)).toEqual({ visivel: true, podeEditar: true, obrigatorio: true });
  });

  it('só quem pode agir na etapa altera; registro encerrado é só consulta', () => {
    expect(regraAnexosEtapa(true, etapa('opcional'), 'emAndamento', false).podeEditar).toBe(false);
    expect(regraAnexosEtapa(true, etapa('obrigatorio'), 'concluido', true)).toEqual({ visivel: true, podeEditar: false, obrigatorio: false });
    // Fluxo parado num script/decisão: sem etapa humana → só consulta.
    expect(regraAnexosEtapa(true, { ...etapa('opcional'), tipo: 'tarefaSistema' }, 'emAndamento', true).podeEditar).toBe(false);
  });

  it('pasta do registro e biblioteca padrão do site', () => {
    expect(bibliotecaPadrao('https://dgtnh.sharepoint.com/sites/processostesteproduto')).toBe('/sites/processostesteproduto/Shared Documents');
    expect(pastaDoRegistro('/sites/x/Shared Documents/', 'auditoria', 'AUD-2026-0001'))
      .toBe('/sites/x/Shared Documents/Anexos de Ambientes/auditoria/AUD-2026-0001');
    // Caracteres que o SharePoint não aceita em nomes de pasta/arquivo.
    expect(segmentoSeguro('Relatório: "final"?/v2.pdf')).toBe('Relatório final v2.pdf');
  });
});
