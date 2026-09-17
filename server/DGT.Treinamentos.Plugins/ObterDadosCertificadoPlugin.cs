using System;
using System.Globalization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;

namespace DGT.Treinamentos.Plugins
{
    public sealed class ObterDadosCertificadoPlugin : IPlugin
    {
        // =============================================================
        // CUSTOM API
        // =============================================================

        private const string InputCertificadoId =
            "dgt_CertificadoId";

        private const string OutputResultadoJson =
            "dgt_ResultadoJson";


        // =============================================================
        // EXECUTE
        // =============================================================

        public void Execute(IServiceProvider serviceProvider)
        {
            var context =
                (IPluginExecutionContext)serviceProvider.GetService(
                    typeof(IPluginExecutionContext));

            var factory =
                (IOrganizationServiceFactory)serviceProvider.GetService(
                    typeof(IOrganizationServiceFactory));

            var tracing =
                (ITracingService)serviceProvider.GetService(
                    typeof(ITracingService));

            var service =
                factory.CreateOrganizationService(
                    context.UserId);

            try
            {
                tracing.Trace(
                    "DGT - ObterDadosCertificadoPlugin iniciado.");

                // =====================================================
                // 1. RECEBER CERTIFICADO ID
                // =====================================================

                if (!context.InputParameters.Contains(
                        InputCertificadoId))
                {
                    throw new InvalidPluginExecutionException(
                        $"Parâmetro '{InputCertificadoId}' não foi informado.");
                }

                var certificadoIdTexto =
                    context.InputParameters[
                        InputCertificadoId] as string;

                if (string.IsNullOrWhiteSpace(
                        certificadoIdTexto))
                {
                    throw new InvalidPluginExecutionException(
                        $"Parâmetro '{InputCertificadoId}' está vazio.");
                }

                Guid certificadoId;

                if (!Guid.TryParse(
                        certificadoIdTexto,
                        out certificadoId))
                {
                    throw new InvalidPluginExecutionException(
                        $"Parâmetro '{InputCertificadoId}' possui GUID inválido.");
                }

                tracing.Trace(
                    "CertificadoId recebido: {0}",
                    certificadoId);


                // =====================================================
                // 2. OBTER DADOS
                // =====================================================

                var resultado =
                    ObterDados(
                        service,
                        tracing,
                        certificadoId);


                // =====================================================
                // 3. SERIALIZAR RESULTADO
                // =====================================================

                var resultadoJson =
                    JsonConvert.SerializeObject(
                        resultado);

                context.OutputParameters[
                    OutputResultadoJson] =
                    resultadoJson;

                tracing.Trace(
                    "ResultadoJson gerado.");

                tracing.Trace(
                    "DGT - ObterDadosCertificadoPlugin finalizado com sucesso.");
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                tracing.Trace(
                    "Erro ObterDadosCertificadoPlugin: {0}",
                    ex.ToString());

                throw new InvalidPluginExecutionException(
                    "Não foi possível obter os dados do certificado: " +
                    ex.Message,
                    ex);
            }
        }


        // =============================================================
        // OBTER DADOS
        // =============================================================

        private static ResultadoCertificado ObterDados(
            IOrganizationService service,
            ITracingService tracing,
            Guid certificadoId)
        {
            // =========================================================
            // 1. CERTIFICADO
            // =========================================================

            tracing.Trace(
                "Consultando dgt_certificado...");

            var certificado =
                service.Retrieve(
                    "dgt_certificado",
                    certificadoId,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_numero",
                        "dgt_dataemissao",
                        "dgt_datavalidade",
                        "dgt_usuariotreinamento",
                        "dgt_ativo"));

            tracing.Trace(
                "Certificado localizado.");

            var usuarioTreinamentoRef =
                certificado.GetAttributeValue<EntityReference>(
                    "dgt_usuariotreinamento");

            if (usuarioTreinamentoRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "O certificado não possui Usuário Treinamento vinculado.");
            }

            tracing.Trace(
                "UsuarioTreinamentoId: {0}",
                usuarioTreinamentoRef.Id);


            // =========================================================
            // 2. USUÁRIO TREINAMENTO
            // =========================================================

            tracing.Trace(
                "Consultando dgt_usuariotreinamento...");

            var usuarioTreinamento =
                service.Retrieve(
                    "dgt_usuariotreinamento",
                    usuarioTreinamentoRef.Id,
                    new ColumnSet(
                        "dgt_usuario",
                        "dgt_treinamento",
                        "dgt_trilha",
                        "dgt_nota",
                        "dgt_dataconclusao",
                        "dgt_datavalidade",
                        "dgt_revisaotreinada",
                        "dgt_status",
                        "dgt_ativo"));

            tracing.Trace(
                "Usuário Treinamento localizado.");

            var usuarioRef =
                usuarioTreinamento.GetAttributeValue<EntityReference>(
                    "dgt_usuario");

            if (usuarioRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "A atribuição não possui usuário vinculado.");
            }

            var treinamentoRef =
                usuarioTreinamento.GetAttributeValue<EntityReference>(
                    "dgt_treinamento");

            if (treinamentoRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "A atribuição não possui treinamento vinculado.");
            }

            tracing.Trace(
                "UsuarioId: {0}",
                usuarioRef.Id);

            tracing.Trace(
                "TreinamentoId: {0}",
                treinamentoRef.Id);


            // =========================================================
            // 3. USUÁRIO
            // =========================================================

            tracing.Trace(
                "Consultando dgt_usuario...");

            /*
             * Mantemos somente os campos já confirmados na tabela.
             * Matrícula e cargo não entram nesta consulta enquanto
             * não confirmarmos os nomes lógicos dessas colunas.
             */

            var usuario =
                service.Retrieve(
                    "dgt_usuario",
                    usuarioRef.Id,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_email",
                        "dgt_upn",
                        "dgt_ativo"));

            tracing.Trace(
                "Usuário localizado: {0}",
                usuario.GetAttributeValue<string>(
                    "dgt_name") ?? string.Empty);


            // =========================================================
            // 4. TREINAMENTO
            // =========================================================

            tracing.Trace(
                "Consultando dgt_treinamento...");

            var treinamento =
                service.Retrieve(
                    "dgt_treinamento",
                    treinamentoRef.Id,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_codigo",
                        "dgt_codigoexterno",
                        "dgt_cargahorariamin",
                        "dgt_validademeses",
                        "dgt_ativo"));

            tracing.Trace(
                "Treinamento localizado: {0}",
                treinamento.GetAttributeValue<string>(
                    "dgt_name") ?? string.Empty);


            // =========================================================
            // 5. NOTA
            // =========================================================

            var nota =
                ObterDecimal(
                    usuarioTreinamento,
                    "dgt_nota");


            // =========================================================
            // 6. DATAS
            // =========================================================

            var dataConclusao =
                usuarioTreinamento.GetAttributeValue<DateTime?>(
                    "dgt_dataconclusao");

            var dataValidade =
                usuarioTreinamento.GetAttributeValue<DateTime?>(
                    "dgt_datavalidade");

            if (!dataValidade.HasValue)
            {
                dataValidade =
                    certificado.GetAttributeValue<DateTime?>(
                        "dgt_datavalidade");
            }

            var dataEmissao =
                certificado.GetAttributeValue<DateTime?>(
                    "dgt_dataemissao");


            // =========================================================
            // 7. CARGA HORÁRIA
            // =========================================================

            var cargaHorariaMin =
                ObterInteiro(
                    treinamento,
                    "dgt_cargahorariamin");


            // =========================================================
            // 8. TRILHA
            // =========================================================

            var trilhaRef =
                usuarioTreinamento.GetAttributeValue<EntityReference>(
                    "dgt_trilha");


            // =========================================================
            // 9. MONTAR RESULTADO
            // =========================================================

            var resultado =
                new ResultadoCertificado
                {
                    sucesso = true,

                    certificadoId =
                        certificado.Id.ToString(),

                    usuarioTreinamentoId =
                        usuarioTreinamento.Id.ToString(),

                    usuarioId =
                        usuario.Id.ToString(),

                    treinamentoId =
                        treinamento.Id.ToString(),

                    numeroCertificado =
                        certificado.GetAttributeValue<string>(
                            "dgt_numero")
                        ?? string.Empty,

                    nomeColaborador =
                        usuario.GetAttributeValue<string>(
                            "dgt_name")
                        ?? string.Empty,

                    emailColaborador =
                        ObterEmail(
                            usuario),

                    nomeTreinamento =
                        treinamento.GetAttributeValue<string>(
                            "dgt_name")
                        ?? string.Empty,

                    codigoTreinamento =
                        treinamento.GetAttributeValue<string>(
                            "dgt_codigo")
                        ?? string.Empty,

                    codigoExterno =
                        treinamento.GetAttributeValue<string>(
                            "dgt_codigoexterno")
                        ?? string.Empty,

                    trilha =
                        trilhaRef != null
                            ? trilhaRef.Name ?? string.Empty
                            : string.Empty,

                    revisaoTreinada =
                        usuarioTreinamento.GetAttributeValue<string>(
                            "dgt_revisaotreinada")
                        ?? string.Empty,

                    cargaHorariaMin =
                        cargaHorariaMin,

                    cargaHorariaFormatada =
                        FormatarCargaHoraria(
                            cargaHorariaMin),

                    nota =
                        nota,

                    notaFormatada =
                        FormatarNota(
                            nota),

                    dataEmissao =
                        FormatarIso(
                            dataEmissao),

                    dataEmissaoFormatada =
                        FormatarData(
                            dataEmissao),

                    dataConclusao =
                        FormatarIso(
                            dataConclusao),

                    dataConclusaoFormatada =
                        FormatarData(
                            dataConclusao),

                    dataValidade =
                        FormatarIso(
                            dataValidade),

                    dataValidadeFormatada =
                        dataValidade.HasValue
                            ? FormatarData(
                                dataValidade)
                            : "Sem vencimento"
                };

            tracing.Trace(
                "Resultado do certificado montado com sucesso.");

            return resultado;
        }


        // =============================================================
        // EMAIL
        // =============================================================

        private static string ObterEmail(
            Entity usuario)
        {
            var email =
                usuario.GetAttributeValue<string>(
                    "dgt_email");

            if (!string.IsNullOrWhiteSpace(
                    email))
            {
                return email;
            }

            return
                usuario.GetAttributeValue<string>(
                    "dgt_upn")
                ?? string.Empty;
        }


        // =============================================================
        // DECIMAL
        // =============================================================

        private static decimal? ObterDecimal(
            Entity entity,
            string atributo)
        {
            if (!entity.Attributes.Contains(
                    atributo))
            {
                return null;
            }

            var valor =
                entity[atributo];

            if (valor == null)
            {
                return null;
            }

            if (valor is decimal decimalValue)
            {
                return decimalValue;
            }

            if (valor is double doubleValue)
            {
                return Convert.ToDecimal(
                    doubleValue);
            }

            if (valor is int intValue)
            {
                return intValue;
            }

            if (valor is Money moneyValue)
            {
                return moneyValue.Value;
            }

            decimal convertido;

            if (decimal.TryParse(
                    valor.ToString(),
                    NumberStyles.Any,
                    CultureInfo.InvariantCulture,
                    out convertido))
            {
                return convertido;
            }

            if (decimal.TryParse(
                    valor.ToString(),
                    NumberStyles.Any,
                    CultureInfo.GetCultureInfo(
                        "pt-BR"),
                    out convertido))
            {
                return convertido;
            }

            return null;
        }


        // =============================================================
        // INTEIRO
        // =============================================================

        private static int ObterInteiro(
            Entity entity,
            string atributo)
        {
            if (!entity.Attributes.Contains(
                    atributo))
            {
                return 0;
            }

            var valor =
                entity[atributo];

            if (valor == null)
            {
                return 0;
            }

            if (valor is int intValue)
            {
                return intValue;
            }

            if (valor is long longValue)
            {
                return Convert.ToInt32(
                    longValue);
            }

            if (valor is decimal decimalValue)
            {
                return Convert.ToInt32(
                    decimalValue);
            }

            if (valor is double doubleValue)
            {
                return Convert.ToInt32(
                    doubleValue);
            }

            int convertido;

            if (int.TryParse(
                    valor.ToString(),
                    out convertido))
            {
                return convertido;
            }

            return 0;
        }


        // =============================================================
        // FORMATAR CARGA HORÁRIA
        // =============================================================

        private static string FormatarCargaHoraria(
            int minutos)
        {
            if (minutos <= 0)
            {
                return "0h";
            }

            var horas =
                minutos / 60;

            var minutosRestantes =
                minutos % 60;

            if (horas > 0 &&
                minutosRestantes > 0)
            {
                return
                    horas +
                    "h " +
                    minutosRestantes +
                    "min";
            }

            if (horas > 0)
            {
                return
                    horas +
                    "h";
            }

            return
                minutosRestantes +
                "min";
        }


        // =============================================================
        // FORMATAR NOTA
        // =============================================================

        private static string FormatarNota(
            decimal? nota)
        {
            if (!nota.HasValue)
            {
                return string.Empty;
            }

            return
                nota.Value.ToString(
                    "0.##",
                    CultureInfo.InvariantCulture)
                +
                "%";
        }


        // =============================================================
        // FORMATAR DATA
        // =============================================================

        private static string FormatarData(
            DateTime? data)
        {
            if (!data.HasValue)
            {
                return string.Empty;
            }

            return
                data.Value.ToString(
                    "dd/MM/yyyy",
                    CultureInfo.GetCultureInfo(
                        "pt-BR"));
        }


        // =============================================================
        // FORMATAR ISO
        // =============================================================

        private static string FormatarIso(
            DateTime? data)
        {
            if (!data.HasValue)
            {
                return string.Empty;
            }

            return
                data.Value
                    .ToUniversalTime()
                    .ToString(
                        "o",
                        CultureInfo.InvariantCulture);
        }


        // =============================================================
        // DTO
        // =============================================================

        private sealed class ResultadoCertificado
        {
            public bool sucesso { get; set; }

            public string certificadoId { get; set; }

            public string usuarioTreinamentoId { get; set; }

            public string usuarioId { get; set; }

            public string treinamentoId { get; set; }

            public string numeroCertificado { get; set; }

            public string nomeColaborador { get; set; }

            public string emailColaborador { get; set; }

            public string nomeTreinamento { get; set; }

            public string codigoTreinamento { get; set; }

            public string codigoExterno { get; set; }

            public string trilha { get; set; }

            public string revisaoTreinada { get; set; }

            public int cargaHorariaMin { get; set; }

            public string cargaHorariaFormatada { get; set; }

            public decimal? nota { get; set; }

            public string notaFormatada { get; set; }

            public string dataEmissao { get; set; }

            public string dataEmissaoFormatada { get; set; }

            public string dataConclusao { get; set; }

            public string dataConclusaoFormatada { get; set; }

            public string dataValidade { get; set; }

            public string dataValidadeFormatada { get; set; }
        }
    }
}