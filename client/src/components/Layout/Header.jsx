import React from 'react';
import { Layout, Button, Dropdown, Avatar, Space, Tag, Tooltip, Badge } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined,
  UserOutlined, LogoutOutlined,
  WifiOutlined, MenuOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';

const { Header: AntHeader } = Layout;

// Role → gradient for avatar background
const ROLE_GRADIENT = {
  owner:   'linear-gradient(135deg, #F59E0B, #EF4444)',
  manager: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
  staff:   'linear-gradient(135deg, #10B981, #06B6D4)',
};
const ROLE_COLOR = {
  owner:   'gold',
  manager: 'geekblue',
  staff:   'cyan',
};

const Header = ({ collapsed, onToggle, onMobileMenuOpen }) => {
  const { user, tenant, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const menuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: (
        <div>
          <div style={{ fontWeight: 600 }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>{user?.email}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', danger: true },
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
        background: '#ffffff',
        padding: '0 20px',
        height: 64,
        lineHeight: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #F1F5F9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left — collapse toggle */}
      <Space size={4}>
        {/* Desktop toggle */}
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          className="hide-mobile"
          style={{
            fontSize: 18,
            color: '#64748B',
            width: 40, height: 40,
            borderRadius: 8,
          }}
        />
        {/* Mobile hamburger */}
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={onMobileMenuOpen}
          className="hide-desktop"
          style={{
            fontSize: 18,
            color: '#64748B',
            width: 40, height: 40,
            borderRadius: 8,
          }}
        />
      </Space>

      {/* Right — connection status + tenant + user */}
      <Space size={12}>
        {/* Live connection indicator */}
        <Tooltip title={connected ? 'Live updates active' : 'Connecting…'}>
          <Badge dot status={connected ? 'success' : 'processing'} offset={[-3, 3]}>
            <div style={{
              width: 32, height: 32,
              borderRadius: 8,
              background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s',
            }}>
              <WifiOutlined style={{
                fontSize: 14,
                color: connected ? '#10B981' : '#F59E0B',
              }} />
            </div>
          </Badge>
        </Tooltip>

        {/* Tenant chip */}
        {tenant && (
          <div className="hide-mobile" style={{
            padding: '4px 12px',
            background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            color: '#4F46E5',
            border: '1px solid #C7D2FE',
          }}>
            {tenant.name}
          </div>
        )}

        {/* User menu */}
        <Dropdown
          menu={{ items: menuItems, onClick: handleMenuClick }}
          placement="bottomRight"
          trigger={['click']}
        >
          <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background 0.15s' }}
            className="user-menu-trigger">
            <Avatar
              size={34}
              icon={<UserOutlined />}
              style={{
                background: ROLE_GRADIENT[user?.role] || ROLE_GRADIENT.staff,
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </Avatar>
            <div className="hide-mobile" style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'capitalize' }}>
                {user?.role}
              </div>
            </div>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Header;
