using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // ATRIBUIÇÃO POR ÁREA
    //
    // Tabela de regras: dgt_treinamentoarea
    //   dgt_treinamento (lookup)  dgt_area (lookup)
    //   dgt_prazodias (inteiro, opcional)  dgt_ativo (sim/não)
    //
    // Quando uma regra "Treinamento X → Área Y" está ativa, TODOS os
    // membros ativos da área recebem o treinamento, inclusive quem
    // entrar na área depois.
    //
    // REGISTRO (Plugin Registration Tool), todos ASSÍNCRONOS,
    // PostOperation (40), com Post Image "PostImage" (todos os campos):
    //   dgt_treinamentoarea  Create
    //   dgt_treinamentoarea  Update  (Filtering: dgt_ativo)
    //   dgt_usuarioarea      Create
    //   dgt_usuarioarea      Update  (Filtering: dgt_ativo, dgt_area)
    //
    // Cada atribuição reutiliza a Custom API dgt_ProcessarAtribuicao,
    // que já trata duplicidade, conclusões válidas, sequência da trilha
    // e liberação. Origem = "Grupo", OrigemId = id da regra.
    //
    // Nunca remove atribuições: desativar a regra ou retirar a pessoa
    // da área apenas interrompe NOVAS atribuições (histórico preservado).
    // ================================================================
    public sealed class AtribuirPorAreaPlugin : IPlugin
    {
        private const string TabelaRegra = "dgt_treinamentoarea";
        private const string TabelaVinculo = "dgt_usuarioarea";
        private const string ApiAtribuicao = "dgt_ProcessarAtribuicao";
        private const string Origem = "Grupo";

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

            // Executa como SYSTEM: a regra foi criada por um
            // administrador, mas a atribuição acontece também quando um
            // usuário comum é vinculado a uma área.
            var sistema =
                factory.CreateOrganizationService(
                    null);

            var imagem =
                context.PostEntityImages.Contains("PostImage")
                    ? context.PostEntityImages["PostImage"]
                    : context.InputParameters.Contains("Target")
                        ? context.InputParameters["Target"] as Entity
                        : null;

            if (imagem == null)
            {
                tracing.Trace("Sem imagem/target. Nada a fazer.");
                return;
            }

            var pares =
                new List<Par>();

            if (context.PrimaryEntityName.Equals(TabelaRegra, StringComparison.OrdinalIgnoreCase))
            {
                pares.AddRange(
                    ParesDaRegra(
                        sistema,
                        context.PrimaryEntityId,
                        imagem));
            }
            else if (context.PrimaryEntityName.Equals(TabelaVinculo, StringComparison.OrdinalIgnoreCase))
            {
                pares.AddRange(
                    ParesDoVinculo(
                        sistema,
                        imagem));
            }
            else
            {
                return;
            }

            tracing.Trace("{0} atribuição(ões) a processar.", pares.Count);

            var criadas = 0;
            var falhas = 0;

            foreach (var par in pares)
            {
                try
                {
                    Atribuir(
                        sistema,
                        par);

                    criadas++;
                }
                catch (Exception ex)
                {
                    // Uma pessoa com problema (ex.: usuário inativo) não
                    // impede as demais.
                    falhas++;

                    tracing.Trace(
                        "Falha ao atribuir {0} ao usuário {1}: {2}",
                        par.TreinamentoId,
                        par.UsuarioId,
                        ex.Message);
                }
            }

            tracing.Trace("Processadas: {0}. Falhas: {1}.", criadas, falhas);
        }

        // ============================================================
        // REGRA CRIADA/REATIVADA → todos os membros ativos da área
        // ============================================================

        private static IEnumerable<Par> ParesDaRegra(
            IOrganizationService sistema,
            Guid regraId,
            Entity regra)
        {
            if (regra.GetAttributeValue<bool?>("dgt_ativo") == false)
            {
                yield break;
            }

            var treinamento = regra.GetAttributeValue<EntityReference>("dgt_treinamento");
            var area = regra.GetAttributeValue<EntityReference>("dgt_area");

            if (treinamento == null || area == null)
            {
                yield break;
            }

            var prazo = regra.GetAttributeValue<int?>("dgt_prazodias");

            var consulta =
                new QueryExpression(TabelaVinculo)
                {
                    ColumnSet = new ColumnSet("dgt_usuario")
                };

            consulta.Criteria.AddCondition("dgt_area", ConditionOperator.Equal, area.Id);
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.NotEqual, false);

            var usuarios =
                sistema.RetrieveMultiple(consulta)
                    .Entities
                    .Select(v => v.GetAttributeValue<EntityReference>("dgt_usuario"))
                    .Where(u => u != null)
                    .Select(u => u.Id)
                    .Distinct();

            foreach (var usuarioId in usuarios)
            {
                yield return new Par
                {
                    UsuarioId = usuarioId,
                    TreinamentoId = treinamento.Id,
                    RegraId = regraId,
                    PrazoDias = prazo,
                    AreaNome = area.Name
                };
            }
        }

        // ============================================================
        // PESSOA ENTROU NA ÁREA → todas as regras ativas da área
        // ============================================================

        private static IEnumerable<Par> ParesDoVinculo(
            IOrganizationService sistema,
            Entity vinculo)
        {
            if (vinculo.GetAttributeValue<bool?>("dgt_ativo") == false)
            {
                yield break;
            }

            var usuario = vinculo.GetAttributeValue<EntityReference>("dgt_usuario");
            var area = vinculo.GetAttributeValue<EntityReference>("dgt_area");

            if (usuario == null || area == null)
            {
                yield break;
            }

            var consulta =
                new QueryExpression(TabelaRegra)
                {
                    ColumnSet = new ColumnSet("dgt_treinamento", "dgt_prazodias")
                };

            consulta.Criteria.AddCondition("dgt_area", ConditionOperator.Equal, area.Id);
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.NotEqual, false);

            foreach (var regra in sistema.RetrieveMultiple(consulta).Entities)
            {
                var treinamento = regra.GetAttributeValue<EntityReference>("dgt_treinamento");

                if (treinamento == null)
                {
                    continue;
                }

                yield return new Par
                {
                    UsuarioId = usuario.Id,
                    TreinamentoId = treinamento.Id,
                    RegraId = regra.Id,
                    PrazoDias = regra.GetAttributeValue<int?>("dgt_prazodias"),
                    AreaNome = area.Name
                };
            }
        }

        // ============================================================
        // ATRIBUIÇÃO (reutiliza a Custom API existente)
        // ============================================================

        private static void Atribuir(
            IOrganizationService sistema,
            Par par)
        {
            var dataLimite =
                par.PrazoDias.HasValue && par.PrazoDias.Value > 0
                    ? DateTime.UtcNow.Date
                        .AddDays(par.PrazoDias.Value)
                        .ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                    : string.Empty;

            var observacao =
                "Atribuição automática por área" +
                (string.IsNullOrWhiteSpace(par.AreaNome) ? "" : ": " + par.AreaNome) + ".";

            var payload =
                "{" +
                "\"UsuarioId\":" + Texto(par.UsuarioId.ToString("D")) + "," +
                "\"TreinamentoId\":" + Texto(par.TreinamentoId.ToString("D")) + "," +
                "\"TrilhaId\":\"\"," +
                "\"Origem\":" + Texto(Origem) + "," +
                "\"OrigemId\":" + Texto(par.RegraId.ToString("D")) + "," +
                "\"DataLimite\":" + Texto(dataLimite) + "," +
                "\"Observacao\":" + Texto(observacao) +
                "}";

            var requisicao =
                new OrganizationRequest(ApiAtribuicao);

            requisicao["PayloadJson"] = payload;

            sistema.Execute(requisicao);
        }

        private sealed class Par
        {
            public Guid UsuarioId;
            public Guid TreinamentoId;
            public Guid RegraId;
            public int? PrazoDias;
            public string AreaNome;
        }

        private static string Texto(
            string valor)
        {
            var sb = new StringBuilder("\"");

            foreach (var c in valor ?? string.Empty)
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

            return sb.Append('"').ToString();
        }
    }
}
