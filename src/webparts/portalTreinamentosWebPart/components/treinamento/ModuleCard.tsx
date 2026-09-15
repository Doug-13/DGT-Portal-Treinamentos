import * as React from 'react';
import { IModuloTreinamento, StatusUsuarioModulo } from '../../models/Modulo';

export interface IModuleCardProps {
  modulo: IModuloTreinamento;
  treinamentoEmAndamento: boolean;
  processando?: boolean;
  onIniciar: (modulo: IModuloTreinamento) => void;
  onConcluir: (modulo: IModuloTreinamento) => void;
  className?: string;
}

const ModuleCard: React.FC<IModuleCardProps> = ({
  modulo,
  treinamentoEmAndamento,
  processando = false,
  onIniciar,
  onConcluir,
  className
}) => {
  const concluido = modulo.statusModulo === StatusUsuarioModulo.Concluido;
  const emAndamento = modulo.statusModulo === StatusUsuarioModulo.EmAndamento;
  const temRegistro = Boolean(modulo.usuarioModuloId);

  return (
    <article className={className}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <small>Módulo {modulo.ordem}</small>
          <h3>{modulo.titulo}</h3>
          <div>
            {modulo.tipoModuloNome} · {modulo.duracaoMin} min
            {modulo.obrigatorio ? ' · Obrigatório' : ''}
          </div>
        </div>
        <strong>{modulo.statusModuloNome}</strong>
      </div>

      {modulo.descricao && <p>{modulo.descricao}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {modulo.urlConteudo ? (
          <a href={modulo.urlConteudo} target="_blank" rel="noreferrer">
            Acessar conteúdo
          </a>
        ) : (
          <button type="button" disabled>
            Conteúdo em preparação
          </button>
        )}

        {!concluido && !emAndamento && (
          <button
            type="button"
            disabled={!treinamentoEmAndamento || !temRegistro || processando}
            onClick={() => onIniciar(modulo)}
          >
            {processando ? 'Processando...' : 'Iniciar módulo'}
          </button>
        )}

        {emAndamento && (
          <button
            type="button"
            disabled={!temRegistro || processando}
            onClick={() => onConcluir(modulo)}
          >
            {processando ? 'Processando...' : 'Concluir módulo'}
          </button>
        )}

        {concluido && (
          <button type="button" disabled>
            ✓ Módulo concluído
          </button>
        )}
      </div>
    </article>
  );
};

export default ModuleCard;
