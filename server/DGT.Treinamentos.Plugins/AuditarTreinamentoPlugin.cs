using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // HISTÓRICO COMPLETO DO TREINAMENTO
    //
    // Registra em dgt_auditorianegocio toda criação, alteração e
    // exclusão do treinamento e da sua estrutura, sempre vinculada ao
    // TREINAMENTO (dgt_entidade = 'dgt_treinamento',
    // dgt_registroid = id do treinamento).
    //
    // Tabelas auditadas (e como chegam ao treinamento):
    //   dgt_treinamento
    //   dgt_modulo                     -> dgt_treinamento
    //   dgt_moduloconteudo             -> dgt_modulo
    //   dgt_modulopergunta             -> dgt_moduloconteudo
    //   dgt_moduloperguntaalternativa  -> dgt_modulopergunta
    //   dgt_avaliacao                  -> dgt_treinamento
    //   dgt_questao                    -> dgt_avaliacao
    //   dgt_alternativa                -> dgt_questao
    //   dgt_treinamentodocumento       -> dgt_treinamento
    //   dgt_trilhatreinamento          -> dgt_treinamento
    //
    // REGISTRO (Plugin Registration Tool), para CADA tabela acima:
    //   Create  | PostOperation (40) | ASSÍNCRONO | Post Image "PostImage"
    //   Update  | PostOperation (40) | ASSÍNCRONO | Pre Image "PreImage"
    //                                              + Post Image "PostImage"
    //   Delete  | PostOperation (40) | ASSÍNCRONO | Pre Image "PreImage"
    //   (imagens com todos os atributos)
    //
    // É assíncrono de propósito: uma falha na auditoria nunca impede o
    // usuário de salvar. Falhas aparecem em Configurações > Trabalhos
    // do Sistema.
    //
    // Regra do projeto: NUNCA apagar histórico. Este plugin só insere.
    // ================================================================
    public sealed class AuditarTreinamentoPlugin : IPlugin
    {
        private const string EntidadeHistorico = "dgt_treinamento";
        private const string Origem = "Plugin Auditoria - Treinamentos";

        // Tamanho máximo gravado em dgt_dadosnovos. O padrão de colunas
        // "Várias linhas de texto" costuma ser 2.000 caracteres. Se você
        // aumentar o tamanho máximo da coluna (recomendado: 100.000),
        // aumente também este valor.
        private const int LimiteJson = 1900;

        private const int LimiteValor = 300;

        private sealed class TabelaAuditada
        {
            public string Rotulo;
            public string LookupPai;
            public string TabelaPai;
        }

        private static readonly Dictionary<string, TabelaAuditada> Tabelas =
            new Dictionary<string, TabelaAuditada>(StringComparer.OrdinalIgnoreCase)
            {
                ["dgt_treinamento"] = new TabelaAuditada { Rotulo = "Treinamento" },
                ["dgt_modulo"] = new TabelaAuditada { Rotulo = "Módulo", LookupPai = "dgt_treinamento", TabelaPai = "dgt_treinamento" },
                ["dgt_moduloconteudo"] = new TabelaAuditada { Rotulo = "Conteúdo do módulo", LookupPai = "dgt_modulo", TabelaPai = "dgt_modulo" },
                ["dgt_modulopergunta"] = new TabelaAuditada { Rotulo = "Pergunta do módulo", LookupPai = "dgt_moduloconteudo", TabelaPai = "dgt_moduloconteudo" },
                ["dgt_moduloperguntaalternativa"] = new TabelaAuditada { Rotulo = "Alternativa da pergunta do módulo", LookupPai = "dgt_modulopergunta", TabelaPai = "dgt_modulopergunta" },
                ["dgt_avaliacao"] = new TabelaAuditada { Rotulo = "Avaliação", LookupPai = "dgt_treinamento", TabelaPai = "dgt_treinamento" },
                ["dgt_questao"] = new TabelaAuditada { Rotulo = "Questão", LookupPai = "dgt_avaliacao", TabelaPai = "dgt_avaliacao" },
                ["dgt_alternativa"] = new TabelaAuditada { Rotulo = "Alternativa", LookupPai = "dgt_questao", TabelaPai = "dgt_questao" },
                ["dgt_treinamentodocumento"] = new TabelaAuditada { Rotulo = "Documento vinculado", LookupPai = "dgt_treinamento", TabelaPai = "dgt_treinamento" },
                ["dgt_trilhatreinamento"] = new TabelaAuditada { Rotulo = "Trilha", LookupPai = "dgt_treinamento", TabelaPai = "dgt_treinamento" }
            };

        private static readonly HashSet<string> CamposIgnorados =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "modifiedon", "modifiedby", "modifiedonbehalfby",
                "createdon", "createdby", "createdonbehalfby",
                "versionnumber", "timezoneruleversionnumber",
                "utcconversiontimezonecode", "overriddencreatedon",
                "importsequencenumber", "owningbusinessunit",
                "owninguser", "owningteam"
            };

        // Rótulos procurados na coluna Ação (dgt_acao). Mesmo critério
        // usado pelo DocumentoHistoricoService do portal.
        private static readonly Dictionary<string, string[]> RotulosAcao =
            new Dictionary<string, string[]>
            {
                ["CRIACAO"] = new[] { "criacao", "inclusao", "criar", "create" },
                ["ALTERACAO"] = new[] { "alteracao", "atualizacao", "edicao", "update" },
                ["EXCLUSAO"] = new[] { "exclusao", "remocao", "delete", "alteracao", "atualizacao" }
            };

        private static readonly ConcurrentDictionary<string, Dictionary<string, string>> CacheRotulos =
            new ConcurrentDictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);

        private static List<KeyValuePair<int, string>> cacheOpcoesAcao;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context =
                (IPluginExecutionContext)serviceProvider.GetService(
                    typeof(IPluginExecutionContext));

            var tracing =
                (ITracingService)serviceProvider.GetService(
                    typeof(ITracingService));

            var factory =
                (IOrganizationServiceFactory)serviceProvider.GetService(
                    typeof(IOrganizationServiceFactory));

            // Grava como SYSTEM: o histórico não depende dos privilégios
            // de quem fez a alteração.
            var sistema =
                factory.CreateOrganizationService(
                    null);

            try
            {
                Executar(
                    context,
                    sistema,
                    tracing);
            }
            catch (Exception ex)
            {
                tracing.Trace(
                    "AuditarTreinamentoPlugin falhou: {0}",
                    ex);

                throw new InvalidPluginExecutionException(
                    "Falha ao registrar o histórico do treinamento: " + ex.Message,
                    ex);
            }
        }

        private static void Executar(
            IPluginExecutionContext context,
            IOrganizationService sistema,
            ITracingService tracing)
        {
            var mensagem =
                context.MessageName ?? string.Empty;

            var evento =
                mensagem.Equals("Create", StringComparison.OrdinalIgnoreCase)
                    ? "CRIACAO"
                    : mensagem.Equals("Update", StringComparison.OrdinalIgnoreCase)
                        ? "ALTERACAO"
                        : mensagem.Equals("Delete", StringComparison.OrdinalIgnoreCase)
                            ? "EXCLUSAO"
                            : null;

            if (evento == null)
            {
                return;
            }

            var tabela =
                context.PrimaryEntityName;

            if (!Tabelas.TryGetValue(
                    tabela,
                    out var definicao))
            {
                tracing.Trace("Tabela não auditada: {0}", tabela);
                return;
            }

            var pre =
                context.PreEntityImages.Contains("PreImage")
                    ? context.PreEntityImages["PreImage"]
                    : null;

            var post =
                context.PostEntityImages.Contains("PostImage")
                    ? context.PostEntityImages["PostImage"]
                    : null;

            var target =
                context.InputParameters.Contains("Target") &&
                context.InputParameters["Target"] is Entity entidade
                    ? entidade
                    : null;

            var registroId =
                context.PrimaryEntityId;

            // Imagem de referência para descobrir o treinamento e o nome.
            var referencia =
                post ??
                pre ??
                target;

            var treinamentoId =
                ResolverTreinamento(
                    sistema,
                    tabela,
                    registroId,
                    referencia,
                    tracing);

            if (treinamentoId == Guid.Empty)
            {
                tracing.Trace(
                    "Não foi possível identificar o treinamento de {0} {1}.",
                    tabela,
                    registroId);

                return;
            }

            var campos =
                MontarCampos(
                    sistema,
                    evento,
                    tabela,
                    target,
                    pre,
                    post);

            // Alteração sem mudança real de valor (ex.: portal reenviou
            // todos os campos iguais): não gera evento.
            if (evento == "ALTERACAO" &&
                campos.Count == 0)
            {
                tracing.Trace("Nenhuma alteração relevante.");
                return;
            }

            var registroNome =
                ObterNome(post) ??
                ObterNome(pre) ??
                ObterNome(target) ??
                string.Empty;

            var titulo =
                MontarTitulo(
                    evento,
                    tabela,
                    definicao.Rotulo,
                    registroNome,
                    campos);

            var descricao =
                MontarDescricao(
                    evento,
                    campos);

            var usuario =
                ObterUsuario(
                    sistema,
                    context.InitiatingUserId);

            var json =
                MontarJson(
                    evento,
                    tabela,
                    definicao.Rotulo,
                    registroId,
                    registroNome,
                    usuario.Nome,
                    campos);

            var auditoria =
                new Entity(
                    "dgt_auditorianegocio");

            auditoria["dgt_name"] =
                Limitar(titulo, 100);

            auditoria["dgt_entidade"] =
                EntidadeHistorico;

            auditoria["dgt_registroid"] =
                treinamentoId.ToString("D").ToLowerInvariant();

            auditoria["dgt_dataevento"] =
                DataDoEvento(post, pre);

            auditoria["dgt_descricao"] =
                Limitar(descricao, 1900);

            auditoria["dgt_dadosnovos"] =
                json;

            auditoria["dgt_origem"] =
                Origem;

            auditoria["dgt_ativo"] =
                true;

            var acao =
                ResolverAcao(
                    sistema,
                    evento);

            if (acao.HasValue)
            {
                auditoria["dgt_acao"] =
                    new OptionSetValue(acao.Value);
            }

            if (usuario.DgtUsuarioId != Guid.Empty)
            {
                auditoria["dgt_usuario"] =
                    new EntityReference(
                        "dgt_usuario",
                        usuario.DgtUsuarioId);
            }

            sistema.Create(
                auditoria);

            tracing.Trace(
                "Histórico registrado: {0}",
                titulo);
        }

        // ============================================================
        // TREINAMENTO DE ORIGEM
        // ============================================================

        private static Guid ResolverTreinamento(
            IOrganizationService sistema,
            string tabela,
            Guid registroId,
            Entity imagem,
            ITracingService tracing)
        {
            var tabelaAtual = tabela;
            var idAtual = registroId;
            var entidadeAtual = imagem;

            for (var nivel = 0; nivel < 6; nivel++)
            {
                if (tabelaAtual.Equals(
                        "dgt_treinamento",
                        StringComparison.OrdinalIgnoreCase))
                {
                    return idAtual;
                }

                if (!Tabelas.TryGetValue(
                        tabelaAtual,
                        out var definicao) ||
                    string.IsNullOrEmpty(definicao.LookupPai))
                {
                    return Guid.Empty;
                }

                EntityReference pai = null;

                if (entidadeAtual != null &&
                    entidadeAtual.Contains(definicao.LookupPai))
                {
                    pai = entidadeAtual.GetAttributeValue<EntityReference>(
                        definicao.LookupPai);
                }
                else
                {
                    try
                    {
                        var registro =
                            sistema.Retrieve(
                                tabelaAtual,
                                idAtual,
                                new ColumnSet(
                                    definicao.LookupPai));

                        pai = registro.GetAttributeValue<EntityReference>(
                            definicao.LookupPai);
                    }
                    catch (Exception ex)
                    {
                        tracing.Trace(
                            "Não foi possível ler {0} {1}: {2}",
                            tabelaAtual,
                            idAtual,
                            ex.Message);

                        return Guid.Empty;
                    }
                }

                if (pai == null)
                {
                    return Guid.Empty;
                }

                tabelaAtual = definicao.TabelaPai;
                idAtual = pai.Id;
                entidadeAtual = null;
            }

            return Guid.Empty;
        }

        // ============================================================
        // CAMPOS ALTERADOS
        // ============================================================

        private sealed class Campo
        {
            public string Nome;
            public string Rotulo;
            public string Anterior;
            public string Novo;
        }

        private static List<Campo> MontarCampos(
            IOrganizationService sistema,
            string evento,
            string tabela,
            Entity target,
            Entity pre,
            Entity post)
        {
            var resultado =
                new List<Campo>();

            if (evento == "EXCLUSAO")
            {
                return resultado;
            }

            var chavePrimaria =
                tabela + "id";

            IEnumerable<string> nomes;

            if (evento == "CRIACAO")
            {
                nomes =
                    (post ?? target)?.Attributes.Keys ??
                    Enumerable.Empty<string>();
            }
            else
            {
                nomes =
                    target?.Attributes.Keys ??
                    Enumerable.Empty<string>();
            }

            var rotulos =
                ObterRotulos(
                    sistema,
                    tabela);

            foreach (var nome in nomes
                         .Where(n =>
                             !CamposIgnorados.Contains(n) &&
                             !n.Equals(chavePrimaria, StringComparison.OrdinalIgnoreCase))
                         .OrderBy(n => n))
            {
                var anterior =
                    evento == "CRIACAO"
                        ? string.Empty
                        : Formatar(pre, nome);

                var novo =
                    Formatar(post ?? target, nome);

                if (string.Equals(
                        anterior,
                        novo,
                        StringComparison.Ordinal))
                {
                    continue;
                }

                if (evento == "CRIACAO" &&
                    string.IsNullOrEmpty(novo))
                {
                    continue;
                }

                resultado.Add(
                    new Campo
                    {
                        Nome = nome,
                        Rotulo = rotulos.TryGetValue(nome, out var rotulo)
                            ? rotulo
                            : nome,
                        Anterior = Limitar(anterior, LimiteValor),
                        Novo = Limitar(novo, LimiteValor)
                    });
            }

            return resultado;
        }

        private static string Formatar(
            Entity entidade,
            string campo)
        {
            if (entidade == null ||
                !entidade.Contains(campo))
            {
                return string.Empty;
            }

            if (entidade.FormattedValues.Contains(campo))
            {
                return entidade.FormattedValues[campo] ?? string.Empty;
            }

            var valor =
                entidade[campo];

            switch (valor)
            {
                case null:
                    return string.Empty;

                case EntityReference referencia:
                    return !string.IsNullOrWhiteSpace(referencia.Name)
                        ? referencia.Name
                        : referencia.Id.ToString("D");

                case OptionSetValue opcao:
                    return opcao.Value.ToString(CultureInfo.InvariantCulture);

                case Money dinheiro:
                    return dinheiro.Value.ToString("N2", new CultureInfo("pt-BR"));

                case bool booleano:
                    return booleano ? "Sim" : "Não";

                case DateTime data:
                    return data.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture) + " (UTC)";

                case decimal numero:
                    return numero.ToString(new CultureInfo("pt-BR"));

                case double numeroDouble:
                    return numeroDouble.ToString(new CultureInfo("pt-BR"));

                default:
                    return Convert.ToString(valor, CultureInfo.InvariantCulture) ?? string.Empty;
            }
        }

        private static Dictionary<string, string> ObterRotulos(
            IOrganizationService sistema,
            string tabela)
        {
            return CacheRotulos.GetOrAdd(
                tabela,
                nome =>
                {
                    var rotulos =
                        new Dictionary<string, string>(
                            StringComparer.OrdinalIgnoreCase);

                    try
                    {
                        var resposta =
                            (RetrieveEntityResponse)sistema.Execute(
                                new RetrieveEntityRequest
                                {
                                    LogicalName = nome,
                                    EntityFilters = EntityFilters.Attributes,
                                    RetrieveAsIfPublished = false
                                });

                        foreach (var atributo in resposta.EntityMetadata.Attributes)
                        {
                            var rotulo =
                                atributo.DisplayName?.UserLocalizedLabel?.Label;

                            if (!string.IsNullOrWhiteSpace(rotulo))
                            {
                                rotulos[atributo.LogicalName] = rotulo;
                            }
                        }
                    }
                    catch
                    {
                        // Sem metadados: usa o nome lógico do campo.
                    }

                    return rotulos;
                });
        }

        // ============================================================
        // TEXTOS
        // ============================================================

        private static string MontarTitulo(
            string evento,
            string tabela,
            string rotuloTabela,
            string registroNome,
            List<Campo> campos)
        {
            var ehTreinamento =
                tabela.Equals(
                    "dgt_treinamento",
                    StringComparison.OrdinalIgnoreCase);

            if (ehTreinamento &&
                evento == "ALTERACAO")
            {
                var sequencial =
                    campos.FirstOrDefault(
                        c => c.Nome.Equals("dgt_sequencial", StringComparison.OrdinalIgnoreCase));

                if (sequencial != null)
                {
                    var codigo =
                        campos.FirstOrDefault(
                            c => c.Nome.Equals("dgt_codigo", StringComparison.OrdinalIgnoreCase));

                    return codigo != null
                        ? $"Código alterado: {codigo.Anterior} → {codigo.Novo}"
                        : $"Sequencial alterado: {sequencial.Anterior} → {sequencial.Novo}";
                }

                var ativo =
                    campos.FirstOrDefault(
                        c => c.Nome.Equals("dgt_ativo", StringComparison.OrdinalIgnoreCase));

                if (ativo != null &&
                    campos.Count == 1)
                {
                    return ativo.Novo == "Sim"
                        ? "Treinamento ativado"
                        : "Treinamento desativado";
                }
            }

            var verbo =
                evento == "CRIACAO"
                    ? "incluído(a)"
                    : evento == "EXCLUSAO"
                        ? "excluído(a)"
                        : "alterado(a)";

            if (ehTreinamento)
            {
                verbo =
                    evento == "CRIACAO"
                        ? "criado"
                        : evento == "EXCLUSAO"
                            ? "excluído"
                            : "alterado";
            }

            return string.IsNullOrWhiteSpace(registroNome) || ehTreinamento
                ? $"{rotuloTabela} {verbo}"
                : $"{rotuloTabela} {verbo}: {registroNome}";
        }

        private static string MontarDescricao(
            string evento,
            List<Campo> campos)
        {
            if (evento == "EXCLUSAO")
            {
                return "Registro excluído.";
            }

            if (campos.Count == 0)
            {
                return evento == "CRIACAO"
                    ? "Registro criado."
                    : string.Empty;
            }

            var nomes =
                string.Join(
                    ", ",
                    campos.Select(c => c.Rotulo));

            return evento == "CRIACAO"
                ? $"Registro criado com {campos.Count} campo(s) preenchido(s)."
                : $"{campos.Count} campo(s) alterado(s): {nomes}.";
        }

        private static string ObterNome(
            Entity entidade)
        {
            if (entidade == null)
            {
                return null;
            }

            var nome =
                entidade.GetAttributeValue<string>("dgt_name");

            return string.IsNullOrWhiteSpace(nome)
                ? null
                : nome.Trim();
        }

        private static DateTime DataDoEvento(
            Entity post,
            Entity pre)
        {
            var modificado =
                post?.GetAttributeValue<DateTime?>("modifiedon");

            return modificado ?? DateTime.UtcNow;
        }

        // ============================================================
        // USUÁRIO
        // ============================================================

        private sealed class UsuarioEvento
        {
            public string Nome = string.Empty;
            public Guid DgtUsuarioId = Guid.Empty;
        }

        private static UsuarioEvento ObterUsuario(
            IOrganizationService sistema,
            Guid systemUserId)
        {
            var usuario =
                new UsuarioEvento();

            try
            {
                var systemUser =
                    sistema.Retrieve(
                        "systemuser",
                        systemUserId,
                        new ColumnSet(
                            "fullname",
                            "azureactivedirectoryobjectid"));

                usuario.Nome =
                    systemUser.GetAttributeValue<string>("fullname") ??
                    string.Empty;

                var objectId =
                    systemUser.GetAttributeValue<Guid?>(
                        "azureactivedirectoryobjectid");

                if (objectId.HasValue &&
                    objectId.Value != Guid.Empty)
                {
                    var query =
                        new QueryExpression("dgt_usuario")
                        {
                            ColumnSet = new ColumnSet("dgt_usuarioid"),
                            TopCount = 1
                        };

                    query.Criteria.AddCondition(
                        "dgt_entraobjectid",
                        ConditionOperator.Equal,
                        objectId.Value.ToString("D"));

                    var encontrado =
                        sistema.RetrieveMultiple(query)
                            .Entities
                            .FirstOrDefault();

                    if (encontrado != null)
                    {
                        usuario.DgtUsuarioId = encontrado.Id;
                    }
                }
            }
            catch
            {
                // Sem vínculo com dgt_usuario: o nome fica no JSON.
            }

            return usuario;
        }

        // ============================================================
        // COLUNA AÇÃO (dgt_acao)
        // ============================================================

        private static int? ResolverAcao(
            IOrganizationService sistema,
            string evento)
        {
            var opcoes =
                cacheOpcoesAcao;

            if (opcoes == null)
            {
                opcoes =
                    new List<KeyValuePair<int, string>>();

                try
                {
                    var resposta =
                        (RetrieveAttributeResponse)sistema.Execute(
                            new RetrieveAttributeRequest
                            {
                                EntityLogicalName = "dgt_auditorianegocio",
                                LogicalName = "dgt_acao",
                                RetrieveAsIfPublished = false
                            });

                    if (resposta.AttributeMetadata is EnumAttributeMetadata metadados)
                    {
                        foreach (var opcao in metadados.OptionSet.Options)
                        {
                            if (opcao.Value.HasValue)
                            {
                                opcoes.Add(
                                    new KeyValuePair<int, string>(
                                        opcao.Value.Value,
                                        Normalizar(
                                            opcao.Label?.UserLocalizedLabel?.Label)));
                            }
                        }
                    }
                }
                catch
                {
                    // Sem metadados: grava sem a coluna Ação.
                }

                cacheOpcoesAcao = opcoes;
            }

            if (opcoes.Count == 0)
            {
                return null;
            }

            foreach (var candidato in RotulosAcao[evento])
            {
                var encontrada =
                    opcoes.FirstOrDefault(
                        o => o.Value.StartsWith(candidato, StringComparison.Ordinal));

                if (encontrada.Value != null)
                {
                    return encontrada.Key;
                }
            }

            return opcoes[0].Key;
        }

        // ============================================================
        // JSON (sem dependências externas)
        // ============================================================

        private static string MontarJson(
            string evento,
            string tabela,
            string tabelaRotulo,
            Guid registroId,
            string registroNome,
            string usuarioNome,
            List<Campo> campos)
        {
            var json =
                SerializarJson(
                    evento, tabela, tabelaRotulo, registroId,
                    registroNome, usuarioNome, campos);

            if (json.Length <= LimiteJson)
            {
                return json;
            }

            // Reduz os valores até caber no limite da coluna.
            foreach (var limite in new[] { 120, 60, 25 })
            {
                var reduzidos =
                    campos
                        .Select(c => new Campo
                        {
                            Nome = c.Nome,
                            Rotulo = c.Rotulo,
                            Anterior = Limitar(c.Anterior, limite),
                            Novo = Limitar(c.Novo, limite)
                        })
                        .ToList();

                json =
                    SerializarJson(
                        evento, tabela, tabelaRotulo, registroId,
                        registroNome, usuarioNome, reduzidos);

                if (json.Length <= LimiteJson)
                {
                    return json;
                }
            }

            // Último recurso: só os nomes dos campos.
            var somenteNomes =
                campos
                    .Select(c => new Campo
                    {
                        Nome = c.Nome,
                        Rotulo = c.Rotulo,
                        Anterior = "…",
                        Novo = "…"
                    })
                    .ToList();

            json =
                SerializarJson(
                    evento, tabela, tabelaRotulo, registroId,
                    Limitar(registroNome, 60), usuarioNome, somenteNomes);

            return json.Length <= LimiteJson
                ? json
                : SerializarJson(
                    evento, tabela, tabelaRotulo, registroId,
                    Limitar(registroNome, 60), usuarioNome, new List<Campo>());
        }

        private static string SerializarJson(
            string evento,
            string tabela,
            string tabelaRotulo,
            Guid registroId,
            string registroNome,
            string usuarioNome,
            List<Campo> campos)
        {
            var sb = new StringBuilder();

            sb.Append('{');
            Propriedade(sb, "evento", evento); sb.Append(',');
            Propriedade(sb, "tabela", tabela); sb.Append(',');
            Propriedade(sb, "tabelaRotulo", tabelaRotulo); sb.Append(',');
            Propriedade(sb, "registroId", registroId.ToString("D").ToLowerInvariant()); sb.Append(',');
            Propriedade(sb, "registroNome", registroNome); sb.Append(',');
            Propriedade(sb, "usuarioNome", usuarioNome); sb.Append(',');
            sb.Append("\"campos\":[");

            for (var i = 0; i < campos.Count; i++)
            {
                if (i > 0)
                {
                    sb.Append(',');
                }

                var campo = campos[i];

                sb.Append('{');
                Propriedade(sb, "campo", campo.Nome); sb.Append(',');
                Propriedade(sb, "rotulo", campo.Rotulo); sb.Append(',');
                Propriedade(sb, "anterior", campo.Anterior); sb.Append(',');
                Propriedade(sb, "novo", campo.Novo);
                sb.Append('}');
            }

            sb.Append("]}");

            return sb.ToString();
        }

        private static void Propriedade(
            StringBuilder sb,
            string nome,
            string valor)
        {
            sb.Append('"').Append(nome).Append("\":\"");
            Escapar(sb, valor ?? string.Empty);
            sb.Append('"');
        }

        private static void Escapar(
            StringBuilder sb,
            string valor)
        {
            foreach (var c in valor)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < ' ')
                        {
                            sb.Append("\\u").Append(((int)c).ToString("x4"));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
        }

        // ============================================================
        // UTILITÁRIOS
        // ============================================================

        private static string Limitar(
            string valor,
            int maximo)
        {
            if (string.IsNullOrEmpty(valor) ||
                valor.Length <= maximo)
            {
                return valor ?? string.Empty;
            }

            return valor.Substring(0, maximo - 1) + "…";
        }

        private static string Normalizar(
            string valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return string.Empty;
            }

            var decomposto =
                valor
                    .Trim()
                    .ToLowerInvariant()
                    .Normalize(NormalizationForm.FormD);

            return new string(
                decomposto
                    .Where(c =>
                        CharUnicodeInfo.GetUnicodeCategory(c) !=
                        UnicodeCategory.NonSpacingMark)
                    .ToArray());
        }
    }
}
