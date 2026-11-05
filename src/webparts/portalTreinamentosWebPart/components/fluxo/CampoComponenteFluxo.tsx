import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IConfigComponente,
  lerEnvelopeComponente
} from '../../services/fluxo/valorComponente';

import {
  COMPONENTES_NATIVOS
} from '../../services/fluxo/componentesNativos';

import ComponenteHtml from './componentes/ComponenteHtml';
import ComponenteMontadorBom from './componentes/ComponenteMontadorBom';
import { IPropsComponenteNativo } from './componentes/tiposComponente';

// ============================================================
// CAMPO "COMPONENTE": escolhe a tela (nativa ou HTML) e mostra, logo
// abaixo, o resumo e o que impede concluir a etapa.
// ============================================================

// Telas dos componentes nativos (descrição em componentesNativos.ts).
const TELAS_NATIVAS: Record<string, React.FC<IPropsComponenteNativo>> = {
  montadorBom: ComponenteMontadorBom
};

export interface ICampoComponenteFluxoProps {
  id: string;
  rotulo: string;
  config?: IConfigComponente;
  valor: string;
  desabilitado?: boolean;
  onAlterar?: (valor: string) => void;
  dataverseService?: DataverseService;
  valoresRegistro?: Record<string, string>;
}

const CampoComponenteFluxo: React.FC<ICampoComponenteFluxoProps> = (props) => {

  const config = props.config;
  const somenteLeitura = !!props.desabilitado || !props.onAlterar;
  const alterar = (novo: string): void => { if (props.onAlterar && !props.desabilitado) { props.onAlterar(novo); } };

  if (!config) {
    return <div style={{ fontSize: '13px', color: '#B42318' }}>O componente “{props.rotulo}” não está configurado (Processos → Metadados).</div>;
  }

  let tela: React.ReactNode;
  if (config.tipo === 'nativo') {
    const Tela = config.nativo ? TELAS_NATIVAS[config.nativo] : undefined;
    const descricao = COMPONENTES_NATIVOS.find(item => item.chave === config.nativo);
    tela = Tela
      ? <Tela valor={props.valor} onAlterar={alterar} somenteLeitura={somenteLeitura} parametros={config.parametros} valoresRegistro={props.valoresRegistro} dataverseService={props.dataverseService} />
      : <div style={{ fontSize: '13px', color: '#B42318' }}>Componente nativo “{descricao ? descricao.nome : config.nativo}” não disponível nesta versão do portal.</div>;
  } else {
    tela = (
      <ComponenteHtml
        config={config}
        valor={props.valor}
        onAlterar={alterar}
        somenteLeitura={somenteLeitura}
        valoresRegistro={props.valoresRegistro}
        dataverseService={props.dataverseService}
      />
    );
  }

  const envelope = lerEnvelopeComponente(props.valor);

  return (
    <div id={props.id}>
      {tela}
      {envelope && (
        <div style={{ marginTop: '6px', fontSize: '12.5px', color: envelope.valido ? '#0E5A12' : '#8A1C14' }}>
          {envelope.valido ? '✓ ' : '⚠ '}{envelope.resumo || (envelope.valido ? 'Pronto' : 'Incompleto')}
          {!envelope.valido && (envelope.erros || []).length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
              {(envelope.erros || []).map(erro => <li key={erro}>{erro}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CampoComponenteFluxo;
