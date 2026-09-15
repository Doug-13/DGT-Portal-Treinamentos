import * as React from 'react';

export interface ITopbarProps {
  userName: string;
  userEmail?: string;
  fotoUsuario?: string;
  logo?: React.ReactNode;
  onFotoError?: () => void;
  className?: string;
}

const Topbar: React.FC<ITopbarProps> = ({
  userName,
  userEmail,
  fotoUsuario,
  logo,
  onFotoError,
  className
}) => (
  <header
    className={className}
    style={{
      minHeight: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16
    }}
  >
    <div>{logo}</div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 600 }}>{userName}</div>
        {userEmail && <small>{userEmail}</small>}
      </div>

      {fotoUsuario && (
        <img
          src={fotoUsuario}
          alt={`Foto de ${userName}`}
          onError={onFotoError}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            objectFit: 'cover'
          }}
        />
      )}
    </div>
  </header>
);

export default Topbar;
