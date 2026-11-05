import {
  DataverseService
} from '../DataverseService';

import {
  AreaAdminService
} from '../AreaAdminService';

import {
  IProcesso
} from '../../models/Processo';

import {
  IFluxoDefinicao,
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  IAmbiente
} from '../../models/Ambiente';

import {
  obterPersistenciaFluxo
} from '../fluxo/persistenciaFluxo';

import {
  metadadosParaCopiar
} from '../fluxo/copiaFluxo';

import {
  AmbienteService,
  gerarChaveAmbiente,
  gerarPrefixoAmbiente
} from '../ambientes/AmbienteService';

import {
  lerLayout,
  normalizarLayout
} from '../ambientes/layoutAmbiente';

import {
  IPacoteInterpretado,
  IPacoteProcesso,
  IReferenciasPacote,
  exportarPacote
} from './pacoteProcesso';

// ============================================================
// IMPORTAR / EXPORTAR PACOTE DE PROCESSO (Dataverse)
//
// Importar faz, na ordem, os MESMOS passos das telas:
//   1. processo   → usa o existente (mesmo código) ou cria
//   2. metadados  → acrescenta os campos que faltam; os existentes
//                   ficam como estão (tipo diferente = erro)
//   3. fluxo      → cria um RASCUNHO (como "Copiar fluxo")
//   4. publicar   → opcional, só se passar na validação do editor
//   5. ambiente   → opcional: cria o ambiente ligado ao fluxo e grava
//                   as telas configuradas
// Nada é apagado; um rascunho existente só é descartado se o usuário
// marcar "substituir rascunho".
// ============================================================

export interface IOpcoesImportacao {
  publicar: boolean;
  criarAmbiente: boolean;
  substituirRascunho: boolean;
  // Pacote SEM fluxo com ambiente: fluxo (dgt_processo) escolhido na
  // tela. Vazio = o processo do pacote (ou, sem processo, um novo AMB-…).
  fluxoAmbienteId?: string;
}

export interface IPassoImportacao {
  ok: boolean;
  texto: string;
}

export interface IResultadoImportacao {
  ok: boolean;
  passos: IPassoImportacao[];
  processo?: IProcesso;
  ambiente?: IAmbiente;
}

const guid = (valor?: string): string => String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const mensagem = (erro: unknown): string => (erro instanceof Error ? erro.message : String(erro));

export class PacoteProcessoService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // Áreas (sigla), usuários (e-mail) e processos (código) do portal.
  public async referencias(): Promise<IReferenciasPacote> {
    const areasService = new AreaAdminService(this.dataverse);
    const persistencia = obterPersistenciaFluxo(this.dataverse);
    const [areas, usuarios, processos] = await Promise.all([
      areasService.listarAreas().catch(() => []),
      areasService.listarUsuarios().catch(() => []),
      persistencia.processos.carregar(true, []).then(dados => dados.processos).catch(() => [] as IProcesso[])
    ]);
    return {
      areas: areas.map(item => ({ id: guid(item.id), sigla: item.sigla, nome: item.nome })),
      usuarios: usuarios.map(item => ({ id: guid(item.id), email: item.email, nome: item.nome })),
      processos: processos.filter(item => item.ativo !== false).map(item => ({ id: guid(item.id), codigo: item.codigo, nome: item.nome }))
    };
  }

  public async importar(
    pacote: IPacoteInterpretado,
    opcoes: IOpcoesImportacao,
    ambientesConhecidos: IAmbiente[] = []
  ): Promise<IResultadoImportacao> {

    const passos: IPassoImportacao[] = [];
    const falha = (texto: string, processo?: IProcesso): IResultadoImportacao => {
      passos.push({ ok: false, texto });
      return { ok: false, passos, processo };
    };

    const persistencia = obterPersistenciaFluxo(this.dataverse);
    let processo: IProcesso | undefined;

    if (pacote.processo) {
      const dadosProcesso = pacote.processo;

      // 1. Processo
      try {
        const dados = await persistencia.processos.carregar(true, []);
        processo = dados.processos.find(item => (item.codigo || '').toUpperCase() === dadosProcesso.codigo);
        if (processo) {
          passos.push({ ok: true, texto: `Processo ${processo.codigo} já existe — usado (nome e área não foram alterados).` });
        } else {
          const criado = await persistencia.processos.criarProcesso(
            {
              codigo: dadosProcesso.codigo,
              nome: dadosProcesso.nome,
              descricao: dadosProcesso.descricao,
              areaId: dadosProcesso.areaId,
              areaNome: dadosProcesso.areaNome
            },
            dados.processos
          );
          if (!criado.ok || !criado.processo) {
            return falha(`Processo não criado: ${criado.erro || 'erro desconhecido'}`);
          }
          processo = criado.processo;
          passos.push({ ok: true, texto: `Processo ${processo.codigo} — ${processo.nome} criado.` });
        }
      } catch (erro) {
        return falha(`Não foi possível ler/criar o processo: ${mensagem(erro)}`);
      }

      // 2. Metadados
      let metadadosFinais: IFluxoMetadado[];
      try {
        const atuais = await persistencia.metadados.listar(processo.id);
        const conflitos =
          pacote.metadados.filter(meta => atuais.some(atual => atual.chave === meta.chave && atual.tipo !== meta.tipo));
        if (conflitos.length > 0) {
          return falha(
            `Campos com o mesmo nome e tipo diferente no processo: ${conflitos.map(item => {
              const atual = atuais.find(a => a.chave === item.chave);
              return `${item.chave} (no processo: ${atual ? atual.tipo : '?'}; no JSON: ${item.tipo})`;
            }).join(', ')}. Renomeie a chave no JSON.`,
            processo
          );
        }
        const novos = metadadosParaCopiar(pacote.metadados, atuais);
        metadadosFinais = novos.length > 0 ? await persistencia.metadados.salvar(processo.id, atuais.concat(novos)) : atuais;
        const mantidos = pacote.metadados.length - novos.length;
        passos.push({ ok: true, texto: `Campos: ${novos.length} novo(s)${mantidos > 0 ? `, ${mantidos} já existia(m) e foram mantidos` : ''}.` });
      } catch (erro) {
        return falha(`Campos (metadados) não gravados: ${mensagem(erro)}`, processo);
      }

      // 3. Rascunho do fluxo
      if (pacote.definicao) {
        try {
          const versoes = await persistencia.catalogo.listarVersoes(processo.id);
          if (versoes.some(item => item.status === 'rascunho')) {
            if (!opcoes.substituirRascunho) {
              return falha('O processo já tem um rascunho de fluxo. Marque "substituir o rascunho existente" ou publique/descarte o rascunho no editor.', processo);
            }
            const descarte = await persistencia.catalogo.descartarRascunho(processo.id);
            if (!descarte.ok) {
              return falha(`Rascunho existente não descartado: ${descarte.erros.join(' ')}`, processo);
            }
            passos.push({ ok: true, texto: 'Rascunho anterior descartado.' });
          }
          const definicao: IFluxoDefinicao = { ...pacote.definicao, processoId: processo.id, metadados: metadadosFinais };
          const copia = await persistencia.catalogo.criarCopia(processo, definicao, 'manter');
          if (!copia.ok) {
            return falha(`Fluxo não criado: ${copia.erros.join(' ')}`, processo);
          }
          passos.push({ ok: true, texto: `Fluxo criado como rascunho${copia.definicao ? ` (versão ${copia.definicao.versao})` : ''}, com ${pacote.definicao.elementos.length} elementos.` });
        } catch (erro) {
          return falha(`Fluxo não criado: ${mensagem(erro)}`, processo);
        }

        // 4. Publicar
        if (opcoes.publicar) {
          try {
            const publicado = await persistencia.catalogo.publicarRascunho(processo.id);
            passos.push(
              publicado.ok
                ? { ok: true, texto: 'Fluxo publicado.' }
                : { ok: false, texto: `Fluxo não publicado (fica como rascunho): ${publicado.erros.join(' ')}` }
            );
          } catch (erro) {
            passos.push({ ok: false, texto: `Fluxo não publicado (fica como rascunho): ${mensagem(erro)}` });
          }
        }
      } else {
        passos.push({ ok: true, texto: 'Pacote sem fluxo: desenhe-o depois em Processos → Fluxos (ou importe um pacote com "fluxo").' });
      }
    }

    // 5. Ambiente
    let ambiente: IAmbiente | undefined;
    if (pacote.ambiente && opcoes.criarAmbiente) {
      const dados = pacote.ambiente;
      const ambientes = new AmbienteService(this.dataverse);

      // Fluxo do ambiente: o do pacote; senão o escolhido na tela / em
      // "ambiente.fluxo"; senão o processo do pacote; senão um novo.
      const processoDoAmbiente =
        pacote.definicao && processo
          ? processo.id
          : opcoes.fluxoAmbienteId || dados.processoExistenteId || (processo ? processo.id : undefined);

      // Lista atual do Dataverse (evita chave/nome repetidos).
      const lidos = await ambientes.listar();
      const ambientesExistentes = lidos.disponivel ? lidos.ambientes : ambientesConhecidos;
      const resultado = await ambientes.criar(
        {
          processoId: processoDoAmbiente,
          nome: dados.nome,
          chave: dados.chave || gerarChaveAmbiente(dados.nome),
          descricao: dados.descricao,
          subtitulo: dados.subtitulo,
          icone: dados.icone,
          ordem: dados.ordem || (ambientesExistentes.length + 1) * 10,
          liberadoParaTodos: dados.liberadoParaTodos,
          perfisPadrao: dados.perfisPadrao,
          prefixoCodigo: dados.prefixoCodigo || gerarPrefixoAmbiente(dados.nome),
          rotuloRegistro: dados.rotuloRegistro
        },
        ambientesExistentes
      );
      if (!resultado.ok || !resultado.ambiente) {
        passos.push({ ok: false, texto: `Ambiente NÃO criado: ${resultado.erros.join(' ')}` });
      } else {
        ambiente = resultado.ambiente;
        passos.push({
          ok: true,
          texto: `Ambiente "${ambiente.nome}" criado no menu lateral, ligado ao fluxo ${ambiente.processoNome || ''}.` +
            (processoDoAmbiente ? '' : ' (fluxo novo, vazio: desenhe-o na aba Configuração do ambiente).') +
            ' Libere-o em Usuários e acessos (o Administrador já vê).'
        });
        if (dados.layout) {
          try {
            const json = JSON.stringify(dados.layout);
            await ambientes.salvarLayout(ambiente, json);
            ambiente = { ...ambiente, layoutJson: json };
            passos.push({ ok: true, texto: 'Telas do ambiente configuradas.' });
          } catch (erro) {
            passos.push({ ok: false, texto: `Telas não gravadas (o ambiente usa as telas padrão): ${mensagem(erro)}` });
          }
        }
      }
    } else if (pacote.ambiente) {
      passos.push({ ok: true, texto: 'Ambiente não criado (opção desmarcada).' });
    }

    return { ok: passos.every(item => item.ok), passos, processo, ambiente };
  }

  // Pacote de um processo existente: versão publicada (ou o rascunho, se
  // ainda não houver publicada) + campos; com o ambiente, inclui as telas.
  public async exportar(
    processoId: string,
    ambiente?: IAmbiente
  ): Promise<IPacoteProcesso> {
    const persistencia = obterPersistenciaFluxo(this.dataverse);
    const referencias = await this.referencias();
    const dados = await persistencia.processos.carregar(true, []);
    const processo = dados.processos.find(item => guid(item.id) === guid(processoId));
    if (!processo) {
      throw new Error('Processo não encontrado.');
    }
    const [metadados, versoes] = await Promise.all([
      persistencia.metadados.listar(processo.id),
      persistencia.catalogo.listarVersoes(processo.id)
    ]);
    const definicao =
      versoes.find(item => item.status === 'publicado') ||
      versoes.find(item => item.status === 'rascunho');

    return exportarPacote(
      {
        processo: { codigo: processo.codigo, nome: processo.nome, descricao: processo.descricao, areaId: processo.areaId },
        metadados,
        definicao,
        ambiente: ambiente
          ? {
            nome: ambiente.nome,
            chave: ambiente.chave,
            descricao: ambiente.descricao || undefined,
            subtitulo: ambiente.subtitulo || undefined,
            icone: ambiente.icone,
            ordem: ambiente.ordem,
            prefixoCodigo: ambiente.prefixoCodigo,
            rotuloRegistro: ambiente.rotuloRegistro,
            liberadoParaTodos: ambiente.liberadoParaTodos,
            perfisPadrao: ambiente.perfisPadrao
          }
          : undefined,
        layout: ambiente ? normalizarLayout(lerLayout(ambiente.layoutJson), definicao) : undefined
      },
      referencias
    );
  }
}

// Baixa um objeto como arquivo .json (navegador).
export const baixarJson = (nomeArquivo: string, conteudo: unknown): void => {
  const blob = new Blob([JSON.stringify(conteudo, undefined, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
