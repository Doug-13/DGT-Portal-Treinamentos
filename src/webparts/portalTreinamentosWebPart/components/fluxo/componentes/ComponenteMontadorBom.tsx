import * as React from 'react';

import SelecaoKitEtapa from '../../../pages/Arquitetura/SelecaoKitEtapa';

import {
  ISelecaoKit
} from '../../../services/bom/montadorBom';

import {
  KitsService,
  aplicarNoMontador
} from '../../../services/bom/KitsService';

import {
  lerEnvelopeComponente,
  gravarEnvelopeComponente
} from '../../../services/fluxo/valorComponente';

import {
  IPropsComponenteNativo
} from './tiposComponente';

import {
  envelopeDoMontador
} from './montadorBomEnvelope';

// ============================================================
// COMPONENTE NATIVO "Montador de B.O.M."
//
// A MESMA tela de Seleção de kit da Arquitetura, dentro de uma etapa
// de fluxo. Carrega o catálogo da aba Kits (Dataverse) uma vez por
// sessão; a cada alteração devolve o envelope com a lista de itens,
// os erros (que bloqueiam o Concluir) e o resumo.
// ============================================================

// Catálogo carregado nesta sessão (o montador usa o catálogo do módulo).
const estadoCatalogo: { promessa?: Promise<void> } = {};

const garantirCatalogo = (props: IPropsComponenteNativo): Promise<void> => {
  if (!props.dataverseService) {
    return Promise.resolve();
  }
  if (!estadoCatalogo.promessa) {
    estadoCatalogo.promessa =
      new KitsService(props.dataverseService)
        .carregar()
        .then(dados => aplicarNoMontador(dados))
        .catch(erro => {
          estadoCatalogo.promessa = undefined;
          console.error('[Montador de B.O.M.] Catálogo da aba Kits não carregado; usando o padrão.', erro);
        });
  }
  return estadoCatalogo.promessa;
};

const ComponenteMontadorBom: React.FC<IPropsComponenteNativo> = (props) => {

  const [pronto, setPronto] = React.useState(!props.dataverseService);

  React.useEffect(() => {
    let ativo = true;
    garantirCatalogo(props)
      .then(() => { if (ativo) { setPronto(true); } })
      .catch(() => { if (ativo) { setPronto(true); } });
    return () => { ativo = false; };
  }, []);

  const envelope = lerEnvelopeComponente(props.valor);
  const selecaoInicial = envelope && envelope.dados ? envelope.dados as ISelecaoKit : undefined;

  const parametros = props.parametros || {};
  const canal =
    (parametros.campoCanal && props.valoresRegistro ? props.valoresRegistro[parametros.campoCanal] : '') ||
    parametros.canal ||
    '';

  if (!pronto) {
    return <div style={{ fontSize: '13px', color: '#64748B', padding: '12px' }}>Carregando o catálogo de kits...</div>;
  }

  return (
    <SelecaoKitEtapa
      selecaoInicial={selecaoInicial}
      semColuna={false}
      canal={canal}
      salvando={false}
      somenteLeitura={props.somenteLeitura}
      // Sem a barra própria: quem grava e conclui é a etapa do fluxo.
      modoSimulacao={true}
      onSalvar={() => Promise.resolve()}
      onAlterar={(selecao: ISelecaoKit) => props.onAlterar(gravarEnvelopeComponente(envelopeDoMontador(selecao)))}
    />
  );
};

export default ComponenteMontadorBom;
