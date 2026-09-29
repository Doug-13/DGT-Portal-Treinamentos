import {
  DataverseService
} from './DataverseService';

import {
  diagnosticarErro,
  IDiagnosticoErro
} from '../utils/diagnosticoDataverse';

// ============================================================
// TESTE DE CONEXÃO — executado pelo próprio usuário
//
//   1. Token + usuário no ambiente (WhoAmI)
//   2. Dados do usuário no Dataverse (ativo? unidade?)
//   3. Security Roles / Group Teams
//   4. Leitura da tabela de colaboradores do portal
//   5. Cadastro do colaborador com o e-mail dele
//   6. Leitura de treinamentos e documentos
//
// Um passo bloqueante que falhar faz os seguintes serem pulados,
// para não gerar erros em cascata que confundem a análise.
// ============================================================

export type StatusPassoTeste =
  | 'ok'
  | 'aviso'
  | 'erro'
  | 'ignorado';

export interface IPassoTeste {
  id: string;
  nome: string;
  status: StatusPassoTeste;
  detalhe: string;
  diagnostico?: IDiagnosticoErro;
  duracaoMs?: number;
}

export interface IResultadoTesteConexao {
  passos: IPassoTeste[];
  conclusao: string;
  // Diagnóstico do primeiro passo com erro (o que precisa ser resolvido).
  diagnosticoPrincipal?: IDiagnosticoErro;
}

interface IDefinicaoPasso {
  id: string;
  nome: string;
  // Se falhar, os próximos passos são pulados.
  bloqueante: boolean;
  // Falha vira "aviso" (não impede o uso, só informa).
  opcional?: boolean;
  executar: () => Promise<{ status?: StatusPassoTeste; detalhe: string }>;
}

export class DiagnosticoConexaoService {

  private readonly dataverse:
    DataverseService;

  private readonly email:
    string;

  public constructor(
    dataverse: DataverseService,
    email: string
  ) {
    this.dataverse = dataverse;
    this.email = email;
  }

  public async executar(
    aoAtualizar?: (passos: IPassoTeste[]) => void
  ): Promise<IResultadoTesteConexao> {

    let systemUserId = '';

    const definicoes: IDefinicaoPasso[] = [
      {
        id: 'whoami',
        nome: 'Autenticação e usuário no ambiente (WhoAmI)',
        bloqueante: true,
        executar: async () => {
          const eu = await this.dataverse.whoAmI();
          systemUserId = eu.UserId;

          return {
            detalhe: `Usuário reconhecido pelo Dataverse (ID ${eu.UserId}).`
          };
        }
      },
      {
        id: 'usuario-sistema',
        nome: 'Situação do usuário no Dataverse',
        bloqueante: false,
        opcional: true,
        executar: async () => {
          const usuario =
            await this.dataverse.getUsuarioSistemaDiagnostico(systemUserId);

          const unidade =
            (usuario.businessunitid as Record<string, unknown> | undefined)?.name;

          const desabilitado =
            usuario.isdisabled === true;

          return {
            status: desabilitado ? 'erro' : 'ok',
            detalhe:
              `${String(usuario.fullname || '-')} · ${String(usuario.internalemailaddress || usuario.domainname || '-')}` +
              ` · ${desabilitado ? 'DESABILITADO' : 'habilitado'}` +
              (unidade ? ` · Unidade: ${String(unidade)}` : '')
          };
        }
      },
      {
        id: 'papeis',
        nome: 'Security Roles e Group Teams',
        bloqueante: false,
        opcional: true,
        executar: async () => {
          const resultado =
            await this.dataverse.getPapeisEquipesDiagnostico(systemUserId);

          const semNada =
            resultado.papeis.length === 0 &&
            resultado.equipes.length === 0;

          return {
            status: semNada ? 'aviso' : 'ok',
            detalhe: semNada
              ? 'Nenhuma Security Role direta nem equipe encontrada — o usuário provavelmente não conseguirá ler os dados.'
              : `Roles diretas: ${resultado.papeis.join(', ') || 'nenhuma'} · Equipes: ${resultado.equipes.join(', ') || 'nenhuma'}`
          };
        }
      },
      {
        id: 'tabela-usuarios',
        nome: 'Leitura da tabela de colaboradores (dgt_usuario)',
        bloqueante: true,
        executar: async () => {
          await this.dataverse.testarLeituraTabela('dgt_usuario', 'dgt_usuarioid');

          return {
            detalhe: 'Permissão de leitura confirmada.'
          };
        }
      },
      {
        id: 'cadastro',
        nome: 'Cadastro do colaborador no Portal',
        bloqueante: true,
        executar: async () => {
          const cadastro =
            await this.dataverse.testarCadastroPortal(this.email);

          if (!cadastro.encontrado) {
            throw new Error(
              `Seu usuário não está cadastrado no Portal de Treinamentos. Nenhum registro em dgt_usuario com o e-mail ${this.email}.`
            );
          }

          if (!cadastro.ativo) {
            throw new Error(
              'Seu usuário está inativo no Portal de Treinamentos.'
            );
          }

          return {
            detalhe: `Cadastro encontrado e ativo: ${cadastro.nome || this.email}.`
          };
        }
      },
      {
        id: 'tabela-treinamentos',
        nome: 'Leitura de treinamentos (dgt_usuariotreinamento)',
        bloqueante: false,
        opcional: true,
        executar: async () => {
          const quantidade =
            await this.dataverse.testarLeituraTabela('dgt_usuariotreinamento', 'dgt_usuariotreinamentoid');

          return {
            detalhe: quantidade > 0
              ? 'Permissão de leitura confirmada.'
              : 'Leitura permitida (nenhum registro visível para este usuário).'
          };
        }
      },
      {
        id: 'tabela-documentos',
        nome: 'Leitura de documentos (dgt_documento)',
        bloqueante: false,
        opcional: true,
        executar: async () => {
          const quantidade =
            await this.dataverse.testarLeituraTabela('dgt_documento', 'dgt_documentoid');

          return {
            detalhe: quantidade > 0
              ? 'Permissão de leitura confirmada.'
              : 'Leitura permitida (nenhum registro visível para este usuário).'
          };
        }
      }
    ];

    const passos: IPassoTeste[] =
      definicoes.map(
        definicao => ({
          id: definicao.id,
          nome: definicao.nome,
          status: 'ignorado',
          detalhe: 'Aguardando...'
        })
      );

    const publicar = (): void => {
      if (aoAtualizar) {
        aoAtualizar(passos.map(passo => ({ ...passo })));
      }
    };

    publicar();

    let interrompido = false;
    let diagnosticoPrincipal: IDiagnosticoErro | undefined;

    for (let indice = 0; indice < definicoes.length; indice++) {

      const definicao = definicoes[indice];
      const passo = passos[indice];

      if (interrompido) {
        passo.status = 'ignorado';
        passo.detalhe = 'Não executado: um passo anterior falhou.';
        continue;
      }

      const inicio = Date.now();

      try {
        const resultado = await definicao.executar();

        passo.status = resultado.status || 'ok';
        passo.detalhe = resultado.detalhe;
      } catch (error) {
        const diagnostico = diagnosticarErro(error);

        passo.status = definicao.opcional ? 'aviso' : 'erro';
        passo.detalhe = diagnostico.titulo;
        passo.diagnostico = diagnostico;

        if (!definicao.opcional && !diagnosticoPrincipal) {
          diagnosticoPrincipal = diagnostico;
        }

        if (definicao.bloqueante) {
          interrompido = true;
        }
      }

      passo.duracaoMs = Date.now() - inicio;
      publicar();
    }

    const erros =
      passos.filter(passo => passo.status === 'erro').length;

    const avisos =
      passos.filter(passo => passo.status === 'aviso').length;

    return {
      passos,
      diagnosticoPrincipal,
      conclusao:
        erros > 0
          ? `Foi encontrado um bloqueio: ${diagnosticoPrincipal ? diagnosticoPrincipal.titulo : 'veja os passos com erro'}.`
          : avisos > 0
            ? 'A conexão funciona, mas há avisos que podem limitar o acesso.'
            : 'Tudo certo: o Dataverse e o cadastro do portal estão funcionando para este usuário.'
    };
  }
}

export const passosParaTexto = (
  passos: IPassoTeste[]
): string[] => [
  'Teste de conexão:',
  ...passos.map(
    passo =>
      `  [${passo.status.toUpperCase()}] ${passo.nome} — ${passo.detalhe}` +
      (passo.diagnostico?.codigo ? ` (código ${passo.diagnostico.codigo})` : '') +
      (passo.duracaoMs !== undefined ? ` · ${passo.duracaoMs}ms` : '')
  )
];
