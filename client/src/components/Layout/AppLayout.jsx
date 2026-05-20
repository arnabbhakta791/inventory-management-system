import React, { useState } from 'react';
import { Layout, Drawer, Grid } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar, { SidebarContent } from './Sidebar';
import Header from './Header';
import StockAlertListener from '../StockAlertListener';

const { Content } = Layout;
const { useBreakpoint } = Grid;

const AppLayout = () => {
  const [collapsed,       setCollapsed]       = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px

  return (
    <Layout style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      {/* Real-time stock notifications */}
      <StockAlertListener />

      {/* ── Desktop sidebar (hidden on mobile) ─────────────────── */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} />
      )}

      {/* ── Mobile sidebar Drawer ───────────────────────────────── */}
      <Drawer
        placement="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        width={224}
        className="mobile-sidebar-drawer"
        title="Inventory Pro"
        styles={{
          body:   { padding: 0, background: 'linear-gradient(180deg, #1E1B4B 0%, #111827 100%)' },
          header: { background: '#1E1B4B', borderBottom: '1px solid rgba(255,255,255,0.08)' },
        }}
      >
        <SidebarContent onItemClick={() => setMobileDrawerOpen(false)} />
      </Drawer>

      {/* ── Main content area ───────────────────────────────────── */}
      <Layout style={{ background: '#F1F5F9', minWidth: 0 }}>
        <Header
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onMobileMenuOpen={() => setMobileDrawerOpen(true)}
        />

        <Content
          className="app-content"
          style={{
            margin:       isMobile ? '12px' : '24px',
            padding:      isMobile ? '16px' : '28px',
            background:   '#ffffff',
            borderRadius: isMobile ? 8 : 12,
            minHeight:    'calc(100vh - 64px - 48px)',
            boxShadow:    '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
