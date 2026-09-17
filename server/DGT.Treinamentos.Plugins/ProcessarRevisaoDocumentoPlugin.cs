using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;

namespace DGT.Treinamentos.Plugins
{
    public sealed class ProcessarRevisaoDocumentoPlugin : IPlugin
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
                    JsonConvert.DeserializeObject<PayloadRevisaoDocumento>(
                        payloadJson);

                if (payload == null)
                {
                    throw new InvalidPluginExecutionException(
                        "Payload da revisão documental inválido.");
                }

                var resultado =
                    Processar(
                        service,
                        context.UserId,
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
                    "Não foi possível processar a revisão documental: " +
                    ex.Message,
                    ex);
            }
        }

        private static ResultadoRevisaoDocumento Processar(
            IOrganizationService service,
            Guid executorId,
            PayloadRevisaoDocumento payload)
        {
            Guid revisaoId;

            if (!Guid.TryParse(
                    payload.DocumentoRevisaoId,
                    out revisaoId))
            {
                throw new InvalidPluginExecutionException(
                    "DocumentoRevisaoId inválido.");
            }

            var revisao =
                service.Retrieve(
                    "dgt_documentorevisao",
                    revisaoId,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_documento",
                        "dgt_revisao",
                        "dgt_requerretreinamento",
                        "dgt_justificativa",
                        "dgt_status",
                        "dgt_ativa",
                        "dgt_dataaprovacao",
                        "dgt_datavigencia"));

            var documentoRef =
                revisao.GetAttributeValue<EntityReference>(
                    "dgt_documento");

            if (documentoRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "A revisão não possui documento vinculado.");
            }

            var revisaoNumero =
                revisao.GetAttributeValue<string>(
                    "dgt_revisao") ??
                string.Empty;

            var requerRetreinamento =
                revisao.GetAttributeValue<bool?>(
                    "dgt_requerretreinamento") ==
                true;

            if (!requerRetreinamento)
            {
                var justificativa =
                    revisao.GetAttributeValue<string>(
                        "dgt_justificativa");

                if (string.IsNullOrWhiteSpace(
                        justificativa))
                {
                    throw new InvalidPluginExecutionException(
                        "A revisão foi marcada sem retreinamento, mas não possui justificativa.");
                }
            }

            PublicarRevisao(
                service,
                revisaoId,
                executorId,
                payload.DataVigencia);

            AtualizarDocumentoAtual(
                service,
                documentoRef.Id,
                revisaoNumero);

            var resultado =
                new ResultadoRevisaoDocumento
                {
                    sucesso = true,
                    mensagem =
                        requerRetreinamento
                            ? "Revisão publicada e retreinamentos processados."
                            : "Revisão publicada sem necessidade de retreinamento.",
                    documentoRevisaoId =
                        revisaoId.ToString(),
                    documentoId =
                        documentoRef.Id.ToString(),
                    revisao =
                        revisaoNumero,
                    requerRetreinamento =
                        requerRetreinamento,
                    treinamentosImpactados =
                        0,
                    usuariosImpactados =
                        0,
                    atribuicoesCriadas =
                        0,
                    atribuicoesReutilizadas =
                        0,
                    atribuicoesBloqueadas =
                        0,
                    falhas =
                        new List<string>()
                };

            if (!requerRetreinamento)
            {
                return resultado;
            }

            var treinamentos =
                BuscarTreinamentosDocumento(
                    service,
                    documentoRef.Id);

            resultado.treinamentosImpactados =
                treinamentos.Count;

            var usuariosProcessados =
                new HashSet<Guid>();

            foreach (var treinamentoId in treinamentos)
            {
                var usuarios =
                    BuscarUsuariosTreinados(
                        service,
                        treinamentoId);

                foreach (var usuario in usuarios)
                {
                    usuariosProcessados.Add(
                        usuario.UsuarioId);

                    try
                    {
                        var retorno =
                            ExecutarAtribuicao(
                                service,
                                usuario.UsuarioId,
                                treinamentoId,
                                usuario.TrilhaId,
                                revisaoId,
                                payload.DataLimite,
                                revisaoNumero);

                        if (retorno.criado)
                        {
                            resultado.atribuicoesCriadas++;
                        }

                        if (retorno.reutilizado)
                        {
                            resultado.atribuicoesReutilizadas++;
                        }

                        if (!retorno.liberado)
                        {
                            resultado.atribuicoesBloqueadas++;
                        }
                    }
                    catch (Exception ex)
                    {
                        resultado.falhas.Add(
                            "Usuário " +
                            usuario.UsuarioId +
                            " / Treinamento " +
                            treinamentoId +
                            ": " +
                            ex.Message);
                    }
                }
            }

            resultado.usuariosImpactados =
                usuariosProcessados.Count;

            if (resultado.falhas.Count > 0)
            {
                resultado.mensagem =
                    "Revisão publicada. Alguns retreinamentos apresentaram falha.";
            }

            return resultado;
        }

        private static void PublicarRevisao(
            IOrganizationService service,
            Guid revisaoId,
            Guid executorId,
            string dataVigenciaPayload)
        {
            var update =
                new Entity(
                    "dgt_documentorevisao",
                    revisaoId);

            TrySetOpcaoPorRotulo(
                service,
                update,
                "dgt_status",
                "Vigente");

            TrySetBooleano(
                service,
                update,
                "dgt_ativa",
                true);

            TrySetData(
                service,
                update,
                "dgt_dataaprovacao",
                DateTime.UtcNow);

            DateTime dataVigencia;

            if (DateTime.TryParse(
                    dataVigenciaPayload,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal |
                    DateTimeStyles.AdjustToUniversal,
                    out dataVigencia))
            {
                TrySetData(
                    service,
                    update,
                    "dgt_datavigencia",
                    dataVigencia);
            }
            else
            {
                TrySetData(
                    service,
                    update,
                    "dgt_datavigencia",
                    DateTime.UtcNow);
            }

            TrySetLookup(
                service,
                update,
                "dgt_aprovadopor",
                "systemuser",
                executorId);

            service.Update(
                update);
        }

        private static void AtualizarDocumentoAtual(
            IOrganizationService service,
            Guid documentoId,
            string revisao)
        {
            var update =
                new Entity(
                    "dgt_documento",
                    documentoId);

            TrySetTexto(
                service,
                update,
                "dgt_revisaoatual",
                revisao);

            TrySetOpcaoPorRotulo(
                service,
                update,
                "dgt_status",
                "Vigente");

            TrySetBooleano(
                service,
                update,
                "dgt_ativo",
                true);

            if (update.Attributes.Count > 0)
            {
                service.Update(
                    update);
            }
        }

        private static List<Guid> BuscarTreinamentosDocumento(
            IOrganizationService service,
            Guid documentoId)
        {
            var q =
                new QueryExpression(
                    "dgt_treinamentodocumento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_treinamento")
                };

            q.Criteria.AddCondition(
                "dgt_documento",
                ConditionOperator.Equal,
                documentoId);

            if (AtributoExiste(
                    service,
                    "dgt_treinamentodocumento",
                    "dgt_ativo"))
            {
                q.Criteria.AddCondition(
                    "dgt_ativo",
                    ConditionOperator.Equal,
                    true);
            }

            return service
                .RetrieveMultiple(q)
                .Entities
                .Select(
                    x => x.GetAttributeValue<EntityReference>(
                        "dgt_treinamento"))
                .Where(
                    x => x != null)
                .Select(
                    x => x.Id)
                .Distinct()
                .ToList();
        }

        private static List<UsuarioTreinado> BuscarUsuariosTreinados(
            IOrganizationService service,
            Guid treinamentoId)
        {
            var q =
                new QueryExpression(
                    "dgt_usuariotreinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_usuario",
                            "dgt_trilha",
                            "dgt_dataconclusao")
                };

            q.Criteria.AddCondition(
                "dgt_treinamento",
                ConditionOperator.Equal,
                treinamentoId);

            q.Criteria.AddCondition(
                "dgt_dataconclusao",
                ConditionOperator.NotNull);

            q.AddOrder(
                "dgt_dataconclusao",
                OrderType.Descending);

            var encontrados =
                new Dictionary<Guid, UsuarioTreinado>();

            foreach (var item in
                service.RetrieveMultiple(q).Entities)
            {
                var usuarioRef =
                    item.GetAttributeValue<EntityReference>(
                        "dgt_usuario");

                if (usuarioRef == null)
                {
                    continue;
                }

                if (encontrados.ContainsKey(
                        usuarioRef.Id))
                {
                    continue;
                }

                var trilhaRef =
                    item.GetAttributeValue<EntityReference>(
                        "dgt_trilha");

                encontrados[
                    usuarioRef.Id] =
                    new UsuarioTreinado
                    {
                        UsuarioId =
                            usuarioRef.Id,
                        TrilhaId =
                            trilhaRef != null
                                ? trilhaRef.Id
                                : Guid.Empty
                    };
            }

            return encontrados
                .Values
                .ToList();
        }

        private static ResultadoAtribuicao ExecutarAtribuicao(
            IOrganizationService service,
            Guid usuarioId,
            Guid treinamentoId,
            Guid trilhaId,
            Guid revisaoId,
            string dataLimite,
            string revisaoNumero)
        {
            var payload =
                new
                {
                    UsuarioId =
                        usuarioId.ToString(),
                    TreinamentoId =
                        treinamentoId.ToString(),
                    TrilhaId =
                        trilhaId == Guid.Empty
                            ? string.Empty
                            : trilhaId.ToString(),
                    Origem =
                        "Revisão documental",
                    OrigemId =
                        revisaoId.ToString(),
                    DataLimite =
                        dataLimite ?? string.Empty,
                    Observacao =
                        "Retreinamento gerado pela revisão " +
                        revisaoNumero
                };

            var request =
                new OrganizationRequest(
                    "dgt_ProcessarAtribuicao");

            request["PayloadJson"] =
                JsonConvert.SerializeObject(
                    payload);

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

            var resultado =
                JsonConvert.DeserializeObject<ResultadoAtribuicao>(
                    resultadoJson);

            if (resultado == null)
            {
                throw new InvalidPluginExecutionException(
                    "Resultado inválido retornado por dgt_ProcessarAtribuicao.");
            }

            return resultado;
        }

        private static AttributeMetadata ObterAtributo(
            IOrganizationService service,
            string entidade,
            string atributo)
        {
            try
            {
                return (
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
                        })
                ).AttributeMetadata;
            }
            catch
            {
                return null;
            }
        }

        private static bool AtributoExiste(
            IOrganizationService service,
            string entidade,
            string atributo)
        {
            return ObterAtributo(
                       service,
                       entidade,
                       atributo) !=
                   null;
        }

        private static void TrySetTexto(
            IOrganizationService service,
            Entity entity,
            string atributo,
            string valor)
        {
            if (string.IsNullOrWhiteSpace(
                    valor))
            {
                return;
            }

            var metadata =
                ObterAtributo(
                    service,
                    entity.LogicalName,
                    atributo);

            if (metadata is StringAttributeMetadata ||
                metadata is MemoAttributeMetadata)
            {
                entity[atributo] =
                    valor;
            }
        }

        private static void TrySetBooleano(
            IOrganizationService service,
            Entity entity,
            string atributo,
            bool valor)
        {
            if (ObterAtributo(
                    service,
                    entity.LogicalName,
                    atributo)
                is BooleanAttributeMetadata)
            {
                entity[atributo] =
                    valor;
            }
        }

        private static void TrySetData(
            IOrganizationService service,
            Entity entity,
            string atributo,
            DateTime valor)
        {
            if (ObterAtributo(
                    service,
                    entity.LogicalName,
                    atributo)
                is DateTimeAttributeMetadata)
            {
                entity[atributo] =
                    valor;
            }
        }

        private static void TrySetLookup(
            IOrganizationService service,
            Entity entity,
            string atributo,
            string targetLogicalName,
            Guid targetId)
        {
            if (ObterAtributo(
                    service,
                    entity.LogicalName,
                    atributo)
                is LookupAttributeMetadata)
            {
                entity[atributo] =
                    new EntityReference(
                        targetLogicalName,
                        targetId);
            }
        }

        private static void TrySetOpcaoPorRotulo(
            IOrganizationService service,
            Entity entity,
            string atributo,
            string rotulo)
        {
            var metadata =
                ObterAtributo(
                    service,
                    entity.LogicalName,
                    atributo)
                as PicklistAttributeMetadata;

            if (metadata == null ||
                metadata.OptionSet == null)
            {
                TrySetTexto(
                    service,
                    entity,
                    atributo,
                    rotulo);

                return;
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
                    entity[atributo] =
                        new OptionSetValue(
                            option.Value ?? 0);

                    return;
                }
            }
        }

        private sealed class PayloadRevisaoDocumento
        {
            public string DocumentoRevisaoId { get; set; }
            public string DataVigencia { get; set; }
            public string DataLimite { get; set; }
        }

        private sealed class ResultadoRevisaoDocumento
        {
            public bool sucesso { get; set; }
            public string mensagem { get; set; }
            public string documentoRevisaoId { get; set; }
            public string documentoId { get; set; }
            public string revisao { get; set; }
            public bool requerRetreinamento { get; set; }
            public int treinamentosImpactados { get; set; }
            public int usuariosImpactados { get; set; }
            public int atribuicoesCriadas { get; set; }
            public int atribuicoesReutilizadas { get; set; }
            public int atribuicoesBloqueadas { get; set; }
            public List<string> falhas { get; set; }
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

        private sealed class UsuarioTreinado
        {
            public Guid UsuarioId { get; set; }
            public Guid TrilhaId { get; set; }
        }
    }
}
