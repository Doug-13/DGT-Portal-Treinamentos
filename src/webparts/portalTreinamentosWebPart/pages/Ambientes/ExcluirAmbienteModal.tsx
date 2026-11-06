import * as React from 'react';

import {
  IAmbiente
} from '../../models/Ambiente';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  AmbienteService,
  IAnaliseExclusaoAmbiente
} from '../../services/ambientes/AmbienteService';

// ============================================================
// EXCLUIR AMBIENTE (Administrador)
//
//   Desativar  → some do menu; registros e histórico ficam (recomendado
//                quando o ambiente já foi usado de verdade)
//   Excluir    → apaga o ambiente E os registros dele (fase de criação
//                e testes). Exige digitar a chave. Opcional: apagar
//                também o processo/fluxo, se ninguém mais o usa.
// ============================================================

export interface IExcluirAmbienteModalProps {
  ambiente: IAmbiente;
  todos: IAmbiente[];
  dataverseService: DataverseService;
  onFechar: (resultado?: 'excluido' | 'desativado') => void;
}

const COR = {
  azul: '#202A44',
  texto2: '#5E6670',
  borda: '#D9D9D6',
  vermelho: '#B42318',
  vermelhoClaro: '#FEF3F2',
  ambar: '#B54708',
  ambarClaro: '#FFFAEB',
  verde: '#067647'
};

const botao = (tipo: 'perigo' | 'secundario' | 'primario', desabilitado = false): React.CSSProperties => ({
  padding: '9px 16px',
  borderRadius: '8px',
  border: tipo === 'secundario' ? `1px solid ${COR.azul}` : 0,
  background: desabilitado ? '#CBD5E1' : tipo === 'perigo' ? COR.vermelho : tipo === 'primario' ? COR.azul : '#FFFFFF',
  color: tipo === 'secundario' ? COR.azul : '#FFFFFF',
  fontWeight: 700,
  fontSize: '13px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit'
});

const ExcluirAmbienteModal: React.FC<IExcluirAmbienteModalProps> = ({ ambiente, todos, dataverseService, onFechar }) => {

  const servico = React.useMemo(() => new AmbienteService(dataverseService), [dataverseService]);
  const [analise, setAnalise] = React.useState<IAnaliseExclusaoAmbiente | undefined>(undefined);
  const [erro, setErro] = React.useState('');
  const [confirmacao, setConfirmacao] = React.useState('');
  const [excluirFluxo, setExcluirFluxo] = React.useState(false);
  const [progresso, setProgresso] = React.useState('');
  const [avisos, setAvisos] = React.useState<string[] | undefined>(undefined);
  const processando = !!progresso;

  React.useEffect(() => {
    let ativo = true;
    servico.analisarExclusao(ambiente, todos)
      .then(resultado => {
        if (ativo) {
          setAnalise(resultado);
          setExcluirFluxo(resultado.podeExcluirFluxo);
        }
      })
      .catch(falha => { if (ativo) { setErro(`Não foi possível analisar o ambiente: ${falha instanceof Error ? falha.message : String(falha)}`); } });
    return () => { ativo = false; };
  }, [ambiente.id]);

  const desativar = async (): Promise<void> => {
    setProgresso('Desativando...');
    try {
      await servico.desativar(ambiente);
      onFechar('desativado');
    } catch (falha) {
      setErro(`Não foi possível desativar: ${falha instanceof Error ? falha.message : String(falha)}`);
      setProgresso('');
    }
  };

  const excluir = async (): Promise<void> => {
    setProgresso('Excluindo...');
    setErro('');
    try {
      const resultado = await servico.excluir(ambiente, todos, excluirFluxo, setProgresso);
      setAvisos(resultado);
      setProgresso('');
      if (resultado.length === 0) {
        onFechar('excluido');
      }
    } catch (falha) {
      setErro(
        `A exclusão parou: ${falha instanceof Error ? falha.message : String(falha)}. ` +
        'Se for falta de permissão, o Administrador precisa do privilégio Excluir em "Ambiente" e "Registro de Ambiente". ' +
        'O que já foi excluído não volta; tente de novo para concluir.'
      );
      setProgresso('');
    }
  };

  const confirmado = confirmacao.trim().toLowerCase() === ambiente.chave.toLowerCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="excluir-ambiente-titulo"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, .45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px', fontFamily: "Barlow, Arial, 'Segoe UI', sans-serif" }}
    >
      <div style={{ width: '100%', maxWidth: '640px', background: '#FFFFFF', borderRadius: '10px', boxShadow: '0 20px 50px rgba(0,0,0,.25)', color: COR.azul, fontSize: '13.5px' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COR.borda}`, display: 'flex', alignItems: 'center' }}>
          <strong id="excluir-ambiente-titulo" style={{ fontSize: '15px', flex: 1 }}>Excluir ambiente “{ambiente.nome}”</strong>
          <button type="button" aria-label="Fechar" disabled={processando} onClick={() => onFechar()} style={{ border: 0, background: 'transparent', fontSize: '20px', cursor: 'pointer', color: COR.azul }}>×</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px', lineHeight: 1.5 }}>
          {!analise && !erro && <div>Analisando o ambiente...</div>}

          {erro && <div style={{ padding: '10px 12px', borderRadius: '8px', background: COR.vermelhoClaro, color: COR.vermelho }}>{erro}</div>}

          {avisos && avisos.length > 0 && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: COR.ambarClaro, color: COR.ambar }}>
              <strong>Ambiente excluído.</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>{avisos.map(item => <li key={item}>{item}</li>)}</ul>
              <div style={{ marginTop: '8px' }}><button type="button" style={botao('primario')} onClick={() => onFechar('excluido')}>Fechar</button></div>
            </div>
          )}

          {analise && !avisos && (
            <>
              <div>
                <strong>Registros:</strong> {analise.registros.total}
                {analise.registros.total > 0 && ` (${analise.registros.emAndamento} em andamento, ${analise.registros.concluidos} concluído(s), ${analise.registros.cancelados} cancelado(s))`}
                <br />
                <strong>Fluxo:</strong> {analise.processoNome || '—'}{' '}
                {analise.podeExcluirFluxo
                  ? '(usado só por este ambiente — pode ser excluído junto)'
                  : analise.outrosAmbientes.length > 0
                    ? `(também usado por ${analise.outrosAmbientes.join(', ')} — fica)`
                    : analise.documentosNoFluxo + analise.revisoesNoFluxo > 0
                      ? '(usado por documentos — fica)'
                      : ''}
              </div>

              {ambiente.ativo && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: COR.ambarClaro, color: COR.ambar }}>
                  <strong>Recomendado se o ambiente já foi usado de verdade: desativar.</strong> Ele some do menu e de Usuários e
                  acessos; registros e histórico ficam guardados e o ambiente pode ser reativado em “Editar dados do ambiente”.
                  <div style={{ marginTop: '8px' }}>
                    <button type="button" disabled={processando} onClick={() => { desativar().catch(() => undefined); }} style={botao('secundario', processando)}>
                      Desativar ambiente
                    </button>
                  </div>
                </div>
              )}

              <div style={{ padding: '12px 14px', borderRadius: '8px', background: COR.vermelhoClaro, color: COR.vermelho }}>
                <strong>Excluir definitivamente (fase de criação e testes).</strong> Apaga o ambiente
                {analise.registros.total > 0 ? <> <strong>e os {analise.registros.total} registro(s)</strong> dele, com o histórico do fluxo</> : ''}.
                Não há como desfazer. A chave “{ambiente.chave}” fica livre para criar o ambiente de novo (quem tinha o
                ambiente liberado volta a vê-lo se ele for recriado com a mesma chave).
              </div>

              <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={excluirFluxo} disabled={!analise.podeExcluirFluxo || processando} onChange={() => setExcluirFluxo(!excluirFluxo)} />
                <span>
                  Excluir também o processo e o fluxo “{analise.processoNome || '—'}” (versões e campos)
                  {!analise.podeExcluirFluxo && <span style={{ display: 'block', fontSize: '12px', color: COR.texto2 }}>Não disponível: o fluxo é usado por outro ambiente ou por documentos.</span>}
                </span>
              </label>

              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', marginBottom: '4px' }}>Para confirmar, digite a chave do ambiente: <strong>{ambiente.chave}</strong></span>
                <input
                  value={confirmacao}
                  disabled={processando}
                  onChange={evento => setConfirmacao(evento.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1px solid ${COR.borda}`, borderRadius: '6px', fontFamily: 'inherit', fontSize: '13.5px' }}
                />
              </label>

              {progresso && <div style={{ color: COR.texto2 }}>{progresso}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" disabled={processando} onClick={() => onFechar()} style={botao('secundario', processando)}>Cancelar</button>
                <button type="button" disabled={processando || !confirmado} onClick={() => { excluir().catch(() => undefined); }} style={botao('perigo', processando || !confirmado)}>
                  Excluir definitivamente
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcluirAmbienteModal;
