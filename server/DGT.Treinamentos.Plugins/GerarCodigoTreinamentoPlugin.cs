using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace DGT.Treinamentos.Plugins
{
    public sealed class GerarCodigoTreinamentoPlugin : IPlugin
    {
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

            var service =
                factory.CreateOrganizationService(
                    context.UserId);

            tracing.Trace(
                "GerarCodigoTreinamentoPlugin iniciado.");

            if (!string.Equals(
                    context.MessageName,
                    "Create",
                    StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (context.Stage != 20)
            {
                tracing.Trace(
                    "Stage ignorado: {0}",
                    context.Stage);

                return;
            }

            if (!context.InputParameters.Contains("Target"))
            {
                return;
            }

            if (!(context.InputParameters["Target"] is Entity target))
            {
                return;
            }

            if (!string.Equals(
                    target.LogicalName,
                    "dgt_treinamento",
                    StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var codigoExistente =
                target.GetAttributeValue<string>(
                    "dgt_codigo");

            if (!string.IsNullOrWhiteSpace(
                    codigoExistente))
            {
                tracing.Trace(
                    "Registro já possui código. Nada será alterado.");

                return;
            }

            var areaRef =
                target.GetAttributeValue<EntityReference>(
                    "dgt_area");

            if (areaRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "A área do treinamento é obrigatória.");
            }

            var tipo =
                target.GetAttributeValue<OptionSetValue>(
                    "dgt_tipotreinamento");

            if (tipo == null)
            {
                throw new InvalidPluginExecutionException(
                    "O tipo do treinamento é obrigatório.");
            }

            var area =
                service.Retrieve(
                    "dgt_area",
                    areaRef.Id,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_sigla",
                        "dgt_ativo"));

            var areaAtiva =
                area.GetAttributeValue<bool?>(
                    "dgt_ativo") ?? true;

            if (!areaAtiva)
            {
                throw new InvalidPluginExecutionException(
                    "A área selecionada está inativa.");
            }

            var siglaArea =
                area.GetAttributeValue<string>(
                    "dgt_sigla");

            if (string.IsNullOrWhiteSpace(
                    siglaArea))
            {
                throw new InvalidPluginExecutionException(
                    "A área selecionada não possui sigla cadastrada.");
            }

            siglaArea =
                NormalizarSigla(
                    siglaArea);

            var siglaTipo =
                ObterSiglaTipo(
                    tipo.Value);

            var query =
                new QueryExpression(
                    "dgt_treinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_sequencial",
                            "dgt_codigo"),

                    TopCount =
                        1
                };

            query.Criteria.AddCondition(
                "dgt_area",
                ConditionOperator.Equal,
                areaRef.Id);

            query.Criteria.AddCondition(
                "dgt_tipotreinamento",
                ConditionOperator.Equal,
                tipo.Value);

            query.Criteria.AddCondition(
                "dgt_sequencial",
                ConditionOperator.NotNull);

            query.AddOrder(
                "dgt_sequencial",
                OrderType.Descending);

            var ultimo =
                service
                    .RetrieveMultiple(
                        query)
                    .Entities
                    .FirstOrDefault();

            var sequencial =
                1;

            if (ultimo != null)
            {
                var ultimoSequencial =
                    ultimo.GetAttributeValue<int?>(
                        "dgt_sequencial") ?? 0;

                sequencial =
                    ultimoSequencial + 1;
            }

            var codigo =
                $"TRN-{siglaArea}-{siglaTipo}-{sequencial:000}";

            tracing.Trace(
                "Código gerado: {0}",
                codigo);

            target["dgt_sequencial"] =
                sequencial;

            target["dgt_codigo"] =
                codigo;

            tracing.Trace(
                "GerarCodigoTreinamentoPlugin concluído.");
        }

        private static string NormalizarSigla(
            string valor)
        {
            var texto =
                valor
                    .Trim()
                    .ToUpperInvariant();

            var caracteres =
                texto
                    .Where(
                        c =>
                            char.IsLetterOrDigit(c))
                    .ToArray();

            var resultado =
                new string(
                    caracteres);

            if (string.IsNullOrWhiteSpace(
                    resultado))
            {
                throw new InvalidPluginExecutionException(
                    "A sigla da área é inválida.");
            }

            return resultado;
        }

        private static string ObterSiglaTipo(
            int valor)
        {
            switch (valor)
            {
                case 100000000:
                    return "POP";

                case 100000001:
                    return "IT";

                case 100000002:
                    return "PROC";

                case 100000003:
                    return "POL";

                case 100000004:
                    return "INT";

                case 100000005:
                    return "NR";

                case 100000006:
                    return "MAN";

                case 100000007:
                    return "SIS";

                case 100000008:
                    return "COM";

                case 100000009:
                    return "TEC";

                case 100000010:
                    return "OUT";

                default:
                    throw new InvalidPluginExecutionException(
                        "O tipo do treinamento informado não é reconhecido.");
            }
        }
    }
}
