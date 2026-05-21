import React, { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Table, Tag, Space, Typography,
  Button, Badge, Tooltip, Alert, Spin, Progress,
} from 'antd';
import {
  DollarOutlined, WarningOutlined, ShoppingCartOutlined,
  InboxOutlined, ReloadOutlined, FireOutlined,
  ArrowUpOutlined, RiseOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';

const { Title, Text } = Typography;

// ── Colour palette ────────────────────────────────────────────────
const COLORS = {
  primary:  '#1890ff',
  success:  '#52c41a',
  warning:  '#faad14',
  danger:   '#ff4d4f',
  purple:   '#722ed1',
  cyan:     '#13c2c2',
};

// ── Stat Card ─────────────────────────────────────────────────────
const StatCard = ({ title, value, prefix, suffix, color, icon, loading, onClick, extra }) => (
  <Card
    hoverable={!!onClick}
    onClick={onClick}
    style={{ cursor: onClick ? 'pointer' : 'default', borderTop: `3px solid ${color}` }}
    size="small"
  >
    <Statistic
      title={<Space>{icon}<span>{title}</span></Space>}
      value={value}
      prefix={prefix}
      suffix={suffix}
      loading={loading}
      valueStyle={{ color, fontWeight: 700 }}
    />
    {extra}
  </Card>
);

// ── Custom chart tooltip ──────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px' }}>
      <p style={{ margin: 0, fontWeight: 600, color: '#333' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ margin: '2px 0', color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { tenant }          = useAuth();
  const navigate            = useNavigate();
  const { socket, connected } = useSocket();

  const [stats,        setStats]        = useState(null);
  const [lowStock,     setLowStock]     = useState([]);
  const [topSellers,   setTopSellers]   = useState([]);
  const [stockGraph,   setStockGraph]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [liveRefresh,  setLiveRefresh]  = useState(false); // true while auto-refreshing

  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      else         setLiveRefresh(true);

      const [statsRes, lowRes, sellRes, graphRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/low-stock', { params: { limit: 8 } }),
        api.get('/dashboard/top-sellers'),
        api.get('/dashboard/stock-graph'),
      ]);
      setStats(statsRes.data.data);
      setLowStock(lowRes.data.data);
      setTopSellers(sellRes.data.data);
      setStockGraph(graphRes.data.data);
      setLastRefresh(new Date());
    } catch {
      // silent — individual cards will show empty state
    } finally {
      setLoading(false);
      setLiveRefresh(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh whenever any stock changes (socket:updated fired by server
  // after every order, PO receive, or manual adjustment)
  useEffect(() => {
    if (!socket || !connected) return;
    const handler = () => fetchAll({ silent: true });
    socket.on('stock:updated', handler);
    return () => socket.off('stock:updated', handler);
  }, [socket, connected, fetchAll]);

  // ── Low-stock columns ──────────────────────────────────────────
  const lowStockColumns = [
    {
      title: 'Product',
      key: 'product',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.productName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.category}</Text>
        </Space>
      ),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      render: (s) => <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{s}</Tag>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      render: (s) => (
        <Badge
          status={s === 'critical' ? 'error' : 'warning'}
          text={
            <Text style={{ color: s === 'critical' ? COLORS.danger : COLORS.warning, fontWeight: 600 }}>
              {s === 'critical' ? 'Out of stock' : 'Low stock'}
            </Text>
          }
        />
      ),
    },
    {
      title: 'Stock / Threshold',
      key: 'stock',
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Progress
            percent={Math.min(100, Math.round((r.currentStock / r.threshold) * 100))}
            size="small"
            showInfo={false}
            strokeColor={r.severity === 'critical' ? COLORS.danger : COLORS.warning}
            style={{ width: 100 }}
          />
          <Text style={{ fontSize: 11 }}>
            <strong style={{ color: r.severity === 'critical' ? COLORS.danger : COLORS.warning }}>
              {r.currentStock}
            </strong>
            <Text type="secondary"> / {r.threshold}</Text>
          </Text>
        </Space>
      ),
    },
    {
      title: 'Deficit',
      dataIndex: 'deficit',
      align: 'center',
      render: (d) => <Tag color="red">-{d} needed</Tag>,
    },
  ];

  // ── Top sellers bar ────────────────────────────────────────────
  const topSellerColumns = [
    {
      title: '#',
      key: 'rank',
      width: 36,
      render: (_, __, i) => (
        <Text strong style={{ color: i < 3 ? COLORS.warning : '#888', fontSize: 16 }}>
          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
        </Text>
      ),
    },
    {
      title: 'Product',
      key: 'product',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.productName || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.sku}</Text>
        </Space>
      ),
    },
    {
      title: 'Sold (30d)',
      dataIndex: 'totalSold',
      align: 'right',
      render: (v) => (
        <Tag color="green" style={{ fontWeight: 700, fontSize: 13 }}>
          <ArrowUpOutlined /> {v}
        </Tag>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <Row justify="space-between" align="middle">
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Dashboard
            {tenant && <Text type="secondary" style={{ fontSize: 14, fontWeight: 400, marginLeft: 10 }}>— {tenant.name}</Text>}
          </Title>
          {lastRefresh && (
            <Space size={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Last updated: {dayjs(lastRefresh).format('HH:mm:ss')}
              </Text>
              {liveRefresh && (
                <Badge status="processing" text={<Text type="secondary" style={{ fontSize: 12 }}>Live update…</Text>} />
              )}
              {!liveRefresh && connected && (
                <Badge status="success" text={<Text type="secondary" style={{ fontSize: 12 }}>Live</Text>} />
              )}
            </Space>
          )}
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={() => fetchAll()} loading={loading}>
            Refresh
          </Button>
        </Col>
      </Row>

      {/* ── KPI Stat Cards ─────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            title="Inventory Value"
            value={stats?.inventoryValue ?? 0}
            prefix="₹"
            color={COLORS.primary}
            icon={<DollarOutlined />}
            loading={loading}
            extra={
              <Text type="secondary" style={{ fontSize: 11 }}>
                {stats?.totalUnits?.toLocaleString() || 0} total units
              </Text>
            }
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Tooltip title="Only items that still need restocking — variants already covered by a pending Purchase Order are excluded.">
            <div>
              <StatCard
                title="Low Stock Alerts"
                value={stats?.lowStockCount ?? 0}
                color={stats?.lowStockCount > 0 ? COLORS.warning : COLORS.success}
                icon={<WarningOutlined />}
                loading={loading}
                onClick={stats?.lowStockCount > 0 ? () => navigate('/products?lowStock=true') : null}
                extra={
                  <Space direction="vertical" size={2} style={{ marginTop: 4 }}>
                    {stats?.criticalCount > 0 && (
                      <Tag color="red">
                        <FireOutlined /> {stats.criticalCount} critical
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      PO-covered items excluded
                    </Text>
                  </Space>
                }
              />
            </div>
          </Tooltip>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            title="Pending Orders"
            value={stats?.pendingOrders ?? 0}
            color={COLORS.cyan}
            icon={<ShoppingCartOutlined />}
            loading={loading}
            onClick={() => navigate('/orders?status=pending')}
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            title="Pending POs"
            value={stats?.pendingPOs ?? 0}
            color={COLORS.purple}
            icon={<InboxOutlined />}
            loading={loading}
            onClick={() => navigate('/purchase-orders?status=sent')}
          />
        </Col>
      </Row>

      {/* ── Charts Row ─────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>

        {/* 7-day Stock Movement Graph */}
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space>
                <RiseOutlined style={{ color: COLORS.primary }} />
                <span>Stock Movements — Last 7 Days</span>
              </Space>
            }
            size="small"
          >
            {loading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : stockGraph.length === 0 ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                No movement data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={stockGraph} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIn"  x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLORS.success} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLORS.danger}  stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.danger}   stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => dayjs(d).format('DD MMM')}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ReTooltip
                    content={<ChartTooltip />}
                    labelFormatter={(d) => dayjs(d).format('DD MMM YYYY')}
                  />
                  <Legend iconType="circle" iconSize={8} />
                  <Area
                    type="monotone"
                    dataKey="in"
                    name="Stock In"
                    stroke={COLORS.success}
                    fill="url(#gradIn)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="out"
                    name="Stock Out"
                    stroke={COLORS.danger}
                    fill="url(#gradOut)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* Top 5 Sellers */}
        <Col xs={24} lg={9}>
          <Card
            title={
              <Space>
                <FireOutlined style={{ color: COLORS.warning }} />
                <span>Top 5 Sellers — Last 30 Days</span>
              </Space>
            }
            size="small"
            style={{ height: '100%' }}
          >
            {loading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : topSellers.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#ccc' }}>
                No sales data yet
              </div>
            ) : (
              <>
                {/* Mini bar chart */}
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart
                    data={topSellers}
                    margin={{ top: 4, right: 4, left: -20, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="sku" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <ReTooltip content={<ChartTooltip />} />
                    <Bar dataKey="totalSold" name="Units Sold" fill={COLORS.primary} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Ranked list below chart */}
                <Table
                  dataSource={topSellers}
                  columns={topSellerColumns}
                  rowKey="sku"
                  pagination={false}
                  size="small"
                  showHeader={false}
                  style={{ marginTop: 8 }}
                />
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Smart Low-Stock Alert Table ─────────────────────────── */}
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: COLORS.warning }} />
            <span>Low Stock Alerts</span>
            {stats?.lowStockCount > 0 && (
              <Badge count={stats.lowStockCount} style={{ backgroundColor: COLORS.warning }} />
            )}
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              — items below threshold after accounting for pending POs
            </Text>
          </Space>
        }
        extra={
          <Button size="small" onClick={() => navigate('/products')}>
            Manage Products
          </Button>
        }
        size="small"
      >
        {loading ? (
          <Spin style={{ display: 'block', margin: '24px auto' }} />
        ) : lowStock.length === 0 ? (
          <Alert
            message="All stock levels are healthy!"
            description="No items are below their low-stock threshold (after accounting for incoming Purchase Orders)."
            type="success"
            showIcon
          />
        ) : (
          <Table
            dataSource={lowStock}
            columns={lowStockColumns}
            rowKey={(r) => `${r.productId}-${r.sku}`}
            pagination={false}
            size="small"
            scroll={{ x: 700 }}
            rowClassName={(r) => r.severity === 'critical' ? 'ant-table-row-danger' : ''}
          />
        )}
      </Card>

    </Space>
  );
};

export default Dashboard;
