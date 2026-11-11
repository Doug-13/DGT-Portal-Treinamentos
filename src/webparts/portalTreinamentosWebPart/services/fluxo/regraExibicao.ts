import {
  IFluxoCampo,
  IFluxoMetadado
} from '../../models/Fluxo';

// ============================================================
// REGRA DE EXIBIÇÃO DO METADADO ("exibir só quando")
//
// Definida uma vez, nos metadados do processo, e aplicada a todas as
// atividades que exibem o campo (inclusive versões já publicadas: os
// metadados atuais do processo são aplicados na execução).
//   modo da atividade Obrigatório → obrigatório só quando aparece
//   demais modos                  → aparece só quando a condição bate
// Sem regra no processo, vale a regra antiga da atividade (se houver).
// ============================================================

// Tipos que podem servir de condição.
export const TIPOS_CONDICAO_EXIBICAO = ['simNao', 'lista', 'texto', 'numero', 'data'];

export const aplicarRegraExibicao = (
  campo: IFluxoCampo,
  metadado: IFluxoMetadado
): IFluxoCampo => {
  const regra = metadado.exibirQuando;
  if (!regra || !regra.campo) {
    return campo;
  }
  const exigido = campo.obrigatorio || !!campo.obrigatorioQuando;
  return {
    ...campo,
    obrigatorio: false,
    obrigatorioQuando: exigido ? { ...regra } : undefined,
    mostrarQuando: exigido ? undefined : { ...regra }
  };
};

export const descreverRegraExibicao = (
  regra: { campo: string; valor: string } | undefined,
  metadados: IFluxoMetadado[]
): string => {
  if (!regra) {
    return '';
  }
  const campo = metadados.find(item => item.chave === regra.campo);
  const valor = campo && campo.tipo === 'simNao' ? (regra.valor === 'sim' ? 'Sim' : regra.valor === 'nao' ? 'Não' : regra.valor) : regra.valor;
  return `Exibir só quando "${campo ? campo.rotulo : regra.campo}" for ${valor || '(vazio)'}`;
};

export const validarRegrasExibicao = (
  metadados: IFluxoMetadado[]
): string[] => {
  const erros: string[] = [];
  metadados.forEach(metadado => {
    const regra = metadado.exibirQuando;
    if (!regra) {
      return;
    }
    const alvo = metadados.find(item => item.chave === regra.campo);
    if (!alvo) {
      erros.push(`A regra de exibição de "${metadado.rotulo}" usa um campo que não existe nos metadados do processo.`);
    } else if (alvo.chave === metadado.chave) {
      erros.push(`A regra de exibição de "${metadado.rotulo}" não pode depender do próprio campo.`);
    } else if (TIPOS_CONDICAO_EXIBICAO.indexOf(alvo.tipo) < 0) {
      erros.push(`A regra de exibição de "${metadado.rotulo}" usa "${alvo.rotulo}", que não pode ser condição (use Sim/Não, Lista, Texto, Número ou Data).`);
    } else if (!(regra.valor || '').trim()) {
      erros.push(`Informe o valor da regra de exibição de "${metadado.rotulo}".`);
    } else if (alvo.exibirQuando && alvo.exibirQuando.campo === metadado.chave) {
      erros.push(`"${metadado.rotulo}" e "${alvo.rotulo}" dependem um do outro na regra de exibição: um deles nunca apareceria.`);
    }
  });
  return erros;
};
