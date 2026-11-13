using System;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API dgt_GerenciarIa — chave da IA salva pelo portal
    //
    // Chamada pela tela Indicadores › Administrar IA (só Administrador:
    // a API exige Gravar em dgt_iaconfiguracao).
    //
    // PayloadJson:
    //   { "acao": "salvarChave", "chave": "sk-ant-..." }  testa e salva
    //   { "acao": "testarChave" }                          testa a chave salva
    //   { "acao": "removerChave" }                         volta à Configuração segura
    //
    // ResultadoJson:
    //   { "ok": true, "mensagem": "...", "chaveFinal": "…a1B2" }
    //
    // A chave vai para dgt_iaconfiguracao.dgt_chaveapi (coluna protegida)
    // pelo SYSTEM e NUNCA volta ao navegador: o portal só vê os 4 últimos
    // caracteres, quem trocou e quando. A chave não é registrada em log.
    //
    // REGISTRO (Plugin Registration Tool): passo na mensagem
    //   dgt_GerenciarIa · Primary Entity none · PostOperation · Synchronous
    //   (sem Configuração segura).
    // ================================================================
    public sealed class GerenciarIaPlugin : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var fabrica = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var sistema = fabrica.CreateOrganizationService(null);

            var payloadJson = context.InputParameters.Contains("PayloadJson")
                ? context.InputParameters["PayloadJson"] as string
                : null;

            JObject payload;
            try
            {
                payload = JObject.Parse(string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson);
            }
            catch (JsonException)
            {
                throw new InvalidPluginExecutionException("PayloadJson inválido.");
            }

            var acao = (string)payload["acao"] ?? string.Empty;
            var config = IaComum.LerConfiguracao(sistema, tracing);

            if (config.Id == Guid.Empty)
            {
                throw new InvalidPluginExecutionException(
                    "A configuração da IA não existe: rode o script criar-ia-administracao.ps1.");
            }

            switch (acao)
            {
                case "salvarChave":
                    {
                        var chave = ((string)payload["chave"] ?? string.Empty).Trim();
                        if (chave.Length < 20 || chave.Length > 500 || chave.IndexOf(' ') >= 0)
                        {
                            throw new InvalidPluginExecutionException("A chave informada não parece válida.");
                        }

                        // Só salva se a Anthropic aceitar.
                        var problema = IaComum.TestarChave(chave, tracing);
                        if (problema.Length > 0)
                        {
                            throw new InvalidPluginExecutionException("Chave não salva. " + problema);
                        }

                        var final = "…" + chave.Substring(chave.Length - 4);
                        var nomeUsuario = NomeDe(sistema, context.InitiatingUserId);

                        var registro = new Entity(IaComum.TabelaConfiguracao, config.Id);
                        registro["dgt_chaveapi"] = chave;
                        registro["dgt_chavefinal"] = final;
                        registro["dgt_chaveatualizadaem"] = DateTime.UtcNow;
                        registro["dgt_chaveatualizadapor"] = IaComum.Cortar(nomeUsuario, 200);
                        sistema.Update(registro);

                        tracing.Trace("Chave da IA substituída por {0}.", nomeUsuario);
                        Responder(context, true, "Chave testada e salva. Já vale para todas as funcionalidades de IA.", final);
                        break;
                    }

                case "testarChave":
                    {
                        if (string.IsNullOrWhiteSpace(config.Chave))
                        {
                            Responder(context, false, "Nenhuma chave salva no portal: os plugins usam a Configuração segura do passo.", string.Empty);
                            break;
                        }
                        var problema = IaComum.TestarChave(config.Chave, tracing);
                        Responder(
                            context,
                            problema.Length == 0,
                            problema.Length == 0 ? "Chave válida: a Anthropic aceitou a chave salva." : problema,
                            "…" + config.Chave.Substring(Math.Max(0, config.Chave.Length - 4)));
                        break;
                    }

                case "removerChave":
                    {
                        var registro = new Entity(IaComum.TabelaConfiguracao, config.Id);
                        registro["dgt_chaveapi"] = null;
                        registro["dgt_chavefinal"] = null;
                        registro["dgt_chaveatualizadaem"] = DateTime.UtcNow;
                        registro["dgt_chaveatualizadapor"] = IaComum.Cortar(NomeDe(sistema, context.InitiatingUserId), 200);
                        sistema.Update(registro);
                        Responder(context, true, "Chave removida do portal. Os plugins voltam a usar a Configuração segura do passo.", string.Empty);
                        break;
                    }

                default:
                    throw new InvalidPluginExecutionException("Ação inválida. Use salvarChave, testarChave ou removerChave.");
            }
        }

        private static void Responder(IPluginExecutionContext context, bool ok, string mensagem, string chaveFinal)
        {
            context.OutputParameters["ResultadoJson"] =
                JsonConvert.SerializeObject(new { ok, mensagem, chaveFinal });
        }

        private static string NomeDe(IOrganizationService sistema, Guid usuarioId)
        {
            try
            {
                return sistema.Retrieve("systemuser", usuarioId, new Microsoft.Xrm.Sdk.Query.ColumnSet("fullname"))
                    .GetAttributeValue<string>("fullname") ?? string.Empty;
            }
            catch (Exception)
            {
                return string.Empty;
            }
        }
    }
}
