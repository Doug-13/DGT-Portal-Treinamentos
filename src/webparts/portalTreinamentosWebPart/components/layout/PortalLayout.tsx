import * as React from 'react';

export interface IPortalLayoutProps {
  sidebar?: React.ReactNode;
  topbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const PortalLayout: React.FC<IPortalLayoutProps> = ({
  sidebar,
  topbar,
  children,
  className
}) => (
  <div className={className} style={{ minHeight: '100%' }}>
    {topbar}

    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      {sidebar}
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  </div>
);

export default PortalLayout;
