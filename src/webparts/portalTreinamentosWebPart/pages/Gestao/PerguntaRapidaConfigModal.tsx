import * as React from 'react';

import {
  DataverseService,
  IDataverseRecord
} from '../../services/DataverseService';

import PerguntaRapidaEditor from
  './PerguntaRapidaEditor';

// ============================================================
// CONFIGURAR PERGUNTA RÁPIDA (Gestão > Módulos > Conteúdos)
//
// Mostra a pergunta e as alternativas (com a correta marcada) e
// permite ajustar o feedback (mostrar e textos de acerto/erro).
//
// "Exigir acerto" é uma regra do MÓDULO (Editar módulo > Exigir
// acerto nas perguntas rápidas) e não é editado aqui.
//
// Se o conteúdo "Pergunta rápida" ainda não tiver pergunta
// cadastrada, abre o cadastro (PerguntaRapidaEditor), que herda a
// regra de acerto das demais perguntas do módulo.
// ============================================================

export interface IPerguntaRapidaConfigModalProps {
  dataverse: DataverseService;
  conteudoModuloId: string;
  titulo: string;
  onFechar: () => void;
}

interface IAlternativaView {
  id: string;
  texto: string;
  correta: boolean;
}

const texto = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null
    ? padrao
    : String(valor);
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = false
): boolean => {
  const valor = registro[campo];
  if (typeof valor === 'boolean') return valor;
  if (valor === 1 || valor === '1' || valor === 'true') return true;
  if (valor === 0 || valor === '0' || valor === 'false') return false;
  return padrao;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 11px',
  border: '1px solid #D8E2EC',
  borderRadius: '8px',
  marginTop: '5px',
  fontSize: '13px',
  color: '#18324A',
  background: '#FFFFFF'
};

const botao: React.CSSProperties = {
  padding: '9px 14px',
  border: '1px solid #0B5CAB',
  background: '#FFFFFF',
  color: '#0B5CAB',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '12px'
};

const botaoPrimario: React.CSSProperties = {
  ...botao,
  background: '#0B5CAB',
  color: '#FFFFFF'
};

const PerguntaRapidaConfigModal: React.FC<IPerguntaRapidaConfigModalProps> = props => {

  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [sucesso, setSucesso] = React.useState('');

  const [perguntaId, setPerguntaId] = React.useState('');
  const [enunciado, setEnunciado] = React.useState('');
  const [alternativas, setAlternativas] = React.useState<IAlternativaView[]>([]);

  // Regra do módulo, usada só ao cadastrar uma pergunta nova.
  const [exigirAcertoModulo, setExigirAcertoModulo] = React.useState(true);
  const [mostrarFeedback, setMostrarFeedback] = React.useState(true);
  const [feedbackAcerto, setFeedbackAcerto] = React.useState('');
  const [feedbackErro, setFeedbackErro] = React.useState('');

  // Regra atual do módulo: true se as demais perguntas do módulo
  // exigem acerto (ou se ainda não há nenhuma).
  const regraAcertoDoModulo = React.useCallback(
    async (): Promise<boolean> => {
      try {
        const conteudo =
          await props.dataverse.obterRegistro(
            'dgt_moduloconteudo',
            props.conteudoModuloId,
            ['_dgt_modulo_value']
          );

        const moduloId =
          conteudo
            ? texto(conteudo.registro, '_dgt_modulo_value')
            : '';

        if (!moduloId) {
          return true;
        }

        const conteudos =
          await props.dataverse.listarRegistros(
            'dgt_moduloconteudo',
            '$select=dgt_moduloconteudoid' +
            `&$filter=_dgt_modulo_value eq ${moduloId.replace(/[{}]/g, '').toLowerCase()}`
          );

        const valores: boolean[] = [];

        for (const item of conteudos) {
          const perguntas =
            await props.dataverse.getPerguntaRapidaModulo(
              texto(item, 'dgt_moduloconteudoid')
            );

          perguntas.forEach(p => {
            valores.push(booleano(p, 'dgt_exigiracerto', false));
          });
        }

        return valores.length === 0 || valores.every(v => v);

      } catch (e) {
        console.warn('Não foi possível ler a regra de acerto do módulo.', e);
        return true;
      }
    },
    [props.dataverse, props.conteudoModuloId]
  );

  const carregar = React.useCallback(
    async (): Promise<void> => {

      setCarregando(true);
      setErro('');

      try {

        const perguntas =
          await props.dataverse.getPerguntaRapidaModulo(
            props.conteudoModuloId
          );

        const registro = perguntas[0];

        if (!registro) {
          setPerguntaId('');
          setExigirAcertoModulo(
            await regraAcertoDoModulo()
          );
          return;
        }

        const id = texto(registro, 'dgt_moduloperguntaid');

        setPerguntaId(id);
        setEnunciado(texto(registro, 'dgt_enunciado', texto(registro, 'dgt_name')));
        setMostrarFeedback(booleano(registro, 'dgt_mostrarfeedback', true));
        setFeedbackAcerto(texto(registro, 'dgt_feedbackacerto'));
        setFeedbackErro(texto(registro, 'dgt_feedbackerro'));

        const lista =
          await props.dataverse.getAlternativasPerguntaRapidaModulo(id);

        setAlternativas(
          lista.map(item => ({
            id: texto(item, 'dgt_moduloperguntaalternativaid'),
            texto: texto(item, 'dgt_texto'),
            correta: booleano(item, 'dgt_correta', false)
          }))
        );

      } catch (e) {
        setErro(
          e instanceof Error
            ? e.message
            : 'Não foi possível carregar a pergunta.'
        );
      } finally {
        setCarregando(false);
      }
    },
    [props.dataverse, props.conteudoModuloId, regraAcertoDoModulo]
  );

  React.useEffect(() => {
    carregar().catch((e: unknown) => console.error(e));
  }, [carregar]);

  const salvar = async (): Promise<void> => {

    if (!perguntaId) {
      return;
    }

    setSalvando(true);
    setErro('');
    setSucesso('');

    try {

      await props.dataverse.atualizarRegistro(
        'dgt_modulopergunta',
        perguntaId,
        {
          dgt_mostrarfeedback: mostrarFeedback,
          dgt_feedbackacerto: feedbackAcerto.trim(),
          dgt_feedbackerro: feedbackErro.trim()
        }
      );

      setSucesso('Configuração salva.');

    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar a configuração.'
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99998,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: '0 20px 50px rgba(15,23,42,0.25)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0B5CAB', letterSpacing: '0.04em' }}>
              PERGUNTA RÁPIDA
            </span>
            <h3 style={{ margin: '4px 0 0', color: '#0B2D4D' }}>
              {props.titulo || 'Configurar pergunta'}
            </h3>
          </div>
          <button type="button" style={botao} onClick={props.onFechar}>
            Fechar
          </button>
        </div>

        {erro && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', background: '#FDE7E9', color: '#A4262C', fontSize: '13px' }}>
            {erro}
          </div>
        )}

        {sucesso && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', background: '#E7F5EE', color: '#13795B', fontSize: '13px' }}>
            ✓ {sucesso}
          </div>
        )}

        {carregando && (
          <p style={{ color: '#64748B', fontSize: '13px' }}>Carregando pergunta...</p>
        )}

        {/* Sem pergunta cadastrada: abre o cadastro */}
        {!carregando && !perguntaId && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: '13px' }}>
              Este conteúdo ainda não tem pergunta cadastrada. Cadastre abaixo.
            </p>
            <PerguntaRapidaEditor
              dataverse={props.dataverse}
              conteudoModuloId={props.conteudoModuloId}
              exigirAcertoPadrao={exigirAcertoModulo}
              onSalvo={() => {
                setSucesso('Pergunta cadastrada.');
                carregar().catch((e: unknown) => console.error(e));
              }}
              onCancelar={props.onFechar}
            />
          </div>
        )}

        {!carregando && perguntaId && (
          <>
            <div style={{ marginTop: '16px', padding: '14px', background: '#F5F9FF', border: '1px solid #D6E6F7', borderRadius: '10px' }}>
              <strong style={{ display: 'block', color: '#0B2D4D', marginBottom: '10px' }}>
                {enunciado}
              </strong>

              <div style={{ display: 'grid', gap: '6px' }}>
                {alternativas.map(alternativa => (
                  <div
                    key={alternativa.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: alternativa.correta ? '1px solid #8FD3B6' : '1px solid #E2E8F0',
                      background: alternativa.correta ? '#E7F5EE' : '#FFFFFF',
                      fontSize: '13px',
                      color: '#18324A'
                    }}
                  >
                    {alternativa.correta ? '✓ ' : '○ '}
                    {alternativa.texto}
                    {alternativa.correta && (
                      <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 700, color: '#13795B' }}>
                        correta
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '18px', display: 'grid', gap: '14px' }}>

<p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                A exigência de acerto é definida no módulo, em <strong>Editar módulo → Exigir acerto nas perguntas rápidas</strong>.
              </p>

              <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={mostrarFeedback}
                  onChange={e => { setMostrarFeedback(e.target.checked); setSucesso(''); }}
                />
                <strong style={{ color: '#0B2D4D', fontSize: '13px' }}>Mostrar feedback após a resposta</strong>
              </label>

              {mostrarFeedback && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px' }}>Mensagem de acerto</label>
                    <textarea
                      rows={2}
                      value={feedbackAcerto}
                      onChange={e => { setFeedbackAcerto(e.target.value); setSucesso(''); }}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px' }}>Mensagem de erro</label>
                    <textarea
                      rows={2}
                      value={feedbackErro}
                      onChange={e => { setFeedbackErro(e.target.value); setSucesso(''); }}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" style={botao} onClick={props.onFechar}>
                Cancelar
              </button>
              <button
                type="button"
                style={{ ...botaoPrimario, opacity: salvando ? 0.6 : 1 }}
                disabled={salvando}
                onClick={() => {
                  salvar().catch((e: unknown) => console.error(e));
                }}
              >
                {salvando ? 'Salvando...' : 'Salvar configuração'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PerguntaRapidaConfigModal;
