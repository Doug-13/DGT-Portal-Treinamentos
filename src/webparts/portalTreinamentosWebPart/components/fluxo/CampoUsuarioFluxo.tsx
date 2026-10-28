import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IValorUsuario,
  gravarValorUsuario,
  lerValorUsuario
} from '../../services/fluxo/valorUsuario';

// ============================================================
// CAMPO "USUÁRIO" DO FLUXO
//
// Busca entre os usuários ATIVOS da plataforma (dgt_usuario) por nome
// ou e-mail. A lista é carregada uma vez e reaproveitada por todos os
// campos da tela (cache por 5 minutos).
//
// Uso:
//   <CampoUsuarioFluxo
//     id="fluxo-campo-responsavel"
//     valor={valor}
//     onAlterar={novo => definirValor('responsavel', novo)}
//     dataverseService={dataverseService}
//   />
//
// Se a tela já tem a lista de usuários, ela pode ser passada em
// "usuarios" e o componente não consulta o Dataverse.
// ============================================================

export interface ICampoUsuarioFluxoProps {
  id: string;

  // Valor gravado (JSON — ver services/fluxo/valorUsuario.ts).
  valor: string;

  onAlterar: (valor: string) => void;

  desabilitado?: boolean;

  dataverseService?: DataverseService;

  usuarios?: IValorUsuario[];

  placeholder?: string;
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  ciano10: '#E6F9FC',
  borda: '#D9D9D6',
  texto2: '#5E6670'
};

// ------------------------------------------------------------
// Cache compartilhado da lista de usuários
// ------------------------------------------------------------

let cacheUsuarios: { lidoEm: number; lista: Promise<IValorUsuario[]> } | undefined;

const carregarUsuarios = (
  dataverse: DataverseService
): Promise<IValorUsuario[]> => {

  if (cacheUsuarios && Date.now() - cacheUsuarios.lidoEm < 5 * 60 * 1000) {
    return cacheUsuarios.lista;
  }

  const lista =
    dataverse.getUsuarios()
      .then(
        registros =>
          registros
            .map(registro => ({
              id: String(registro.dgt_usuarioid || '').replace(/[{}]/g, '').toLowerCase(),
              nome: String(registro.dgt_name || ''),
              email: String(registro.dgt_email || registro.dgt_upn || '')
            }))
            .filter(usuario => !!usuario.id && !!usuario.nome)
      );

  // Em caso de erro, permite tentar de novo na próxima abertura.
  lista.catch(() => { cacheUsuarios = undefined; });

  cacheUsuarios = { lidoEm: Date.now(), lista };
  return lista;
};

const normalizar = (
  texto: string
): string =>
  (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const iniciais = (
  nome: string
): string =>
  nome
    .split(' ')
    .filter(parte => parte.length > 2)
    .slice(0, 2)
    .map(parte => parte[0].toUpperCase())
    .join('') || (nome[0] || '?').toUpperCase();

const LIMITE_RESULTADOS = 8;

const CampoUsuarioFluxo: React.FC<ICampoUsuarioFluxoProps> = (props) => {

  const selecionado =
    lerValorUsuario(props.valor);

  const [usuarios, setUsuarios] =
    React.useState<IValorUsuario[]>(props.usuarios || []);

  const [carregando, setCarregando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  const [busca, setBusca] =
    React.useState('');

  const [aberto, setAberto] =
    React.useState(false);

  const [destaque, setDestaque] =
    React.useState(0);

  const caixaRef =
    React.useRef<HTMLDivElement>(null);

  // Carrega a lista (uma vez, quando não foi informada).
  React.useEffect(
    () => {
      if (props.usuarios) {
        setUsuarios(props.usuarios);
        return;
      }

      if (!props.dataverseService) {
        return;
      }

      let ativo = true;
      setCarregando(true);
      setErro('');

      carregarUsuarios(props.dataverseService)
        .then(lista => { if (ativo) { setUsuarios(lista); } })
        .catch(falha => {
          console.error(falha);
          if (ativo) { setErro('Não foi possível carregar os usuários da plataforma.'); }
        })
        .then(() => { if (ativo) { setCarregando(false); } }, () => undefined);

      return () => { ativo = false; };
    },
    [props.dataverseService, props.usuarios]
  );

  // Fecha a lista ao clicar fora.
  React.useEffect(
    () => {
      if (!aberto) {
        return;
      }

      const aoClicar = (evento: MouseEvent): void => {
        if (caixaRef.current && !caixaRef.current.contains(evento.target as Node)) {
          setAberto(false);
        }
      };

      document.addEventListener('mousedown', aoClicar);
      return () => document.removeEventListener('mousedown', aoClicar);
    },
    [aberto]
  );

  const resultados =
    React.useMemo(
      () => {
        const termo = normalizar(busca.trim());
        return usuarios
          .filter(usuario =>
            !termo ||
            normalizar(usuario.nome).indexOf(termo) >= 0 ||
            normalizar(usuario.email || '').indexOf(termo) >= 0
          )
          .slice(0, LIMITE_RESULTADOS);
      },
      [usuarios, busca]
    );

  const escolher = (
    usuario: IValorUsuario
  ): void => {
    props.onAlterar(gravarValorUsuario(usuario));
    setBusca('');
    setAberto(false);
  };

  const aoTeclar = (
    evento: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setAberto(true);
      setDestaque(atual => Math.min(atual + 1, resultados.length - 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setDestaque(atual => Math.max(atual - 1, 0));
    } else if (evento.key === 'Enter') {
      if (aberto && resultados[destaque]) {
        evento.preventDefault();
        escolher(resultados[destaque]);
      }
    } else if (evento.key === 'Escape') {
      setAberto(false);
    }
  };

  // Usuário escolhido: mostra o "cartão" com opção de trocar.
  if (selecionado) {
    return (
      <div
        id={props.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minHeight: '38px',
          boxSizing: 'border-box',
          padding: '5px 8px 5px 6px',
          border: `1px solid ${COR.borda}`,
          borderRadius: '6px',
          background: props.desabilitado ? '#F2F2F2' : '#FFFFFF'
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '28px',
            height: '28px',
            minWidth: '28px',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COR.azul,
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 700
          }}
        >
          {iniciais(selecionado.nome)}
        </span>

        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
          <strong style={{ display: 'block', color: COR.azul, fontSize: '13.5px' }}>
            {selecionado.nome}
          </strong>
          {
            selecionado.email &&
            <small style={{ color: COR.texto2, fontSize: '11.5px' }}>{selecionado.email}</small>
          }
        </span>

        {
          !props.desabilitado &&
          (
            <button
              type="button"
              onClick={() => props.onAlterar('')}
              title="Remover e escolher outro usuário"
              style={{
                border: `1px solid ${COR.borda}`,
                background: '#FFFFFF',
                color: COR.azul,
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              Trocar
            </button>
          )
        }
      </div>
    );
  }

  return (
    <div ref={caixaRef} style={{ position: 'relative' }}>
      <input
        id={props.id}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        autoComplete="off"
        value={busca}
        disabled={props.desabilitado}
        placeholder={
          carregando
            ? 'Carregando usuários...'
            : props.placeholder || '🔍 Buscar usuário por nome ou e-mail...'
        }
        onChange={evento => { setBusca(evento.target.value); setAberto(true); setDestaque(0); }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight: '38px',
          border: `1px solid ${aberto ? COR.ciano : COR.borda}`,
          borderRadius: '6px',
          padding: '8px 10px',
          fontFamily: 'inherit',
          fontSize: '14px',
          color: COR.azul,
          background: props.desabilitado ? '#F2F2F2' : '#FFFFFF'
        }}
      />

      {
        erro &&
        <div style={{ marginTop: '4px', fontSize: '12px', color: '#B42318' }}>{erro}</div>
      }

      {
        aberto && !props.desabilitado &&
        (
          <ul
            role="listbox"
            style={{
              position: 'absolute',
              zIndex: 20,
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              margin: 0,
              padding: '4px',
              listStyle: 'none',
              background: '#FFFFFF',
              border: `1px solid ${COR.borda}`,
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(32, 42, 68, .14)',
              maxHeight: '280px',
              overflowY: 'auto'
            }}
          >
            {
              carregando
                ? <li style={{ padding: '10px', fontSize: '13px', color: COR.texto2 }}>Carregando usuários...</li>
                : resultados.length === 0
                  ? (
                    <li style={{ padding: '10px', fontSize: '13px', color: COR.texto2 }}>
                      {usuarios.length === 0 ? 'Nenhum usuário disponível.' : 'Nenhum usuário encontrado.'}
                    </li>
                  )
                  : resultados.map(
                    (usuario, indice) => (
                      <li
                        key={usuario.id}
                        role="option"
                        aria-selected={indice === destaque}
                        onMouseDown={evento => { evento.preventDefault(); escolher(usuario); }}
                        onMouseEnter={() => setDestaque(indice)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '7px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: indice === destaque ? COR.ciano10 : 'transparent'
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: '26px',
                            height: '26px',
                            minWidth: '26px',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#EDF0F5',
                            color: COR.azul,
                            fontSize: '10.5px',
                            fontWeight: 700
                          }}
                        >
                          {iniciais(usuario.nome)}
                        </span>
                        <span style={{ minWidth: 0, lineHeight: 1.25 }}>
                          <strong style={{ display: 'block', fontSize: '13px', color: COR.azul }}>{usuario.nome}</strong>
                          {usuario.email && <small style={{ fontSize: '11.5px', color: COR.texto2 }}>{usuario.email}</small>}
                        </span>
                      </li>
                    )
                  )
            }
          </ul>
        )
      }
    </div>
  );
};

export default CampoUsuarioFluxo;
