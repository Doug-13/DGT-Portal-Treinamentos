import * as React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import FluxoTreinamentoEtapas from '../../components/common/FluxoTreinamentoEtapas';
import { ITreinamentoAdmin } from '../../services/TreinamentoAdminService';
import {
  IAlternativaAdmin,
  IAvaliacaoAdmin,
  IEditarAlternativa,
  IEditarAvaliacao,
  IEditarQuestao,
  INovaAlternativa,
  INovaAvaliacao,
  INovaQuestao,
  INovaQuestaoCompleta,
  IQuestaoAdmin,
  TipoQuestaoCriacao
} from '../../services/AvaliacaoAdminService';

export interface IGestaoAvaliacoesPageProps {
  treinamentos: ITreinamentoAdmin[];
  treinamentoId: string;
  avaliacaoSelecionada?: IAvaliacaoAdmin;
  questaoSelecionada?: IQuestaoAdmin;
  avaliacoes: IAvaliacaoAdmin[];
  questoes: IQuestaoAdmin[];
  alternativas: IAlternativaAdmin[];
  carregando: boolean;
  processando: boolean;
  erro: string;
  onVoltar: () => void;
  onSelecionarTreinamento: (id: string) => Promise<void>;
  onSelecionarAvaliacao: (item: IAvaliacaoAdmin) => Promise<void>;
  onSelecionarQuestao: (item: IQuestaoAdmin) => Promise<void>;
  onCriarAvaliacao: (dados: INovaAvaliacao) => Promise<void>;
  onEditarAvaliacao: (dados: IEditarAvaliacao) => Promise<void>;
  onDefinirAvaliacaoAtiva: (id: string, ativa: boolean) => Promise<void>;
  onCriarQuestao: (dados: INovaQuestao) => Promise<void>;
  onCriarQuestaoCompleta: (dados: INovaQuestaoCompleta) => Promise<void>;
  onEditarQuestao: (dados: IEditarQuestao) => Promise<void>;
  onDefinirQuestaoAtiva: (id: string, ativa: boolean) => Promise<void>;
  onCriarAlternativa: (dados: INovaAlternativa) => Promise<void>;
  onEditarAlternativa: (dados: IEditarAlternativa) => Promise<void>;
  onDefinirAlternativaAtiva: (id: string, ativa: boolean) => Promise<void>;
  modoFluxo?: boolean;
  onConcluir?:
    () => Promise<void>;

  onImportarJson:
    (
      arquivo:
        File
    ) => Promise<string>;

  onEtapaClick?:
    (
      etapa:
        1 | 2 | 3
    ) => void;
}

interface IRespostaRascunho {
  texto: string;
  correta: boolean;
}

const C = {
  azul: '#0B5CAB',
  azulEscuro: '#0B2D4D',
  branco: '#FFFFFF',
  texto: '#18324A',
  secundario: '#64748B',
  borda: '#D8E2EC',
  verde: '#13795B',
  verdeClaro: '#E7F5EE',
  vermelho: '#B42318',
  vermelhoClaro: '#FDE7E9'
};

const card: React.CSSProperties = {
  padding: '18px', background: C.branco, border: `1px solid ${C.borda}`,
  borderRadius: '14px'
};
const btn: React.CSSProperties = {
  padding: '9px 13px', border: `1px solid ${C.azul}`, background: C.branco,
  color: C.azul, borderRadius: '8px', cursor: 'pointer', fontWeight: 700
};
const btnPrimary: React.CSSProperties = { ...btn, background: C.azul, color: C.branco };
const btnDanger: React.CSSProperties = { ...btn, border: `1px solid ${C.vermelho}`, color: C.vermelho };
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  border: `1px solid ${C.borda}`, borderRadius: '8px', color: C.texto, background: C.branco
};

const tipos: Array<{ tipo: TipoQuestaoCriacao; titulo: string; descricao: string }> = [
  { tipo: 'Escolha única', titulo: '◉ Escolha única', descricao: 'Uma resposta correta entre várias opções.' },
  { tipo: 'Múltipla escolha', titulo: '☑ Múltipla escolha', descricao: 'Permite duas ou mais respostas corretas.' },
  { tipo: 'Verdadeiro/Falso', titulo: 'V/F Verdadeiro ou falso', descricao: 'Duas opções fixas para resposta rápida.' },
  { tipo: 'Sim/Não', titulo: 'S/N Sim ou não', descricao: 'Duas opções fixas: Sim e Não.' }
];

const respostasIniciais = (tipo: TipoQuestaoCriacao): IRespostaRascunho[] => {
  if (tipo === 'Verdadeiro/Falso') {
    return [{ texto: 'Verdadeiro', correta: true }, { texto: 'Falso', correta: false }];
  }
  if (tipo === 'Sim/Não') {
    return [{ texto: 'Sim', correta: true }, { texto: 'Não', correta: false }];
  }
  return [{ texto: '', correta: true }, { texto: '', correta: false }];
};

const GestaoAvaliacoesPage: React.FC<IGestaoAvaliacoesPageProps> = (props) => {
  const inputJsonRef =
    React.useRef<HTMLInputElement>(
      null
    );

  const [
    importandoJson,
    setImportandoJson
  ] =
    React.useState(false);

  const [
    mensagemImportacao,
    setMensagemImportacao
  ] =
    React.useState('');

  const [
    erroImportacao,
    setErroImportacao
  ] =
    React.useState('');

  const [
    concluindoFluxo,
    setConcluindoFluxo
  ] =
    React.useState(false);

  const [
    erroConclusao,
    setErroConclusao
  ] =
    React.useState('');

  const treinamento = React.useMemo(
    () => props.treinamentos.find(item => item.id === props.treinamentoId),
    [props.treinamentoId, props.treinamentos]
  );

  const [modalAvaliacao, setModalAvaliacao] = React.useState(false);
  const [nomeAvaliacao, setNomeAvaliacao] = React.useState('Avaliação final');
  const [nota, setNota] = React.useState('70');
  const [quantidade, setQuantidade] = React.useState('10');
  const [tentativas, setTentativas] = React.useState('3');

  const [modalQuestao, setModalQuestao] = React.useState(false);
  const [tipoQuestao, setTipoQuestao] = React.useState<TipoQuestaoCriacao>('Escolha única');
  const [enunciado, setEnunciado] = React.useState('');
  const [peso, setPeso] = React.useState('1');
  const [respostas, setRespostas] = React.useState<IRespostaRascunho[]>(respostasIniciais('Escolha única'));
  const [erroModal, setErroModal] = React.useState('');

  const abrirAvaliacao = (): void => {
    if (!props.treinamentoId) { return; }
    setNomeAvaliacao('Avaliação final');
    setNota(String(treinamento?.notaMinima || 70));
    setQuantidade('10');
    setTentativas('3');
    setErroModal('');
    setModalAvaliacao(true);
  };

  const salvarAvaliacao = async (): Promise<void> => {
    setErroModal('');
    const n = Number(nota); const q = Number(quantidade); const t = Number(tentativas);
    if (!nomeAvaliacao.trim()) { setErroModal('Informe o nome da avaliação.'); return; }
    if (n < 0 || n > 100) { setErroModal('Nota mínima deve estar entre 0 e 100.'); return; }
    if (q <= 0 || t <= 0) { setErroModal('Quantidade de questões e tentativas devem ser maiores que zero.'); return; }
    try {
      await props.onCriarAvaliacao({
        treinamentoId: props.treinamentoId, nome: nomeAvaliacao.trim(), descricao: '',
        notaMinima: n, quantidadeQuestoes: q, tentativasPermitidas: t, tempoLimiteMin: 0,
        sortearQuestoes: true, embaralharQuestoes: true, embaralharAlternativas: true,
        mostrarResultado: true, mostrarRespostasCorretas: false, ativa: true
      });
      setModalAvaliacao(false);
    } catch (e) { setErroModal(e instanceof Error ? e.message : 'Erro ao criar avaliação.'); }
  };

  const abrirQuestao = (): void => {
    if (!props.avaliacaoSelecionada) { return; }
    setTipoQuestao('Escolha única'); setEnunciado(''); setPeso('1');
    setRespostas(respostasIniciais('Escolha única')); setErroModal(''); setModalQuestao(true);
  };

  const trocarTipo = (novoTipo: TipoQuestaoCriacao): void => {
    setTipoQuestao(novoTipo); setRespostas(respostasIniciais(novoTipo));
  };

  const marcarCorreta = (indice: number): void => {
    setRespostas(lista => lista.map((item, i) => {
      if (tipoQuestao === 'Múltipla escolha') {
        return i === indice ? { ...item, correta: !item.correta } : item;
      }
      return { ...item, correta: i === indice };
    }));
  };

  const salvarQuestao = async (): Promise<void> => {
    setErroModal('');
    if (!props.avaliacaoSelecionada) { return; }
    if (!enunciado.trim()) { setErroModal('Informe a pergunta.'); return; }
    const p = Number(peso);
    if (!Number.isFinite(p) || p <= 0) { setErroModal('Informe um peso válido.'); return; }
    const validas = respostas.filter(item => item.texto.trim());
    if (validas.length < 2) { setErroModal('Cadastre pelo menos duas respostas.'); return; }
    const corretas = validas.filter(item => item.correta).length;
    if (corretas === 0) { setErroModal('Marque pelo menos uma resposta correta.'); return; }
    if (tipoQuestao !== 'Múltipla escolha' && corretas !== 1) {
      setErroModal('Este tipo deve possuir exatamente uma resposta correta.'); return;
    }
    try {
      await props.onCriarQuestaoCompleta({
        avaliacaoId: props.avaliacaoSelecionada.id,
        enunciado: enunciado.trim(), ordem: props.questoes.length + 1, peso: p,
        tipo: tipoQuestao, alternativas: validas
      });
      setModalQuestao(false);
    } catch (e) { setErroModal(e instanceof Error ? e.message : 'Erro ao criar questão.'); }
  };

  return (
    <section>
      <PageHeader
        titulo={props.modoFluxo ? 'Avaliação do treinamento' : 'Gestão de avaliações'}
        subtitulo={props.modoFluxo
          ? 'Etapa 3 de 3 — configure a prova, crie questões e conclua o cadastro.'
          : 'Configure avaliações e crie questões completas de forma simples.'}
      />

      {
        props.modoFluxo &&
        (
          <FluxoTreinamentoEtapas
            etapa={3}
            permitirNavegacao={
              true
            }
            onEtapaClick={
              props.onEtapaClick
            }
          />
        )
      }

      <input
        ref={inputJsonRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={event => {
          const arquivo =
            event.target.files &&
            event.target.files[0];

          if (!arquivo) { return; }

          setImportandoJson(true);
          setMensagemImportacao('');
          setErroImportacao('');

          void props.onImportarJson(arquivo)
            .then(mensagem => {
              setMensagemImportacao(mensagem);
              return props.onSelecionarTreinamento(props.treinamentoId);
            })
            .catch((error: unknown) => {
              setErroImportacao(
                error instanceof Error
                  ? error.message
                  : 'Erro ao importar prova por JSON.'
              );
            })
            .then(() => {
              setImportandoJson(false);
              if (inputJsonRef.current) {
                inputJsonRef.current.value = '';
              }
            });
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <button type="button" onClick={props.onVoltar} style={btn}>
          {props.modoFluxo ? '← Voltar aos módulos' : 'Voltar'}
        </button>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!props.treinamentoId || importandoJson}
            onClick={() => inputJsonRef.current?.click()}
            style={{
              ...btn,
              opacity: !props.treinamentoId || importandoJson ? .55 : 1
            }}
          >
            {importandoJson ? 'Importando JSON...' : '⬆ Importar prova por JSON'}
          </button>

          <button type="button" onClick={abrirAvaliacao} style={btnPrimary}>
            + Nova avaliação
          </button>
        </div>
      </div>

      {mensagemImportacao && (
        <div style={{ ...card, marginBottom: '16px', background: C.verdeClaro, color: C.verde }}>
          {mensagemImportacao}
        </div>
      )}

      {erroImportacao && (
        <div style={{ ...card, marginBottom: '16px', background: C.vermelhoClaro, color: C.vermelho }}>
          {erroImportacao}
        </div>
      )}

      {props.erro && <div style={{ ...card, marginBottom: '16px', background: C.vermelhoClaro, color: C.vermelho }}>{props.erro}</div>}

      {props.modoFluxo ? (
        <div style={{ ...card, marginBottom: '18px', background: '#F8FAFC' }}>
          <span style={{ color: C.secundario, fontSize: '12px' }}>Treinamento em configuração</span>
          <strong style={{ display: 'block', marginTop: '4px', color: C.azulEscuro }}>
            {treinamento ? `${treinamento.codigo} - ${treinamento.nome}` : 'Treinamento selecionado'}
          </strong>
        </div>
      ) : (
        <div style={{ ...card, marginBottom: '18px' }}>
          <label>Treinamento</label>
          <select value={props.treinamentoId} style={{ ...input, marginTop: '8px' }}
            onChange={e => props.onSelecionarTreinamento(e.target.value).catch(console.error)}>
            <option value="">Selecione</option>
            {props.treinamentos.map(item => <option key={item.id} value={item.id}>{item.codigo} - {item.nome}</option>)}
          </select>
        </div>
      )}

      {props.carregando ? <div style={card}>Carregando...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px,.8fr) minmax(420px,1.5fr) minmax(300px,1fr)', gap: '16px', alignItems: 'start' }}>
          <div style={card}>
            <h3>Avaliações</h3>
            {props.avaliacoes.length === 0 && <p style={{ color: C.secundario }}>Nenhuma avaliação cadastrada.</p>}
            {props.avaliacoes.map(av => (
              <div key={av.id} style={{ padding: '10px 0', borderBottom: '1px solid #EDF0F4' }}>
                <button type="button" style={{ ...btn, width: '100%', textAlign: 'left', background: props.avaliacaoSelecionada?.id === av.id ? '#EEF6FF' : C.branco }}
                  onClick={() => props.onSelecionarAvaliacao(av).catch(console.error)}>{av.nome}</button>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '7px', fontSize: '12px', color: C.secundario }}>
                  <span>Nota: {av.notaMinima}%</span><span>{av.quantidadeQuestoes} questões</span>
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div><h3 style={{ marginBottom: '3px' }}>Questões</h3><small style={{ color: C.secundario }}>Pergunta e respostas na mesma tela.</small></div>
              <button type="button" disabled={!props.avaliacaoSelecionada} onClick={abrirQuestao}
                style={{ ...btnPrimary, opacity: props.avaliacaoSelecionada ? 1 : .5 }}>+ Nova questão</button>
            </div>
            {props.avaliacaoSelecionada && props.questoes.length === 0 && <p style={{ color: C.secundario, marginTop: '18px' }}>Nenhuma questão cadastrada.</p>}
            {props.questoes.map(q => (
              <div key={q.id} style={{ marginTop: '12px', padding: '13px', border: props.questaoSelecionada?.id === q.id ? `2px solid ${C.azul}` : `1px solid ${C.borda}`, borderRadius: '10px' }}>
                <button type="button" onClick={() => props.onSelecionarQuestao(q).catch(console.error)}
                  style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: C.texto }}>
                  <strong>{q.ordem}.</strong> {q.enunciado}
                </button>
                <div style={{ display: 'flex', gap: '8px', marginTop: '9px', alignItems: 'center' }}>
                  <span style={{ padding: '3px 7px', borderRadius: '999px', background: '#EEF4F8', fontSize: '11px', fontWeight: 700 }}>
                    {q.multiplasRespostas ? 'Múltipla escolha' : 'Escolha única'}
                  </span>
                  <span style={{ color: C.secundario, fontSize: '12px' }}>Peso {q.peso}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            <h3>Respostas</h3>
            {!props.questaoSelecionada && <p style={{ color: C.secundario }}>Selecione uma questão.</p>}
            {props.alternativas.map(a => (
              <div key={a.id} style={{ marginTop: '9px', padding: '11px', border: `1px solid ${a.correta ? '#A7D7C5' : C.borda}`, borderRadius: '9px', background: a.correta ? C.verdeClaro : C.branco }}>
                <strong>{a.ordem}.</strong> {a.texto}
                <div style={{ marginTop: '5px', fontSize: '12px', color: a.correta ? C.verde : C.secundario, fontWeight: a.correta ? 700 : 400 }}>
                  {a.correta ? '✓ Correta' : 'Incorreta'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {props.modoFluxo && props.onConcluir && (
        <div
          style={{
            marginTop: '24px',
            padding: '18px',
            background: '#FFFFFF',
            border: `1px solid ${C.borda}`,
            borderRadius: '14px'
          }}
        >
          {erroConclusao && (
            <div
              style={{
                marginBottom: '12px',
                padding: '12px',
                borderRadius: '8px',
                background: C.vermelhoClaro,
                color: C.vermelho
              }}
            >
              {erroConclusao}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '16px',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <strong
                style={{
                  display: 'block',
                  color: C.azulEscuro,
                  marginBottom: '4px'
                }}
              >
                Finalizar criação do treinamento
              </strong>

              <span
                style={{
                  color: C.secundario,
                  fontSize: '13px'
                }}
              >
                Você pode navegar entre Treinamento, Módulos e Avaliação antes de encerrar.
              </span>
            </div>

            <button
              type="button"
              disabled={
                props.avaliacoes.length === 0 ||
                concluindoFluxo ||
                props.processando
              }
              onClick={() => {
                if (!props.onConcluir) {
                  return;
                }

                setConcluindoFluxo(true);
                setErroConclusao('');

                void props.onConcluir()
                  .catch((error: unknown) => {
                    setErroConclusao(
                      error instanceof Error
                        ? error.message
                        : 'Não foi possível concluir o treinamento.'
                    );
                  })
                  .then(() => {
                    setConcluindoFluxo(false);
                  });
              }}
              style={{
                ...btnPrimary,
                padding: '11px 20px',
                opacity:
                  props.avaliacoes.length === 0 ||
                  concluindoFluxo ||
                  props.processando
                    ? .55
                    : 1
              }}
            >
              {
                concluindoFluxo
                  ? 'Salvando...'
                  : 'Salvar e encerrar'
              }
            </button>
          </div>
        </div>
      )}

      {modalAvaliacao && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(15,23,42,.58)' }}>
          <div style={{ width: '100%', maxWidth: '620px', padding: '24px', background: C.branco, borderRadius: '16px' }}>
            <h2>Nova avaliação</h2>
            {erroModal && <div style={{ padding: '12px', background: C.vermelhoClaro, color: C.vermelho, borderRadius: '8px', marginBottom: '14px' }}>{erroModal}</div>}
            <label>Nome</label><input value={nomeAvaliacao} onChange={e => setNomeAvaliacao(e.target.value)} style={{ ...input, marginTop: '6px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '14px' }}>
              <div><label>Nota mínima (%)</label><input type="number" value={nota} onChange={e => setNota(e.target.value)} style={{ ...input, marginTop: '6px' }} /></div>
              <div><label>Questões da prova</label><input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} style={{ ...input, marginTop: '6px' }} /></div>
              <div><label>Tentativas</label><input type="number" value={tentativas} onChange={e => setTentativas(e.target.value)} style={{ ...input, marginTop: '6px' }} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button type="button" onClick={() => setModalAvaliacao(false)} style={btn}>Cancelar</button>
              <button type="button" onClick={() => salvarAvaliacao().catch(console.error)} style={btnPrimary}>Salvar avaliação</button>
            </div>
          </div>
        </div>
      )}

      {modalQuestao && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(15,23,42,.62)' }}>
          <div style={{ width: '100%', maxWidth: '900px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', background: C.branco, borderRadius: '16px' }}>
            <h2 style={{ margin: '0 0 4px', color: C.azulEscuro }}>Nova questão</h2>
            <p style={{ margin: '0 0 18px', color: C.secundario }}>Escolha o tipo, escreva a pergunta e cadastre as respostas na mesma tela.</p>
            {erroModal && <div style={{ padding: '12px', background: C.vermelhoClaro, color: C.vermelho, borderRadius: '8px', marginBottom: '14px' }}>{erroModal}</div>}

            <strong>Tipo da questão</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '9px', marginTop: '9px', marginBottom: '18px' }}>
              {tipos.map(item => (
                <button key={item.tipo} type="button" onClick={() => trocarTipo(item.tipo)}
                  style={{ padding: '13px', border: tipoQuestao === item.tipo ? `2px solid ${C.azul}` : `1px solid ${C.borda}`, borderRadius: '10px', background: tipoQuestao === item.tipo ? '#EEF6FF' : C.branco, textAlign: 'left', cursor: 'pointer' }}>
                  <strong style={{ display: 'block', color: C.azul, marginBottom: '5px' }}>{item.titulo}</strong>
                  <small style={{ color: C.secundario }}>{item.descricao}</small>
                </button>
              ))}
            </div>

            <label>Pergunta *</label>
            <textarea rows={4} value={enunciado} onChange={e => setEnunciado(e.target.value)} placeholder="Digite o enunciado da questão..."
              style={{ ...input, marginTop: '6px', resize: 'vertical', lineHeight: 1.5 }} />

            <div style={{ width: '160px', marginTop: '14px' }}>
              <label>Peso</label><input type="number" min={1} value={peso} onChange={e => setPeso(e.target.value)} style={{ ...input, marginTop: '6px' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '9px' }}>
              <strong>Respostas</strong>
              {(tipoQuestao === 'Escolha única' || tipoQuestao === 'Múltipla escolha') && (
                <button type="button" onClick={() => setRespostas(lista => [...lista, { texto: '', correta: false }])} style={btn}>+ Adicionar resposta</button>
              )}
            </div>

            <div style={{ display: 'grid', gap: '9px' }}>
              {respostas.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '42px minmax(240px,1fr) auto', gap: '10px', alignItems: 'center', padding: '10px', border: `1px solid ${r.correta ? '#8ECDB6' : C.borda}`, background: r.correta ? C.verdeClaro : C.branco, borderRadius: '9px' }}>
                  <input type={tipoQuestao === 'Múltipla escolha' ? 'checkbox' : 'radio'} name="correta" checked={r.correta} onChange={() => marcarCorreta(i)} />
                  <input value={r.texto} disabled={tipoQuestao === 'Verdadeiro/Falso' || tipoQuestao === 'Sim/Não'}
                    onChange={e => setRespostas(lista => lista.map((item, idx) => idx === i ? { ...item, texto: e.target.value } : item))}
                    placeholder={`Resposta ${i + 1}`} style={input} />
                  {(tipoQuestao === 'Escolha única' || tipoQuestao === 'Múltipla escolha') && respostas.length > 2 && (
                    <button type="button" onClick={() => setRespostas(lista => lista.filter((_, idx) => idx !== i))} style={btnDanger}>Remover</button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button type="button" onClick={() => setModalQuestao(false)} style={btn}>Cancelar</button>
              <button type="button" disabled={props.processando} onClick={() => salvarQuestao().catch(console.error)} style={btnPrimary}>
                {props.processando ? 'Salvando...' : 'Salvar questão completa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default GestaoAvaliacoesPage;
