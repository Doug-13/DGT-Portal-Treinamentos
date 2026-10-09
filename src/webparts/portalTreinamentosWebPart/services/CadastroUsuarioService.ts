import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  PerfilAcesso
} from './AutorizacaoService';

// ============================================================
// CADASTRO DE USUÁRIOS NO PORTAL
//
// Problema: a pessoa é liberada no ambiente (Power Platform admin
// center → Usuários), mas não aparece em "Usuários e acessos",
// porque o portal lista a tabela dgt_usuario — e ninguém criou o
// registro dela ali.
//
// Solução: comparar os usuários do AMBIENTE (systemuser) com os do
// PORTAL (dgt_usuario) e cadastrar com um clique, já com nome,
// e-mail, UPN e Entra Object ID corretos (os mesmos do Microsoft
// 365, que o portal usa para reconhecer quem está logado).
//
// Situações:
//   novo      → existe no ambiente e não tem registro no portal
//   inativo   → tem registro no portal, mas com Ativo = Não
//               (não aparece na tela; é reativado, sem duplicar)
//
// Ficam de fora: usuários desabilitados, contas de aplicativo e
// contas de suporte da Microsoft (sem Entra Object ID ou com
// modo de acesso diferente de "Leitura-Gravação").
// ============================================================

export type SituacaoCadastro = 'novo' | 'inativo';

export interface IUsuarioAmbiente {
  systemUserId: string;
  nome: string;
  email: string;
  upn: string;
  entraObjectId: string;
  situacao: SituacaoCadastro;
  // Preenchido quando situacao = 'inativo'
  usuarioPortalId?: string;
}

const guid = (valor: unknown): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const minusculo = (valor: string): string =>
  (valor || '').trim().toLowerCase();

// "Silva, Sara" → "Sara Silva" (o ambiente guarda Sobrenome, Nome).
const montarNome = (r: IDataverseRecord): string => {
  const primeiro = texto(r, 'firstname');
  const ultimo = texto(r, 'lastname');
  if (primeiro && ultimo) {
    return `${primeiro} ${ultimo}`;
  }
  const completo = texto(r, 'fullname');
  const m = /^([^,]+),\s*(.+)$/.exec(completo);
  return m ? `${m[2]} ${m[1]}` : completo || texto(r, 'internalemailaddress');
};

export class CadastroUsuarioService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // Usuários do ambiente que ainda não estão (ativos) no portal.
  public async listarPendentes(): Promise<IUsuarioAmbiente[]> {

    const [ambiente, portal] = await Promise.all([
      this.dataverse.listarRegistros(
        'systemuser',
        '$select=systemuserid,fullname,firstname,lastname,internalemailaddress,domainname,azureactivedirectoryobjectid' +
        '&$filter=isdisabled eq false and accessmode eq 0 and azureactivedirectoryobjectid ne null'
      ),
      this.dataverse.listarRegistros(
        'dgt_usuario',
        '$select=dgt_usuarioid,dgt_name,dgt_email,dgt_upn,dgt_entraobjectid,dgt_ativo'
      )
    ]);

    // Índices do portal por e-mail, UPN e Object ID
    const porChave: Record<string, IDataverseRecord> = {};

    portal.forEach(r => {
      [texto(r, 'dgt_email'), texto(r, 'dgt_upn'), texto(r, 'dgt_entraobjectid')]
        .map(minusculo)
        .filter(chave => !!chave)
        .forEach(chave => {
          // Se houver mais de um, prefere o ativo.
          const atual = porChave[chave];
          if (!atual || (atual.dgt_ativo === false && r.dgt_ativo !== false)) {
            porChave[chave] = r;
          }
        });
    });

    const pendentes: IUsuarioAmbiente[] = [];

    ambiente.forEach(r => {

      const email = minusculo(texto(r, 'internalemailaddress'));
      const upn = minusculo(texto(r, 'domainname'));
      const objectId = guid(r.azureactivedirectoryobjectid);

      if (!email && !upn) {
        return;
      }

      const existente =
        porChave[email] ||
        porChave[upn] ||
        porChave[objectId];

      if (existente && existente.dgt_ativo !== false) {
        return; // já está no portal
      }

      pendentes.push({
        systemUserId: guid(r.systemuserid),
        nome: montarNome(r),
        email: email || upn,
        upn: upn || email,
        entraObjectId: objectId,
        situacao: existente ? 'inativo' : 'novo',
        usuarioPortalId: existente ? guid(existente.dgt_usuarioid) : undefined
      });
    });

    return pendentes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // Cria (ou reativa) o usuário no portal. Devolve o id em dgt_usuario.
  public async cadastrar(
    usuario: IUsuarioAmbiente,
    perfil: PerfilAcesso
  ): Promise<string> {

    if (usuario.situacao === 'inativo' && usuario.usuarioPortalId) {
      await this.dataverse.atualizarRegistro(
        'dgt_usuario',
        usuario.usuarioPortalId,
        {
          dgt_ativo: true,
          dgt_perfilacesso: perfil,
          dgt_entraobjectid: usuario.entraObjectId
        }
      );
      return usuario.usuarioPortalId;
    }

    return this.dataverse.criarRegistro(
      'dgt_usuario',
      {
        dgt_name: usuario.nome.substring(0, 200),
        dgt_email: usuario.email,
        dgt_upn: usuario.upn,
        dgt_entraobjectid: usuario.entraObjectId,
        dgt_ativo: true,
        dgt_perfilacesso: perfil
      }
    );
  }
}
