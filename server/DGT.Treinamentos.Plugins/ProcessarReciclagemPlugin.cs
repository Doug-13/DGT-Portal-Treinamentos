using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;

namespace DGT.Treinamentos.Plugins
{
    public sealed class ProcessarReciclagemPlugin : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context =
                (IPluginExecutionContext)serviceProvider.GetService(
                    typeof(IPluginExecutionContext));

            var factory =
                (IOrganizationServiceFactory)serviceProvider.GetService(
                    typeof(IOrganizationServiceFactory));

            var service =
                factory.CreateOrganizationService(
                    context.UserId);

            try
            {
                var payloadJson =
                    context.InputParameters.Contains("PayloadJson")
                        ? context.InputParameters["PayloadJson"] as string
                        : null;

                if (string.IsNullOrWhiteSpace(payloadJson))
                {
                    throw new InvalidPluginExecutionException(
                        "PayloadJson não foi informado.");
                }

                var payload =
                    JsonConvert.DeserializeObject<PayloadReciclagem>(
                        payloadJson);

                if (payload == null)
                {
                    throw new InvalidPluginExecutionException(
                        "Payload de reciclagem inválido.");
                }

                var resultado =
                    Processar(
                        service,
                        payload);

                context.OutputParameters["ResultadoJson"] =
                    JsonConvert.SerializeObject(
                        resultado);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new InvalidPluginExecutionException(
                    "Não foi possível processar a reciclagem: " +
                    ex.Message,
                    ex);
            }
        }

        private static ResultadoReciclagem Processar(
            IOrganizationService service,
            PayloadReciclagem payload)
        {
            Guid usuarioTreinamentoId;

            if (!Guid.TryParse(
                    payload.UsuarioTreinamentoId,
                    out usuarioTreinamentoId))
            {
                throw new InvalidPluginExecutionException(
                    "UsuarioTreinamentoId inválido.");
            }

            var antigo =
                service.Retrieve(
                    "dgt_usuariotreinamento",
                    usuarioTreinamentoId,
                    new ColumnSet(
                        "dgt_usuario",
                        "dgt_treinamento",
                        "dgt_trilha",
                        "dgt_dataconclusao",
                        "dgt_datavalidade",
                        "dgt_status"));

            var usuario =
                antigo.GetAttributeValue<EntityReference>(
                    "dgt_usuario");

            var treinamento =
                antigo.GetAttributeValue<EntityReference>(
                    "dgt_treinamento");

            var trilha =
                antigo.GetAttributeValue<EntityReference>(
                    "dgt_trilha");

            if (usuario == null ||
                treinamento == null)
            {
                throw new InvalidPluginExecutionException(
                    "O histórico não possui usuário ou treinamento vinculado.");
            }

            var conclusao =
                antigo.GetAttributeValue<DateTime?>(
                    "dgt_dataconclusao");

            if (!conclusao.HasValue)
            {
                throw new InvalidPluginExecutionException(
                    "Somente treinamentos concluídos podem gerar reciclagem.");
            }

            var validade =
                antigo.GetAttributeValue<DateTime?>(
                    "dgt_datavalidade");

            if (!payload.Forcar &&
                validade.HasValue &&
                validade.Value.ToUniversalTime() >
                DateTime.UtcNow)
            {
                throw new InvalidPluginExecutionException(
                    "O treinamento ainda está válido e não requer reciclagem.");
            }

            MarcarComoVencido(
                service,
                antigo);

            var request =
                new OrganizationRequest(
                    "dgt_ProcessarAtribuicao");

            var payloadAtribuicao =
                new
                {
                    UsuarioId =
                        usuario.Id.ToString(),

                    TreinamentoId =
                        treinamento.Id.ToString(),

                    TrilhaId =
                        trilha != null
                            ? trilha.Id.ToString()
                            : string.Empty,

                    Origem =
                        "Reciclagem",

                    OrigemId =
                        usuarioTreinamentoId.ToString(),

                    DataLimite =
                        payload.DataLimite ?? string.Empty,

                    Observacao =
                        "Reciclagem gerada a partir do histórico " +
                        usuarioTreinamentoId
                };

            request["PayloadJson"] =
                JsonConvert.SerializeObject(
                    payloadAtribuicao);

            var response =
                service.Execute(
                    request);

            var resultadoJson =
                response.Results.Contains(
                    "ResultadoJson")
                    ? response["ResultadoJson"] as string
                    : null;

            if (string.IsNullOrWhiteSpace(
                    resultadoJson))
            {
                throw new InvalidPluginExecutionException(
                    "A Custom API dgt_ProcessarAtribuicao não retornou ResultadoJson.");
            }

            var atribuicao =
                JsonConvert.DeserializeObject<ResultadoAtribuicao>(
                    resultadoJson);

            if (atribuicao == null)
            {
                throw new InvalidPluginExecutionException(
                    "Resultado inválido da atribuição.");
            }

            return new ResultadoReciclagem
            {
                sucesso =
                    atribuicao.sucesso,

                mensagem =
                    atribuicao.criado
                        ? "Reciclagem criada com sucesso."
                        : atribuicao.mensagem,

                usuarioTreinamentoAnteriorId =
                    usuarioTreinamentoId.ToString(),

                novoUsuarioTreinamentoId =
                    atribuicao.usuarioTreinamentoId,

                criado =
                    atribuicao.criado,

                reutilizado =
                    atribuicao.reutilizado,

                liberado =
                    atribuicao.liberado
            };
        }

        private static void MarcarComoVencido(
            IOrganizationService service,
            Entity antigo)
        {
            var opcao =
                ObterOpcaoPorRotulo(
                    service,
                    "dgt_usuariotreinamento",
                    "dgt_status",
                    "Vencido");

            if (!opcao.HasValue)
            {
                return;
            }

            var update =
                new Entity(
                    "dgt_usuariotreinamento",
                    antigo.Id);

            update["dgt_status"] =
                new OptionSetValue(
                    opcao.Value);

            service.Update(
                update);
        }

        private static int? ObterOpcaoPorRotulo(
            IOrganizationService service,
            string entidade,
            string atributo,
            string rotulo)
        {
            try
            {
                var response =
                    (RetrieveAttributeResponse)
                    service.Execute(
                        new RetrieveAttributeRequest
                        {
                            EntityLogicalName =
                                entidade,
                            LogicalName =
                                atributo,
                            RetrieveAsIfPublished =
                                true
                        });

                var metadata =
                    response.AttributeMetadata
                    as PicklistAttributeMetadata;

                if (metadata == null ||
                    metadata.OptionSet == null)
                {
                    return null;
                }

                foreach (var option in
                    metadata.OptionSet.Options)
                {
                    var label =
                        option.Label
                              ?.UserLocalizedLabel
                              ?.Label;

                    if (string.Equals(
                            label,
                            rotulo,
                            StringComparison.OrdinalIgnoreCase))
                    {
                        return option.Value;
                    }
                }

                return null;
            }
            catch
            {
                return null;
            }
        }

        private sealed class PayloadReciclagem
        {
            public string UsuarioTreinamentoId { get; set; }
            public string DataLimite { get; set; }
            public bool Forcar { get; set; }
        }

        private sealed class ResultadoAtribuicao
        {
            public bool sucesso { get; set; }
            public string mensagem { get; set; }
            public string usuarioTreinamentoId { get; set; }
            public bool reutilizado { get; set; }
            public bool criado { get; set; }
            public bool liberado { get; set; }
        }

        private sealed class ResultadoReciclagem
        {
            public bool sucesso { get; set; }
            public string mensagem { get; set; }
            public string usuarioTreinamentoAnteriorId { get; set; }
            public string novoUsuarioTreinamentoId { get; set; }
            public bool criado { get; set; }
            public bool reutilizado { get; set; }
            public bool liberado { get; set; }
        }
    }
}
