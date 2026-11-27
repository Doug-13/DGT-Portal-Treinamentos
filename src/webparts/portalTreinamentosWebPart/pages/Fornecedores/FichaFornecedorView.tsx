import * as React from 'react';

import {
  FornecedoresService
} from '../../services/fornecedores/FornecedoresService';

import {
  ANEXOS_SIMPLES,
  DECLARACOES_FICHA,
  EMAIL_DOCUMENTOS_FORNECEDORES,
  FAIXAS_FATURAMENTO_SIMPLES,
  IContatoFornecedor,
  IDadosBancarios,
  IDeclaracoesFicha,
  IFornecedor,
  IQuadroSocietario,
  ISocio,
  PORTES_FICHA,
  PREVISOES_MUDANCA_REGIME,
  QUESTOES_INTEGRIDADE,
  REGIMES_TRIBUTARIOS,
  RESPOSTAS_QUESTIONARIO,
  RespostaQuestionario,
  TIPOS_SOLICITACAO
} from '../../services/fornecedores/modeloFornecedores';

import {
  destinatarioPedido,
  emailValido
} from '../../services/fornecedores/pedidoDocumentos';

import {
  CampoContato
} from './ListaFornecedoresView';

import {
  pontosDeAtencao
} from '../../services/fornecedores/homologacao';

import {
  formatarCnpj,
  normalizarCnpj
} from '../../utils/cnpj';

import {
  Aviso,
  COR,
  CampoMotivo,
  Modal,
  Selo,
  ajuda,
  botao,
  campo,
  celula,
  celulaCabecalho,
  formatarDataHora,
  painel,
  rotulo
} from '../Kits/kitsComum';

// ============================================================
// FORNECEDORES — FICHA DE CADASTRO (SUP-CPL-01)
//
// Mostra o que o fornecedor respondeu no formulário (itens 1 a 8).
// Quadro societário (com CPF) e dados bancários ficam em colunas com
// segurança de campo: quem não está no perfil vê "protegido". Mesmo
// para quem pode ler, CPF e conta aparecem mascarados até clicar em
// "Mostrar". O histórico nunca registra esses valores.
// ============================================================

const dataBr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

export const mascararCpfExibicao = (cpf: string): string => {
  const d = (cpf || '').replace(/\D/g, '');
  return d.length === 11 ? `***.${d.substring(3, 6)}.${d.substring(6, 9)}-**` : (d ? '***' : '—');
};

const mascararFinal = (valor: string): string => {
  const v = (valor || '').trim();
  return v.length <= 3 ? (v ? '***' : '—') : `${'•'.repeat(Math.min(8, v.length - 3))}${v.substring(v.length - 3)}`;
};

const formatarCpf = (cpf: string): string => {
  const d = (cpf || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.substring(0, 3)}.${d.substring(3, 6)}.${d.substring(6, 9)}-${d.substring(9)}` : d;
};

const Linha: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div style={{ display: 'flex', gap: '12px', padding: '7px 0', borderBottom: `1px solid ${COR.fundo}`, fontSize: '14px', flexWrap: 'wrap' }}>
    <div style={{ width: '220px', flexShrink: 0, color: COR.texto2 }}>{titulo}</div>
    <div style={{ flex: '1 1 240px', whiteSpace: 'pre-wrap' }}>{children || '—'}</div>
  </div>
);

const Bloco: React.FC<{ numero: string; titulo: string; acao?: React.ReactNode; children: React.ReactNode }> = ({ numero, titulo, acao, children }) => (
  <div style={{ ...painel, marginBottom: '12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color: COR.branco, background: COR.azul, borderRadius: '6px', padding: '2px 8px' }}>{numero}</span>
      <span style={{ fontSize: '14.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', flex: 1 }}>{titulo}</span>
      {acao}
    </div>
    {children}
  </div>
);

const contatoTexto = (c: IContatoFornecedor): string =>
  [c.nome, c.email, c.telefone].filter(Boolean).join(' · ');

// ------------------------------------------------------------
// Modais de edição
// ------------------------------------------------------------

const QuestionarioModal: React.FC<{
  fornecedor: IFornecedor;
  fechar: () => void;
  salvar: (respostas: Record<string, RespostaQuestionario>, motivo: string) => Promise<void>;
}> = ({ fornecedor, fechar, salvar }) => {
  const [respostas, setRespostas] = React.useState<Record<string, RespostaQuestionario>>({ ...fornecedor.questionario });
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await salvar(respostas, motivo);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo="Questionário de integridade"
      subtitulo="Corrija apenas com base em informação do próprio fornecedor (ex.: e-mail de retificação)."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={820}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando || !motivo.trim())} disabled={gravando || !motivo.trim()} onClick={() => { confirmar().catch(() => undefined); }}>
            {gravando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      {QUESTOES_INTEGRIDADE.map(q => (
        <div key={q.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${COR.fundo}`, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px', fontSize: '13.5px' }}><strong>{q.id}</strong> {q.texto}</div>
          <select aria-label={`Resposta ${q.id}`} style={{ ...campo, width: '200px' }} value={respostas[q.id] || ''}
            onChange={e => setRespostas(r => ({ ...r, [q.id]: e.target.value as RespostaQuestionario }))}>
            {RESPOSTAS_QUESTIONARIO.map(r => <option key={r} value={r}>{r || 'Sem resposta'}</option>)}
          </select>
        </div>
      ))}
      <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={gravando} />
    </Modal>
  );
};

const socioVazio = (): ISocio => ({ nome: '', cargo: '', cpf: '', participacao: '' });

const QuadroModal: React.FC<{
  quadro?: IQuadroSocietario;
  fechar: () => void;
  salvar: (quadro: IQuadroSocietario, motivo: string) => Promise<void>;
}> = ({ quadro, fechar, salvar }) => {
  const [q, setQ] = React.useState<IQuadroSocietario>(quadro
    ? { ...quadro, socios: quadro.socios.length ? quadro.socios.map(s => ({ ...s })) : [socioVazio()] }
    : { socios: [socioVazio()], participaOutras: '', outrasSociedades: '', grupoEconomico: '', grupoEconomicoDetalhe: '' });
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const mudarSocio = (i: number, parcial: Partial<ISocio>): void =>
    setQ(atual => ({ ...atual, socios: atual.socios.map((s, j) => (j === i ? { ...s, ...parcial } : s)) }));

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await salvar(q, motivo);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo="Quadro societário e administradores"
      subtitulo="Coluna protegida (perfil de segurança de campo). O histórico registra só que houve alteração, sem os valores."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={860}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando || !motivo.trim())} disabled={gravando || !motivo.trim()} onClick={() => { confirmar().catch(() => undefined); }}>
            {gravando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      {q.socios.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
          <input aria-label="Nome completo" placeholder="Nome completo" style={{ ...campo, flex: '3 1 200px', width: 'auto' }} value={s.nome} onChange={e => mudarSocio(i, { nome: e.target.value })} />
          <input aria-label="Cargo / qualificação" placeholder="Cargo / qualificação" style={{ ...campo, flex: '2 1 150px', width: 'auto' }} value={s.cargo} onChange={e => mudarSocio(i, { cargo: e.target.value })} />
          <input aria-label="CPF" placeholder="CPF" autoComplete="off" style={{ ...campo, flex: '1 1 130px', width: 'auto' }} value={s.cpf} onChange={e => mudarSocio(i, { cpf: e.target.value.replace(/[^\d.-]/g, '') })} />
          <input aria-label="% participação" placeholder="% part." style={{ ...campo, flex: '0 1 90px', width: 'auto' }} value={s.participacao} onChange={e => mudarSocio(i, { participacao: e.target.value })} />
          <button type="button" style={botao('discreto')} aria-label="Remover linha" onClick={() => setQ(a => ({ ...a, socios: a.socios.filter((_, j) => j !== i) }))}>✕</button>
        </div>
      ))}
      <button type="button" style={botao('secundario')} onClick={() => setQ(a => ({ ...a, socios: a.socios.concat([socioVazio()]) }))}>+ Sócio / administrador</button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px 14px', marginTop: '14px' }}>
        <div>
          <label style={rotulo} htmlFor="qs-outras">Participam de outras sociedades?</label>
          <select id="qs-outras" style={campo} value={q.participaOutras} onChange={e => setQ(a => ({ ...a, participaOutras: e.target.value as IQuadroSocietario['participaOutras'] }))}>
            <option value="">Não informado</option><option value="Sim">Sim</option><option value="Não">Não</option>
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="qs-grupo">Integra grupo econômico?</label>
          <select id="qs-grupo" style={campo} value={q.grupoEconomico} onChange={e => setQ(a => ({ ...a, grupoEconomico: e.target.value as IQuadroSocietario['grupoEconomico'] }))}>
            <option value="">Não informado</option><option value="Sim">Sim</option><option value="Não">Não</option>
          </select>
        </div>
      </div>
      <label style={rotulo} htmlFor="qs-outras-det">Outras sociedades (empresa, CNPJ e participação)</label>
      <textarea id="qs-outras-det" style={{ ...campo, resize: 'vertical' }} rows={2} value={q.outrasSociedades} onChange={e => setQ(a => ({ ...a, outrasSociedades: e.target.value }))} />
      <label style={rotulo} htmlFor="qs-grupo-det">Controladora / coligadas</label>
      <textarea id="qs-grupo-det" style={{ ...campo, resize: 'vertical' }} rows={2} value={q.grupoEconomicoDetalhe} onChange={e => setQ(a => ({ ...a, grupoEconomicoDetalhe: e.target.value }))} />
      <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={gravando} />
    </Modal>
  );
};

const BancarioModal: React.FC<{
  dados?: IDadosBancarios;
  fechar: () => void;
  salvar: (dados: IDadosBancarios, motivo: string) => Promise<void>;
}> = ({ dados, fechar, salvar }) => {
  const [d, setD] = React.useState<IDadosBancarios>(dados
    ? { ...dados }
    : { banco: '', agencia: '', conta: '', tipoChavePix: '', chavePix: '', titular: '', cnpjTitular: '' });
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const mudar = (parcial: Partial<IDadosBancarios>): void => setD(a => ({ ...a, ...parcial }));

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await salvar(d, motivo);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  const campos: Array<{ chave: keyof IDadosBancarios; rotulo: string }> = [
    { chave: 'banco', rotulo: 'Banco (nome e código)' },
    { chave: 'agencia', rotulo: 'Agência' },
    { chave: 'conta', rotulo: 'Conta corrente (com dígito)' },
    { chave: 'tipoChavePix', rotulo: 'Tipo de chave Pix' },
    { chave: 'chavePix', rotulo: 'Chave Pix' },
    { chave: 'titular', rotulo: 'Titular da conta' },
    { chave: 'cnpjTitular', rotulo: 'CNPJ do titular' }
  ];

  return (
    <Modal
      titulo="Dados bancários para pagamento"
      subtitulo="Só com solicitação formal assinada pelo representante legal e comprovante bancário. Depois de salvar, a conferência volta para pendente até a confirmação por telefone."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={700}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando || !motivo.trim())} disabled={gravando || !motivo.trim()} onClick={() => { confirmar().catch(() => undefined); }}>
            {gravando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 14px' }}>
        {campos.map(c => (
          <div key={c.chave}>
            <label style={rotulo} htmlFor={`bc-${c.chave}`}>{c.rotulo}</label>
            <input id={`bc-${c.chave}`} autoComplete="off" style={campo} value={d[c.chave]} onChange={e => mudar({ [c.chave]: e.target.value } as Partial<IDadosBancarios>)} />
          </div>
        ))}
      </div>
      <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={gravando} />
    </Modal>
  );
};

// Administrador do módulo: corrige os dados da ficha (itens 0, 1, 2, 4,
// 6 e 8). Grava pelo atualizarFornecedor: antes → depois no histórico.
const opcoesCom = (lista: string[], atual: string): string[] =>
  atual && lista.indexOf(atual) < 0 ? lista.concat([atual]) : lista;

const DadosFichaModal: React.FC<{
  fornecedor: IFornecedor;
  fechar: () => void;
  salvar: (novo: IFornecedor, motivo: string) => Promise<void>;
}> = ({ fornecedor, fechar, salvar }) => {
  const decInicial: IDeclaracoesFicha = fornecedor.declaracoes
    ? { ...fornecedor.declaracoes }
    : { aceitas: false, representante: '', cargo: '', local: '', data: '' };
  const [f, setF] = React.useState<IFornecedor>({ ...fornecedor });
  const [dec, setDec] = React.useState<IDeclaracoesFicha>(decInicial);
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const mudar = (parcial: Partial<IFornecedor>): void => setF(a => ({ ...a, ...parcial }));
  const mudarDec = (parcial: Partial<IDeclaracoesFicha>): void => setDec(a => ({ ...a, ...parcial }));

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      const decMudou = JSON.stringify(dec) !== JSON.stringify(decInicial);
      await salvar({ ...f, declaracoes: decMudou ? dec : fornecedor.declaracoes }, motivo);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  const grade: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 14px' };
  const secao = (titulo: string): React.ReactNode => (
    <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', margin: '16px 0 6px', color: COR.texto2 }}>{titulo}</div>
  );

  return (
    <Modal
      titulo="Editar dados da ficha"
      subtitulo="Administrador do módulo. Cada campo alterado fica no histórico (antes → depois) com o motivo."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={820}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando || !motivo.trim())} disabled={gravando || !motivo.trim()} onClick={() => { confirmar().catch(() => undefined); }}>
            {gravando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      {secao('0 · Solicitação')}
      <div style={grade}>
        <div>
          <label style={rotulo} htmlFor="fd-solicitacao">Tipo de solicitação</label>
          <select id="fd-solicitacao" style={campo} value={f.tipoSolicitacao} onChange={e => mudar({ tipoSolicitacao: e.target.value })}>
            {opcoesCom([''].concat(TIPOS_SOLICITACAO), f.tipoSolicitacao).map(t => <option key={t} value={t}>{t || 'Não informado'}</option>)}
          </select>
        </div>
      </div>

      {secao('1 · Dados cadastrais declarados')}
      <div style={grade}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={rotulo} htmlFor="fd-catficha">Categoria de fornecimento</label>
          <input id="fd-catficha" style={campo} value={f.categoriaFornecimento} onChange={e => mudar({ categoriaFornecimento: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-porte">Porte declarado</label>
          <select id="fd-porte" style={campo} value={f.porteDeclarado} onChange={e => mudar({ porteDeclarado: e.target.value })}>
            {opcoesCom(PORTES_FICHA, f.porteDeclarado).map(p => <option key={p} value={p}>{p || 'Não informado'}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-telefone">Telefone geral</label>
          <input id="fd-telefone" style={campo} value={f.telefone} onChange={e => mudar({ telefone: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-site">Site</label>
          <input id="fd-site" style={campo} value={f.site} onChange={e => mudar({ site: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-emailnf">E-mail para pedidos / NF</label>
          <input id="fd-emailnf" style={campo} value={f.emailPedidos} onChange={e => mudar({ emailPedidos: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-cep">CEP</label>
          <input id="fd-cep" style={campo} maxLength={9} value={f.cep} onChange={e => mudar({ cep: e.target.value })} />
        </div>
      </div>
      <label style={rotulo} htmlFor="fd-descricao">Produtos e/ou serviços fornecidos</label>
      <textarea id="fd-descricao" style={{ ...campo, resize: 'vertical' }} rows={2} value={f.descricaoFornecimento} onChange={e => mudar({ descricaoFornecimento: e.target.value })} />

      {secao('2 · Contatos principais')}
      <CampoContato titulo="Contato comercial" valor={f.contatoComercial} aoMudar={c => mudar({ contatoComercial: c })} />
      <CampoContato titulo="Contato fiscal / contábil" valor={f.contatoFiscal} aoMudar={c => mudar({ contatoFiscal: c })} />
      <CampoContato titulo="Contato financeiro / faturamento" valor={f.contatoFinanceiro} aoMudar={c => mudar({ contatoFinanceiro: c })} />
      <CampoContato titulo="Contato integridade / compliance" valor={f.contatoIntegridade} aoMudar={c => mudar({ contatoIntegridade: c })} />

      {secao('4 · Enquadramento tributário')}
      <div style={grade}>
        <div>
          <label style={rotulo} htmlFor="fd-regime">Regime tributário</label>
          <select id="fd-regime" style={campo} value={f.regimeTributario} onChange={e => mudar({ regimeTributario: e.target.value })}>
            {opcoesCom(REGIMES_TRIBUTARIOS, f.regimeTributario).map(r => <option key={r} value={r}>{r || 'Não informado'}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-faixa">Faixa de faturamento (Simples)</label>
          <select id="fd-faixa" style={campo} value={f.faixaFaturamento} onChange={e => mudar({ faixaFaturamento: e.target.value })}>
            {opcoesCom(FAIXAS_FATURAMENTO_SIMPLES, f.faixaFaturamento).map(p => <option key={p} value={p}>{p || 'Não se aplica'}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-anexo">Anexo do Simples</label>
          <select id="fd-anexo" style={campo} value={f.anexoSimples} onChange={e => mudar({ anexoSimples: e.target.value })}>
            {opcoesCom(ANEXOS_SIMPLES, f.anexoSimples).map(p => <option key={p} value={p}>{p || 'Não se aplica'}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-mudanca">Mudança de regime prevista</label>
          <select id="fd-mudanca" style={campo} value={f.previsaoMudancaRegime} onChange={e => mudar({ previsaoMudancaRegime: e.target.value })}>
            {opcoesCom(PREVISOES_MUDANCA_REGIME, f.previsaoMudancaRegime).map(p => <option key={p} value={p}>{p || 'Não informado'}</option>)}
          </select>
        </div>
      </div>

      {secao('6 · Integridade (textos)')}
      <label style={rotulo} htmlFor="fd-cert">Certificações (ISO, Pró-Ética, outras)</label>
      <textarea id="fd-cert" style={{ ...campo, resize: 'vertical' }} rows={2} value={f.certificacoes} onChange={e => mudar({ certificacoes: e.target.value })} />
      <label style={rotulo} htmlFor="fd-detalhe">Detalhamento das respostas positivas</label>
      <textarea id="fd-detalhe" style={{ ...campo, resize: 'vertical' }} rows={2} value={f.detalhamentoPositivas} onChange={e => mudar({ detalhamentoPositivas: e.target.value })} />
      <div style={ajuda}>As respostas do questionário e o quadro societário têm o próprio botão Editar.</div>

      {secao('8 · Declarações e compromissos')}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', marginBottom: '8px' }}>
        <input type="checkbox" checked={dec.aceitas} onChange={e => mudarDec({ aceitas: e.target.checked })} />
        Declarações aceitas
      </label>
      <div style={grade}>
        <div>
          <label style={rotulo} htmlFor="fd-rep">Representante legal</label>
          <input id="fd-rep" style={campo} value={dec.representante} onChange={e => mudarDec({ representante: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-cargo">Cargo</label>
          <input id="fd-cargo" style={campo} value={dec.cargo} onChange={e => mudarDec({ cargo: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-local">Local</label>
          <input id="fd-local" style={campo} value={dec.local} onChange={e => mudarDec({ local: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="fd-data">Data</label>
          <input id="fd-data" type="date" style={campo} value={dec.data} onChange={e => mudarDec({ data: e.target.value })} />
        </div>
      </div>

      <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={gravando} />
    </Modal>
  );
};

// Administrador do módulo: novo pedido de documentos por e-mail (o
// primeiro pedido é o do Fluxo 1, quando a ficha chega).
const SolicitarDocumentosModal: React.FC<{
  fornecedor: IFornecedor;
  pendentes?: string[];
  fechar: () => void;
  enviar: (documentos: string[], observacao: string) => Promise<void>;
}> = ({ fornecedor, pendentes, fechar, enviar }) => {
  const lista = pendentes || [];
  const [marcados, setMarcados] = React.useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    lista.forEach(d => { m[d] = true; });
    return m;
  });
  const [outros, setOutros] = React.useState('');
  const destinatario = destinatarioPedido(fornecedor);
  const [observacao, setObservacao] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const documentos = lista.filter(d => marcados[d])
    .concat(outros.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
  const pode = !gravando && documentos.length > 0 && emailValido(destinatario) && !!fornecedor.protocolo;

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await enviar(documentos, observacao);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo="Solicitar documentos por e-mail"
      subtitulo={`Sai de ${EMAIL_DOCUMENTOS_FORNECEDORES} com o protocolo no assunto; a resposta com os anexos entra sozinha como "A conferir".`}
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={700}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', !pode)} disabled={!pode} onClick={() => { confirmar().catch(() => undefined); }}>
            {gravando ? 'Enviando…' : 'Enviar pedido'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      {!fornecedor.protocolo && <Aviso tipo="alerta">Fornecedor sem protocolo: a resposta não teria como ser vinculada a ele.</Aviso>}

      <Linha titulo="De">{EMAIL_DOCUMENTOS_FORNECEDORES}</Linha>
      <Linha titulo="Para (E-mail para pedidos / NF)">{destinatario}</Linha>
      {!emailValido(destinatario) && (
        <Aviso tipo="alerta">O &quot;E-mail para pedidos / NF&quot; da ficha está vazio ou inválido. Corrija em &quot;Editar dados da ficha&quot; antes de enviar.</Aviso>
      )}

      <div style={{ ...rotulo, marginTop: '12px' }}>Documentos pendentes</div>
      {pendentes === undefined && <div style={ajuda}>Carregando a situação dos documentos…</div>}
      {pendentes !== undefined && lista.length === 0 && <div style={ajuda}>Nenhum documento pendente. Use o campo abaixo para pedir outro.</div>}
      {lista.map(d => (
        <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', padding: '3px 0' }}>
          <input type="checkbox" checked={!!marcados[d]} onChange={e => setMarcados(m => ({ ...m, [d]: e.target.checked }))} />
          {d}
        </label>
      ))}

      <label style={rotulo} htmlFor="sd-outros">Outros documentos (um por linha)</label>
      <textarea id="sd-outros" style={{ ...campo, resize: 'vertical' }} rows={2} value={outros} onChange={e => setOutros(e.target.value)} />

      <label style={rotulo} htmlFor="sd-obs">Mensagem adicional (opcional)</label>
      <textarea id="sd-obs" style={{ ...campo, resize: 'vertical' }} rows={2} value={observacao} onChange={e => setObservacao(e.target.value)} />
      <div style={ajuda}>Não escreva CNPJ, CPF ou dados bancários: o e-mail e o histórico não aceitam.</div>
    </Modal>
  );
};

// ------------------------------------------------------------
// Ficha
// ------------------------------------------------------------

const FichaFornecedorView: React.FC<{
  servico: FornecedoresService;
  fornecedor: IFornecedor;
  usuarioNome: string;
  administra: boolean;
  // Documentos manuais pendentes (undefined = ainda carregando).
  documentosPendentes?: string[];
  aoAlterar: (aviso?: string) => Promise<void>;
}> = ({ servico, fornecedor, usuarioNome, administra, documentosPendentes, aoAlterar }) => {

  const [editar, setEditar] = React.useState<'' | 'questionario' | 'quadro' | 'bancario' | 'dados' | 'pedido'>('');
  const [mostrarCpf, setMostrarCpf] = React.useState(false);
  const [mostrarConta, setMostrarConta] = React.useState(false);

  const f = fornecedor;
  const pontos = pontosDeAtencao(f.questionario);
  const atencao: Record<string, boolean> = {};
  pontos.forEach(p => { atencao[p.id] = true; });

  const banco = f.dadosBancarios;
  const titularConfere = !!banco && !!banco.cnpjTitular && !!f.cnpj && normalizarCnpj(banco.cnpjTitular) === normalizarCnpj(f.cnpj);

  return (
    <div>
      {administra && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: '10px' }}>
          <button type="button" style={botao('secundario')} onClick={() => setEditar('dados')}>Editar dados da ficha</button>
          <button type="button" style={botao('principal')} onClick={() => setEditar('pedido')}>Solicitar documentos</button>
        </div>
      )}

      {!f.fichaRecebidaEm && (
        <Aviso tipo="info">
          Ficha ainda não recebida pelo formulário. Quando o fornecedor responder, os dados aparecem aqui e ele recebe
          {f.protocolo ? ` o protocolo ${f.protocolo}` : ' um protocolo'} com a lista de documentos para enviar a {EMAIL_DOCUMENTOS_FORNECEDORES}.
        </Aviso>
      )}

      <Bloco numero="0" titulo="Solicitação">
        <Linha titulo="Protocolo">{f.protocolo}</Linha>
        <Linha titulo="Tipo de solicitação">{f.tipoSolicitacao}</Linha>
        <Linha titulo="Ficha recebida em">{f.fichaRecebidaEm ? formatarDataHora(f.fichaRecebidaEm) : ''}</Linha>
        <Linha titulo="Origem do cadastro">{f.origem}</Linha>
        <Linha titulo="Documentos por e-mail">{`${EMAIL_DOCUMENTOS_FORNECEDORES} (assunto com o protocolo)`}</Linha>
      </Bloco>

      <Bloco numero="1" titulo="Dados cadastrais declarados">
        <Linha titulo="Categoria de fornecimento">{f.categoriaFornecimento}</Linha>
        <Linha titulo="Produtos / serviços">{f.descricaoFornecimento}</Linha>
        <Linha titulo="Porte declarado">
          {f.porteDeclarado}{f.porteDeclarado && f.porte ? ` (Receita: ${f.porte})` : ''}
        </Linha>
        <Linha titulo="Telefone geral">{f.telefone}</Linha>
        <Linha titulo="Site">{f.site}</Linha>
        <Linha titulo="E-mail para pedidos / NF">{f.emailPedidos}</Linha>
        <Linha titulo="CEP">{f.cep}</Linha>
        <div style={ajuda}>Razão social, endereço, CNAE, natureza e inscrições estão na aba Dados. Para corrigir, use Editar na aba Dados.</div>
      </Bloco>

      <Bloco numero="2" titulo="Contatos principais">
        <Linha titulo="Comercial">{contatoTexto(f.contatoComercial)}</Linha>
        <Linha titulo="Fiscal / contábil">{contatoTexto(f.contatoFiscal)}</Linha>
        <Linha titulo="Financeiro / faturamento">{contatoTexto(f.contatoFinanceiro)}</Linha>
        <Linha titulo="Integridade / compliance">{contatoTexto(f.contatoIntegridade)}</Linha>
      </Bloco>

      <Bloco
        numero="3"
        titulo="Quadro societário e administradores"
        acao={(
          <>
            {f.quadroSocietario && f.quadroSocietario.socios.length > 0 && (
              <button type="button" style={botao('discreto')} onClick={() => setMostrarCpf(!mostrarCpf)}>{mostrarCpf ? 'Ocultar CPF' : 'Mostrar CPF'}</button>
            )}
            <button type="button" style={botao('secundario')} onClick={() => setEditar('quadro')}>Editar</button>
          </>
        )}
      >
        {!f.quadroSocietario
          ? <div style={ajuda}>Não informado, ou você não está no perfil “DGT - Fornecedores - Quadro societário”.</div>
          : (
            <>
              {f.quadroSocietario.socios.length > 0 && (
                <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px', marginBottom: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
                    <thead>
                      <tr>
                        <th style={celulaCabecalho}>Nome completo</th>
                        <th style={celulaCabecalho}>Cargo / qualificação</th>
                        <th style={celulaCabecalho}>CPF</th>
                        <th style={celulaCabecalho}>% participação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.quadroSocietario.socios.map((s, i) => (
                        <tr key={i}>
                          <td style={celula}>{s.nome}</td>
                          <td style={celula}>{s.cargo || '—'}</td>
                          <td style={celula}>{mostrarCpf ? formatarCpf(s.cpf) : mascararCpfExibicao(s.cpf)}</td>
                          <td style={celula}>{s.participacao || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Linha titulo="Participam de outras sociedades?">
                {[f.quadroSocietario.participaOutras, f.quadroSocietario.outrasSociedades].filter(Boolean).join(' — ')}
              </Linha>
              <Linha titulo="Integra grupo econômico?">
                {[f.quadroSocietario.grupoEconomico, f.quadroSocietario.grupoEconomicoDetalhe].filter(Boolean).join(' — ')}
              </Linha>
            </>
          )}
      </Bloco>

      <Bloco numero="4" titulo="Enquadramento tributário">
        <Linha titulo="Regime tributário">{f.regimeTributario}</Linha>
        <Linha titulo="Faixa de faturamento (Simples)">{f.faixaFaturamento}</Linha>
        <Linha titulo="Anexo do Simples">{f.anexoSimples}</Linha>
        <Linha titulo="Mudança de regime no próximo exercício">{f.previsaoMudancaRegime}</Linha>
      </Bloco>

      <Bloco
        numero="5"
        titulo="Dados bancários para pagamento"
        acao={(
          <>
            {banco && <button type="button" style={botao('discreto')} onClick={() => setMostrarConta(!mostrarConta)}>{mostrarConta ? 'Ocultar' : 'Mostrar'}</button>}
            <button type="button" style={botao('secundario')} onClick={() => setEditar('bancario')}>Editar</button>
          </>
        )}
      >
        {!banco
          ? <div style={ajuda}>Não informado, ou você não está no perfil “DGT - Fornecedores - Dados bancários”.</div>
          : (
            <>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                {titularConfere
                  ? <Selo tom="ciano">titular = CNPJ do cadastro</Selo>
                  : <Selo tom="indigo">! titular diferente do CNPJ cadastrado ou não informado</Selo>}
                {f.bancarioConferido
                  ? <Selo tom="ciano">✓ confirmado por telefone</Selo>
                  : <Selo tom="azul">confirmação telefônica pendente</Selo>}
              </div>
              <Linha titulo="Banco">{banco.banco}</Linha>
              <Linha titulo="Agência">{mostrarConta ? banco.agencia : mascararFinal(banco.agencia)}</Linha>
              <Linha titulo="Conta corrente">{mostrarConta ? banco.conta : mascararFinal(banco.conta)}</Linha>
              <Linha titulo="Chave Pix">{[banco.tipoChavePix, mostrarConta ? banco.chavePix : mascararFinal(banco.chavePix)].filter(Boolean).join(' · ')}</Linha>
              <Linha titulo="Titular">{banco.titular}</Linha>
              <Linha titulo="CNPJ do titular">{banco.cnpjTitular ? formatarCnpj(banco.cnpjTitular) : ''}</Linha>
              <div style={ajuda}>Pagamento só em conta do CNPJ cadastrado. A confirmação telefônica é marcada na aba Homologação.</div>
            </>
          )}
      </Bloco>

      <Bloco numero="6" titulo="Questionário de integridade e due diligence" acao={<button type="button" style={botao('secundario')} onClick={() => setEditar('questionario')}>Editar</button>}>
        {pontos.length > 0 && (
          <Aviso tipo="alerta">
            {pontos.length} resposta(s) para análise ({pontos.map(p => p.id).join(', ')}). Respostas positivas não implicam reprovação automática.
          </Aviso>
        )}
        {QUESTOES_INTEGRIDADE.map(q => {
          const resposta = f.questionario[q.id] || '';
          return (
            <div key={q.id} style={{ display: 'flex', gap: '10px', padding: '6px 0', borderBottom: `1px solid ${COR.fundo}`, fontSize: '13.5px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 380px' }}><strong>{q.id}</strong> {q.texto}</div>
              <div style={{ width: '190px' }}>
                {resposta
                  ? <Selo tom={atencao[q.id] ? 'indigo' : 'cinza'}>{atencao[q.id] ? `! ${resposta}` : resposta}</Selo>
                  : <span style={{ color: COR.texto2 }}>sem resposta</span>}
              </div>
            </div>
          );
        })}
        <Linha titulo="Certificações">{f.certificacoes}</Linha>
        <Linha titulo="Detalhamento das respostas positivas">{f.detalhamentoPositivas}</Linha>
      </Bloco>

      <Bloco numero="8" titulo="Declarações e compromissos">
        {!f.declaracoes
          ? <div style={ajuda}>Ainda não recebidas.</div>
          : (
            <>
              <div style={{ marginBottom: '6px' }}>
                {f.declaracoes.aceitas ? <Selo tom="ciano">✓ declarações aceitas no formulário</Selo> : <Selo tom="indigo">! declarações não aceitas</Selo>}
                {' '}
                <Selo tom={f.assinaturaStatus ? 'azul' : 'cinza'}>{f.assinaturaStatus || 'assinatura (Clicksign): aguardando integração'}</Selo>
              </div>
              <Linha titulo="Representante legal">{[f.declaracoes.representante, f.declaracoes.cargo].filter(Boolean).join(' — ')}</Linha>
              <Linha titulo="Local / data">{[f.declaracoes.local, f.declaracoes.data ? dataBr(f.declaracoes.data) : ''].filter(Boolean).join(' — ')}</Linha>
              <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '13px', lineHeight: 1.6, color: COR.texto2 }}>
                {DECLARACOES_FICHA.map(d => <li key={d.titulo}><strong>{d.titulo}.</strong> {d.texto}</li>)}
              </ul>
            </>
          )}
      </Bloco>

      {editar === 'questionario' && (
        <QuestionarioModal
          fornecedor={f}
          fechar={() => setEditar('')}
          salvar={async (respostas, motivo) => {
            await servico.salvarQuestionario(f, respostas, motivo, usuarioNome);
            setEditar('');
            await aoAlterar('Questionário atualizado.');
          }}
        />
      )}

      {editar === 'quadro' && (
        <QuadroModal
          quadro={f.quadroSocietario}
          fechar={() => setEditar('')}
          salvar={async (quadro, motivo) => {
            await servico.salvarQuadroSocietario(f, quadro, motivo, usuarioNome);
            setEditar('');
            await aoAlterar('Quadro societário atualizado.');
          }}
        />
      )}

      {editar === 'bancario' && (
        <BancarioModal
          dados={banco}
          fechar={() => setEditar('')}
          salvar={async (dados, motivo) => {
            await servico.salvarDadosBancarios(f, dados, motivo, usuarioNome);
            setEditar('');
            await aoAlterar('Dados bancários atualizados: confirme por telefone antes de pagar.');
          }}
        />
      )}

      {editar === 'dados' && administra && (
        <DadosFichaModal
          fornecedor={f}
          fechar={() => setEditar('')}
          salvar={async (novo, motivo) => {
            await servico.atualizarFornecedor(novo, f, motivo, usuarioNome);
            setEditar('');
            await aoAlterar('Dados da ficha atualizados (registrado no histórico).');
          }}
        />
      )}

      {editar === 'pedido' && administra && (
        <SolicitarDocumentosModal
          fornecedor={f}
          pendentes={documentosPendentes}
          fechar={() => setEditar('')}
          enviar={async (documentos, observacao) => {
            await servico.solicitarDocumentos(f, documentos, observacao, usuarioNome);
            setEditar('');
            await aoAlterar('Pedido de documentos colocado na fila de e-mails (registrado no histórico).');
          }}
        />
      )}
    </div>
  );
};

export default FichaFornecedorView;
