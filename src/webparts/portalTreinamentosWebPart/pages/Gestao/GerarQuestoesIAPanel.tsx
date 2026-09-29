import * as React from 'react';

import {
  INovaQuestaoCompleta,
  TipoQuestaoCriacao
} from '../../services/AvaliacaoAdminService';

import {
  IParametrosGeracaoIA,
  IQuestaoGeradaIA,
  IResultadoGeracaoIA
} from '../../services/QuestaoIAService';

// ============================================================
// GERAR QUESTÕES COM IA (Claude)
//
// 1. Gera uma prévia de questões a partir do conteúdo dos módulos
//    (automaticamente quando o banco de questões está vazio).
// 2. O responsável revisa, edita, remove o que não servir.
// 3. "Salvar selecionadas" grava no banco de questões da avaliação,
//    que passa a listar todas as questões criadas.
// ============================================================

export interface IGerarQuestoesIAPanelProps {
  treinamentoId: string;
  avaliacaoId: string;
  quantidadeQuestoesExistentes: number;
  proximaOrdem: number;

  // Gera automaticamente ao abrir uma avaliação sem questões.
  gerarAutomaticamente?: boolean;

  onGerar: (
    parametros: IParametrosGeracaoIA
  ) => Promise<IResultadoGeracaoIA>;

  onSalvarQuestao: (
    dados: INovaQuestaoCompleta
  ) => Promise<void>;
}

const C = {
  azul: '#0B5CAB',
  azulEscuro: '#0B2D4D',
  azulClaro: '#EAF3FB',
  roxo: '#5B3FD6',
  roxoClaro: '#F1EDFD',
  branco: '#FFFFFF',
  texto: '#18324A',
  secundario: '#66788A',
  borda: '#D8E2EC',
  fundo: '#F6F9FC',
  verde: '#13795B',
  verdeClaro: '#E7F5EE',
  vermelho: '#B42318',
  vermelhoClaro: '#FDE7E9',
  ambar: '#B45309',
  ambarClaro: '#FFF4E5'
};

const card: React.CSSProperties = {
  background: C.branco,
  border: `1px solid ${C.borda}`,
  borderRadius: '14px',
  padding: '18px',
  marginBottom: '16px'
};

const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 11px',
  border: `1px solid ${C.borda}`,
  borderRadius: '8px',
  fontSize: '13px',
  fontFamily: 'inherit',
  color: C.texto,
  background: C.branco
};

const btn: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: '8px',
  border: `1px solid ${C.borda}`,
  background: C.branco,
  color: C.texto,
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer'
};

const btnPrimario: React.CSSProperties = {
  ...btn,
  border: `1px solid ${C.roxo}`,
  background: C.roxo,
  color: C.branco
};

const TIPOS: TipoQuestaoCriacao[] = [
  'Escolha única',
  'Múltipla escolha',
  'Verdadeiro/Falso'
];

const GerarQuestoesIAPanel: React.FC<IGerarQuestoesIAPanelProps> = (
  props
) => {

  const [quantidade, setQuantidade] = React.useState(10);
  const [instrucoes, setInstrucoes] = React.useState('');
  const [mostrarOpcoes, setMostrarOpcoes] = React.useState(false);

  const [gerando, setGerando] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [progresso, setProgresso] = React.useState({ atual: 0, total: 0 });

  const [erro, setErro] = React.useState('');
  const [avisos, setAvisos] = React.useState<string[]>([]);
  const [falhas, setFalhas] = React.useState<string[]>([]);
  const [info, setInfo] = React.useState('');

  const [questoes, setQuestoes] = React.useState<IQuestaoGeradaIA[]>([]);
  const [selecionadas, setSelecionadas] = React.useState<Record<string, boolean>>({});

  // Avaliações para as quais a geração automática já rodou nesta sessão.
  const geradoAutomaticamente = React.useRef<Record<string, boolean>>({});

  const ocupado = gerando || salvando;

  // Troca de avaliação: limpa a prévia.
  React.useEffect(
    () => {
      setQuestoes([]);
      setSelecionadas({});
      setErro('');
      setAvisos([]);
      setFalhas([]);
      setInfo('');
    },
    [props.avaliacaoId]
  );

  const gerar = React.useCallback(
    async (): Promise<void> => {

      if (!props.treinamentoId || !props.avaliacaoId) {
        return;
      }

      setGerando(true);
      setErro('');
      setAvisos([]);
      setFalhas([]);
      setInfo('');

      try {
        const resultado =
          await props.onGerar({
            treinamentoId: props.treinamentoId,
            avaliacaoId: props.avaliacaoId,
            quantidade,
            instrucoes
          });

        setQuestoes(atuais => [...atuais, ...resultado.questoes]);

        setSelecionadas(atuais => {
          const novo = { ...atuais };
          resultado.questoes.forEach(q => { novo[q.chave] = true; });
          return novo;
        });

        setAvisos(resultado.avisos);

        setInfo(
          `${resultado.questoes.length} questão(ões) gerada(s) a partir de ` +
          `${resultado.modulosLidos} módulo(s)` +
          (resultado.modelo ? ` · ${resultado.modelo}` : '') +
          '.'
        );

      } catch (e) {
        setErro(
          e instanceof Error
            ? e.message
            : 'Não foi possível gerar as questões.'
        );
      } finally {
        setGerando(false);
      }
    },
    [
      instrucoes,
      props.avaliacaoId,
      props.onGerar,
      props.treinamentoId,
      quantidade
    ]
  );

  // Geração automática ao abrir uma avaliação com o banco vazio.
  // Aguarda 1,5 s de estabilidade para não disparar enquanto a lista
  // de questões ainda está carregando.
  React.useEffect(
    () => {
      if (
        !props.gerarAutomaticamente ||
        !props.avaliacaoId ||
        !props.treinamentoId ||
        props.quantidadeQuestoesExistentes !== 0 ||
        geradoAutomaticamente.current[props.avaliacaoId]
      ) {
        return undefined;
      }

      const temporizador =
        window.setTimeout(
          () => {
            geradoAutomaticamente.current[props.avaliacaoId] = true;
            void gerar();
          },
          1500
        );

      return () =>
        window.clearTimeout(
          temporizador
        );
    },
    [
      props.avaliacaoId,
      props.gerarAutomaticamente,
      props.quantidadeQuestoesExistentes,
      props.treinamentoId
    ]
  );

  // ---------------- Edição da prévia ----------------

  const atualizar = (
    chave: string,
    alteracao: (q: IQuestaoGeradaIA) => IQuestaoGeradaIA
  ): void =>
    setQuestoes(atuais =>
      atuais.map(q => (q.chave === chave ? alteracao(q) : q))
    );

  const remover = (
    chave: string
  ): void => {
    setQuestoes(atuais => atuais.filter(q => q.chave !== chave));
    setSelecionadas(atuais => {
      const novo = { ...atuais };
      delete novo[chave];
      return novo;
    });
  };

  const marcarCorreta = (
    questao: IQuestaoGeradaIA,
    indice: number
  ): void =>
    atualizar(questao.chave, q => ({
      ...q,
      alternativas: q.alternativas.map((a, i) =>
        q.tipo === 'Múltipla escolha'
          ? (i === indice ? { ...a, correta: !a.correta } : a)
          : { ...a, correta: i === indice }
      )
    }));

  const validar = (
    q: IQuestaoGeradaIA
  ): string => {
    const alternativas = q.alternativas.filter(a => a.texto.trim());
    const corretas = alternativas.filter(a => a.correta).length;

    if (!q.enunciado.trim()) return 'Enunciado vazio.';
    if (alternativas.length < 2) return 'Menos de duas alternativas.';
    if (corretas === 0) return 'Nenhuma alternativa correta marcada.';
    if (q.tipo !== 'Múltipla escolha' && corretas !== 1) return 'Este tipo exige exatamente uma correta.';

    return '';
  };

  const listaSelecionada =
    questoes.filter(q => selecionadas[q.chave]);

  const todasMarcadas =
    questoes.length > 0 &&
    listaSelecionada.length === questoes.length;

  // ---------------- Salvar ----------------

  const salvar = async (): Promise<void> => {

    const paraSalvar = listaSelecionada;

    const invalidas =
      paraSalvar
        .map(q => ({ q, motivo: validar(q) }))
        .filter(item => !!item.motivo);

    if (invalidas.length > 0) {
      setErro(
        `Corrija ${invalidas.length} questão(ões) antes de salvar: ` +
        invalidas.map(item => `"${item.q.enunciado.substring(0, 40)}…" (${item.motivo})`).join('; ')
      );
      return;
    }

    setSalvando(true);
    setErro('');
    setFalhas([]);
    setProgresso({ atual: 0, total: paraSalvar.length });

    const ordemInicial = props.proximaOrdem;
    const salvas: string[] = [];
    const erros: string[] = [];

    for (let i = 0; i < paraSalvar.length; i += 1) {
      const q = paraSalvar[i];

      setProgresso({ atual: i + 1, total: paraSalvar.length });

      try {
        await props.onSalvarQuestao({
          avaliacaoId: props.avaliacaoId,
          enunciado: q.enunciado.trim(),
          ordem: ordemInicial + salvas.length,
          peso: 1,
          tipo: q.tipo,
          alternativas: q.alternativas
            .filter(a => a.texto.trim())
            .map(a => ({ texto: a.texto.trim(), correta: a.correta })),
          explicacao: q.explicacao
        });

        salvas.push(q.chave);

      } catch (e) {
        erros.push(
          `"${q.enunciado.substring(0, 50)}…": ` +
          (e instanceof Error ? e.message : 'erro ao salvar')
        );
      }
    }

    setQuestoes(atuais => atuais.filter(q => salvas.indexOf(q.chave) < 0));
    setSelecionadas(atuais => {
      const novo = { ...atuais };
      salvas.forEach(chave => { delete novo[chave]; });
      return novo;
    });

    setFalhas(erros);
    setInfo(
      `${salvas.length} questão(ões) salva(s) no banco de questões.` +
      (erros.length ? ` ${erros.length} com erro.` : '')
    );

    setSalvando(false);
  };

  // ---------------- Render ----------------

  return (
    <div style={{ ...card, borderColor: '#D9D0FA', background: 'linear-gradient(180deg, #FBFAFF 0%, #FFFFFF 90px)' }}>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 3px', color: C.azulEscuro }}>
            ✨ Gerar questões com IA
          </h3>
          <small style={{ color: C.secundario }}>
            O Claude lê o conteúdo dos módulos deste treinamento e propõe questões para você revisar.
          </small>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={quantidade}
            disabled={ocupado}
            onChange={e => setQuantidade(Number(e.target.value))}
            style={{ ...input, width: 'auto' }}
            aria-label="Quantidade de questões"
          >
            {[5, 10, 15, 20].map(n => (
              <option key={n} value={n}>{n} questões</option>
            ))}
          </select>

          <button
            type="button"
            disabled={ocupado || !props.avaliacaoId}
            onClick={() => { void gerar(); }}
            style={{ ...btnPrimario, opacity: ocupado || !props.avaliacaoId ? 0.6 : 1 }}
          >
            {gerando ? 'Gerando...' : questoes.length ? 'Gerar mais' : 'Gerar questões'}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMostrarOpcoes(!mostrarOpcoes)}
        style={{
          marginTop: '10px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: C.azul,
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {mostrarOpcoes ? 'Ocultar instruções' : 'Adicionar instruções para a IA (opcional)'}
      </button>

      {mostrarOpcoes && (
        <textarea
          value={instrucoes}
          disabled={ocupado}
          onChange={e => setInstrucoes(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder="Ex.: foque nas etapas de aprovação do contrato; inclua 2 questões de Verdadeiro/Falso; nível intermediário."
          style={{ ...input, marginTop: '8px', resize: 'vertical' }}
        />
      )}

      {gerando && (
        <div
          style={{
            marginTop: '14px',
            padding: '12px 14px',
            borderRadius: '8px',
            background: C.roxoClaro,
            color: C.roxo,
            fontSize: '13px'
          }}
        >
          Lendo os módulos e elaborando as questões... isso pode levar até 1 minuto.
        </div>
      )}

      {erro && (
        <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '8px', background: C.vermelhoClaro, color: C.vermelho, fontSize: '13px' }}>
          {erro}
        </div>
      )}

      {info && !gerando && (
        <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: C.verdeClaro, color: C.verde, fontSize: '13px' }}>
          {info}
        </div>
      )}

      {(avisos.length > 0 || falhas.length > 0) && (
        <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '8px', background: C.ambarClaro, color: C.ambar, fontSize: '12px', lineHeight: 1.5 }}>
          {avisos.map((a, i) => <div key={`a${i}`}>• {a}</div>)}
          {falhas.map((f, i) => <div key={`f${i}`}>• {f}</div>)}
        </div>
      )}

      {questoes.length > 0 && (
        <>
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: C.ambarClaro,
              color: C.ambar,
              fontSize: '12px',
              lineHeight: 1.5
            }}
          >
            <strong>Revise antes de salvar.</strong> Questões geradas por IA podem conter erros ou
            gabaritos incorretos. Confira cada enunciado, as alternativas e a resposta correta.
          </div>

          <div
            style={{
              marginTop: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <label style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={todasMarcadas}
                disabled={ocupado}
                onChange={() => {
                  const novo: Record<string, boolean> = {};
                  questoes.forEach(q => { novo[q.chave] = !todasMarcadas; });
                  setSelecionadas(novo);
                }}
              />
              Selecionar todas ({listaSelecionada.length} de {questoes.length})
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => { setQuestoes([]); setSelecionadas({}); }}
                style={{ ...btn, opacity: ocupado ? 0.6 : 1 }}
              >
                Descartar prévia
              </button>

              <button
                type="button"
                disabled={ocupado || listaSelecionada.length === 0}
                onClick={() => { void salvar(); }}
                style={{
                  ...btnPrimario,
                  background: C.verde,
                  borderColor: C.verde,
                  opacity: ocupado || listaSelecionada.length === 0 ? 0.6 : 1
                }}
              >
                {salvando
                  ? `Salvando ${progresso.atual} de ${progresso.total}...`
                  : `Salvar ${listaSelecionada.length} selecionada(s)`}
              </button>
            </div>
          </div>

          {questoes.map((q, indice) => {
            const problema = validar(q);
            const marcada = !!selecionadas[q.chave];

            return (
              <div
                key={q.chave}
                style={{
                  marginTop: '12px',
                  padding: '14px',
                  border: `1px solid ${marcada ? C.roxo : C.borda}`,
                  borderRadius: '10px',
                  background: marcada ? C.branco : C.fundo,
                  opacity: marcada ? 1 : 0.75
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="checkbox"
                    checked={marcada}
                    disabled={ocupado}
                    onChange={() => setSelecionadas({ ...selecionadas, [q.chave]: !marcada })}
                    aria-label={`Selecionar questão ${indice + 1}`}
                  />

                  <strong style={{ fontSize: '13px', color: C.azulEscuro }}>
                    Questão {indice + 1}
                  </strong>

                  <select
                    value={q.tipo}
                    disabled={ocupado}
                    onChange={e => {
                      const tipo = e.target.value as TipoQuestaoCriacao;
                      atualizar(q.chave, atual => ({
                        ...atual,
                        tipo,
                        alternativas:
                          tipo === 'Verdadeiro/Falso'
                            ? [
                              { texto: 'Verdadeiro', correta: true },
                              { texto: 'Falso', correta: false }
                            ]
                            : atual.alternativas
                      }));
                    }}
                    style={{ ...input, width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                  >
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {q.modulo && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: C.azulClaro, color: C.azul, fontWeight: 600 }}>
                      {q.modulo}
                    </span>
                  )}

                  {problema && (
                    <span style={{ fontSize: '11px', color: C.vermelho, fontWeight: 600 }}>
                      ⚠ {problema}
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => remover(q.chave)}
                    style={{ ...btn, marginLeft: 'auto', padding: '4px 10px', fontSize: '12px', color: C.vermelho }}
                  >
                    Remover
                  </button>
                </div>

                <textarea
                  value={q.enunciado}
                  disabled={ocupado}
                  onChange={e => atualizar(q.chave, atual => ({ ...atual, enunciado: e.target.value }))}
                  rows={2}
                  aria-label="Enunciado"
                  style={{ ...input, marginTop: '10px', resize: 'vertical', fontWeight: 600 }}
                />

                <div style={{ marginTop: '8px' }}>
                  {q.alternativas.map((a, i) => (
                    <div key={`${q.chave}-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                      <input
                        type={q.tipo === 'Múltipla escolha' ? 'checkbox' : 'radio'}
                        name={`correta-${q.chave}`}
                        checked={a.correta}
                        disabled={ocupado}
                        onChange={() => marcarCorreta(q, i)}
                        title="Marcar como correta"
                      />

                      <input
                        value={a.texto}
                        disabled={ocupado || q.tipo === 'Verdadeiro/Falso'}
                        onChange={e =>
                          atualizar(q.chave, atual => ({
                            ...atual,
                            alternativas: atual.alternativas.map((alt, j) =>
                              j === i ? { ...alt, texto: e.target.value } : alt
                            )
                          }))
                        }
                        style={{
                          ...input,
                          padding: '6px 9px',
                          borderColor: a.correta ? C.verde : C.borda,
                          background: a.correta ? C.verdeClaro : C.branco
                        }}
                      />
                    </div>
                  ))}
                </div>

                {q.explicacao && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: C.secundario, lineHeight: 1.5 }}>
                    <strong>Explicação:</strong> {q.explicacao}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default GerarQuestoesIAPanel;
