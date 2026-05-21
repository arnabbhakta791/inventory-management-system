import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Select, Input, Typography,
  message, Card, Row, Col, Statistic,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, ReloadOutlined, SearchOutlined,
  ShoppingCartOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, CarOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/axios';

const { Title } = Typography;
const { Option } = Select;

const STATUS_CONFIG = {
  pending:              { color: 'gold',    label: 'Pending',    icon: <ClockCircleOutlined /> },
  confirmed:            { color: 'blue',    label: 'Confirmed',  icon: <CheckCircleOutlined /> },
  shipped:              { color: 'cyan',    label: 'Shipped',    icon: <CarOutlined /> },
  delivered:            { color: 'green',   label: 'Delivered',  icon: <TrophyOutlined /> },
  cancelled:            { color: 'red',     label: 'Cancelled',  icon: <CloseCircleOutlined /> },
  partially_fulfilled:  { color: 'orange',  label: 'Partial',    icon: <ShoppingCartOutlined /> },
};

const OrderList = () => {
  const navigate = useNavigate();
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [summary, setSummary]       = useState({ total: 0, pending: 0, revenue: 0 });
  const [filters, setFilters]       = useState({ status: '', search: '' });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.pageSize };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;

      const { data } = await api.get('/orders', { params });
      setOrders(data.data);
      setPagination((p) => ({ ...p, current: page, total: data.pagination.total }));

      // Quick page-level stats
      const pending = data.data.filter((o) => o.status === 'pending').length;
      const revenue = data.data
        .filter((o) => !['cancelled'].includes(o.status))
        .reduce((s, o) => s + (o.totalAmount || 0), 0);
      setSummary({ total: data.pagination.total, pending, revenue });
    } catch {
      message.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.pageSize]);

  useEffect(() => { fetchOrders(1); }, [filters]);

  const columns = [
    {
      title: 'Order #',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (num, record) => (
        <Button
          type="link"
          style={{ padding: 0, fontFamily: 'monospace', fontWeight: 600 }}
          onClick={() => navigate(`/orders/${record._id}`)}
        >
          {num}
        </Button>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{r.customerName}</span>
          {r.customerEmail && <span style={{ fontSize: 11, color: '#888' }}>{r.customerEmail}</span>}
        </Space>
      ),
    },
    {
      title: 'Items',
      key: 'items',
      align: 'center',
      render: (_, r) => <Tag>{r.items?.length || 0} SKUs</Tag>,
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (v) => (
        <span style={{ fontWeight: 600, color: '#1890ff' }}>
          ₹{(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d) => (
        <Space direction="vertical" size={0}>
          <span>{dayjs(d).format('DD MMM YYYY')}</span>
          <span style={{ fontSize: 11, color: '#888' }}>{dayjs(d).format('HH:mm')}</span>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/orders/${record._id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Sales Orders</Title>
        <div className="page-header-actions">
          <Button icon={<ReloadOutlined />} onClick={() => fetchOrders(1)}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/orders/new')}>
            New Order
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <Row gutter={[12, 12]}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Total Orders" value={summary.total} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Pending" value={summary.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Revenue (page)"
              value={summary.revenue}
              prefix="₹"
              precision={0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small">
        <Row gutter={[12, 8]} className="filter-row">
          <Col xs={24} sm={12} md={10}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search by customer name..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              allowClear
              placeholder="All statuses"
              style={{ width: '100%' }}
              value={filters.status || undefined}
              onChange={(v) => setFilters((f) => ({ ...f, status: v || '' }))}
            >
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                <Option key={val} value={val}>
                  <Tag color={cfg.color}>{cfg.label}</Tag>
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (t) => `${t} orders`,
          onChange: (page, size) => {
            setPagination((p) => ({ ...p, pageSize: size }));
            fetchOrders(page);
          },
        }}
        scroll={{ x: 800 }}
      />
    </Space>
  );
};

export default OrderList;
