using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // ACOMPANHAMENTO DE LICITAÇÕES — FASE 2 (verificação automática)
    //
    // Duas Custom APIs, o MESMO plugin, a MESMA chave:
    //
    //   dgt_AcompanharLicitacao
    //     PayloadJson: { "acao": "acompanhar"|"parar", "chaveEdital": "...", "idPncp": "..." }
    //     → criptografa o identificador do PNCP (que contém o CNPJ do
    //       órgão) e grava em dgt_identificadorcripto (coluna com
    //       segurança de campo). "parar" apaga o campo.
    //
    //   dgt_AtualizarAcompanhamentos   (chamada pelo fluxo diário)
    //     → para cada edital acompanhado: descriptografa EM MEMÓRIA,
    //       consulta o PNCP, compara com a última foto e grava as
    //       alterações (sem CNPJ). Respeita o limite de tempo do
    //       Dataverse: o que não couber fica para a próxima rodada.
    //
    // REGISTRO (Plugin Registration Tool): 2 passos, ambos
    //   Stage PostOperation · Synchronous · SEM "Delete AsyncOperation"
    //   Secure Configuration = a MESMA chave nos dois passos:
    //     64 bytes aleatórios em Base64 (ver docs/acompanhamento-licitacoes.md)
    //
    // CRIPTOGRAFIA: AES-256-CBC (IV aleatório) + HMAC-SHA256
    //   (encrypt-then-MAC). Formato: "v1:" + Base64(IV | cifrado | MAC).
    //   O identificador NUNCA vai para o rastreamento (trace) nem
    //   para o navegador.
    //
    // A regra de comparação é a mesma de utils/snapshotLicitacao.ts.
    // ================================================================
    public sealed class AcompanhamentoLicitacaoPlugin : IPlugin
    {
        private const string TabelaAcompanhamento = "dgt_licitacaoacompanhamento";
        private const string TabelaAlteracao = "dgt_licitacaoalteracao";

        private const string BaseConsulta = "https://pncp.gov.br/api/consulta/v1";
        private const string BasePncp = "https://pncp.gov.br/api/pncp/v1";

        // O Dataverse encerra plugins em ~2 min: para antes.
        private static readonly TimeSpan Orcamento = TimeSpan.FromSeconds(95);

        private static readonly HttpClient Http =
            new HttpClient { Timeout = TimeSpan.FromSeconds(20) };

        private static readonly Regex IdPncp =
            new Regex(@"^(\d{14})-\d+-(\d+)/(\d{4})$", RegexOptions.Compiled);

        private static readonly Regex Cnpj =
            new Regex(@"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b", RegexOptions.Compiled);

        private static readonly Regex Cpf =
            new Regex(@"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", RegexOptions.Compiled);

        private readonly byte[] _chaveCifra;
        private readonly byte[] _chaveMac;

        public AcompanhamentoLicitacaoPlugin(string unsecureConfig, string secureConfig)
        {
            try
            {
                var bytes = Convert.FromBase64String((secureConfig ?? string.Empty).Trim());
                if (bytes.Length >= 64)
                {
                    _chaveCifra = bytes.Take(32).ToArray();
                    _chaveMac = bytes.Skip(32).Take(32).ToArray();
                }
            }
            catch (FormatException)
            {
                _chaveCifra = null;
                _chaveMac = null;
            }
        }

        private bool TemChave => _chaveCifra != null && _chaveMac != null;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var fabrica = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));

            // SYSTEM: grava a coluna com segurança de campo.
            var sistema = fabrica.CreateOrganizationService(null);

            var payload = LerPayload(context);
            JObject resultado;

            switch (context.MessageName)
            {
                case "dgt_AcompanharLicitacao":
                    resultado = Acompanhar(sistema, payload, tracing);
                    break;

                case "dgt_AtualizarAcompanhamentos":
                    resultado = Atualizar(sistema, tracing);
                    break;

                default:
                    throw new InvalidPluginExecutionException($"Mensagem não suportada: {context.MessageName}");
            }

            context.OutputParameters["ResultadoJson"] = resultado.ToString(Formatting.None);
        }

        // ------------------------------------------------------------
        // dgt_AcompanharLicitacao
        // ------------------------------------------------------------

        private JObject Acompanhar(IOrganizationService sistema, JObject payload, ITracingService tracing)
        {
            var acao = ((string)payload["acao"] ?? "acompanhar").Trim().ToLowerInvariant();
            var chave = ((string)payload["chaveEdital"] ?? string.Empty).Trim();

            if (chave.Length == 0)
            {
                throw new InvalidPluginExecutionException("chaveEdital não informada.");
            }

            var registro = BuscarAcompanhamento(sistema, chave);
            if (registro == null)
            {
                throw new InvalidPluginExecutionException("Acompanhamento não encontrado para este edital.");
            }

            var atualizacao = new Entity(TabelaAcompanhamento, registro.Id);

            if (acao == "parar")
            {
                atualizacao["dgt_identificadorcripto"] = null;
                atualizacao["dgt_monitoramentoautomatico"] = false;
                sistema.Update(atualizacao);
                return new JObject { ["cifrado"] = false, ["motivo"] = "Identificador removido." };
            }

            if (!TemChave)
            {
                return new JObject
                {
                    ["cifrado"] = false,
                    ["motivo"] = "Verificação automática desligada: a chave de criptografia ainda não foi registrada no plugin (fase 1)."
                };
            }

            var id = ((string)payload["idPncp"] ?? string.Empty).Trim();
            if (!IdPncp.IsMatch(id))
            {
                throw new InvalidPluginExecutionException("Identificador do PNCP em formato inesperado.");
            }

            atualizacao["dgt_identificadorcripto"] = Cifrar(id);
            atualizacao["dgt_monitoramentoautomatico"] = true;
            sistema.Update(atualizacao);

            tracing.Trace("Identificador criptografado e gravado para o acompanhamento {0}.", registro.Id);

            return new JObject { ["cifrado"] = true };
        }

        // ------------------------------------------------------------
        // dgt_AtualizarAcompanhamentos
        // ------------------------------------------------------------

        private JObject Atualizar(IOrganizationService sistema, ITracingService tracing)
        {
            if (!TemChave)
            {
                throw new InvalidPluginExecutionException(
                    "Verificação automática desligada: registre a chave de criptografia na Configuração segura do passo.");
            }

            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            var relogio = Stopwatch.StartNew();

            var consulta = new QueryExpression(TabelaAcompanhamento)
            {
                ColumnSet = new ColumnSet("dgt_chaveedital", "dgt_identificadorcripto", "dgt_snapshotjson"),
                TopCount = 200
            };
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);
            consulta.Criteria.AddCondition("dgt_identificadorcripto", ConditionOperator.NotNull);
            consulta.AddOrder("dgt_ultimaverificacao", OrderType.Ascending);

            var lista = sistema.RetrieveMultiple(consulta).Entities;

            int verificados = 0, comAlteracao = 0, novas = 0, erros = 0;

            foreach (var registro in lista)
            {
                if (relogio.Elapsed > Orcamento)
                {
                    break;
                }

                try
                {
                    var id = Decifrar((string)registro["dgt_identificadorcripto"]);
                    var m = IdPncp.Match(id);
                    if (!m.Success)
                    {
                        throw new InvalidOperationException("identificador inválido");
                    }

                    var caminho = $"/orgaos/{m.Groups[1].Value}/compras/{m.Groups[3].Value}/{int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture)}";

                    var foto = Fotografar(caminho);

                    var anterior = LerSnapshot(registro.GetAttributeValue<string>("dgt_snapshotjson"));
                    var mudancas = anterior != null ? Comparar(anterior, foto) : new List<string[]>();

                    // Documentos/itens que não carregaram agora: mantém os anteriores.
                    if (anterior != null)
                    {
                        if (((JArray)foto["documentos"]).Count == 0) { foto["documentos"] = anterior["documentos"] ?? new JArray(); }
                        if (((JArray)foto["itens"]).Count == 0) { foto["itens"] = anterior["itens"] ?? new JArray(); }
                        if (string.IsNullOrEmpty((string)foto["situacao"])) { foto["situacao"] = anterior["situacao"]; }
                    }

                    var referencia = new EntityReference(TabelaAcompanhamento, registro.Id);
                    var chave = registro.GetAttributeValue<string>("dgt_chaveedital");

                    foreach (var mudanca in mudancas)
                    {
                        var alteracao = new Entity(TabelaAlteracao);
                        alteracao["dgt_name"] = Limitar(mudanca[1], 200);
                        alteracao["dgt_acompanhamento"] = referencia;
                        alteracao["dgt_chaveedital"] = chave;
                        alteracao["dgt_tipo"] = mudanca[0];
                        alteracao["dgt_descricao"] = Limitar(mudanca[1], 2000);
                        alteracao["dgt_valoranterior"] = Limitar(Mascarar(mudanca[2]), 4000);
                        alteracao["dgt_valornovo"] = Limitar(Mascarar(mudanca[3]), 4000);
                        alteracao["dgt_origem"] = "automatica";
                        alteracao["dgt_lida"] = false;
                        sistema.Create(alteracao);
                    }

                    var atualizacao = new Entity(TabelaAcompanhamento, registro.Id);
                    atualizacao["dgt_situacao"] = Limitar((string)foto["situacao"] ?? string.Empty, 200);
                    var valor = (decimal?)foto["valor"];
                    atualizacao["dgt_valorestimado"] = valor.HasValue ? (object)Math.Round(valor.Value, 2) : null;
                    atualizacao["dgt_dataabertura"] = (string)foto["abertura"] ?? string.Empty;
                    atualizacao["dgt_dataencerramento"] = (string)foto["encerramento"] ?? string.Empty;
                    atualizacao["dgt_objeto"] = Limitar((string)foto["objeto"] ?? string.Empty, 4000);
                    atualizacao["dgt_snapshotjson"] = foto.ToString(Formatting.None);
                    atualizacao["dgt_ultimaverificacao"] = DateTime.UtcNow;
                    sistema.Update(atualizacao);

                    verificados++;
                    if (mudancas.Count > 0)
                    {
                        comAlteracao++;
                        novas += mudancas.Count;
                    }
                }
                catch (Exception ex)
                {
                    erros++;
                    // Sem o identificador no log: só o id do registro.
                    tracing.Trace("Falha ao verificar o acompanhamento {0}: {1}", registro.Id, ex.Message);

                    var marcar = new Entity(TabelaAcompanhamento, registro.Id);
                    marcar["dgt_ultimaverificacao"] = DateTime.UtcNow;
                    sistema.Update(marcar);
                }
            }

            var resultado = new JObject
            {
                ["verificados"] = verificados,
                ["comAlteracao"] = comAlteracao,
                ["novasAlteracoes"] = novas,
                ["erros"] = erros,
                ["pendentes"] = Math.Max(0, lista.Count - verificados - erros)
            };

            tracing.Trace("Verificação: {0}", resultado.ToString(Formatting.None));

            return resultado;
        }

        // ------------------------------------------------------------
        // PNCP → foto (mesma estrutura de ISnapshotLicitacao)
        // ------------------------------------------------------------

        private static JObject Fotografar(string caminho)
        {
            var detalhe = BuscarJson(BaseConsulta + caminho) as JObject ?? new JObject();

            var documentos = new JArray();
            var arquivos = BuscarJson(BasePncp + caminho + "/arquivos") as JArray;
            if (arquivos != null)
            {
                foreach (var d in arquivos.OfType<JObject>()
                    .Where(d => (bool?)d["statusAtivo"] != false)
                    .OrderBy(d => (int?)d["sequencialDocumento"] ?? 0))
                {
                    documentos.Add(new JObject
                    {
                        ["seq"] = (int?)d["sequencialDocumento"] ?? 0,
                        ["titulo"] = Limitar(Mascarar((string)d["titulo"] ?? string.Empty), 300),
                        ["tipo"] = (string)d["tipoDocumentoNome"] ?? (string)d["tipoDocumentoDescricao"] ?? string.Empty
                    });
                }
            }

            var itens = new JArray();
            for (var pagina = 1; pagina <= 5; pagina++)
            {
                var bruto = BuscarJson($"{BasePncp}{caminho}/itens?pagina={pagina}&tamanhoPagina=500");
                var lote = bruto as JArray ?? (bruto as JObject)?["data"] as JArray ?? new JArray();
                foreach (var i in lote.OfType<JObject>())
                {
                    var item = new JObject
                    {
                        ["n"] = (int?)i["numeroItem"] ?? itens.Count + 1,
                        ["situacao"] = ((string)i["situacaoCompraItemNome"] ?? string.Empty).Trim()
                    };
                    var valorItem = (decimal?)i["valorTotal"];
                    if (valorItem.HasValue) { item["valor"] = valorItem.Value; }
                    itens.Add(item);
                }
                if (lote.Count < 500) { break; }
            }

            var foto = new JObject
            {
                ["v"] = 1,
                ["situacao"] = ((string)detalhe["situacaoCompraNome"] ?? string.Empty).Trim(),
                ["abertura"] = Curta((string)detalhe["dataAberturaProposta"]),
                ["encerramento"] = Curta((string)detalhe["dataEncerramentoProposta"]),
                ["objeto"] = Limitar(Mascarar(((string)detalhe["objetoCompra"] ?? string.Empty).Trim()), 4000),
                ["documentos"] = new JArray(documentos.OrderBy(d => (int)d["seq"])),
                ["itens"] = new JArray(itens.OrderBy(i => (int)i["n"]))
            };

            var valor = (decimal?)detalhe["valorTotalEstimado"];
            if (valor.HasValue) { foto["valor"] = valor.Value; }

            return foto;
        }

        private static JToken BuscarJson(string url)
        {
            using (var resposta = Http.GetAsync(url).GetAwaiter().GetResult())
            {
                if (resposta.StatusCode == HttpStatusCode.NoContent || resposta.StatusCode == HttpStatusCode.NotFound)
                {
                    return null;
                }
                if (!resposta.IsSuccessStatusCode)
                {
                    throw new InvalidOperationException($"PNCP respondeu {(int)resposta.StatusCode}");
                }
                var conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                return string.IsNullOrWhiteSpace(conteudo) ? null : JToken.Parse(conteudo);
            }
        }

        // ------------------------------------------------------------
        // Comparação (espelho de compararSnapshots no portal)
        // Cada mudança: [tipo, descricao, anterior, novo]
        // ------------------------------------------------------------

        private static List<string[]> Comparar(JObject anterior, JObject atual)
        {
            var lista = new List<string[]>();

            var sitNova = (string)atual["situacao"] ?? string.Empty;
            var sitVelha = (string)anterior["situacao"] ?? string.Empty;
            if (sitNova.Length > 0 && sitNova != sitVelha)
            {
                lista.Add(new[] { "situacao", "Situação do edital alterada", sitVelha.Length > 0 ? sitVelha : "—", sitNova });
            }

            CompararData(lista, anterior, atual, "encerramento", "Encerramento das propostas alterado");
            CompararData(lista, anterior, atual, "abertura", "Abertura das propostas alterada");

            var valorNovo = (decimal?)atual["valor"];
            var valorVelho = (decimal?)anterior["valor"] ?? 0m;
            if (valorNovo.HasValue && Math.Abs(valorVelho - valorNovo.Value) >= 0.01m)
            {
                lista.Add(new[] { "valor", "Valor estimado alterado", Moeda((decimal?)anterior["valor"]), Moeda(valorNovo) });
            }

            var objNovo = (string)atual["objeto"] ?? string.Empty;
            var objVelho = (string)anterior["objeto"] ?? string.Empty;
            if (objNovo.Length > 0 && objNovo != objVelho)
            {
                lista.Add(new[] { "objeto", "Objeto do edital alterado", objVelho, objNovo });
            }

            var docsNovos = (atual["documentos"] as JArray ?? new JArray()).OfType<JObject>().ToList();
            var docsVelhos = (anterior["documentos"] as JArray ?? new JArray()).OfType<JObject>().ToList();
            if (docsNovos.Count > 0)
            {
                var antes = new HashSet<int>(docsVelhos.Select(d => (int?)d["seq"] ?? 0));
                var agora = new HashSet<int>(docsNovos.Select(d => (int?)d["seq"] ?? 0));
                foreach (var d in docsNovos.Where(d => !antes.Contains((int?)d["seq"] ?? 0)))
                {
                    var tipo = (string)d["tipo"] ?? string.Empty;
                    lista.Add(new[] { "documento", "Novo documento publicado", string.Empty, (string)d["titulo"] + (tipo.Length > 0 ? $" ({tipo})" : string.Empty) });
                }
                foreach (var d in docsVelhos.Where(d => !agora.Contains((int?)d["seq"] ?? 0)))
                {
                    lista.Add(new[] { "documento", "Documento retirado", (string)d["titulo"] ?? string.Empty, string.Empty });
                }
            }

            var itensNovos = (atual["itens"] as JArray ?? new JArray()).OfType<JObject>().ToList();
            var itensVelhos = (anterior["itens"] as JArray ?? new JArray()).OfType<JObject>().ToList();
            if (itensNovos.Count > 0)
            {
                var porNumero = itensVelhos.GroupBy(i => (int?)i["n"] ?? 0).ToDictionary(g => g.Key, g => g.First());
                foreach (var i in itensNovos)
                {
                    var n = (int?)i["n"] ?? 0;
                    var situacao = (string)i["situacao"] ?? string.Empty;
                    if (!porNumero.TryGetValue(n, out var velho))
                    {
                        if (itensVelhos.Count > 0)
                        {
                            lista.Add(new[] { "item", $"Item {n} incluído", string.Empty, situacao.Length > 0 ? situacao : "incluído" });
                        }
                        continue;
                    }
                    var situacaoVelha = (string)velho["situacao"] ?? string.Empty;
                    if (situacao.Length > 0 && situacao != situacaoVelha)
                    {
                        lista.Add(new[] { "item", $"Item {n}: situação alterada", situacaoVelha.Length > 0 ? situacaoVelha : "—", situacao });
                    }
                }
            }

            return lista;
        }

        private static void CompararData(List<string[]> lista, JObject anterior, JObject atual, string campo, string descricao)
        {
            var nova = (string)atual[campo] ?? string.Empty;
            var velha = (string)anterior[campo] ?? string.Empty;
            if (nova.Length > 0 && nova != velha)
            {
                lista.Add(new[] { "data", descricao, DataBr(velha), DataBr(nova) });
            }
        }

        // ------------------------------------------------------------
        // Criptografia: AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC)
        // ------------------------------------------------------------

        private string Cifrar(string texto)
        {
            using (var aes = Aes.Create())
            {
                aes.KeySize = 256;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                aes.Key = _chaveCifra;
                aes.GenerateIV();

                byte[] cifrado;
                using (var cifrador = aes.CreateEncryptor())
                {
                    var dados = Encoding.UTF8.GetBytes(texto);
                    cifrado = cifrador.TransformFinalBlock(dados, 0, dados.Length);
                }

                var corpo = aes.IV.Concat(cifrado).ToArray();
                using (var hmac = new HMACSHA256(_chaveMac))
                {
                    var mac = hmac.ComputeHash(corpo);
                    return "v1:" + Convert.ToBase64String(corpo.Concat(mac).ToArray());
                }
            }
        }

        private string Decifrar(string valor)
        {
            if (string.IsNullOrEmpty(valor) || !valor.StartsWith("v1:", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("identificador criptografado em formato desconhecido");
            }

            var bytes = Convert.FromBase64String(valor.Substring(3));
            if (bytes.Length < 16 + 16 + 32)
            {
                throw new InvalidOperationException("identificador criptografado incompleto");
            }

            var corpo = bytes.Take(bytes.Length - 32).ToArray();
            var mac = bytes.Skip(bytes.Length - 32).ToArray();

            using (var hmac = new HMACSHA256(_chaveMac))
            {
                var esperado = hmac.ComputeHash(corpo);
                // Comparação em tempo constante.
                var diferenca = 0;
                for (var i = 0; i < 32; i++) { diferenca |= esperado[i] ^ mac[i]; }
                if (diferenca != 0)
                {
                    throw new InvalidOperationException("identificador adulterado ou chave diferente");
                }
            }

            using (var aes = Aes.Create())
            {
                aes.KeySize = 256;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                aes.Key = _chaveCifra;
                aes.IV = corpo.Take(16).ToArray();

                using (var decifrador = aes.CreateDecryptor())
                {
                    var cifrado = corpo.Skip(16).ToArray();
                    return Encoding.UTF8.GetString(decifrador.TransformFinalBlock(cifrado, 0, cifrado.Length));
                }
            }
        }

        // ------------------------------------------------------------
        // Utilitários
        // ------------------------------------------------------------

        private static JObject LerPayload(IPluginExecutionContext context)
        {
            var json = context.InputParameters.Contains("PayloadJson")
                ? context.InputParameters["PayloadJson"] as string
                : null;
            if (string.IsNullOrWhiteSpace(json))
            {
                return new JObject();
            }
            try
            {
                return JObject.Parse(json);
            }
            catch (JsonException)
            {
                throw new InvalidPluginExecutionException("PayloadJson inválido.");
            }
        }

        private static Entity BuscarAcompanhamento(IOrganizationService sistema, string chave)
        {
            var q = new QueryExpression(TabelaAcompanhamento)
            {
                ColumnSet = new ColumnSet("dgt_licitacaoacompanhamentoid"),
                TopCount = 1
            };
            q.Criteria.AddCondition("dgt_chaveedital", ConditionOperator.Equal, chave);
            return sistema.RetrieveMultiple(q).Entities.FirstOrDefault();
        }

        private static JObject LerSnapshot(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) { return null; }
            try { return JObject.Parse(json); }
            catch (JsonException) { return null; }
        }

        private static string Curta(string data) =>
            string.IsNullOrEmpty(data) ? string.Empty : (data.Length > 16 ? data.Substring(0, 16) : data);

        private static string DataBr(string valor)
        {
            var m = Regex.Match(valor ?? string.Empty, @"^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?");
            if (!m.Success) { return string.IsNullOrEmpty(valor) ? "—" : valor; }
            return $"{m.Groups[3].Value}/{m.Groups[2].Value}/{m.Groups[1].Value}" +
                   (m.Groups[4].Success ? " " + m.Groups[4].Value : string.Empty);
        }

        private static string Moeda(decimal? valor) =>
            valor.HasValue ? valor.Value.ToString("C", new CultureInfo("pt-BR")) : "—";

        private static string Mascarar(string texto) =>
            Cpf.Replace(Cnpj.Replace(texto ?? string.Empty, "[dado removido]"), "[dado removido]");

        private static string Limitar(string texto, int tamanho) =>
            string.IsNullOrEmpty(texto) ? string.Empty : (texto.Length > tamanho ? texto.Substring(0, tamanho) : texto);
    }
}
