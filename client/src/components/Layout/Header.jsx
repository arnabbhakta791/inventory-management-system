import React from 'react';
import { Layout, Button, Dropdown, Avatar, Space, Tag, Tooltip, Badge } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined,
  UserOutlined, LogoutOutlined, WifiOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';

const { Header: AntHeader } = Layout;

const Header = ({ collapsed, onToggle }) => {
  const { user, tenant, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const menuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    }
  };

  return (
    <AntHeader
      style={{
        background: '#fff',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={onToggle}
        style={{ fontSize: 16 }}
      />

      <Space size="middle">
        {/* Real-time connection indicator */}
        <Tooltip title={connected ? 'Live updates connected' : 'Connecting to live updates…'}>
          <Badge
            dot
            status={connected ? 'success' : 'processing'}
            offset={[-2, 2]}
          >
            <WifiOutlined
              style={{
                fontSize: 16,
                color: connected ? '#52c41a' : '#faad14',
                transition: 'color 0.3s',
              }}
            />
          </Badge>
        </Tooltip>

        {tenant && <Tag color="blue">{tenant.name}</Tag>}

        <Dropdown
          menu={{ items: menuItems, onClick: handleMenuClick }}
          placement="bottomRight"
        >
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} />
            <span>{user?.name}</span>
            <Tag color="green">{user?.role}</Tag>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Header;
