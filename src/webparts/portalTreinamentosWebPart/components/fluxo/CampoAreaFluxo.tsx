import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  AreaAdminService,
  IAreaAdmin
} from '../../services/AreaAdminService';

import {
  gravarValorArea,
  lerValorArea
} from '../../services/fluxo/valorArea';

// ============================================================
// CAMPO "ÁREA" DO FLUXO
//
// Lista as áreas ATIVAS cadastradas no portal (dgt_area). A lista é
// carregada uma vez e reaproveitada por todos os campos da tela
// (cache de 5 minutos). Uma área já gravada que foi desativada
// continua aparecendo (marcada), para não perder o valor.
// ============================================================

export interface ICampoAreaFluxoProps {
  id: string;
  valor: string;
  onAlterar: (valor: string) => void;
  desabilitado?: boolean;
  dataverseService?: DataverseService;
  // Rótulo acessível (ex.: célula de tabela).
  rotuloAcessivel?: string;
  estilo?: React.CSSProperties;
}

let cacheAreas: { lidoEm: number; lista: Promise<IAreaAdmin[]> } | undefined;

const carregarAreas = (
  dataverse: DataverseService
): Promise<IAreaAdmin[]> => {

  if (cacheAreas && Date.now() - cacheAreas.lidoEm < 5 * 60 * 1000) {
    return cacheAreas.lista;
  }

  const lista =
    new AreaAdminService(dataverse).listarAreas()
      .then(areas => areas.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')));

  lista.catch(() => { cacheAreas = undefined; });

  cacheAreas = { lidoEm: Date.now(), lista };
  return lista;
};

const guid = (
  valor?: string
): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const estiloPadrao: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '38px',
  border: '1px solid #D9D9D6',
  borderRadius: '6px',
  padding: '7px 10px',
  fontFamily: 'inherit',
  fontSize: '14px',
  color: '#202A44',
  background: '#FFFFFF'
};

const CampoAreaFluxo: React.FC<ICampoAreaFluxoProps> = (props) => {

  const [areas, setAreas] =
    React.useState<IAreaAdmin[]>([]);

  const [carregando, setCarregando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  React.useEffect(
    () => {
      if (!props.dataverseService) {
        return;
      }

      let ativo = true;
      setCarregando(true);

      carregarAreas(props.dataverseService)
        .then(lista => { if (ativo) { setAreas(lista); } })
        .catch(falha => {
          console.error(falha);
          if (ativo) { setErro('Não foi possível carregar as áreas.'); }
        })
        .then(() => { if (ativo) { setCarregando(false); } }, () => undefined);

      return () => { ativo = false; };
    },
    [props.dataverseService]
  );

  const atual =
    lerValorArea(props.valor);

  const ativas =
    areas.filter(area => area.ativa !== false);

  const atualForaDaLista =
    !!atual && !ativas.some(area => guid(area.id) === atual.id);

  return (
    <div>
      <select
        id={props.id}
        aria-label={props.rotuloAcessivel}
        value={atual ? atual.id : ''}
        disabled={props.desabilitado || carregando}
        onChange={evento => {
          const escolhida = areas.find(area => guid(area.id) === evento.target.value);
          props.onAlterar(
            escolhida
              ? gravarValorArea({ id: escolhida.id, nome: escolhida.nome, sigla: escolhida.sigla })
              : ''
          );
        }}
        style={{ ...estiloPadrao, ...(props.estilo || {}) }}
      >
        <option value="">{carregando ? 'Carregando áreas...' : '—'}</option>
        {
          atualForaDaLista && atual && (
            <option value={atual.id}>
              {atual.sigla ? `${atual.sigla} — ` : ''}{atual.nome} (inativa)
            </option>
          )
        }
        {
          ativas.map(area => (
            <option key={area.id} value={guid(area.id)}>
              {area.sigla ? `${area.sigla} — ` : ''}{area.nome}
            </option>
          ))
        }
      </select>
      {erro && <div style={{ marginTop: '4px', fontSize: '12px', color: '#B42318' }}>{erro}</div>}
    </div>
  );
};

export default CampoAreaFluxo;
