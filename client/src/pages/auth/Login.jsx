import React, { useState } from 'react';
import { Form, Input, Button, Typography, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text } = Typography;

// Quick-fill demo credentials
const DEMO_ACCOUNTS = [
  { label: 'TechStore — Owner',   email: 'owner@techstore.com',   pw: 'password123' },
  { label: 'FashionHub — Owner',  email: 'owner@fashionhub.com',  pw: 'password123' },
  { label: 'TechStore — Manager', email: 'manager@techstore.com', pw: 'password123' },
  { label: 'TechStore — Staff',   email: 'staff@techstore.com',   pw: 'password123' },
];

const Login = () => {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form]     = Form.useForm();
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const onFinish = async ({ email, password }) => {
    try {
      setLoading(true);
      setError('');
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc) => {
    form.setFieldsValue({ email: acc.email, password: acc.pw });
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #1E1B4B 0%, #111827 50%, #0F172A 100%)',
    }}>
      {/* ── Left panel — branding ──────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'none',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        position: 'relative',
        overflow: 'hidden',
      }}
        className="hide-mobile"
        id="login-brand-panel"
      >
        {/* Background decoration */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99,102,241,0.5)',
              fontSize: 18, fontWeight: 800, color: '#fff',
            }}>IP</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              Inventory Pro
            </span>
          </div>

          <Title level={2} style={{ color: '#fff', margin: '0 0 16px', letterSpacing: '-0.03em', fontSize: 36 }}>
            Manage inventory<br />at any scale.
          </Title>
          <Text style={{ color: '#94A3B8', fontSize: 16, lineHeight: 1.7 }}>
            Multi-tenant SaaS for real-time stock tracking,<br />
            purchase orders, and smart low-stock alerts.
          </Text>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 40 }}>
            {['Real-time alerts', 'Variant management', 'PO workflow', 'Role-based access'].map((f) => (
              <div key={f} style={{
                padding: '6px 14px',
                background: 'rgba(255,255,255,0.07)',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#C7D2FE',
                fontSize: 13,
                fontWeight: 500,
              }}>{f}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — login form ───────────────────────────── */}
      <div style={{
        width: '100%',
        maxWidth: 460,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '40px 40px',
        background: '#ffffff',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.3)',
      }}>
        {/* Mobile logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}
          className="hide-desktop">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
          }}>IP</div>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#0F172A' }}>Inventory Pro</span>
        </div>

        <div style={{ marginBottom: 32 }}>
          <Title level={3} style={{ margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Welcome back
          </Title>
          <Text type="secondary">Sign in to your workspace</Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 20, borderRadius: 8 }}
            closable
            onClose={() => setError('')}
          />
        )}

        <Form form={form} name="login" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="email"
            label={<Text strong style={{ fontSize: 13 }}>Email address</Text>}
            rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#94A3B8' }} />}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<Text strong style={{ fontSize: 13 }}>Password</Text>}
            rules={[{ required: true, message: 'Password is required' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{ height: 46, fontWeight: 600, fontSize: 15, borderRadius: 10 }}
            >
              Sign in
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>Don't have an account? </Text>
          <Link to="/register" style={{ fontWeight: 600 }}>Create workspace</Link>
        </div>

        {/* Demo credentials */}
        <div style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <ThunderboltOutlined style={{ color: '#6366F1', fontSize: 13 }} />
            <Text strong style={{ fontSize: 12, color: '#64748B' }}>DEMO ACCOUNTS — click to fill</Text>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc)}
                style={{
                  textAlign: 'left',
                  padding: '7px 10px',
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: 7,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#374151',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.background = '#EEF2FF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
              >
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{acc.label}</span>
                <span style={{ color: '#94A3B8', marginLeft: 6 }}>{acc.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
