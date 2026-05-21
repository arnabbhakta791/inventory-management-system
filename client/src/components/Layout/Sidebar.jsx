import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, AppstoreOutlined, TeamOutlined,
  ShoppingCartOutlined, InboxOutlined, BarChartOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRole } from '../../hooks/useRole';

const { Sider } = Layout;

const ALL_MENU_ITEMS = [
  { key: '/',                icon: <DashboardOutlined />,     label: 'Dashboard',       minRole: 'staff'   },
  { key: '/products',        icon: <AppstoreOutlined />,      label: 'Products',        minRole: 'staff'   },
  { key: '/inventory',       icon: <BarChartOutlined />,      label: 'Inventory',       minRole: 'staff'   },
  { key: '/suppliers',       icon: <TeamOutlined />,          label: 'Suppliers',       minRole: 'staff'   },
  { key: '/purchase-orders', icon: <InboxOutlined />,         label: 'Purchase Orders', minRole: 'staff'   },
  { key: '/orders',          icon: <ShoppingCartOutlined />,  label: 'Sales Orders',    minRole: 'staff'   },
  { key: '/users',           icon: <UserOutlined />,          label: 'Users',           minRole: 'manager' },
];

// ── Shared sidebar content (used in both Sider and mobile Drawer)
export const SidebarContent = ({ collapsed = false, onItemClick }) => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { can }      = useRole();

  // Filter menu items the current role is allowed to see
  const menuItems = ALL_MENU_ITEMS.filter((item) => can(item.minRole));

  const handleClick = ({ key }) => {
    navigate(key);
    onItemClick?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? 0 : '0 20px',
        gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        {/* Brand mark */}
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          fontSize: 14, fontWeight: 800, color: '#fff',
        }}>
          IP
        </div>
        {!collapsed && (
          <span style={{
            color: '#fff', fontWeight: 700, fontSize: 16,
            letterSpacing: '-0.02em', whiteSpace: 'nowrap',
            opacity: 1, transition: 'opacity 0.2s',
          }}>
            Inventory Pro
          </span>
        )}
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          inlineCollapsed={collapsed}
          items={menuItems}
          onClick={handleClick}
          style={{
            background: 'transparent',
            border: 'none',
          }}
        />
      </div>

      {/* Version footer */}
      {!collapsed && (
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.25)',
          fontSize: 11,
          flexShrink: 0,
        }}>
          Inventory Pro v1.0
        </div>
      )}
    </div>
  );
};

// ── Desktop Sider wrapper ─────────────────────────────────────────
const Sidebar = ({ collapsed }) => (
  <Sider
    collapsible
    collapsed={collapsed}
    trigger={null}
    width={224}
    collapsedWidth={64}
    style={{
      background: 'linear-gradient(180deg, #1E1B4B 0%, #111827 100%)',
      boxShadow: '2px 0 8px rgba(0,0,0,0.25)',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflow: 'hidden',
    }}
  >
    <SidebarContent collapsed={collapsed} />
  </Sider>
);

export default Sidebar;
