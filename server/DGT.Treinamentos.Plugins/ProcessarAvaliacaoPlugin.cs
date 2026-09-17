using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Newtonsoft.Json;

namespace DGT.Treinamentos.Plugins
{
    public sealed class ProcessarAvaliacaoPlugin : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(
                typeof(IPluginExecutionContext));

            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(
                typeof(IOrganizationServiceFactory));

            var service = factory.CreateOrganizationService(context.UserId);

            try
            {
                var payloadJson = context.InputParameters.Contains("PayloadJson")
                    ? context.InputParameters["PayloadJson"] as string
                    : null;

                if (string.IsNullOrWhiteSpace(payloadJson))
                    throw new InvalidPluginExecutionException(
                        "PayloadJson não foi informado.");

                var payload =
                    JsonConvert.DeserializeObject<EnvioAvaliacao>(payloadJson);

                if (payload == null)
                    throw new InvalidPluginExecutionException(
                        "Payload da avaliação inválido.");

                var resultado = Processar(service, payload);

                context.OutputParameters["ResultadoJson"] =
                    JsonConvert.SerializeObject(resultado);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new InvalidPluginExecutionException(
                    "Não foi possível processar a avaliação: " +
                    ex.Message,
                    ex);
            }
        }

        private static ResultadoAvaliacao Processar(
            IOrganizationService service,
            EnvioAvaliacao payload)
        {
            Guid usuarioTreinamentoId;
            Guid avaliacaoId;

            if (!Guid.TryParse(
                payload.usuarioTreinamentoId,
                out usuarioTreinamentoId))
            {
                throw new InvalidPluginExecutionException(
                    "UsuarioTreinamentoId inválido.");
            }

            if (!Guid.TryParse(
                payload.avaliacaoId,
                out avaliacaoId))
            {
                throw new InvalidPluginExecutionException(
                    "AvaliacaoId inválido.");
            }

            var avaliacao = service.Retrieve(
                "dgt_avaliacao",
                avaliacaoId,
                new ColumnSet(
                    "dgt_name",
                    "dgt_notaminima",
                    "dgt_tentativaspermitidas",
                    "dgt_quantidadequestoes",
                    "dgt_treinamento"));

            var usuarioTreinamento = service.Retrieve(
                "dgt_usuariotreinamento",
                usuarioTreinamentoId,
                new ColumnSet(
                    "dgt_name",
                    "dgt_usuario",
                    "dgt_treinamento",
                    "dgt_trilha",
                    "dgt_status",
                    "dgt_liberado",
                    "dgt_dataconclusao",
                    "dgt_datavalidade"));

            ValidarVinculo(
                avaliacao,
                usuarioTreinamento);

            var tentativasPermitidas =
                avaliacao.GetAttributeValue<int?>(
                    "dgt_tentativaspermitidas") ?? 1;

            var tentativasAnteriores =
                BuscarTentativas(
                    service,
                    usuarioTreinamentoId,
                    avaliacaoId);

            if (tentativasAnteriores.Entities.Any(
                x => x.GetAttributeValue<bool?>(
                    "dgt_aprovado") == true))
            {
                throw new InvalidPluginExecutionException(
                    "Esta avaliação já possui uma tentativa aprovada.");
            }

            if (tentativasAnteriores.Entities.Count >=
                tentativasPermitidas)
            {
                throw new InvalidPluginExecutionException(
                    "O limite de tentativas desta avaliação foi atingido.");
            }

            var numeroTentativa =
                tentativasAnteriores.Entities.Count + 1;

            var respostas =
                payload.respostas ??
                new List<RespostaEnvio>();

            if (respostas.Count == 0)
            {
                throw new InvalidPluginExecutionException(
                    "Nenhuma resposta foi recebida.");
            }

            var questoesCorrigidas =
                new List<QuestaoCorrigida>();

            foreach (var resposta in respostas)
            {
                questoesCorrigidas.Add(
                    CorrigirQuestao(
                        service,
                        avaliacaoId,
                        resposta));
            }

            var totalPeso =
                questoesCorrigidas.Sum(x => x.Peso);

            var pontos =
                questoesCorrigidas.Sum(x => x.Pontos);

            var nota = totalPeso <= 0
                ? 0m
                : Math.Round(
                    (pontos / totalPeso) * 100m,
                    2);

            var acertos =
                questoesCorrigidas.Count(x => x.Correta);

            var erros =
                questoesCorrigidas.Count - acertos;

            var notaMinima =
                avaliacao.GetAttributeValue<decimal?>(
                    "dgt_notaminima") ?? 70m;

            var aprovado =
                nota >= notaMinima;

            var tentativaId =
                CriarTentativa(
                    service,
                    payload,
                    usuarioTreinamentoId,
                    avaliacaoId,
                    numeroTentativa,
                    nota,
                    acertos,
                    erros,
                    aprovado,
                    questoesCorrigidas.Count);

            CriarEvidencias(
                service,
                tentativaId,
                numeroTentativa,
                questoesCorrigidas);

            var resultado =
                new ResultadoAvaliacao
                {
                    sucesso = true,

                    mensagem = aprovado
                        ? "Você atingiu a nota mínima e foi aprovado."
                        : "A nota mínima não foi atingida.",

                    tentativaId =
                        tentativaId.ToString(),

                    nota = nota,
                    acertos = acertos,
                    erros = erros,
                    aprovado = aprovado,

                    total =
                        questoesCorrigidas.Count,

                    numeroTentativa =
                        numeroTentativa,

                    tentativasRestantes =
                        Math.Max(
                            tentativasPermitidas -
                            numeroTentativa,
                            0),

                    treinamentoConcluido = false,

                    proximoTreinamentoLiberado = false,

                    proximoTreinamentoNome =
                        string.Empty,

                    certificadoGerado = false,

                    certificadoId =
                        string.Empty,

                    certificadoNumero =
                        string.Empty,

                    dataValidade =
                        null
                };

            if (aprovado)
            {
                ConcluirTreinamentoELiberarProximo(
                    service,
                    usuarioTreinamento,
                    usuarioTreinamentoId,
                    nota,
                    resultado);

                CriarCertificado(
                    service,
                    usuarioTreinamentoId,
                    usuarioTreinamento,
                    resultado);
            }

            return resultado;
        }

        private static void ValidarVinculo(
            Entity avaliacao,
            Entity usuarioTreinamento)
        {
            var treinamentoAvaliacao =
                avaliacao.GetAttributeValue<EntityReference>(
                    "dgt_treinamento");

            var treinamentoUsuario =
                usuarioTreinamento.GetAttributeValue<EntityReference>(
                    "dgt_treinamento");

            if (treinamentoAvaliacao == null ||
                treinamentoUsuario == null ||
                treinamentoAvaliacao.Id !=
                treinamentoUsuario.Id)
            {
                throw new InvalidPluginExecutionException(
                    "A avaliação não pertence ao treinamento atribuído ao usuário.");
            }

            if (usuarioTreinamento
                    .GetAttributeValue<bool?>(
                        "dgt_liberado") != true)
            {
                throw new InvalidPluginExecutionException(
                    "Este treinamento não está liberado para o usuário.");
            }
        }

        private static EntityCollection BuscarTentativas(
            IOrganizationService service,
            Guid usuarioTreinamentoId,
            Guid avaliacaoId)
        {
            var q =
                new QueryExpression(
                    "dgt_tentativa")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_tentativaid",
                            "dgt_numerotentativa",
                            "dgt_aprovado")
                };

            q.Criteria.AddCondition(
                "dgt_usuariotreinamento",
                ConditionOperator.Equal,
                usuarioTreinamentoId);

            q.Criteria.AddCondition(
                "dgt_avaliacao",
                ConditionOperator.Equal,
                avaliacaoId);

            q.Criteria.AddCondition(
                "dgt_ativa",
                ConditionOperator.Equal,
                true);

            return service.RetrieveMultiple(q);
        }

        private static QuestaoCorrigida CorrigirQuestao(
            IOrganizationService service,
            Guid avaliacaoId,
            RespostaEnvio resposta)
        {
            Guid questaoId;

            if (!Guid.TryParse(
                resposta.questaoId,
                out questaoId))
            {
                throw new InvalidPluginExecutionException(
                    "Questão inválida recebida na avaliação.");
            }

            var questao =
                service.Retrieve(
                    "dgt_questao",
                    questaoId,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_enunciado",
                        "dgt_ordem",
                        "dgt_peso",
                        "dgt_tipoquestao",
                        "dgt_multiplasrespostas",
                        "dgt_avaliacao",
                        "dgt_ativa"));

            var avaliacaoQuestao =
                questao.GetAttributeValue<EntityReference>(
                    "dgt_avaliacao");

            if (avaliacaoQuestao == null ||
                avaliacaoQuestao.Id !=
                avaliacaoId)
            {
                throw new InvalidPluginExecutionException(
                    "Foi recebida uma questão que não pertence à avaliação.");
            }

            if (questao.GetAttributeValue<bool?>(
                    "dgt_ativa") != true)
            {
                throw new InvalidPluginExecutionException(
                    "Foi recebida uma questão inativa.");
            }

            var alternativas =
                BuscarAlternativas(
                    service,
                    questaoId);

            var selecionadas =
                new HashSet<Guid>();

            foreach (var valor in
                resposta.alternativasSelecionadas ??
                new List<string>())
            {
                if (string.IsNullOrWhiteSpace(valor))
                    continue;

                Guid alternativaId;

                if (!Guid.TryParse(
                    valor,
                    out alternativaId))
                {
                    throw new InvalidPluginExecutionException(
                        "Alternativa inválida recebida na avaliação.");
                }

                selecionadas.Add(
                    alternativaId);
            }

            if (selecionadas.Any(
                id =>
                    alternativas.All(
                        a => a.Id != id)))
            {
                throw new InvalidPluginExecutionException(
                    "Foi recebida uma alternativa que não pertence à questão.");
            }

            var corretas =
                new HashSet<Guid>(
                    alternativas
                        .Where(
                            a =>
                                a.GetAttributeValue<bool?>(
                                    "dgt_correta") ==
                                true)
                        .Select(
                            a => a.Id));

            var correta =
                selecionadas.SetEquals(
                    corretas);

            var peso =
                questao.GetAttributeValue<decimal?>(
                    "dgt_peso") ?? 1m;

            return new QuestaoCorrigida
            {
                Questao = questao,
                Alternativas = alternativas,
                Selecionadas = selecionadas,
                Correta = correta,
                Peso = peso,
                Pontos =
                    correta
                        ? peso
                        : 0m
            };
        }

        private static List<Entity> BuscarAlternativas(
            IOrganizationService service,
            Guid questaoId)
        {
            var q =
                new QueryExpression(
                    "dgt_alternativa")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_alternativaid",
                            "dgt_name",
                            "dgt_ordem",
                            "dgt_correta",
                            "dgt_ativa")
                };

            q.Criteria.AddCondition(
                "dgt_questao",
                ConditionOperator.Equal,
                questaoId);

            q.Criteria.AddCondition(
                "dgt_ativa",
                ConditionOperator.Equal,
                true);

            q.AddOrder(
                "dgt_ordem",
                OrderType.Ascending);

            return service
                .RetrieveMultiple(q)
                .Entities
                .ToList();
        }

        private static Guid CriarTentativa(
            IOrganizationService service,
            EnvioAvaliacao payload,
            Guid usuarioTreinamentoId,
            Guid avaliacaoId,
            int numero,
            decimal nota,
            int acertos,
            int erros,
            bool aprovado,
            int quantidadeQuestoes)
        {
            var statusFinalizada =
                ObterOpcaoPorRotulo(
                    service,
                    "dgt_tentativa",
                    "dgt_status",
                    "Finalizada");

            var tentativa =
                new Entity(
                    "dgt_tentativa");

            tentativa["dgt_name"] =
                "Tentativa " +
                numero +
                " - " +
                DateTime.UtcNow.ToString(
                    "yyyyMMddHHmmss",
                    CultureInfo.InvariantCulture);

            tentativa["dgt_usuariotreinamento"] =
                new EntityReference(
                    "dgt_usuariotreinamento",
                    usuarioTreinamentoId);

            tentativa["dgt_avaliacao"] =
                new EntityReference(
                    "dgt_avaliacao",
                    avaliacaoId);

            tentativa["dgt_numerotentativa"] =
                numero;

            tentativa["dgt_nota"] =
                nota;

            tentativa["dgt_acertos"] =
                acertos;

            tentativa["dgt_erros"] =
                erros;

            tentativa["dgt_aprovado"] =
                aprovado;

            tentativa["dgt_quantidadequestoes"] =
                quantidadeQuestoes;

            tentativa["dgt_tempoutilizadoseg"] =
                payload.tempoUtilizadoSeg;

            tentativa["dgt_datainicio"] =
                ParseUtc(
                    payload.dataInicio);

            tentativa["dgt_datatermino"] =
                ParseUtc(
                    payload.dataTermino);

            tentativa["dgt_ativa"] =
                true;

            if (statusFinalizada.HasValue)
            {
                tentativa["dgt_status"] =
                    new OptionSetValue(
                        statusFinalizada.Value);
            }

            return service.Create(
                tentativa);
        }

        private static void CriarEvidencias(
            IOrganizationService service,
            Guid tentativaId,
            int numeroTentativa,
            List<QuestaoCorrigida> questoes)
        {
            for (var i = 0;
                 i < questoes.Count;
                 i++)
            {
                var item =
                    questoes[i];

                var questao =
                    item.Questao;

                var tentativaQuestao =
                    new Entity(
                        "dgt_tentativaquestao");

                tentativaQuestao["dgt_name"] =
                    "Tentativa " +
                    numeroTentativa +
                    " - Q" +
                    (i + 1);

                tentativaQuestao["dgt_tentativa"] =
                    new EntityReference(
                        "dgt_tentativa",
                        tentativaId);

                tentativaQuestao["dgt_questao"] =
                    new EntityReference(
                        "dgt_questao",
                        questao.Id);

                tentativaQuestao[
                    "dgt_enunciadoregistrado"] =
                    questao.GetAttributeValue<string>(
                        "dgt_enunciado") ??
                    string.Empty;

                tentativaQuestao[
                    "dgt_ordemapresentada"] =
                    i + 1;

                tentativaQuestao[
                    "dgt_pesoaplicado"] =
                    item.Peso;

                tentativaQuestao[
                    "dgt_pontosobtidos"] =
                    item.Pontos;

                tentativaQuestao[
                    "dgt_correta"] =
                    item.Correta;

                tentativaQuestao[
                    "dgt_respondida"] =
                    item.Selecionadas.Count > 0;

                tentativaQuestao[
                    "dgt_ativa"] =
                    true;

                var tipo =
                    questao.GetAttributeValue<OptionSetValue>(
                        "dgt_tipoquestao");

                if (tipo != null)
                {
                    tentativaQuestao[
                        "dgt_tiporegistrado"] =
                        new OptionSetValue(
                            tipo.Value);
                }

                var tentativaQuestaoId =
                    service.Create(
                        tentativaQuestao);

                for (var a = 0;
                     a < item.Alternativas.Count;
                     a++)
                {
                    var alternativa =
                        item.Alternativas[a];

                    var resposta =
                        new Entity(
                            "dgt_resposta");

                    resposta["dgt_name"] =
                        "Tentativa " +
                        numeroTentativa +
                        " - Q" +
                        (i + 1) +
                        " - A" +
                        (a + 1);

                    resposta[
                        "dgt_tentativaquestao"] =
                        new EntityReference(
                            "dgt_tentativaquestao",
                            tentativaQuestaoId);

                    resposta[
                        "dgt_alternativa"] =
                        new EntityReference(
                            "dgt_alternativa",
                            alternativa.Id);

                    resposta[
                        "dgt_textoregistrado"] =
                        alternativa.GetAttributeValue<string>(
                            "dgt_name") ??
                        string.Empty;

                    resposta[
                        "dgt_ordemapresentada"] =
                        a + 1;

                    resposta[
                        "dgt_selecionada"] =
                        item.Selecionadas.Contains(
                            alternativa.Id);

                    resposta[
                        "dgt_corretaesperada"] =
                        alternativa.GetAttributeValue<bool?>(
                            "dgt_correta") ==
                        true;

                    resposta[
                        "dgt_ativa"] =
                        true;

                    service.Create(
                        resposta);
                }
            }
        }

        private static void ConcluirTreinamentoELiberarProximo(
            IOrganizationService service,
            Entity usuarioTreinamento,
            Guid usuarioTreinamentoId,
            decimal nota,
            ResultadoAvaliacao resultado)
        {
            var agora =
                DateTime.UtcNow;

            var statusConcluido =
                ObterOpcaoPorRotulo(
                    service,
                    "dgt_usuariotreinamento",
                    "dgt_status",
                    "Concluído");

            var treinamentoRef =
                usuarioTreinamento
                    .GetAttributeValue<EntityReference>(
                        "dgt_treinamento");

            if (treinamentoRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "O treinamento da atribuição não foi encontrado.");
            }

            var trilhaRef =
                usuarioTreinamento
                    .GetAttributeValue<EntityReference>(
                        "dgt_trilha");

            var treinamento =
                service.Retrieve(
                    "dgt_treinamento",
                    treinamentoRef.Id,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_validademeses"));

            var validadeMeses =
                treinamento.GetAttributeValue<int?>(
                    "dgt_validademeses") ??
                0;

            var update =
                new Entity(
                    "dgt_usuariotreinamento",
                    usuarioTreinamentoId);

            update["dgt_nota"] =
                nota;

            update["dgt_dataconclusao"] =
                agora;

            update["dgt_liberado"] =
                true;

            if (validadeMeses > 0)
            {
                var validade =
                    agora.AddMonths(
                        validadeMeses);

                update["dgt_datavalidade"] =
                    validade;

                resultado.dataValidade =
                    validade.ToString(
                        "o",
                        CultureInfo.InvariantCulture);
            }

            if (statusConcluido.HasValue)
            {
                update["dgt_status"] =
                    new OptionSetValue(
                        statusConcluido.Value);
            }

            service.Update(
                update);

            resultado.treinamentoConcluido =
                true;

            if (trilhaRef == null)
                return;

            var ordemAtual =
                BuscarOrdemTreinamento(
                    service,
                    trilhaRef.Id,
                    treinamentoRef.Id);

            if (!ordemAtual.HasValue)
                return;

            var proximo =
                BuscarProximoTreinamento(
                    service,
                    trilhaRef.Id,
                    ordemAtual.Value);

            if (proximo == null)
                return;

            var proximoTreinamento =
                proximo.GetAttributeValue<EntityReference>(
                    "dgt_treinamento");

            if (proximoTreinamento == null)
                return;

            var usuarioRef =
                usuarioTreinamento
                    .GetAttributeValue<EntityReference>(
                        "dgt_usuario");

            if (usuarioRef == null)
                return;

            var atribuicaoProxima =
                BuscarAtribuicao(
                    service,
                    usuarioRef.Id,
                    trilhaRef.Id,
                    proximoTreinamento.Id);

            if (atribuicaoProxima == null)
                return;

            if (atribuicaoProxima
                    .GetAttributeValue<bool?>(
                        "dgt_liberado") ==
                true)
            {
                return;
            }

            var statusDisponivel =
                ObterOpcaoPorRotulo(
                    service,
                    "dgt_usuariotreinamento",
                    "dgt_status",
                    "Disponível");

            var liberar =
                new Entity(
                    "dgt_usuariotreinamento",
                    atribuicaoProxima.Id);

            liberar["dgt_liberado"] =
                true;

            liberar["dgt_dataliberacao"] =
                agora;

            if (statusDisponivel.HasValue)
            {
                liberar["dgt_status"] =
                    new OptionSetValue(
                        statusDisponivel.Value);
            }

            service.Update(
                liberar);

            resultado.proximoTreinamentoLiberado =
                true;

            resultado.proximoTreinamentoNome =
                proximoTreinamento.Name ??
                string.Empty;
        }

        // =====================================================
        // BLOCO 3 - CERTIFICADO
        // =====================================================

        private static void CriarCertificado(
            IOrganizationService service,
            Guid usuarioTreinamentoId,
            Entity usuarioTreinamento,
            ResultadoAvaliacao resultado)
        {
            var existente =
                BuscarCertificadoExistente(
                    service,
                    usuarioTreinamentoId);

            if (existente != null)
            {
                resultado.certificadoGerado =
                    true;

                resultado.certificadoId =
                    existente.Id.ToString();

                resultado.certificadoNumero =
                    existente.GetAttributeValue<string>(
                        "dgt_numero") ??
                    string.Empty;

                return;
            }

            // Recupera novamente a atribuição após a conclusão
            // para obter as datas efetivamente persistidas.
            var atribuicao =
                service.Retrieve(
                    "dgt_usuariotreinamento",
                    usuarioTreinamentoId,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_usuario",
                        "dgt_treinamento",
                        "dgt_dataconclusao",
                        "dgt_datavalidade"));

            var treinamentoRef =
                atribuicao.GetAttributeValue<EntityReference>(
                    "dgt_treinamento");

            var usuarioRef =
                atribuicao.GetAttributeValue<EntityReference>(
                    "dgt_usuario");

            if (treinamentoRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "Não foi possível identificar o treinamento para emissão do certificado.");
            }

            if (usuarioRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "Não foi possível identificar o usuário para emissão do certificado.");
            }

            var treinamento =
                service.Retrieve(
                    "dgt_treinamento",
                    treinamentoRef.Id,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_codigo"));

            var usuario =
                service.Retrieve(
                    "dgt_usuario",
                    usuarioRef.Id,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_matricula"));

            var dataConclusao =
                atribuicao.GetAttributeValue<DateTime?>(
                    "dgt_dataconclusao") ??
                DateTime.UtcNow;

            var dataValidade =
                atribuicao.GetAttributeValue<DateTime?>(
                    "dgt_datavalidade");

            var numero =
                GerarNumeroCertificado();

            var nomeTreinamento =
                treinamento.GetAttributeValue<string>(
                    "dgt_name") ??
                treinamentoRef.Name ??
                "Treinamento";

            var nomeUsuario =
                usuario.GetAttributeValue<string>(
                    "dgt_name") ??
                usuarioRef.Name ??
                "Colaborador";

            var certificado =
                new Entity(
                    "dgt_certificado");

            certificado["dgt_name"] =
                "Certificado - " +
                nomeTreinamento +
                " - " +
                nomeUsuario;

            certificado["dgt_numero"] =
                numero;

            certificado["dgt_usuariotreinamento"] =
                new EntityReference(
                    "dgt_usuariotreinamento",
                    usuarioTreinamentoId);

            certificado["dgt_dataemissao"] =
                DateTime.UtcNow;

            if (dataValidade.HasValue)
            {
                certificado["dgt_datavalidade"] =
                    dataValidade.Value;
            }

            certificado["dgt_ativo"] =
                true;

            // O Power Automate preencherá posteriormente:
            //
            // dgt_arquivourl
            // dgt_biblioteca
            // dgt_sharepointitemid

            var certificadoId =
                service.Create(
                    certificado);

            resultado.certificadoGerado =
                true;

            resultado.certificadoId =
                certificadoId.ToString();

            resultado.certificadoNumero =
                numero;
        }

        private static Entity BuscarCertificadoExistente(
            IOrganizationService service,
            Guid usuarioTreinamentoId)
        {
            var q =
                new QueryExpression(
                    "dgt_certificado")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_certificadoid",
                            "dgt_numero",
                            "dgt_dataemissao",
                            "dgt_datavalidade",
                            "dgt_arquivourl",
                            "dgt_ativo"),

                    TopCount = 1
                };

            q.Criteria.AddCondition(
                "dgt_usuariotreinamento",
                ConditionOperator.Equal,
                usuarioTreinamentoId);

            q.Criteria.AddCondition(
                "dgt_ativo",
                ConditionOperator.Equal,
                true);

            q.AddOrder(
                "createdon",
                OrderType.Descending);

            return service
                .RetrieveMultiple(q)
                .Entities
                .FirstOrDefault();
        }

        private static string GerarNumeroCertificado()
        {
            var ano =
                DateTime.UtcNow.Year;

            var codigo =
                Guid.NewGuid()
                    .ToString("N")
                    .Substring(0, 10)
                    .ToUpperInvariant();

            return string.Format(
                CultureInfo.InvariantCulture,
                "DGT-{0}-{1}",
                ano,
                codigo);
        }

        private static int? BuscarOrdemTreinamento(
            IOrganizationService service,
            Guid trilhaId,
            Guid treinamentoId)
        {
            var q =
                new QueryExpression(
                    "dgt_trilhatreinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_ordem")
                };

            q.Criteria.AddCondition(
                "dgt_trilha",
                ConditionOperator.Equal,
                trilhaId);

            q.Criteria.AddCondition(
                "dgt_treinamento",
                ConditionOperator.Equal,
                treinamentoId);

            var r =
                service
                    .RetrieveMultiple(q)
                    .Entities
                    .FirstOrDefault();

            return r == null
                ? (int?)null
                : r.GetAttributeValue<int?>(
                    "dgt_ordem");
        }

        private static Entity BuscarProximoTreinamento(
            IOrganizationService service,
            Guid trilhaId,
            int ordemAtual)
        {
            var q =
                new QueryExpression(
                    "dgt_trilhatreinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_ordem",
                            "dgt_treinamento",
                            "dgt_ativo"),

                    TopCount = 1
                };

            q.Criteria.AddCondition(
                "dgt_trilha",
                ConditionOperator.Equal,
                trilhaId);

            q.Criteria.AddCondition(
                "dgt_ordem",
                ConditionOperator.GreaterThan,
                ordemAtual);

            q.Criteria.AddCondition(
                "dgt_ativo",
                ConditionOperator.Equal,
                true);

            q.AddOrder(
                "dgt_ordem",
                OrderType.Ascending);

            return service
                .RetrieveMultiple(q)
                .Entities
                .FirstOrDefault();
        }

        private static Entity BuscarAtribuicao(
            IOrganizationService service,
            Guid usuarioId,
            Guid trilhaId,
            Guid treinamentoId)
        {
            var q =
                new QueryExpression(
                    "dgt_usuariotreinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_usuariotreinamentoid",
                            "dgt_liberado",
                            "dgt_status"),

                    TopCount = 1
                };

            q.Criteria.AddCondition(
                "dgt_usuario",
                ConditionOperator.Equal,
                usuarioId);

            q.Criteria.AddCondition(
                "dgt_trilha",
                ConditionOperator.Equal,
                trilhaId);

            q.Criteria.AddCondition(
                "dgt_treinamento",
                ConditionOperator.Equal,
                treinamentoId);

            q.Criteria.AddCondition(
                "dgt_ativo",
                ConditionOperator.Equal,
                true);

            return service
                .RetrieveMultiple(q)
                .Entities
                .FirstOrDefault();
        }

        private static int? ObterOpcaoPorRotulo(
            IOrganizationService service,
            string entidade,
            string atributo,
            string rotulo)
        {
            var request =
                new RetrieveAttributeRequest
                {
                    EntityLogicalName =
                        entidade,

                    LogicalName =
                        atributo,

                    RetrieveAsIfPublished =
                        true
                };

            var response =
                (RetrieveAttributeResponse)
                service.Execute(
                    request);

            var metadata =
                response.AttributeMetadata
                    as EnumAttributeMetadata;

            if (metadata == null ||
                metadata.OptionSet == null)
            {
                return null;
            }

            foreach (var option in
                metadata.OptionSet.Options)
            {
                var label =
                    option.Label?
                        .UserLocalizedLabel?
                        .Label;

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

        private static DateTime ParseUtc(
            string value)
        {
            DateTime parsed;

            if (!DateTime.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal |
                DateTimeStyles.AssumeUniversal,
                out parsed))
            {
                return DateTime.UtcNow;
            }

            return parsed.ToUniversalTime();
        }

        private sealed class QuestaoCorrigida
        {
            public Entity Questao { get; set; }

            public List<Entity> Alternativas { get; set; }

            public HashSet<Guid> Selecionadas { get; set; }

            public bool Correta { get; set; }

            public decimal Peso { get; set; }

            public decimal Pontos { get; set; }
        }

        private sealed class EnvioAvaliacao
        {
            public string usuarioTreinamentoId { get; set; }

            public string avaliacaoId { get; set; }

            public string dataInicio { get; set; }

            public string dataTermino { get; set; }

            public int tempoUtilizadoSeg { get; set; }

            public int numeroTentativa { get; set; }

            public List<RespostaEnvio> respostas { get; set; }
        }

        private sealed class RespostaEnvio
        {
            public string questaoId { get; set; }

            public List<string> alternativasSelecionadas { get; set; }
        }

        private sealed class ResultadoAvaliacao
        {
            public bool sucesso { get; set; }

            public string mensagem { get; set; }

            public string tentativaId { get; set; }

            public decimal nota { get; set; }

            public int acertos { get; set; }

            public int erros { get; set; }

            public bool aprovado { get; set; }

            public int total { get; set; }

            public int numeroTentativa { get; set; }

            public int tentativasRestantes { get; set; }

            public bool treinamentoConcluido { get; set; }

            public bool proximoTreinamentoLiberado { get; set; }

            public string proximoTreinamentoNome { get; set; }

            public string dataValidade { get; set; }

            // BLOCO 3
            public bool certificadoGerado { get; set; }

            public string certificadoId { get; set; }

            public string certificadoNumero { get; set; }
        }
    }
}