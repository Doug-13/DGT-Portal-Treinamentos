import * as React from 'react';

import {
  IAmbiente,
  ICONES_AMBIENTE,
  IEdicaoAmbiente,
  IFluxoOpcaoAmbiente
} from '../../models/Ambiente';

import {
  Icones,
  IconeChave
} from '../../components/common/Icones';

import {
  gerarChaveAmbiente,
  gerarPrefixoAmbiente,
  validarDadosAmbiente
} from '../../services/ambientes/AmbienteService';

import {
  PREFIXO_PROCESSO_AMBIENTE
} from '../../services/ambientes/esquemaAmbientes';

import {
  COR,
  CaixaMensagem,
  FONTE,
  botao,
  campo
} from '../Orcamento/orcamentoComum';

// ============================================================
// ADICIONAR / EDITAR AMBIENTE (somente Administrador)
//
// Criar: o portal cria o processo do fluxo (AMB-<CHAVE>) e o
// ambiente. Depois disso o Administrador desenha e publica o fluxo
// (Processos → Fluxos) e libera o ambiente aos usuários em
// Usuários e acessos — igual aos demais módulos.
//
// Editar: a CHAVE não muda (liberações apontam para ela). Ambiente
// não é excluído: é desativado (some do menu, histórico preservado).
// ============================================================

export interface IAmbienteFormModalProps {
  // undefined = novo ambiente.
  ambiente?: IAmbiente;
  existentes: IAmbiente[];
  // false = tabelas ainda não existem no Dataverse.
  disponivel: boolean;
  avisoIndisponivel?: string;
  processando: boolean;
  // Fluxos de Processos → Fluxos que podem ser vinculados.
  carregarFluxos?: () => Promise<IFluxoOpcaoAmbiente[]>;
  onSalvar: (dados: IEdicaoAmbiente) => Promise<string[]>;
  onFechar: () => void;
}

const PERFIS: Array<{ chave: string; nome: string }> = [
  { chave: 'Funcionario', nome: 'Colaborador' },
  { chave: 'Editor', nome: 'Editor' },
  { chave: 'Gestor', nome: 'Gestor' }
];

const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '12.5px',
  fontWeight: 700,
  color: COR.azul,
  marginBottom: '4px'
};

const ajuda: React.CSSProperties = {
  display: 'block',
  fontSize: '11.5px',
  color: COR.texto2,
  marginTop: '3px'
};

const AmbienteFormModal: React.FC<IAmbienteFormModalProps> = (props) => {

  const novo = !props.ambiente;
  const original = props.ambiente;

  const [nome, setNome] = React.useState(original ? original.nome : '');
  const [chave, setChave] = React.useState(original ? original.chave : '');
  const [chaveManual, setChaveManual] = React.useState(!novo);
  const [descricao, setDescricao] = React.useState(original ? original.descricao : '');
  const [subtitulo, setSubtitulo] = React.useState(original ? original.subtitulo : '');
  const [icone, setIcone] = React.useState<IconeChave>(original ? original.icone : 'workflow');
  const [ordem, setOrdem] = React.useState(String(original ? original.ordem : (props.existentes.length + 1) * 10));
  const [prefixo, setPrefixo] = React.useState(original ? original.prefixoCodigo : '');
  const [prefixoManual, setPrefixoManual] = React.useState(!novo);
  const [rotuloRegistro, setRotuloRegistro] = React.useState(original ? original.rotuloRegistro : 'Solicitação');
  const [liberadoParaTodos, setLiberadoParaTodos] = React.useState(original ? original.liberadoParaTodos : false);
  const [perfisPadrao, setPerfisPadrao] = React.useState<string[]>(original ? original.perfisPadrao : []);
  const [ativo, setAtivo] = React.useState(original ? original.ativo : true);
  const [erros, setErros] = React.useState<string[]>([]);

  // Fluxo do ambiente: novo (criado agora) ou um já existente.
  const [modoFluxo, setModoFluxo] = React.useState<'novo' | 'existente'>('novo');
  const [fluxoId, setFluxoId] = React.useState<string>(original ? original.processoId : '');
  const [fluxos, setFluxos] = React.useState<IFluxoOpcaoAmbiente[]>([]);
  const [carregandoFluxos, setCarregandoFluxos] = React.useState(false);
  const [erroFluxos, setErroFluxos] = React.useState('');

  React.useEffect(() => {
    if (!props.carregarFluxos || !props.disponivel) {
      return;
    }
    setCarregandoFluxos(true);
    props.carregarFluxos()
      .then(lista => setFluxos(lista))
      .catch(erro => setErroFluxos(`Não foi possível listar os fluxos: ${erro instanceof Error ? erro.message : String(erro)}`))
      .then(() => setCarregandoFluxos(false))
      .catch(() => undefined);
  }, []);

  const fluxoEscolhido = fluxos.filter(item => item.id === fluxoId)[0];
  const trocandoFluxo = !novo && !!original && !!fluxoId && fluxoId !== original.processoId;

  // Novo ambiente: chave e prefixo acompanham o nome até o
  // Administrador alterá-los à mão.
  const alterarNome = (valor: string): void => {
    setNome(valor);
    if (novo && !chaveManual) {
      setChave(gerarChaveAmbiente(valor));
    }
    if (novo && !prefixoManual) {
      setPrefixo(gerarPrefixoAmbiente(valor));
    }
  };

  const alternarPerfil = (perfil: string): void =>
    setPerfisPadrao(atual =>
      atual.indexOf(perfil) >= 0
        ? atual.filter(item => item !== perfil)
        : atual.concat(perfil)
    );

  const dados = (): IEdicaoAmbiente => ({
    nome: nome.trim(),
    chave: chave.trim(),
    descricao: descricao.trim(),
    subtitulo: subtitulo.trim(),
    icone,
    ordem: parseInt(ordem, 10) || 0,
    liberadoParaTodos,
    // O Administrador global sempre acessa todos os módulos.
    perfisPadrao: perfisPadrao.filter(item => item !== 'Administrador'),
    prefixoCodigo: prefixo.trim().toUpperCase(),
    rotuloRegistro: rotuloRegistro.trim(),
    ativo,
    processoId:
      novo
        ? (modoFluxo === 'existente' ? fluxoId : undefined)
        : (trocandoFluxo ? fluxoId : undefined)
  });

  const salvar = async (): Promise<void> => {
    const valores = dados();
    const problemas = validarDadosAmbiente(valores, props.existentes, original ? original.id : undefined);
    if (novo && modoFluxo === 'existente' && !fluxoId) {
      problemas.push('Escolha o fluxo existente que o ambiente vai usar (ou marque “Criar um fluxo novo”).');
    }
    if (problemas.length > 0) {
      setErros(problemas);
      return;
    }
    if (trocandoFluxo && original) {
      if (!window.confirm(`Trocar o fluxo de "${original.nome}" para "${fluxoEscolhido ? fluxoEscolhido.nome : 'o fluxo escolhido'}"? Os registros em andamento terminam no fluxo em que começaram; os novos seguem o novo fluxo. O fluxo anterior não é apagado.`)) {
        return;
      }
    }
    if (!novo && original && original.ativo && !ativo) {
      if (!window.confirm(`Desativar o ambiente "${original.nome}"? Ele some do menu de todos os usuários. Nada é apagado: os registros e o histórico continuam no Dataverse e o ambiente pode ser reativado.`)) {
        return;
      }
    }
    setErros([]);
    const resultado = await props.onSalvar(valores);
    if (resultado.length > 0) {
      setErros(resultado);
    }
  };

  const IconePrevia = Icones[icone] || Icones.workflow;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ambiente-form-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, .45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '40px 16px',
        fontFamily: FONTE
      }}
      onClick={evento => {
        if (evento.target === evento.currentTarget && !props.processando) {
          props.onFechar();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: '#FFFFFF',
          borderRadius: '10px',
          boxShadow: '0 20px 50px rgba(0,0,0,.25)',
          overflow: 'hidden'
        }}
      >
        <div style={{ background: COR.azul, color: '#FFFFFF', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ display: 'inline-flex', color: COR.ciano }}><IconePrevia /></span>
          <h2 id="ambiente-form-titulo" style={{ margin: 0, fontSize: '16px', fontWeight: 700, flex: 1 }}>
            {novo ? 'Adicionar ambiente' : `Editar ambiente — ${original ? original.nome : ''}`}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            disabled={props.processando}
            onClick={props.onFechar}
            style={{ border: 0, background: 'transparent', color: '#FFFFFF', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '18px 20px' }}>

          {!props.disponivel && (
            <CaixaMensagem
              tipo="alerta"
              texto={props.avisoIndisponivel || 'As tabelas de ambientes ainda não existem no Dataverse. Execute scripts/dataverse/criar-tabelas-ambientes.ps1 e recarregue o portal.'}
            />
          )}

          {novo && props.disponivel && (
            <CaixaMensagem
              tipo="info"
              texto={
                'Cada ambiente fica vinculado a um fluxo de Processos → Fluxos: um novo, criado agora, ou um que já existe.\n' +
                'Depois de criar: confira o fluxo na aba Configuração do ambiente e libere o ambiente em Usuários e acessos, como os demais módulos.'
              }
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', marginTop: '10px' }}>

            <label style={{ display: 'block' }}>
              <span style={rotulo}>Nome do ambiente *</span>
              <input value={nome} maxLength={200} onChange={evento => alterarNome(evento.target.value)} placeholder="Ex.: Licitações" style={campo} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={rotulo}>Chave (identificador permanente) *</span>
              <input
                value={chave}
                maxLength={40}
                disabled={!novo}
                onChange={evento => { setChaveManual(true); setChave(evento.target.value.toLowerCase()); }}
                placeholder="ex.: licitacoes"
                style={{ ...campo, background: novo ? '#FFFFFF' : '#F1F5F9' }}
              />
              <span style={ajuda}>{novo ? 'Gerada pelo nome. Não pode ser alterada depois de criar.' : 'Não pode ser alterada: as liberações dos usuários apontam para ela.'}</span>
            </label>

            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={rotulo}>Descrição</span>
              <input value={descricao} maxLength={500} onChange={evento => setDescricao(evento.target.value)} placeholder="Aparece em Usuários e acessos e no cabeçalho do ambiente." style={campo} />
            </label>

            <label style={{ display: 'block', gridColumn: '1 / -1' }}>
              <span style={rotulo}>Subtítulo do cabeçalho</span>
              <input value={subtitulo} maxLength={200} onChange={evento => setSubtitulo(evento.target.value)} placeholder="Ex.: Do edital à homologação, cada etapa no seu fluxo." style={campo} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={rotulo}>Ícone do menu</span>
              <select value={icone} onChange={evento => setIcone(evento.target.value as IconeChave)} style={campo}>
                {ICONES_AMBIENTE.map(item => <option key={item.chave} value={item.chave}>{item.nome}</option>)}
              </select>
            </label>

            <label style={{ display: 'block' }}>
              <span style={rotulo}>Ordem no menu</span>
              <input type="number" value={ordem} onChange={evento => setOrdem(evento.target.value)} style={campo} />
              <span style={ajuda}>Menor aparece primeiro (entre os ambientes).</span>
            </label>

            <label style={{ display: 'block' }}>
              <span style={rotulo}>Como cada registro é chamado *</span>
              <input value={rotuloRegistro} maxLength={100} onChange={evento => setRotuloRegistro(evento.target.value)} placeholder="Ex.: Solicitação, Processo licitatório" style={campo} />
            </label>

            <label style={{ display: 'block' }}>
              <span style={rotulo}>Prefixo do código *</span>
              <input
                value={prefixo}
                maxLength={6}
                onChange={evento => { setPrefixoManual(true); setPrefixo(evento.target.value.toUpperCase()); }}
                placeholder="LIC"
                style={campo}
              />
              <span style={ajuda}>Códigos: {(prefixo || 'XXX').toUpperCase()}-{new Date().getFullYear()}-0001</span>
            </label>
          </div>

          <fieldset style={{ border: `1px solid ${COR.borda}`, borderRadius: '8px', padding: '10px 14px', marginTop: '16px' }}>
            <legend style={{ ...rotulo, padding: '0 6px', marginBottom: 0 }}>Fluxo do ambiente</legend>

            {novo && (
              <>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: COR.azul, cursor: 'pointer' }}>
                  <input type="radio" name="modo-fluxo" checked={modoFluxo === 'novo'} onChange={() => setModoFluxo('novo')} />
                  <span>
                    <strong>Criar um fluxo novo para este ambiente</strong>
                    <span style={ajuda}>O portal cria o processo {PREFIXO_PROCESSO_AMBIENTE}{(chave || 'CHAVE').toUpperCase()}; você desenha e publica o fluxo pela aba Configuração.</span>
                  </span>
                </label>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: COR.azul, cursor: 'pointer', marginTop: '8px' }}>
                  <input type="radio" name="modo-fluxo" checked={modoFluxo === 'existente'} onChange={() => setModoFluxo('existente')} />
                  <span>
                    <strong>Usar um fluxo que já existe</strong>
                    <span style={ajuda}>Um fluxo criado em Processos → Fluxos (pode ser usado por mais de um ambiente).</span>
                  </span>
                </label>
              </>
            )}

            {!novo && original && (
              <div style={{ fontSize: '13px', color: COR.azul }}>
                Fluxo atual: <strong>{original.processoNome || '—'}</strong>
                <span style={ajuda}>Para trocar, escolha outro abaixo. Registros em andamento terminam no fluxo em que começaram.</span>
              </div>
            )}

            {(!novo || modoFluxo === 'existente') && (
              <div style={{ marginTop: '8px' }}>
                <select
                  aria-label="Fluxo do ambiente"
                  value={fluxoId}
                  disabled={carregandoFluxos}
                  onChange={evento => setFluxoId(evento.target.value)}
                  style={campo}
                >
                  <option value="">{carregandoFluxos ? 'Carregando fluxos...' : (novo ? 'Selecione o fluxo...' : '(manter o fluxo atual)')}</option>
                  {fluxos.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.codigo ? `${item.codigo} — ` : ''}{item.nome}
                      {item.publicado ? '' : ' (sem versão publicada)'}
                      {item.ambientes.length > 0 ? ` · usado por: ${item.ambientes.join(', ')}` : ''}
                    </option>
                  ))}
                </select>
                {erroFluxos && <span style={{ ...ajuda, color: '#B42318' }}>{erroFluxos}</span>}
                {fluxoEscolhido && !fluxoEscolhido.publicado && (
                  <span style={{ ...ajuda, color: '#B42318' }}>
                    Este fluxo ainda não tem versão publicada: o ambiente só aceita registros depois da publicação.
                  </span>
                )}
                <span style={ajuda}>
                  Fluxos desenhados para documentos também podem ser usados; etapas próprias de documentos (publicar, anexar arquivo, subprocesso)
                  são ignoradas no ambiente — a aba Configuração lista quais.
                </span>
              </div>
            )}
          </fieldset>

          <fieldset style={{ border: `1px solid ${COR.borda}`, borderRadius: '8px', padding: '10px 14px', marginTop: '16px' }}>
            <legend style={{ ...rotulo, padding: '0 6px', marginBottom: 0 }}>Liberação padrão (igual aos demais módulos)</legend>

            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: COR.azul, cursor: 'pointer' }}>
              <input type="checkbox" checked={liberadoParaTodos} onChange={() => setLiberadoParaTodos(!liberadoParaTodos)} />
              <span>
                <strong>Liberado para todos</strong>
                <span style={ajuda}>Vale para quem não tem lista própria de módulos em Usuários e acessos.</span>
              </span>
            </label>

            {!liberadoParaTodos && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ ...ajuda, marginTop: 0, marginBottom: '4px' }}>Ou liberado por padrão para os perfis:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                  {PERFIS.map(perfil => (
                    <label key={perfil.chave} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', color: COR.azul, cursor: 'pointer' }}>
                      <input type="checkbox" checked={perfisPadrao.indexOf(perfil.chave) >= 0} onChange={() => alternarPerfil(perfil.chave)} />
                      {perfil.nome}
                    </label>
                  ))}
                </div>
                <span style={ajuda}>
                  Sem nenhuma marcação: o ambiente só aparece para quem for liberado em Usuários e acessos (o Administrador sempre vê).
                </span>
              </div>
            )}
          </fieldset>

          {!novo && (
            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: COR.azul, cursor: 'pointer', marginTop: '14px' }}>
              <input type="checkbox" checked={ativo} onChange={() => setAtivo(!ativo)} />
              <span>
                <strong>Ambiente ativo</strong>
                <span style={ajuda}>Desativado: some do menu e de Usuários e acessos. Registros e histórico são preservados.</span>
              </span>
            </label>
          )}

          {erros.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <CaixaMensagem tipo="erro" texto={erros.join('\n')} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" disabled={props.processando} onClick={props.onFechar} style={botao('secundario', props.processando)}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={props.processando || !props.disponivel}
              onClick={() => { salvar().catch(() => undefined); }}
              style={botao('principal', props.processando || !props.disponivel)}
            >
              {props.processando ? 'Salvando...' : novo ? 'Criar ambiente' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmbienteFormModal;
