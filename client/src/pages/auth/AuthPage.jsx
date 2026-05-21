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

const ANIM_DURATION = 250; // ms

// ─── Mini bar chart bars (stock-in vs stock-out, last 7 days) ────────────────
const BAR_DATA = [
  { in: 60, out: 35 },
  { in: 40, out: 55 },
  { in: 80, out: 30 },
  { in: 55, out: 45 },
  { in: 90, out: 40 },
  { in: 45, out: 60 },
  { in: 70, out: 50 },
];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_H = 44; // px — max bar height

// ─── Glassmorphism card helper ───────────────────────────────────────────────
const GlassCard = ({ children, style = {}, className = '' }) => (
  <div
    className={className}
    style={{
      background:    'rgba(255,255,255,0.06)',
      border:        '1px solid rgba(255,255,255,0.10)',
      borderRadius:  14,
      backdropFilter:'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      ...style,
    }}
  >
    {children}
  </div>
);

// ─── The premium dashboard mockup rendered in the left panel ─────────────────
const DashboardMockup = () => (
  <div style={{ position: 'relative', marginTop: 36, marginBottom: 8 }}>

    {/* ── Main dashboard window ─────────────────────────────────────────── */}
    <GlassCard className="auth-float-slow" style={{ padding: '16px 18px' }}>
      {/* Window chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5F57' }} />
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFBD2E' }} />
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28C840' }} />
        <div style={{
          marginLeft: 'auto',
          fontSize: 10, fontWeight: 600,
          color: '#475569',
          letterSpacing: '0.05em',
        }}>DASHBOARD</div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Products',    value: '1,247', accent: '#6366F1', change: '+12' },
          { label: 'Orders',      value: '84',    accent: '#10B981', change: '+5'  },
          { label: 'Low Stock',   value: '3',     accent: '#F59E0B', change: '-2'  },
        ].map(({ label, value, accent, change }) => (
          <div key={label} style={{
            background:   'rgba(255,255,255,0.05)',
            borderRadius: 10,
            padding:      '10px 10px 8px',
          }}>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#F1F5F9', lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <div style={{ height: 2, flex: 1, background: accent, borderRadius: 2, opacity: 0.8 }} />
              <span style={{ fontSize: 9, color: accent, fontWeight: 600 }}>{change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Stock movement mini chart */}
      <div style={{
        background:   'rgba(255,255,255,0.03)',
        borderRadius: 10,
        padding:      '10px 12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>Stock Movement — 7 days</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#6366F1' }}>
              <div style={{ width: 6, height: 6, borderRadius: 1, background: '#6366F1' }} /> In
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#F43F5E' }}>
              <div style={{ width: 6, height: 6, borderRadius: 1, background: '#F43F5E' }} /> Out
            </span>
          </div>
        </div>

        {/* Bars */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: MAX_H }}>
          {BAR_DATA.map(({ in: inV, out: outV }, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{
                flex: 1,
                height:       `${(inV / 100) * MAX_H}px`,
                background:   'rgba(99,102,241,0.75)',
                borderRadius: '3px 3px 0 0',
              }} />
              <div style={{
                flex: 1,
                height:       `${(outV / 100) * MAX_H}px`,
                background:   'rgba(244,63,94,0.65)',
                borderRadius: '3px 3px 0 0',
              }} />
            </div>
          ))}
        </div>

        {/* Day labels */}
        <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
          {DAYS.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#475569' }}>{d}</div>
          ))}
        </div>
      </div>
    </GlassCard>

    {/* ── Floating alert card (bottom-right) ────────────────────────────── */}
    <GlassCard
      className="auth-float"
      style={{
        position:  'absolute',
        right:     -18,
        bottom:    -22,
        padding:   '10px 14px',
        background:'rgba(245,158,11,0.12)',
        border:    '1px solid rgba(245,158,11,0.25)',
        minWidth:  170,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background:  'rgba(245,158,11,0.2)',
          display:     'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15,
        }}>⚠️</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#FCD34D', marginBottom: 1 }}>
            Low Stock Alert
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>3 variants need restocking</div>
        </div>
      </div>
    </GlassCard>

    {/* ── Floating "live" indicator (top-left) ──────────────────────────── */}
    <GlassCard
      className="auth-float"
      style={{
        position:   'absolute',
        top:        -18,
        left:       -18,
        padding:    '8px 12px',
        background: 'rgba(16,185,129,0.12)',
        border:     '1px solid rgba(16,185,129,0.25)',
        animationDelay: '1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div
          className="auth-pulse-dot"
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#10B981',
            boxShadow:  '0 0 6px rgba(16,185,129,0.8)',
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6EE7B7' }}>Live updates on</span>
      </div>
    </GlassCard>

  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
const AuthPage = () => {
  const { login, register } = useAuth();
  const navigate             = useNavigate();
  const location             = useLocation();

  const [mode,      setMode]      = useState(location.pathname === '/register' ? 'register' : 'login');
  const [animPhase, setAnimPhase] = useState('idle');
  const [direction, setDirection] = useState(1);
  const [form]      = Form.useForm();
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const pendingMode = useRef(null);

  // Sync URL → mode on browser back/forward
  useEffect(() => {
    const next = location.pathname === '/register' ? 'register' : 'login';
    if (next !== mode && animPhase === 'idle') setMode(next);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const raf = requestAnimationFrame(() => {
      const t = setTimeout(() => setAnimPhase('idle'), ANIM_DURATION);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(raf);
  }, [animPhase]);

  const SLIDE_PX = 48;
  const animStyle = {
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

  return (
    <div style={{
      minHeight: '100vh',
      display:   'flex',
      background: 'linear-gradient(135deg, #1E1B4B 0%, #111827 50%, #0F172A 100%)',
    }}>

      {/* ── Left panel — branding + mockup ────────────────────────────────── */}
      <div
        id="auth-brand-panel"
        style={{
          flex:           1,
          display:        'none',
          flexDirection:  'column',
          justifyContent: 'center',
          padding:        '48px 56px',
          position:       'relative',
          overflow:       'hidden',
        }}
      >
        {/* Radial glow */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 25% 40%, rgba(99,102,241,0.18) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        {/* Bottom-right secondary glow */}
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-5%',
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background:  'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display:     'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow:   '0 8px 24px rgba(99,102,241,0.5)',
              fontSize: 18, fontWeight: 800, color: '#fff',
            }}>IP</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              Inventory Pro
            </span>
          </div>

          {/* Animated headline */}
          <div style={animStyle}>
            {isLogin ? (
              <>
                <Title level={2} style={{ color: '#fff', margin: '0 0 12px', letterSpacing: '-0.03em', fontSize: 34 }}>
                  Manage inventory<br />at any scale.
                </Title>
                <Text style={{ color: '#94A3B8', fontSize: 15, lineHeight: 1.7 }}>
                  Multi-tenant SaaS for real-time stock tracking,<br />
                  purchase orders, and smart low-stock alerts.
                </Text>
              </>
            ) : (
              <>
                <Title level={2} style={{ color: '#fff', margin: '0 0 12px', letterSpacing: '-0.03em', fontSize: 34 }}>
                  Your inventory,<br />under control.
                </Title>
                <Text style={{ color: '#94A3B8', fontSize: 15, lineHeight: 1.7 }}>
                  Set up your workspace in seconds. Manage stock,<br />
                  suppliers, and orders — all in one place.
                </Text>
              </>
            )}
          </div>

          {/* Dashboard mockup — not animated, always visible */}
          <DashboardMockup />

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 32 }}>
            {['Real-time alerts', 'Variant management', 'PO workflow', 'Role-based access'].map((f) => (
              <div key={f} style={{
                padding:    '5px 13px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 20,
                border:     '1px solid rgba(255,255,255,0.1)',
                color:      '#C7D2FE',
                fontSize:   12,
                fontWeight: 500,
              }}>{f}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────────────── */}
      <div style={{
        width:          '100%',
        maxWidth:       460,
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
        padding:        '40px 40px',
        background:     '#ffffff',
        boxShadow:      '-20px 0 60px rgba(0,0,0,0.3)',
        overflowY:      'auto',
      }}>
        {/* Mobile logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}
          className="hide-desktop">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background:  'linear-gradient(135deg, #6366F1, #8B5CF6)',
            display:     'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
          }}>IP</div>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#0F172A' }}>Inventory Pro</span>
        </div>

        {/* Animated form area */}
        <div style={{ ...animStyle, willChange: 'transform, opacity' }}>

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

          <Form form={form} name={mode} onFinish={isLogin ? handleLogin : handleRegister} layout="vertical" size="large">
            {isRegister && (
              <>
                <Form.Item
                  name="tenantName"
                  label={<Text strong style={{ fontSize: 13 }}>Business name</Text>}
                  rules={[{ required: true, message: 'Business name is required' }]}
                >
                  <Input prefix={<ShopOutlined style={{ color: '#94A3B8' }} />} placeholder="e.g. Acme Stores" autoComplete="organization" />
                </Form.Item>
                <Form.Item
                  name="name"
                  label={<Text strong style={{ fontSize: 13 }}>Your name</Text>}
                  rules={[{ required: true, message: 'Your name is required' }]}
                >
                  <Input prefix={<UserOutlined style={{ color: '#94A3B8' }} />} placeholder="Full name" autoComplete="name" />
                </Form.Item>
              </>
            )}

            <Form.Item
              name="email"
              label={<Text strong style={{ fontSize: 13 }}>Email address</Text>}
              rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
            >
              <Input prefix={<MailOutlined style={{ color: '#94A3B8' }} />} placeholder="you@company.com" autoComplete="email" />
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
                <Input.Password prefix={<LockOutlined style={{ color: '#94A3B8' }} />} placeholder="••••••••" autoComplete="new-password" />
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

          <div style={{ textAlign: 'center', marginBottom: isLogin ? 24 : 0 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <Link
              to={isLogin ? '/register' : '/login'}
              style={{ fontWeight: 600 }}
              onClick={(e) => { e.preventDefault(); switchMode(isLogin ? 'register' : 'login'); }}
            >
              {isLogin ? 'Create workspace' : 'Sign in'}
            </Link>
          </div>

          {/* Demo credentials — login only */}
          {isLogin && (
            <div style={{
              background:   '#F8FAFC',
              border:       '1px solid #E2E8F0',
              borderRadius: 10,
              padding:      '14px 16px',
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
                      textAlign: 'left', padding: '7px 10px',
                      background: 'white', border: '1px solid #E2E8F0',
                      borderRadius: 7, cursor: 'pointer',
                      fontSize: 12, color: '#374151',
                      transition: 'all 0.15s', fontFamily: 'inherit',
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
