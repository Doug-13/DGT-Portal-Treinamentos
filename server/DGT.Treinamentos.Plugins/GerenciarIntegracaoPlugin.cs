using System;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API dgt_GerenciarIntegracao — segredo das integrações salvo
    // pelo portal (mesmo padrão de dgt_GerenciarIa).
    //
    // Só quem tem Gravar em dgt_integracaoconfiguracao executa (a Custom
    // API exige esse privilégio).
    //
    //   { "acao": "salvarSegredo",  "integracao": "CIGAM-BOM", "segredo": "..." }
    //   { "acao": "salvarEndereco", "integracao": "CIGAM-BOM", "url": "https://...", "ambiente": "Homologação" }
    //   { "acao": "verificar",      "integracao": "CIGAM-BOM" }
    //   { "acao": "removerSegredo", "integracao": "CIGAM-BOM" }
    //
    // Resposta (ResultadoJson):
    //   { "ok": true, "mensagem": "...", "segredoFinal": "…a1B2" }
    //
    // "verificar" NÃO chama o sistema externo: no webhook da MAAX qualquer
    // chamada cria oportunidade e pedido no CIGAM. Confere só se endereço
    // e segredo estão preenchidos e válidos.
    //
    // REGISTRO (Plugin Registration Tool):
    //   dgt_GerenciarIntegracao · Primary Entity none · PostOperation · Synchronous
    //   (sem Configuração segura).
    // ================================================================
    public sealed class GerenciarIntegracaoPlugin : IPlugin
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

            var acao = ((string)payload["acao"] ?? string.Empty).Trim();
            var nome = ((string)payload["integracao"] ?? string.Empty).Trim();
            if (nome.Length == 0)
            {
                throw new InvalidPluginExecutionException("Informe a integração (ex.: CIGAM-BOM).");
            }

            var config = IntegracaoComum.Ler(sistema, nome, tracing);
            if (config.Id == Guid.Empty)
            {
                throw new InvalidPluginExecutionException(
                    "A integração \"" + nome + "\" não existe: rode o script criar-integracoes-configuracao.ps1.");
            }

            var nomeUsuario = IaComum.Cortar(NomeDe(sistema, context.InitiatingUserId), 200);

            switch (acao)
            {
                case "salvarSegredo":
                    {
                        var segredo = ((string)payload["segredo"] ?? string.Empty).Trim();
                        if (segredo.Length < 8 || segredo.Length > 2000 || segredo.IndexOf(' ') >= 0 || segredo.IndexOf('\n') >= 0)
                        {
                            throw new InvalidPluginExecutionException("O segredo informado não parece válido (sem espaços, mínimo de 8 caracteres).");
                        }
                        var final = IntegracaoComum.Final(segredo);
                        var registro = new Entity(IntegracaoComum.Tabela, config.Id);
                        registro["dgt_segredo"] = segredo;
                        registro["dgt_segredofinal"] = final;
                        registro["dgt_segredoatualizadoem"] = DateTime.UtcNow;
                        registro["dgt_segredoatualizadopor"] = nomeUsuario;
                        sistema.Update(registro);
                        tracing.Trace("Segredo da integração {0} substituído por {1}.", nome, nomeUsuario);
                        Responder(context, true, "Segredo salvo. Já vale para os próximos lançamentos.", final);
                        return;
                    }

                case "salvarEndereco":
                    {
                        var url = ((string)payload["url"] ?? string.Empty).Trim();
                        var problema = IntegracaoComum.ValidarUrl(url);
                        if (problema.Length > 0)
                        {
                            throw new InvalidPluginExecutionException(problema);
                        }
                        var registro = new Entity(IntegracaoComum.Tabela, config.Id);
                        registro["dgt_url"] = url;
                        var ambiente = ((string)payload["ambiente"] ?? string.Empty).Trim();
                        if (ambiente.Length > 0)
                        {
                            registro["dgt_ambiente"] = IaComum.Cortar(ambiente, 100);
                        }
                        sistema.Update(registro);
                        tracing.Trace("Endereço da integração {0} alterado por {1}.", nome, nomeUsuario);
                        Responder(context, true, "Endereço salvo.", IntegracaoComum.Final(config.Segredo));
                        return;
                    }

                case "verificar":
                    {
                        var problemas = new JArray();
                        var problemaUrl = IntegracaoComum.ValidarUrl(config.Url);
                        if (problemaUrl.Length > 0) { problemas.Add("Endereço: " + problemaUrl); }
                        if (config.Segredo.Length == 0) { problemas.Add("Segredo não salvo no portal."); }
                        var ok = problemas.Count == 0;
                        Responder(context, ok,
                            ok
                                ? "Endereço e segredo preenchidos. O teste real é o primeiro lançamento em Homologação."
                                : string.Join(" ", problemas.ToObject<string[]>()) + " Enquanto isso, o plugin usa a Configuração do passo (se houver).",
                            config.Segredo.Length > 0 ? IntegracaoComum.Final(config.Segredo) : string.Empty);
                        return;
                    }

                case "removerSegredo":
                    {
                        var registro = new Entity(IntegracaoComum.Tabela, config.Id);
                        registro["dgt_segredo"] = null;
                        registro["dgt_segredofinal"] = null;
                        registro["dgt_segredoatualizadoem"] = DateTime.UtcNow;
                        registro["dgt_segredoatualizadopor"] = nomeUsuario;
                        sistema.Update(registro);
                        tracing.Trace("Segredo da integração {0} removido por {1}.", nome, nomeUsuario);
                        Responder(context, true, "Segredo removido do portal. O plugin volta a usar a Configuração segura do passo (se houver).", string.Empty);
                        return;
                    }

                default:
                    throw new InvalidPluginExecutionException("Ação inválida. Use salvarSegredo, salvarEndereco, verificar ou removerSegredo.");
            }
        }

        private static void Responder(IPluginExecutionContext context, bool ok, string mensagem, string segredoFinal)
        {
            context.OutputParameters["ResultadoJson"] =
                JsonConvert.SerializeObject(new { ok, mensagem, segredoFinal });
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
