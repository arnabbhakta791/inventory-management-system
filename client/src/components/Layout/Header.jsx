import React from 'react';
import { Layout, Button, Dropdown, Avatar, Tooltip, Badge } from 'antd';
import {
  MenuFoldOutlined, MenuUnfoldOutlined,
  UserOutlined, LogoutOutlined,
  WifiOutlined, MenuOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';

const { Header: AntHeader } = Layout;

const ROLE_GRADIENT = {
  owner:   'linear-gradient(135deg, #F59E0B, #EF4444)',
  manager: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
  staff:   'linear-gradient(135deg, #10B981, #06B6D4)',
};

const Header = ({ collapsed, onToggle, onMobileMenuOpen }) => {
  const { user, tenant, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const menuItems = [
    {
      key: 'profile',
      disabled: true,
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{user?.email}</div>
        </div>
      ),
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', danger: true },
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') { logout(); navigate('/login'); }
  };

  return (
    <AntHeader
      style={{
        background:    '#ffffff',
        padding:       '0 20px',
        height:        64,
        // ↓ do NOT set lineHeight here — it inherits into children and
        //   breaks vertical alignment of text nodes inside flex items
        display:       'flex',
        alignItems:    'center',
        justifyContent:'space-between',
        borderBottom:  '1px solid #F1F5F9',
        boxShadow:     '0 1px 3px rgba(0,0,0,0.06)',
        position:      'sticky',
        top:           0,
        zIndex:        100,
      }}
    >
      {/* ── Left: collapse / hamburger toggle ─────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Desktop sidebar toggle */}
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          className="hide-mobile"
          style={{ fontSize: 18, color: '#64748B', width: 40, height: 40, borderRadius: 8 }}
        />
        {/* Mobile hamburger */}
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={onMobileMenuOpen}
          className="hide-desktop"
          style={{ fontSize: 18, color: '#64748B', width: 40, height: 40, borderRadius: 8 }}
        />
      </div>

      {/* ── Right: live status · tenant · user ────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Live connection indicator */}
        <Tooltip title={connected ? 'Live updates active' : 'Connecting…'}>
          <Badge dot status={connected ? 'success' : 'processing'} offset={[-4, 4]}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: connected ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default', transition: 'background 0.3s',
            }}>
              <WifiOutlined style={{ fontSize: 15, color: connected ? '#10B981' : '#F59E0B' }} />
            </div>
          </Badge>
        </Tooltip>

        {/* Tenant chip — hidden on mobile */}
        {tenant && (
          <div
            className="hide-mobile"
            style={{
              display:      'flex',
              alignItems:   'center',
              height:       30,
              padding:      '0 12px',
              background:   'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
              borderRadius: 20,
              border:       '1px solid #C7D2FE',
              fontSize:     12,
              fontWeight:   600,
              color:        '#4F46E5',
              whiteSpace:   'nowrap',
              lineHeight:   1,          // prevent inheritance from blowing height
            }}
          >
            {tenant.name}
          </div>
        )}

        {/* User dropdown */}
        <Dropdown
          menu={{ items: menuItems, onClick: handleMenuClick }}
          placement="bottomRight"
          trigger={['click']}
        >
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            padding:      '4px 8px',
            borderRadius: 10,
            cursor:       'pointer',
            transition:   'background 0.15s',
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {/* Avatar — use initial letter, no icon prop conflict */}
            <Avatar
              size={34}
              style={{
                background: ROLE_GRADIENT[user?.role] ?? ROLE_GRADIENT.staff,
                fontWeight: 700,
                fontSize:   14,
                flexShrink: 0,
                lineHeight: '34px',   // match size so initial centres correctly
              }}
            >
              {user?.name?.[0]?.toUpperCase() ?? <UserOutlined />}
            </Avatar>

            {/* Name + role — hidden on mobile */}
            <div className="hide-mobile" style={{ lineHeight: 1, userSelect: 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'capitalize' }}>
                {user?.role}
              </div>
            </div>
          </div>
        </Dropdown>

      </div>
    </AntHeader>
  );
};

export default Header;
