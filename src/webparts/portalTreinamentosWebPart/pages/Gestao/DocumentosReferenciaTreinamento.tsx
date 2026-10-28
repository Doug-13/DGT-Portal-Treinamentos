import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import CampoDocumentoFluxo from
  '../../components/fluxo/CampoDocumentoFluxo';

import {
  gravarValorDocumentos,
  lerValorDocumentos
} from '../../services/fluxo/valorDocumento';

import {
  IDocumentoDoTreinamento,
  desvincularDocumentoDoTreinamento,
  listarDocumentosDoTreinamento,
  vincularDocumentoAoTreinamento
} from '../../services/referencias/ReferenciasDocumentoService';

// ============================================================
// DOCUMENTOS DE REFERÊNCIA DO TREINAMENTO
//
// Vincula POPs, ITs, políticas... ao treinamento direto no cadastro,
// sem depender de metadados do fluxo. Grava em
// dgt_treinamentodocumento — o mesmo vínculo usado pelo retreinamento
// por revisão documental e mostrado na aba "Referências" do documento.
//
//   Novo treinamento → os documentos escolhidos são vinculados ao
//                      salvar (valor/onAlterar controlados pela tela).
//   Edição           → cada inclusão/remoção é gravada na hora.
//                      Remover DESATIVA o vínculo (nada é apagado).
// ============================================================

export interface IDocumentosReferenciaTreinamentoProps {
  dataverseService?: DataverseService;

  // Edição: treinamento já gravado (vínculos gravados na hora).
  treinamentoId?: string;
  treinamentoCodigo?: string;

  // Novo: seleção pendente (JSON — ver valorDocumento.ts).
  valorPendente?: string;
  onAlterarPendente?: (valor: string) => void;

  onAbrirDocumento?: (documentoId: string) => void;

  desabilitado?: boolean;
}

const COR = {
  azul: '#202A44',
  texto2: '#66788A',
  borda: '#D8E2EC',
  verde: '#13795B',
  vermelho: '#A4262C'
};

const DocumentosReferenciaTreinamento: React.FC<IDocumentosReferenciaTreinamentoProps> = (props) => {

  const edicao =
    !!props.treinamentoId;

  const [vinculos, setVinculos] =
    React.useState<IDocumentoDoTreinamento[]>([]);

  const [carregando, setCarregando] =
    React.useState(false);

  const [gravando, setGravando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  const [mensagem, setMensagem] =
    React.useState('');

  const carregar = React.useCallback(
    async (): Promise<void> => {
      if (!edicao || !props.dataverseService || !props.treinamentoId) {
        return;
      }

      setCarregando(true);
      setErro('');

      try {
        setVinculos(await listarDocumentosDoTreinamento(props.dataverseService, props.treinamentoId));
      } catch (falha) {
        console.error(falha);
        setErro('Não foi possível carregar os documentos vinculados.');
      } finally {
        setCarregando(false);
      }
    },
    [edicao, props.dataverseService, props.treinamentoId]
  );

  React.useEffect(
    () => {
      carregar().catch(falha => console.error(falha));
    },
    [carregar]
  );

  // Valor exibido no seletor.
  const valor =
    edicao
      ? gravarValorDocumentos(
        vinculos.map(item => ({
          id: item.documento.id,
          codigo: item.documento.codigo,
          titulo: item.documento.titulo
        }))
      )
      : props.valorPendente || '';

  // Edição: grava a diferença entre o que estava e o novo valor.
  const alterarEdicao = async (
    novoValor: string
  ): Promise<void> => {

    if (!props.dataverseService || !props.treinamentoId) {
      return;
    }

    const novos = lerValorDocumentos(novoValor).map(item => item.id);
    const atuais = vinculos.map(item => item.documento.id);

    const incluidos = novos.filter(id => atuais.indexOf(id) < 0);
    const removidos = vinculos.filter(item => novos.indexOf(item.documento.id) < 0);

    if (
      removidos.length > 0 &&
      !window.confirm(
        `Desvincular ${removidos.map(item => item.documento.codigo).join(', ')} deste treinamento?\n\n` +
        'Novas revisões desse documento deixarão de gerar retreinamento deste curso. O histórico é preservado.'
      )
    ) {
      return;
    }

    setGravando(true);
    setErro('');
    setMensagem('');

    try {
      for (const documentoId of incluidos) {
        await vincularDocumentoAoTreinamento(
          props.dataverseService,
          props.treinamentoId,
          documentoId,
          `Vínculo criado no cadastro do treinamento${props.treinamentoCodigo ? ` ${props.treinamentoCodigo}` : ''}.`
        );
      }

      for (const item of removidos) {
        await desvincularDocumentoDoTreinamento(props.dataverseService, item.relacaoId);
      }

      setMensagem(
        incluidos.length > 0
          ? 'Documento vinculado ao treinamento.'
          : 'Documento desvinculado do treinamento.'
      );

      await carregar();
    } catch (falha) {
      console.error(falha);
      setErro(`Não foi possível gravar o vínculo: ${falha instanceof Error ? falha.message : String(falha)}`);
    } finally {
      setGravando(false);
    }
  };

  return (
    <div
      style={{
        padding: '14px 16px',
        border: `1px solid ${COR.borda}`,
        borderRadius: '12px',
        background: '#FAFCFE'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
        <strong style={{ color: COR.azul, fontSize: '13px' }}>
          📄 Documentos de referência
        </strong>
        {
          (carregando || gravando) &&
          <span style={{ fontSize: '11.5px', color: COR.texto2 }}>{gravando ? 'Gravando...' : 'Carregando...'}</span>
        }
      </div>

      <div style={{ fontSize: '12px', color: COR.texto2, marginBottom: '10px', lineHeight: 1.45 }}>
        POPs, ITs, políticas e demais documentos em que este treinamento se baseia. Uma nova revisão de um
        desses documentos que exija retreinamento gera retreinamento deste curso. O vínculo também aparece
        na aba <strong>Referências</strong> do documento.
        {!edicao && ' Os vínculos são gravados ao salvar o treinamento.'}
      </div>

      {
        props.dataverseService
          ? (
            <CampoDocumentoFluxo
              id="treinamento-documentos-referencia"
              valor={valor}
              multiplo={true}
              desabilitado={props.desabilitado || gravando || carregando}
              dataverseService={props.dataverseService}
              onAbrirDocumento={props.onAbrirDocumento}
              onAlterar={novo => {
                if (edicao) {
                  alterarEdicao(novo).catch(falha => console.error(falha));
                } else if (props.onAlterarPendente) {
                  props.onAlterarPendente(novo);
                }
              }}
            />
          )
          : (
            <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
              Serviço do Dataverse indisponível nesta tela.
            </div>
          )
      }

      {erro && <div style={{ marginTop: '8px', fontSize: '12.5px', color: COR.vermelho }}>{erro}</div>}
      {mensagem && !erro && <div style={{ marginTop: '8px', fontSize: '12.5px', color: COR.verde }}>✓ {mensagem}</div>}
    </div>
  );
};

export default DocumentosReferenciaTreinamento;
