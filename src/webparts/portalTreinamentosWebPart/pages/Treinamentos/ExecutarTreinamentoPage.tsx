import * as React from 'react';
import { ITreinamento } from '../../models/Treinamento';
import { IModuloTreinamento, StatusUsuarioModulo } from '../../models/Modulo';
import ModuleCard from '../../components/treinamento/ModuleCard';
import TrainingProgress from '../../components/treinamento/TrainingProgress';
import TrainingStatus from '../../components/treinamento/TrainingStatus';
import Loading from '../../components/common/Loading';
import EmptyState from '../../components/common/EmptyState';
import ErrorMessage from '../../components/common/ErrorMessage';

export interface IExecutarTreinamentoPageProps {
  treinamento: ITreinamento;
  modulos: IModuloTreinamento[];
  carregandoModulos: boolean;
  erroModulos: string;
  erroExecucao: string;
  processandoModuloId: string;
  iniciandoTreinamento: boolean;
  progresso: number;
  avaliacaoLiberada: boolean;
  onVoltar: () => void;
  onIniciarTreinamento: () => void;
  onIniciarModulo: (modulo: IModuloTreinamento) => void;
  onConcluirModulo: (modulo: IModuloTreinamento) => void;
  onIniciarAvaliacao: () => void;
}

const ExecutarTreinamentoPage: React.FC<IExecutarTreinamentoPageProps> = ({
  treinamento,
  modulos,
  carregandoModulos,
  erroModulos,
  erroExecucao,
  processandoModuloId,
  iniciandoTreinamento,
  progresso,
  avaliacaoLiberada,
  onVoltar,
  onIniciarTreinamento,
  onIniciarModulo,
  onConcluirModulo,
  onIniciarAvaliacao
}) => {
  const emAndamento =
    treinamento.status === 'Em andamento' ||
    treinamento.status === 'Concluído';

  const obrigatorios = modulos.filter(m => m.obrigatorio);
  const concluidos = obrigatorios.filter(
    m => m.statusModulo === StatusUsuarioModulo.Concluido
  ).length;

  return (
    <section>
      <button type="button" onClick={onVoltar}>← Voltar</button>

      <div style={{ marginTop: 18 }}>
        <TrainingStatus status={treinamento.status} />
        <h1>{treinamento.nome}</h1>
        <p>{treinamento.descricao}</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          margin: '20px 0'
        }}
      >
        <Info titulo="Código" valor={treinamento.codigo || '-'} />
        <Info titulo="Carga horária" valor={treinamento.cargaHoraria} />
        <Info
          titulo="Validade"
          valor={treinamento.validadeMeses ? `${treinamento.validadeMeses} meses` : 'Sem validade'}
        />
      </div>

      <TrainingProgress progresso={progresso} />

      {erroExecucao && (
        <div style={{ marginTop: 16 }}>
          <ErrorMessage mensagem={erroExecucao} />
        </div>
      )}

      {treinamento.status === 'Disponível' && (
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={onIniciarTreinamento}
            disabled={iniciandoTreinamento}
          >
            {iniciandoTreinamento ? 'Iniciando...' : 'Iniciar treinamento'}
          </button>
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Módulos</h2>

      {!emAndamento && treinamento.status !== 'Concluído' && (
        <p>Inicie o treinamento para liberar os módulos.</p>
      )}

      {erroModulos && <ErrorMessage mensagem={erroModulos} />}

      {carregandoModulos ? (
        <Loading mensagem="Carregando módulos..." />
      ) : modulos.length === 0 ? (
        <EmptyState titulo="Nenhum módulo cadastrado para este treinamento" />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {modulos.map(modulo => (
            <ModuleCard
              key={modulo.id}
              modulo={modulo}
              treinamentoEmAndamento={emAndamento}
              processando={processandoModuloId === modulo.id}
              onIniciar={onIniciarModulo}
              onConcluir={onConcluirModulo}
            />
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 32,
          padding: 20,
          border: '1px solid #e5e7eb',
          borderRadius: 12
        }}
      >
        {avaliacaoLiberada ? (
          <>
            <h2>✓ Avaliação liberada</h2>
            <p>Todos os módulos obrigatórios foram concluídos.</p>
            <button type="button" onClick={onIniciarAvaliacao}>
              Iniciar avaliação
            </button>
          </>
        ) : (
          <>
            <h2>🔒 Avaliação</h2>
            <p>
              Conclua os módulos obrigatórios para liberar a avaliação.
              {' '}
              {concluidos}/{obrigatorios.length} concluídos.
            </p>
          </>
        )}
      </div>
    </section>
  );
};

const Info: React.FC<{ titulo: string; valor: string }> = ({ titulo, valor }) => (
  <div style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10 }}>
    <small>{titulo}</small>
    <div style={{ fontWeight: 600, marginTop: 4 }}>{valor}</div>
  </div>
);

export default ExecutarTreinamentoPage;
