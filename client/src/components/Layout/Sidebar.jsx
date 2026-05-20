import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, AppstoreOutlined, TeamOutlined,
  ShoppingCartOutlined, FileTextOutlined, BarChartOutlined,
  UserOutlined, InboxOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/products', icon: <AppstoreOutlined />, label: 'Products' },
  { key: '/inventory', icon: <BarChartOutlined />, label: 'Inventory' },
  { key: '/suppliers', icon: <TeamOutlined />, label: 'Suppliers' },
  { key: '/purchase-orders', icon: <InboxOutlined />, label: 'Purchase Orders' },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: 'Sales Orders' },
  { key: '/users', icon: <UserOutlined />, label: 'Users' },
];

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <Sider collapsible collapsed={collapsed} trigger={null} width={220}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: collapsed ? 14 : 18, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {collapsed ? 'IMS' : 'Inventory Pro'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
};

export default Sidebar;
