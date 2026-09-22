import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  IAreaAdmin,
  IEditarArea,
  IEditarUsuarioArea,
  INovaArea,
  INovoUsuarioArea,
  IUsuarioAreaAdmin,
  IUsuarioDisponivelArea,
  PerfilArea
} from '../../services/AreaAdminService';

export interface IGestaoAreasPageProps {

  areas:
    IAreaAdmin[];

  usuarios:
    IUsuarioDisponivelArea[];

  usuariosAreas:
    IUsuarioAreaAdmin[];

  carregando:
    boolean;

  processando:
    boolean;

  erro:
    string;

  onVoltar:
    () => void;

  onCriarArea:
    (
      dados:
        INovaArea
    ) => Promise<void>;

  onEditarArea:
    (
      dados:
        IEditarArea
    ) => Promise<void>;

  onDefinirAreaAtiva:
    (
      areaId:
        string,
      ativa:
        boolean
    ) => Promise<void>;

  onVincularUsuario:
    (
      dados:
        INovoUsuarioArea
    ) => Promise<void>;

  onEditarUsuarioArea:
    (
      dados:
        IEditarUsuarioArea
    ) => Promise<void>;

  onDefinirUsuarioAreaAtivo:
    (
      vinculoId:
        string,
      ativo:
        boolean
    ) => Promise<void>;
}

type Aba =
  | 'areas'
  | 'usuarios';

interface ILinhaUsuarioArea {
  chave: string;
  usuario:
    IUsuarioDisponivelArea;
  vinculo?:
    IUsuarioAreaAdmin;
}

const cores = {
  azul:
    '#0B5CAB',

  azulEscuro:
    '#0B2D4D',

  azulClaro:
    '#EAF3FB',

  branco:
    '#FFFFFF',

  texto:
    '#18324A',

  textoSecundario:
    '#66788A',

  borda:
    '#D8E2EC',

  fundo:
    '#F6F9FC',

  verde:
    '#117A65',

  verdeClaro:
    '#E5F6F1',

  vermelho:
    '#B42318',

  vermelhoClaro:
    '#FDECEC',

  ambar:
    '#B45309',

  ambarClaro:
    '#FFF4E5'
};

const inputStyle:
  React.CSSProperties = {
  width:
    '100%',

  boxSizing:
    'border-box',

  padding:
    '10px 12px',

  border:
    `1px solid ${cores.borda}`,

  borderRadius:
    '8px',

  fontSize:
    '14px',

  color:
    cores.texto,

  background:
    cores.branco
};

const buttonPrimary:
  React.CSSProperties = {
  padding:
    '10px 16px',

  border:
    `1px solid ${cores.azul}`,

  borderRadius:
    '8px',

  background:
    cores.azul,

  color:
    cores.branco,

  fontWeight:
    700,

  cursor:
    'pointer'
};

const buttonSecondary:
  React.CSSProperties = {
  padding:
    '9px 13px',

  border:
    `1px solid ${cores.azul}`,

  borderRadius:
    '8px',

  background:
    cores.branco,

  color:
    cores.azul,

  fontWeight:
    700,

  cursor:
    'pointer'
};

const buttonDanger:
  React.CSSProperties = {
  ...buttonSecondary,

  border:
    `1px solid ${cores.vermelho}`,

  color:
    cores.vermelho
};

const card:
  React.CSSProperties = {
  background:
    cores.branco,

  border:
    `1px solid ${cores.borda}`,

  borderRadius:
    '14px',

  boxShadow:
    '0 1px 2px rgba(15, 23, 42, 0.04)'
};

const th:
  React.CSSProperties = {
  padding:
    '12px 14px',

  textAlign:
    'left',

  color:
    cores.textoSecundario,

  fontSize:
    '12px',

  fontWeight:
    700,

  background:
    '#EEF4F8',

  borderBottom:
    `1px solid ${cores.borda}`
};

const td:
  React.CSSProperties = {
  padding:
    '13px 14px',

  borderTop:
    `1px solid ${cores.borda}`,

  color:
    cores.texto,

  verticalAlign:
    'middle'
};

const badgeAtivo:
  React.CSSProperties = {
  display:
    'inline-block',

  padding:
    '4px 9px',

  borderRadius:
    '999px',

  background:
    cores.verdeClaro,

  color:
    cores.verde,

  fontSize:
    '12px',

  fontWeight:
    700
};

const badgeInativo:
  React.CSSProperties = {
  ...badgeAtivo,

  background:
    cores.vermelhoClaro,

  color:
    cores.vermelho
};

const badgeAlerta:
  React.CSSProperties = {
  ...badgeAtivo,

  background:
    cores.ambarClaro,

  color:
    cores.ambar
};

const badgeSemArea:
  React.CSSProperties = {
  ...badgeAtivo,

  background:
    '#F1F5F9',

  color:
    '#475569'
};

const GestaoAreasPage:
  React.FC<
    IGestaoAreasPageProps
  > = (
    props
  ) => {

    const areas =
      props.areas ||
      [];

    const usuarios =
      props.usuarios ||
      [];

    const usuariosAreas =
      props.usuariosAreas ||
      [];

    const [
      aba,
      setAba
    ] =
      React.useState<Aba>(
        'areas'
      );

    const [
      pesquisa,
      setPesquisa
    ] =
      React.useState('');

    const [
      formularioArea,
      setFormularioArea
    ] =
      React.useState(
        false
      );

    const [
      areaEditando,
      setAreaEditando
    ] =
      React.useState<
        IAreaAdmin | undefined
      >(
        undefined
      );

    const [
      nomeArea,
      setNomeArea
    ] =
      React.useState('');

    const [
      siglaArea,
      setSiglaArea
    ] =
      React.useState('');

    const [
      areaAtiva,
      setAreaAtiva
    ] =
      React.useState(
        true
      );

    const [
      formularioAcesso,
      setFormularioAcesso
    ] =
      React.useState(
        false
      );

    const [
      acessoEditando,
      setAcessoEditando
    ] =
      React.useState<
        IUsuarioAreaAdmin | undefined
      >(
        undefined
      );

    const [
      usuarioId,
      setUsuarioId
    ] =
      React.useState('');

    const [
      areaId,
      setAreaId
    ] =
      React.useState('');

    const [
      perfilArea,
      setPerfilArea
    ] =
      React.useState<
        PerfilArea
      >(
        'Membro'
      );

    const [
      acessoAtivo,
      setAcessoAtivo
    ] =
      React.useState(
        true
      );

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    const areasFiltradas =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          if (!termo) {
            return areas;
          }

          return areas
            .filter(
              item =>
                item.nome
                  .toLowerCase()
                  .includes(
                    termo
                  ) ||
                item.sigla
                  .toLowerCase()
                  .includes(
                    termo
                  )
            );

        },
        [
          areas,
          pesquisa
        ]
      );

    // Gestores ativos por área — usado para mostrar quem é o
    // responsável (aprovador de documentos) e para alertar quando
    // uma área ficou com mais de um Gestor (ou nenhum) por engano.
    const gestoresPorArea =
      React.useMemo(
        () => {

          const mapa =
            new Map<
              string,
              IUsuarioAreaAdmin[]
            >();

          usuariosAreas
            .filter(
              vinculo =>
                vinculo.perfil === 'Gestor' &&
                vinculo.ativo
            )
            .forEach(
              vinculo => {

                const lista =
                  mapa.get(
                    vinculo.areaId
                  ) ||
                  [];

                lista.push(
                  vinculo
                );

                mapa.set(
                  vinculo.areaId,
                  lista
                );
              }
            );

          return mapa;
        },
        [
          usuariosAreas
        ]
      );

    const linhasUsuarios =
      React.useMemo(
        (): ILinhaUsuarioArea[] => {

          const resultado:
            ILinhaUsuarioArea[] = [];

          usuarios.forEach(
            usuario => {

              const vinculos =
                usuariosAreas
                  .filter(
                    item =>
                      item.usuarioId ===
                      usuario.id
                  );

              if (
                vinculos.length ===
                0
              ) {

                resultado.push({
                  chave:
                    `usuario-${usuario.id}`,

                  usuario
                });

                return;
              }

              vinculos.forEach(
                vinculo => {

                  resultado.push({
                    chave:
                      `vinculo-${vinculo.id}`,

                    usuario,

                    vinculo
                  });
                }
              );
            }
          );

          return resultado;

        },
        [
          usuarios,
          usuariosAreas
        ]
      );

    const linhasUsuariosFiltradas =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          if (!termo) {
            return linhasUsuarios;
          }

          return linhasUsuarios
            .filter(
              item => {

                const vinculo =
                  item.vinculo;

                return (
                  item.usuario.nome
                    .toLowerCase()
                    .includes(
                      termo
                    ) ||

                  item.usuario.email
                    .toLowerCase()
                    .includes(
                      termo
                    ) ||

                  (
                    vinculo
                      ?.areaNome
                      .toLowerCase()
                      .includes(
                        termo
                      ) ??
                    false
                  ) ||

                  (
                    vinculo
                      ?.areaSigla
                      .toLowerCase()
                      .includes(
                        termo
                      ) ??
                    false
                  ) ||

                  (
                    vinculo
                      ?.perfil
                      .toLowerCase()
                      .includes(
                        termo
                      ) ??
                    false
                  )
                );
              }
            );

        },
        [
          linhasUsuarios,
          pesquisa
        ]
      );

    const totalUsuariosSemArea =
      React.useMemo(
        () =>
          usuarios
            .filter(
              usuario =>
                !usuariosAreas
                  .some(
                    vinculo =>
                      vinculo.usuarioId ===
                      usuario.id &&
                      vinculo.ativo
                  )
            )
            .length,
        [
          usuarios,
          usuariosAreas
        ]
      );

    const abrirNovaArea =
      (): void => {

        setAreaEditando(
          undefined
        );

        setNomeArea('');
        setSiglaArea('');
        setAreaAtiva(true);
        setErroLocal('');

        setFormularioArea(
          true
        );
      };

    const abrirEditarArea =
      (
        area:
          IAreaAdmin
      ): void => {

        setAreaEditando(
          area
        );

        setNomeArea(
          area.nome
        );

        setSiglaArea(
          area.sigla
        );

        setAreaAtiva(
          area.ativa
        );

        setErroLocal('');

        setFormularioArea(
          true
        );
      };

    const salvarArea =
      async (): Promise<void> => {

        setErroLocal('');

        if (
          !nomeArea.trim()
        ) {
          setErroLocal(
            'Informe o nome da área.'
          );

          return;
        }

        if (
          !siglaArea.trim()
        ) {
          setErroLocal(
            'Informe a sigla.'
          );

          return;
        }

        try {

          if (
            areaEditando
          ) {

            await props
              .onEditarArea({
                id:
                  areaEditando.id,

                nome:
                  nomeArea.trim(),

                sigla:
                  siglaArea
                    .trim()
                    .toUpperCase(),

                ativa:
                  areaAtiva
              });

          } else {

            await props
              .onCriarArea({
                nome:
                  nomeArea.trim(),

                sigla:
                  siglaArea
                    .trim()
                    .toUpperCase(),

                ativa:
                  areaAtiva
              });
          }

          setFormularioArea(
            false
          );

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar área.'
          );
        }
      };

    const abrirNovoAcesso =
      (
        usuarioPreSelecionadoId =
          ''
      ): void => {

        setAcessoEditando(
          undefined
        );

        setUsuarioId(
          usuarioPreSelecionadoId
        );

        setAreaId('');

        setPerfilArea(
          'Membro'
        );

        setAcessoAtivo(
          true
        );

        setErroLocal('');

        setFormularioAcesso(
          true
        );
      };

    const abrirEditarAcesso =
      (
        acesso:
          IUsuarioAreaAdmin
      ): void => {

        setAcessoEditando(
          acesso
        );

        setUsuarioId(
          acesso.usuarioId
        );

        setAreaId(
          acesso.areaId
        );

        setPerfilArea(
          acesso.perfil
        );

        setAcessoAtivo(
          acesso.ativo
        );

        setErroLocal('');

        setFormularioAcesso(
          true
        );
      };

    const salvarAcesso =
      async (): Promise<void> => {

        setErroLocal('');

        if (!usuarioId) {

          setErroLocal(
            'Selecione um usuário.'
          );

          return;
        }

        if (!areaId) {

          setErroLocal(
            'Selecione uma área.'
          );

          return;
        }

        const duplicado =
          usuariosAreas
            .some(
              item =>
                item.usuarioId ===
                  usuarioId &&
                item.areaId ===
                  areaId &&
                item.id !==
                  acessoEditando?.id
            );

        if (duplicado) {

          setErroLocal(
            'Este usuário já possui vínculo com esta área.'
          );

          return;
        }

        try {

          if (
            acessoEditando
          ) {

            await props
              .onEditarUsuarioArea({
                id:
                  acessoEditando.id,

                usuarioId,

                areaId,

                perfil:
                  perfilArea,

                ativo:
                  acessoAtivo
              });

          } else {

            await props
              .onVincularUsuario({
                usuarioId,

                areaId,

                perfil:
                  perfilArea,

                ativo:
                  acessoAtivo
              });
          }

          setFormularioAcesso(
            false
          );

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Erro ao salvar acesso.'
          );
        }
      };

    return (
      <section
        style={{
          color:
            cores.texto
        }}
      >

        <PageHeader
          titulo="Áreas e acessos"
          subtitulo="Cadastre áreas, defina siglas e gerencie quais usuários pertencem a cada área."
          acao={
            <button
              type="button"
              onClick={
                props.onVoltar
              }
              style={
                buttonSecondary
              }
            >
              ← Voltar
            </button>
          }
        />

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',

            gap:
              '12px',

            marginBottom:
              '18px'
          }}
        >

          <div
            style={{
              ...card,

              padding:
                '14px'
            }}
          >
            <span
              style={{
                display:
                  'block',

                color:
                  cores.textoSecundario,

                fontSize:
                  '12px'
              }}
            >
              Áreas cadastradas
            </span>

            <strong
              style={{
                display:
                  'block',

                marginTop:
                  '6px',

                fontSize:
                  '22px'
              }}
            >
              {
                areas.length
              }
            </strong>
          </div>

          <div
            style={{
              ...card,

              padding:
                '14px'
            }}
          >
            <span
              style={{
                display:
                  'block',

                color:
                  cores.textoSecundario,

                fontSize:
                  '12px'
              }}
            >
              Usuários cadastrados
            </span>

            <strong
              style={{
                display:
                  'block',

                marginTop:
                  '6px',

                fontSize:
                  '22px'
              }}
            >
              {
                usuarios.length
              }
            </strong>
          </div>

          <div
            style={{
              ...card,

              padding:
                '14px'
            }}
          >
            <span
              style={{
                display:
                  'block',

                color:
                  cores.textoSecundario,

                fontSize:
                  '12px'
              }}
            >
              Usuários sem área
            </span>

            <strong
              style={{
                display:
                  'block',

                marginTop:
                  '6px',

                fontSize:
                  '22px'
              }}
            >
              {
                totalUsuariosSemArea
              }
            </strong>
          </div>

        </div>

        {
          (() => {

            const areasComMultiplosGestores =
              areas.filter(
                area =>
                  (gestoresPorArea.get(area.id) || []).length > 1
              );

            if (
              areasComMultiplosGestores.length === 0
            ) {
              return null;
            }

            return (
              <div
                style={{
                  marginBottom: '18px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: cores.ambarClaro,
                  color: cores.ambar,
                  fontSize: '13px',
                  lineHeight: 1.5
                }}
              >
                <strong>⚠ Atenção:</strong> {areasComMultiplosGestores.length === 1
                  ? 'a área abaixo possui mais de um Gestor ativo'
                  : `${areasComMultiplosGestores.length} áreas abaixo possuem mais de um Gestor ativo`}.
                {' '}
                Isso é normal durante uma transição de cargo, mas confira se não sobrou um vínculo antigo
                — o Gestor da área é quem aprova os documentos dela.
                {' '}
                <strong>
                  {
                    areasComMultiplosGestores
                      .map(a => a.nome)
                      .join(', ')
                  }
                </strong>
              </div>
            );
          })()
        }

        <div
          style={{
            display:
              'flex',

            gap:
              '8px',

            marginBottom:
              '18px',

            flexWrap:
              'wrap'
          }}
        >

          <button
            type="button"
            onClick={() =>
              setAba(
                'areas'
              )
            }
            style={{
              ...buttonSecondary,

              background:
                aba ===
                  'areas'
                  ? cores.azulEscuro
                  : cores.branco,

              borderColor:
                aba ===
                  'areas'
                  ? cores.azulEscuro
                  : cores.azul,

              color:
                aba ===
                  'areas'
                  ? cores.branco
                  : cores.azul
            }}
          >
            Áreas
          </button>

          <button
            type="button"
            onClick={() =>
              setAba(
                'usuarios'
              )
            }
            style={{
              ...buttonSecondary,

              background:
                aba ===
                  'usuarios'
                  ? cores.azulEscuro
                  : cores.branco,

              borderColor:
                aba ===
                  'usuarios'
                  ? cores.azulEscuro
                  : cores.azul,

              color:
                aba ===
                  'usuarios'
                  ? cores.branco
                  : cores.azul
            }}
          >
            Usuários por área
          </button>

        </div>

        <div
          style={{
            ...card,

            padding:
              '16px',

            marginBottom:
              '18px',

            display:
              'flex',

            gap:
              '12px',

            justifyContent:
              'space-between',

            alignItems:
              'center',

            flexWrap:
              'wrap'
          }}
        >

          <input
            type="search"
            placeholder={
              aba ===
                'areas'
                ? 'Pesquisar área ou sigla...'
                : 'Pesquisar usuário, e-mail, área ou perfil...'
            }
            value={
              pesquisa
            }
            onChange={
              event =>
                setPesquisa(
                  event.target.value
                )
            }
            style={{
              ...inputStyle,

              maxWidth:
                '420px'
            }}
          />

          <button
            type="button"
            onClick={
              aba ===
                'areas'
                ? abrirNovaArea
                : () =>
                    abrirNovoAcesso()
            }
            style={
              buttonPrimary
            }
          >
            {
              aba ===
                'areas'
                ? '+ Nova área'
                : '+ Adicionar usuário à área'
            }
          </button>

        </div>

        {props.erro && (
          <div
            style={{
              marginBottom:
                '16px',

              padding:
                '12px 14px',

              background:
                cores.vermelhoClaro,

              color:
                cores.vermelho,

              borderRadius:
                '8px'
            }}
          >
            {props.erro}
          </div>
        )}

        {erroLocal && (
          <div
            style={{
              marginBottom:
                '16px',

              padding:
                '12px 14px',

              background:
                '#FFF7D6',

              color:
                '#7A5B00',

              borderRadius:
                '8px'
            }}
          >
            {erroLocal}
          </div>
        )}

        {props.carregando ? (

          <div
            style={{
              ...card,

              padding:
                '36px',

              textAlign:
                'center'
            }}
          >
            Carregando...
          </div>

        ) : aba ===
          'areas' ? (

          <div
            style={{
              ...card,

              overflow:
                'hidden'
            }}
          >

            <table
              style={{
                width:
                  '100%',

                borderCollapse:
                  'collapse'
              }}
            >

              <thead>

                <tr>
                  <th style={th}>
                    Área
                  </th>

                  <th style={th}>
                    Sigla
                  </th>

                  <th style={th}>
                    Status
                  </th>

                  <th style={th}>
                    Gestor
                  </th>

                  <th style={th}>
                    Ações
                  </th>
                </tr>

              </thead>

              <tbody>

                {areasFiltradas.length ===
                  0 ? (

                  <tr>
                    <td
                      colSpan={
                        5
                      }
                      style={{
                        ...td,

                        textAlign:
                          'center',

                        color:
                          cores.textoSecundario
                      }}
                    >
                      Nenhuma área cadastrada.
                    </td>
                  </tr>

                ) : (

                  areasFiltradas.map(
                    area => (

                      <tr
                        key={
                          area.id
                        }
                      >

                        <td style={td}>
                          <strong>
                            {
                              area.nome
                            }
                          </strong>
                        </td>

                        <td style={td}>
                          {
                            area.sigla
                          }
                        </td>

                        <td style={td}>
                          <span
                            style={
                              area.ativa
                                ? badgeAtivo
                                : badgeInativo
                            }
                          >
                            {
                              area.ativa
                                ? 'Ativa'
                                : 'Inativa'
                            }
                          </span>
                        </td>

                        <td style={td}>
                          {
                            (() => {

                              const gestores =
                                gestoresPorArea.get(
                                  area.id
                                ) ||
                                [];

                              if (
                                gestores.length === 0
                              ) {
                                return (
                                  <span style={badgeInativo}>
                                    Sem gestor
                                  </span>
                                );
                              }

                              if (
                                gestores.length === 1
                              ) {
                                return (
                                  <span style={{ color: cores.texto, fontSize: '13px' }}>
                                    {gestores[0].usuarioNome}
                                  </span>
                                );
                              }

                              return (
                                <div>
                                  <span
                                    style={badgeAlerta}
                                    title={
                                      gestores
                                        .map(g => g.usuarioNome)
                                        .join(', ')
                                    }
                                  >
                                    ⚠ {gestores.length} gestores
                                  </span>
                                  <div
                                    style={{
                                      marginTop: '4px',
                                      fontSize: '11px',
                                      color: cores.textoSecundario,
                                      lineHeight: 1.4
                                    }}
                                  >
                                    {
                                      gestores
                                        .map(g => g.usuarioNome)
                                        .join(', ')
                                    }
                                  </div>
                                </div>
                              );
                            })()
                          }
                        </td>

                        <td style={td}>

                          <div
                            style={{
                              display:
                                'flex',

                              gap:
                                '8px',

                              flexWrap:
                                'wrap'
                            }}
                          >

                            <button
                              type="button"
                              onClick={() =>
                                abrirEditarArea(
                                  area
                                )
                              }
                              style={
                                buttonSecondary
                              }
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              disabled={
                                props.processando
                              }
                              onClick={() => {

                                props
                                  .onDefinirAreaAtiva(
                                    area.id,
                                    !area.ativa
                                  )
                                  .catch(
                                    (
                                      error:
                                        unknown
                                    ) =>
                                      console.error(
                                        error
                                      )
                                  );
                              }}
                              style={
                                area.ativa
                                  ? buttonDanger
                                  : buttonSecondary
                              }
                            >
                              {
                                area.ativa
                                  ? 'Desativar'
                                  : 'Ativar'
                              }
                            </button>

                          </div>

                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

            </table>

          </div>

        ) : (

          <div
            style={{
              ...card,

              overflow:
                'hidden'
            }}
          >

            <table
              style={{
                width:
                  '100%',

                borderCollapse:
                  'collapse'
              }}
            >

              <thead>

                <tr>
                  <th style={th}>
                    Usuário
                  </th>

                  <th style={th}>
                    Área
                  </th>

                  <th style={th}>
                    Perfil
                  </th>

                  <th style={th}>
                    Status
                  </th>

                  <th style={th}>
                    Ações
                  </th>
                </tr>

              </thead>

              <tbody>

                {linhasUsuariosFiltradas.length ===
                  0 ? (

                  <tr>
                    <td
                      colSpan={
                        5
                      }
                      style={{
                        ...td,

                        textAlign:
                          'center',

                        color:
                          cores.textoSecundario
                      }}
                    >
                      Nenhum usuário cadastrado foi encontrado.
                    </td>
                  </tr>

                ) : (

                  linhasUsuariosFiltradas.map(
                    linha => {

                      const vinculo =
                        linha.vinculo;

                      return (

                        <tr
                          key={
                            linha.chave
                          }
                        >

                          <td style={td}>

                            <strong>
                              {
                                linha.usuario.nome
                              }
                            </strong>

                            {
                              linha.usuario.email &&
                              (
                                <span
                                  style={{
                                    display:
                                      'block',

                                    marginTop:
                                      '3px',

                                    color:
                                      cores.textoSecundario,

                                    fontSize:
                                      '12px'
                                  }}
                                >
                                  {
                                    linha.usuario.email
                                  }
                                </span>
                              )
                            }

                          </td>

                          <td style={td}>
                            {
                              vinculo
                                ? (
                                  vinculo.areaSigla
                                    ? `${vinculo.areaSigla} - ${vinculo.areaNome}`
                                    : vinculo.areaNome
                                )
                                : (
                                  <span
                                    style={
                                      badgeSemArea
                                    }
                                  >
                                    Sem área
                                  </span>
                                )
                            }
                          </td>

                          <td style={td}>
                            {
                              vinculo
                                ?.perfil ||
                              '-'
                            }
                          </td>

                          <td style={td}>
                            {
                              vinculo
                                ? (
                                  <span
                                    style={
                                      vinculo.ativo
                                        ? badgeAtivo
                                        : badgeInativo
                                    }
                                  >
                                    {
                                      vinculo.ativo
                                        ? 'Ativo'
                                        : 'Inativo'
                                    }
                                  </span>
                                )
                                : (
                                  <span
                                    style={
                                      badgeSemArea
                                    }
                                  >
                                    Sem vínculo
                                  </span>
                                )
                            }
                          </td>

                          <td style={td}>

                            <div
                              style={{
                                display:
                                  'flex',

                                gap:
                                  '8px',

                                flexWrap:
                                  'wrap'
                              }}
                            >

                              {
                                vinculo ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        abrirEditarAcesso(
                                          vinculo
                                        )
                                      }
                                      style={
                                        buttonSecondary
                                      }
                                    >
                                      Editar acesso
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        props.processando
                                      }
                                      onClick={() => {

                                        props
                                          .onDefinirUsuarioAreaAtivo(
                                            vinculo.id,
                                            !vinculo.ativo
                                          )
                                          .catch(
                                            (
                                              error:
                                                unknown
                                            ) =>
                                              console.error(
                                                error
                                              )
                                          );
                                      }}
                                      style={
                                        vinculo.ativo
                                          ? buttonDanger
                                          : buttonSecondary
                                      }
                                    >
                                      {
                                        vinculo.ativo
                                          ? 'Desativar'
                                          : 'Ativar'
                                      }
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        abrirNovoAcesso(
                                          linha.usuario.id
                                        )
                                      }
                                      style={
                                        buttonPrimary
                                      }
                                    >
                                      + Outra área
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      abrirNovoAcesso(
                                        linha.usuario.id
                                      )
                                    }
                                    style={
                                      buttonPrimary
                                    }
                                  >
                                    + Vincular área
                                  </button>
                                )
                              }

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

        {formularioArea && (

          <div
            style={{
              position:
                'fixed',

              inset:
                0,

              zIndex:
                10000,

              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'center',

              padding:
                '20px',

              background:
                'rgba(15,23,42,.55)'
            }}
          >

            <div
              style={{
                width:
                  '100%',

                maxWidth:
                  '520px',

                padding:
                  '24px',

                background:
                  cores.branco,

                borderRadius:
                  '16px'
              }}
            >

              <h2
                style={{
                  color:
                    cores.texto
                }}
              >
                {
                  areaEditando
                    ? 'Editar área'
                    : 'Nova área'
                }
              </h2>

              <label>
                Nome
              </label>

              <input
                value={
                  nomeArea
                }
                onChange={
                  event =>
                    setNomeArea(
                      event.target.value
                    )
                }
                style={
                  inputStyle
                }
              />

              <div
                style={{
                  height:
                    '14px'
                }}
              />

              <label>
                Sigla
              </label>

              <input
                value={
                  siglaArea
                }
                maxLength={
                  10
                }
                onChange={
                  event =>
                    setSiglaArea(
                      event.target.value
                        .toUpperCase()
                    )
                }
                placeholder="Ex.: PRO"
                style={
                  inputStyle
                }
              />

              <label
                style={{
                  display:
                    'flex',

                  gap:
                    '8px',

                  marginTop:
                    '16px'
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    areaAtiva
                  }
                  onChange={
                    event =>
                      setAreaAtiva(
                        event.target.checked
                      )
                  }
                />

                Área ativa
              </label>

              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'flex-end',

                  gap:
                    '10px',

                  marginTop:
                    '24px'
                }}
              >

                <button
                  type="button"
                  onClick={() =>
                    setFormularioArea(
                      false
                    )
                  }
                  style={
                    buttonSecondary
                  }
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={
                    props.processando
                  }
                  onClick={() => {

                    salvarArea()
                      .catch(
                        (
                          error:
                            unknown
                        ) =>
                          console.error(
                            error
                          )
                      );
                  }}
                  style={
                    buttonPrimary
                  }
                >
                  Salvar área
                </button>

              </div>

            </div>

          </div>
        )}

        {formularioAcesso && (

          <div
            style={{
              position:
                'fixed',

              inset:
                0,

              zIndex:
                10000,

              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'center',

              padding:
                '20px',

              background:
                'rgba(15,23,42,.55)'
            }}
          >

            <div
              style={{
                width:
                  '100%',

                maxWidth:
                  '560px',

                padding:
                  '24px',

                background:
                  cores.branco,

                borderRadius:
                  '16px'
              }}
            >

              <h2
                style={{
                  color:
                    cores.texto
                }}
              >
                {
                  acessoEditando
                    ? 'Editar acesso'
                    : 'Adicionar usuário à área'
                }
              </h2>

              <label>
                Usuário
              </label>

              <select
                value={
                  usuarioId
                }
                disabled={
                  !!acessoEditando
                }
                onChange={
                  event =>
                    setUsuarioId(
                      event.target.value
                    )
                }
                style={
                  inputStyle
                }
              >

                <option value="">
                  Selecione
                </option>

                {usuarios.map(
                  usuario => (

                    <option
                      key={
                        usuario.id
                      }
                      value={
                        usuario.id
                      }
                    >
                      {
                        usuario.nome
                      } - {
                        usuario.email
                      }
                    </option>
                  )
                )}

              </select>

              <div
                style={{
                  height:
                    '14px'
                }}
              />

              <label>
                Área
              </label>

              <select
                value={
                  areaId
                }
                disabled={
                  !!acessoEditando
                }
                onChange={
                  event =>
                    setAreaId(
                      event.target.value
                    )
                }
                style={
                  inputStyle
                }
              >

                <option value="">
                  Selecione
                </option>

                {areas
                  .filter(
                    area =>
                      area.ativa
                  )
                  .map(
                    area => (

                      <option
                        key={
                          area.id
                        }
                        value={
                          area.id
                        }
                      >
                        {
                          area.sigla
                        } - {
                          area.nome
                        }
                      </option>
                    )
                  )}

              </select>

              <div
                style={{
                  height:
                    '14px'
                }}
              />

              <label>
                Perfil na área
              </label>

              <select
                value={
                  perfilArea
                }
                onChange={
                  event =>
                    setPerfilArea(
                      event.target
                        .value as PerfilArea
                    )
                }
                style={
                  inputStyle
                }
              >

                <option value="Membro">
                  Membro
                </option>

                <option value="Gestor">
                  Gestor
                </option>

                <option value="Administrador da área">
                  Administrador da área
                </option>

              </select>

              <label
                style={{
                  display:
                    'flex',

                  gap:
                    '8px',

                  marginTop:
                    '16px'
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    acessoAtivo
                  }
                  onChange={
                    event =>
                      setAcessoAtivo(
                        event.target.checked
                      )
                  }
                />

                Vínculo ativo
              </label>

              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'flex-end',

                  gap:
                    '10px',

                  marginTop:
                    '24px'
                }}
              >

                <button
                  type="button"
                  onClick={() =>
                    setFormularioAcesso(
                      false
                    )
                  }
                  style={
                    buttonSecondary
                  }
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={
                    props.processando
                  }
                  onClick={() => {

                    salvarAcesso()
                      .catch(
                        (
                          error:
                            unknown
                        ) =>
                          console.error(
                            error
                          )
                      );
                  }}
                  style={
                    buttonPrimary
                  }
                >
                  Salvar acesso
                </button>

              </div>

            </div>

          </div>
        )}

      </section>
    );
  };

export default GestaoAreasPage;