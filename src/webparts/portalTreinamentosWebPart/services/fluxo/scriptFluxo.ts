import {
  IFonteDadosComponente
} from './valorComponente';

// ============================================================
// TAREFA DE SISTEMA "EXECUTAR SCRIPT" (caixa com engrenagem)
//
// Quando o fluxo chega aqui, o MOTOR PARA, o script roda e só então o
// fluxo segue — assim decisões logo depois do script já enxergam os
// campos que ele preencheu (ex.: "CEP encontrado?").
//
// O script é o CORPO de uma função assíncrona, executado ISOLADO
// (iframe sandbox, sem acesso ao login). Recebe:
//   entrada.valores   → campos do registro/documento (texto)
//   entrada.registro  → { codigo, titulo }
//   entrada.usuario   → { id, nome }
//   DGT.consultar(fonte, { coluna: valor })  → linhas de fonte LIBERADA
//   DGT.http(url, { metodo, corpo })          → só endereços LIBERADOS
//   DGT.log(texto)                            → aparece no teste
// e devolve:
//   return { valores: { campo: 'valor' }, mensagem: '...' }
//   return { erro: 'mensagem' }   → a ação NÃO é concluída
// Só os campos declarados em "campos que o script pode preencher" são
// gravados; o resto é ignorado.
// ============================================================

export const ACAO_SCRIPT = 'executarScript';

export interface IConfigScript {
  codigo: string;
  // Metadados que o script pode preencher.
  camposSaida: string[];
  // Leitura do Dataverse (mesma regra do componente HTML).
  fontes?: IFonteDadosComponente[];
  // Endereços de API liberados (ex.: "viacep.com.br").
  hostsPermitidos?: string[];
  // Tempo máximo (s). Padrão 20.
  tempoLimiteSegundos?: number;
}

export interface IEntradaScript {
  valores: Record<string, string>;
  registro: { codigo: string; titulo: string };
  usuario: { id: string; nome: string };
}

export interface IResultadoScript {
  valores: Record<string, string>;
  erros: string[];
  mensagem?: string;
  log: string[];
}

export const TEMPO_LIMITE_PADRAO = 20;

export const MODELO_SCRIPT_CEP = `// Exemplo: consulta o CEP (ViaCEP) e preenche o endereço.
// Campos usados: cep (entrada) → logradouro, bairro, cidade, uf, cepEncontrado (saída).
const cep = (entrada.valores.cep || '').replace(/\\D/g, '');
if (cep.length !== 8) {
  return { valores: { cepEncontrado: 'nao' }, mensagem: 'CEP inválido' };
}
const resposta = await DGT.http('https://viacep.com.br/ws/' + cep + '/json/');
const dados = resposta.dados || {};
if (!resposta.ok || dados.erro) {
  return { valores: { cepEncontrado: 'nao' }, mensagem: 'CEP não encontrado' };
}
DGT.log('Endereço: ' + dados.logradouro + ', ' + dados.localidade);
return {
  valores: {
    logradouro: dados.logradouro || '',
    bairro: dados.bairro || '',
    cidade: dados.localidade || '',
    uf: dados.uf || '',
    cepEncontrado: 'sim'
  },
  mensagem: 'Endereço preenchido pelo CEP'
};`;

// ------------------------------------------------------------
// Endereços liberados
// ------------------------------------------------------------

const HOST_VALIDO = /^([a-z0-9-]+\.)+[a-z]{2,}$/;

export const normalizarHost = (host: string): string =>
  (host || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

// HTTPS e host liberado (o próprio ou um subdomínio dele).
export const urlPermitida = (
  url: string,
  hosts: string[]
): { ok: boolean; motivo?: string } => {
  const casamento = /^https:\/\/([^/:?#]+)(?::\d+)?([/?#].*)?$/i.exec((url || '').trim());
  if (!casamento) {
    return { ok: false, motivo: 'Use um endereço https:// completo.' };
  }
  const host = casamento[1].toLowerCase();
  const liberados = (hosts || []).map(normalizarHost).filter(item => !!item);
  const permitido = liberados.some(item => host === item || host.substring(host.length - item.length - 1) === `.${item}`);
  return permitido
    ? { ok: true }
    : { ok: false, motivo: `O endereço "${host}" não está liberado neste script (liberados: ${liberados.join(', ') || 'nenhum'}).` };
};

// ------------------------------------------------------------
// Validação da configuração (publicação e pacote JSON)
// ------------------------------------------------------------

export const validarConfigScript = (
  nome: string,
  config: IConfigScript | undefined,
  metadados: Array<{ chave: string; tipo: string }>
): string[] => {
  if (!config || !(config.codigo || '').trim()) {
    return [`Escreva o script da tarefa "${nome}".`];
  }
  const erros: string[] = [];
  if (config.codigo.length > 50000) {
    erros.push(`O script da tarefa "${nome}" passa de 50 mil caracteres.`);
  }
  // camposSaida vazio é válido: script só de verificação (devolve
  // { erro } para bloquear a ação, ou nada para seguir).
  (config.camposSaida || []).forEach(chave => {
    const campo = metadados.find(item => item.chave === chave);
    if (!campo) {
      erros.push(`O script "${nome}" preenche o campo "${chave}", que não existe nos metadados.`);
    } else if (['tabela', 'componente', 'avaliacao'].indexOf(campo.tipo) >= 0) {
      erros.push(`O script "${nome}" não pode preencher o campo "${chave}" (tipo ${campo.tipo}).`);
    }
  });
  (config.hostsPermitidos || []).forEach(host => {
    if (!HOST_VALIDO.test(normalizarHost(host))) {
      erros.push(`Endereço liberado inválido no script "${nome}": "${host}" (ex.: viacep.com.br).`);
    }
  });
  const tempo = config.tempoLimiteSegundos;
  if (tempo !== undefined && !(tempo >= 1 && tempo <= 60)) {
    erros.push(`Tempo limite do script "${nome}" deve ser de 1 a 60 segundos.`);
  }
  return erros;
};

// Só os campos declarados; valores sempre como texto.
export const filtrarSaidaScript = (
  config: IConfigScript,
  valores: unknown
): Record<string, string> => {
  const saida: Record<string, string> = {};
  if (!valores || typeof valores !== 'object') {
    return saida;
  }
  const objeto = valores as Record<string, unknown>;
  (config.camposSaida || []).forEach(chave => {
    if (objeto[chave] === undefined || objeto[chave] === null) {
      return;
    }
    const valor = objeto[chave];
    saida[chave] = typeof valor === 'string' ? valor : typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  });
  return saida;
};

// ------------------------------------------------------------
// Documento isolado (iframe sandbox) que roda o script
// ------------------------------------------------------------

export const montarDocumentoScript = (codigo: string): string => {
  // "</script" no código do usuário fecharia a tag.
  const seguro = (codigo || '').replace(/<\/script/gi, '<\\/script');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
(function () {
  var pendentes = {}, sequencia = 0;
  function enviar(m) { m.canal = 'dgt-script'; parent.postMessage(m, '*'); }
  function pedir(tipo, dados) {
    return new Promise(function (ok, erro) {
      var id = ++sequencia; pendentes[id] = { ok: ok, erro: erro };
      dados.tipo = tipo; dados.id = id; enviar(dados);
    });
  }
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.canal !== 'dgt-portal-script') { return; }
    if (m.tipo === 'iniciar') { executar(m.entrada); return; }
    if (m.tipo === 'resposta' && pendentes[m.id]) {
      var p = pendentes[m.id]; delete pendentes[m.id];
      if (m.ok) { p.ok(m.dados); } else { p.erro(new Error(m.erro || 'Falha')); }
    }
  });
  var DGT = {
    consultar: function (fonte, filtros) { return pedir('consultar', { fonte: fonte, filtros: filtros || {} }); },
    http: function (url, opcoes) { return pedir('http', { url: url, opcoes: opcoes || {} }); },
    log: function (texto) { enviar({ tipo: 'log', texto: String(texto) }); }
  };
  function executar(entrada) {
    var corpo = async function (entrada, DGT) {
${seguro}
    };
    Promise.resolve()
      .then(function () { return corpo(entrada, DGT); })
      .then(function (r) { enviar({ tipo: 'fim', resultado: r || {} }); })
      .catch(function (e) { enviar({ tipo: 'fim', resultado: { erro: (e && e.message) || String(e) } }); });
  }
  enviar({ tipo: 'pronto' });
})();
</script></body></html>`;
};
