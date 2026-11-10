import * as React from 'react';

import {
  IAreaOrcamento,
  IConfigArea,
  IResponsaveisArea,
  OrcamentoService
} from '../../services/orcamento/OrcamentoService';

import {
  OrcamentoFluxoService
} from '../../services/orcamento/OrcamentoFluxoService';

import {
  COR,
  CaixaMensagem,
  FONTE,
  botao,
  cartao,
  explicarErro
} from './orcamentoComum';

// ============================================================
// RESPONSÁVEIS (Administrador / Controladoria)
//
// Uma linha por área: RESPONSÁVEL PELO PREENCHIMENTO e DIRETOR
// RESPONSÁVEL (uma pessoa cada).
//  • O responsável pelo preenchimento cria (ao abrir), edita e envia a
//    planilha da área. Gestores e demais só visualizam. Área sem
//    responsável: ninguém preenche até a Controladoria definir.
//  • No CONT-001, use o responsável "Definido na aba Responsáveis":
//    Preenchimento na 1ª etapa e Diretor na avaliação do diretor.
//    Controladoria e Diretoria Financeira continuam fixas no fluxo.
// ============================================================

export interface IResponsaveisViewProps {
  servico: OrcamentoService;
  fluxo: OrcamentoFluxoService;
  areas: IAreaOrcamento[];
  configs: IConfigArea[];
  onSalvo: () => Promise<void>;
}

const guid = (valor?: string): string => String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const ResponsaveisView: React.FC<IResponsaveisViewProps> = (props) => {

  const [usuarios, setUsuarios] = React.useState<Array<{ id: string; nome: string }>>([]);
  const [editados, setEditados] = React.useState<{ [areaId: string]: IResponsaveisArea }>({});
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [busca, setBusca] = React.useState('');

  React.useEffect(() => {
    let ativo = true;
    props.fluxo.usuarios()
      .then(lista => {
        if (ativo) {
          setUsuarios(lista.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
          setCarregando(false);
        }
      })
      .catch(falha => {
        if (ativo) {
          setErro(explicarErro(falha));
          setCarregando(false);
        }
      });
    return () => { ativo = false; };
  }, [props.fluxo]);

  const configDa = (areaId: string): IConfigArea | undefined =>
    props.configs.filter(item => item.areaId === areaId)[0];

  const atual = (areaId: string): IResponsaveisArea => {
    if (editados[areaId]) {
      return editados[areaId];
    }
    const config = configDa(areaId);
    return config ? config.responsaveis : {};
  };

  const alterar = (areaId: string, papel: keyof IResponsaveisArea, id: string): void => {
    setEditados(mapa => ({ ...mapa, [areaId]: { ...atual(areaId), [papel]: id || undefined } }));
    setAviso('');
  };

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    setErro('');
    const falhas: string[] = [];
    for (const areaId of Object.keys(editados)) {
      const area = props.areas.filter(item => item.id === areaId)[0];
      if (!area) {
        continue;
      }
      try {
        const config = configDa(areaId);
        await props.servico.salvarResponsaveisArea(area, editados[areaId], config ? config.id : undefined);
      } catch (falha) {
        falhas.push(`${area.nome}: ${explicarErro(falha)}`);
      }
    }
    try {
      await props.onSalvo();
    } catch {
      // A lista é recarregada na próxima abertura.
    }
    setSalvando(false);
    if (falhas.length > 0) {
      setErro(`Algumas áreas não foram gravadas:\n${falhas.join('\n')}`);
    } else {
      setEditados({});
      setAviso('✓ Responsáveis salvos. Já valem para as planilhas e para o fluxo de aprovação.');
    }
  };

  if (carregando) {
    return <div style={{ ...cartao, color: COR.texto2 }}>Carregando...</div>;
  }

  const areasFiltradas =
    props.areas.filter(area => !!area.id && (!busca.trim() || area.nome.toLowerCase().indexOf(busca.trim().toLowerCase()) >= 0));
  const semPreenchimento = props.areas.filter(area => !!area.id && !atual(area.id).preenchimento).length;
  const qtdEditadas = Object.keys(editados).length;

  const seletor = (areaId: string, papel: keyof IResponsaveisArea, rotulo: string): React.ReactNode => {
    const valor = guid(atual(areaId)[papel]);
    return (
      <select
        value={valor}
        aria-label={`${rotulo} da área`}
        onChange={evento => alterar(areaId, papel, evento.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          border: `1px solid ${valor ? COR.borda : '#F5C2C7'}`,
          borderRadius: '6px',
          fontSize: '13px',
          color: valor ? COR.azul : COR.perigo,
          background: valor ? '#FFFFFF' : '#FFF5F5',
          fontFamily: FONTE
        }}
      >
        <option value="">— não definido —</option>
        {usuarios.map(usuario => (
          <option key={usuario.id} value={guid(usuario.id)}>{usuario.nome}</option>
        ))}
      </select>
    );
  };

  return (
    <div style={{ fontFamily: FONTE }}>
      <CaixaMensagem tipo="erro" texto={erro} />
      <CaixaMensagem tipo="sucesso" texto={aviso} />
      {props.servico.colunaResponsaveis === false && (
        <CaixaMensagem tipo="alerta" texto="A coluna dos responsáveis ainda não existe no Dataverse. Execute scripts/dataverse/criar-tabelas-orcamento.ps1 e atualize a página." />
      )}
      {semPreenchimento > 0 && (
        <CaixaMensagem tipo="alerta" texto={`${semPreenchimento} área(s) sem responsável pelo preenchimento: o orçamento dessas áreas não pode ser preenchido até a definição.`} />
      )}

      <div style={{ ...cartao, fontSize: '13px', color: COR.texto2 }}>
        Defina, para cada área, o <strong style={{ color: COR.azul }}>responsável pelo preenchimento</strong> (cria, edita e
        envia a planilha) e o <strong style={{ color: COR.azul }}>diretor responsável</strong> (avalia). Gestores e demais
        pessoas da área só visualizam. No processo CONT-001, use o responsável <em>Definido na aba Responsáveis</em>:
        &quot;Responsável pelo preenchimento&quot; na etapa de preenchimento e &quot;Diretor responsável&quot; na avaliação do diretor.
        Controladoria e Diretoria Financeira continuam definidas no fluxo.
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Buscar área..."
          value={busca}
          onChange={evento => setBusca(evento.target.value)}
          style={{ padding: '7px 10px', border: `1px solid ${COR.borda}`, borderRadius: '6px', fontSize: '13px', minWidth: '240px', fontFamily: FONTE }}
        />
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setEditados({})} disabled={qtdEditadas === 0 || salvando} style={botao('secundario', qtdEditadas === 0 || salvando)}>
          Descartar
        </button>
        <button type="button" onClick={() => { salvar().catch(() => undefined); }} disabled={qtdEditadas === 0 || salvando} style={botao('principal', qtdEditadas === 0 || salvando)}>
          {salvando ? 'Salvando...' : `Salvar${qtdEditadas > 0 ? ` (${qtdEditadas})` : ''}`}
        </button>
      </div>

      <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Área', 'Responsável pelo preenchimento', 'Diretor responsável'].map(titulo => (
                <th key={titulo} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: COR.texto2, textTransform: 'uppercase', borderBottom: `1px solid ${COR.borda}` }}>
                  {titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areasFiltradas.map(area => (
              <tr key={area.id} style={{ background: editados[area.id] ? '#FFFBEB' : undefined }}>
                <td style={{ padding: '8px 12px', fontSize: '13.5px', fontWeight: 700, color: COR.azul, borderBottom: `1px solid ${COR.borda}`, whiteSpace: 'nowrap' }}>
                  {area.nome}
                  {editados[area.id] && <span style={{ display: 'block', fontSize: '11px', color: '#B45309', fontWeight: 600 }}>não salvo</span>}
                </td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${COR.borda}`, minWidth: '240px' }}>
                  {seletor(area.id, 'preenchimento', 'Responsável pelo preenchimento')}
                </td>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${COR.borda}`, minWidth: '240px' }}>
                  {seletor(area.id, 'diretor', 'Diretor responsável')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResponsaveisView;
