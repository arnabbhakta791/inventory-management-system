import React, { useState } from 'react';
import { Form, Input, Button, Typography, Alert } from 'antd';
import {
  ShopOutlined, UserOutlined, LockOutlined, MailOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text } = Typography;

const Register = () => {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form]       = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const onFinish = async (values) => {
    try {
      setLoading(true);
      setError('');
      await register(values);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #1E1B4B 0%, #111827 50%, #0F172A 100%)',
    }}>
      {/* ── Left panel — branding ──────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="hide-mobile"
        id="register-brand-panel"
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
            Your inventory,<br />under control.
          </Title>
          <Text style={{ color: '#94A3B8', fontSize: 16, lineHeight: 1.7 }}>
            Set up your workspace in seconds. Manage stock,<br />
            suppliers, and orders — all in one place.
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

      {/* ── Right panel — registration form ───────────────────── */}
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

        <div style={{ marginBottom: 32 }}>
          <Title level={3} style={{ margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Create your workspace
          </Title>
          <Text type="secondary">Get started — it only takes a minute</Text>
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

        <Form form={form} name="register" onFinish={onFinish} layout="vertical" size="large">
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

          <Form.Item
            name="email"
            label={<Text strong style={{ fontSize: 13 }}>Email address</Text>}
            rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#94A3B8' }} />}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<Text strong style={{ fontSize: 13 }}>Password</Text>}
            rules={[{ required: true, min: 6, message: 'At least 6 characters' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
            />
          </Form.Item>

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

          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{ height: 46, fontWeight: 600, fontSize: 15, borderRadius: 10 }}
            >
              Create account
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>Already have an account? </Text>
          <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
