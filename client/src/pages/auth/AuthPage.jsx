import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Typography, Alert } from 'antd';
import {
  UserOutlined, LockOutlined, MailOutlined,
  ShopOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text } = Typography;

const DEMO_ACCOUNTS = [
  { label: 'TechStore — Owner',   email: 'owner@techstore.com',   pw: 'password123' },
  { label: 'FashionHub — Owner',  email: 'owner@fashionhub.com',  pw: 'password123' },
  { label: 'TechStore — Manager', email: 'manager@techstore.com', pw: 'password123' },
  { label: 'TechStore — Staff',   email: 'staff@techstore.com',   pw: 'password123' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Animation phases:
//   idle     → form is fully visible, no transition running
//   exiting  → old form slides + fades out  (250 ms)
//   entering → new form slides + fades in   (250 ms)
// ─────────────────────────────────────────────────────────────────────────────
const ANIM_DURATION = 250; // ms

const AuthPage = () => {
  const { login, register } = useAuth();
  const navigate             = useNavigate();
  const location             = useLocation();

  // Derive initial mode from the current URL
  const [mode,      setMode]      = useState(location.pathname === '/register' ? 'register' : 'login');
  const [animPhase, setAnimPhase] = useState('idle');   // 'idle' | 'exiting' | 'entering'
  const [direction, setDirection] = useState(1);        // 1 = login→register, -1 = register→login
  const [form]      = Form.useForm();
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const pendingMode = useRef(null);

  // Sync URL → mode when navigating via browser back/forward
  useEffect(() => {
    const next = location.pathname === '/register' ? 'register' : 'login';
    if (next !== mode && animPhase === 'idle') {
      setMode(next);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch mode with animation ──────────────────────────────────────────
  const switchMode = (nextMode) => {
    if (nextMode === mode || animPhase !== 'idle') return;
    pendingMode.current = nextMode;
    setDirection(nextMode === 'register' ? 1 : -1);
    setAnimPhase('exiting');
    form.resetFields();
    setError('');
  };

  useEffect(() => {
    if (animPhase !== 'exiting') return;
    const t = setTimeout(() => {
      setMode(pendingMode.current);
      navigate(`/${pendingMode.current}`, { replace: true });
      setAnimPhase('entering');
    }, ANIM_DURATION);
    return () => clearTimeout(t);
  }, [animPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (animPhase !== 'entering') return;
    // Small rAF delay so browser paints the entering-start state before transitioning
    const raf = requestAnimationFrame(() => {
      const t = setTimeout(() => setAnimPhase('idle'), ANIM_DURATION);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(raf);
  }, [animPhase]);

  // ── Inline style for the animated form wrapper ─────────────────────────
  const SLIDE_PX = 48;
  const formWrapStyle = {
    transition: animPhase !== 'idle'
      ? `transform ${ANIM_DURATION}ms cubic-bezier(0.4,0,0.2,1), opacity ${ANIM_DURATION}ms ease`
      : 'none',
    transform: animPhase === 'exiting'
      ? `translateX(${direction * -SLIDE_PX}px)`
      : animPhase === 'entering'
      ? `translateX(${direction * SLIDE_PX}px)`
      : 'translateX(0)',
    opacity: animPhase === 'idle' ? 1 : 0,
  };

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleLogin = async ({ email, password }) => {
    try {
      setLoading(true); setError('');
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect email or password.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (values) => {
    try {
      setLoading(true); setError('');
      await register(values);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const fillDemo = (acc) => {
    form.setFieldsValue({ email: acc.email, password: acc.pw });
    setError('');
  };

  const isLogin    = mode === 'login';
  const isRegister = mode === 'register';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #1E1B4B 0%, #111827 50%, #0F172A 100%)',
    }}>
      {/* ── Left panel — branding (never re-renders during switch) ──────── */}
      <div
        id="auth-brand-panel"
        style={{
          flex: 1,
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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

          {/* Headline — animates with the form content */}
          <div style={formWrapStyle}>
            {isLogin ? (
              <>
                <Title level={2} style={{ color: '#fff', margin: '0 0 16px', letterSpacing: '-0.03em', fontSize: 36 }}>
                  Manage inventory<br />at any scale.
                </Title>
                <Text style={{ color: '#94A3B8', fontSize: 16, lineHeight: 1.7 }}>
                  Multi-tenant SaaS for real-time stock tracking,<br />
                  purchase orders, and smart low-stock alerts.
                </Text>
              </>
            ) : (
              <>
                <Title level={2} style={{ color: '#fff', margin: '0 0 16px', letterSpacing: '-0.03em', fontSize: 36 }}>
                  Your inventory,<br />under control.
                </Title>
                <Text style={{ color: '#94A3B8', fontSize: 16, lineHeight: 1.7 }}>
                  Set up your workspace in seconds. Manage stock,<br />
                  suppliers, and orders — all in one place.
                </Text>
              </>
            )}
          </div>

          {/* Feature pills — always visible */}
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

      {/* ── Right panel — form ─────────────────────────────────────────── */}
      <div style={{
        width: '100%',
        maxWidth: 460,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '40px 40px',
        background: '#ffffff',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.3)',
        overflowY: 'auto',
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

        {/* ── Animated form area ──────────────────────────────────────── */}
        <div style={{ ...formWrapStyle, willChange: 'transform, opacity' }}>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <Title level={3} style={{ margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              {isLogin ? 'Welcome back' : 'Create your workspace'}
            </Title>
            <Text type="secondary">
              {isLogin ? 'Sign in to your workspace' : 'Get started — it only takes a minute'}
            </Text>
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

          <Form
            form={form}
            name={mode}
            onFinish={isLogin ? handleLogin : handleRegister}
            layout="vertical"
            size="large"
          >
            {/* Register-only fields */}
            {isRegister && (
              <>
                <Form.Item
                  name="tenantName"
                  label={<Text strong style={{ fontSize: 13 }}>Business name</Text>}
                  rules={[{ required: true, message: 'Business name is required' }]}
                >
                  <Input
                    prefix={<ShopOutlined style={{ color: '#94A3B8' }} />}
                    placeholder="e.g. Acme Stores"
                    autoComplete="organization"
                  />
                </Form.Item>

                <Form.Item
                  name="name"
                  label={<Text strong style={{ fontSize: 13 }}>Your name</Text>}
                  rules={[{ required: true, message: 'Your name is required' }]}
                >
                  <Input
                    prefix={<UserOutlined style={{ color: '#94A3B8' }} />}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </Form.Item>
              </>
            )}

            {/* Shared fields */}
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
              rules={[
                { required: true, message: 'Password is required' },
                ...(isRegister ? [{ min: 6, message: 'At least 6 characters' }] : []),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
                placeholder={isRegister ? 'Minimum 6 characters' : '••••••••'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </Form.Item>

            {/* Register-only confirm password */}
            {isRegister && (
              <Form.Item
                name="confirmPassword"
                label={<Text strong style={{ fontSize: 13 }}>Confirm password</Text>}
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Please confirm your password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('Passwords do not match'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Form.Item>
            )}

            <Form.Item style={{ marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{ height: 46, fontWeight: 600, fontSize: 15, borderRadius: 10 }}
              >
                {isLogin ? 'Sign in' : 'Create account'}
              </Button>
            </Form.Item>
          </Form>

          {/* Switch link */}
          <div style={{ textAlign: 'center', marginBottom: isLogin ? 24 : 0 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <Link
              to={isLogin ? '/register' : '/login'}
              style={{ fontWeight: 600 }}
              onClick={(e) => {
                e.preventDefault();
                switchMode(isLogin ? 'register' : 'login');
              }}
            >
              {isLogin ? 'Create workspace' : 'Sign in'}
            </Link>
          </div>

          {/* Demo credentials — login only */}
          {isLogin && (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
