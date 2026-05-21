import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Select, DatePicker, Space, Typography, Card,
  Row, Col, Statistic, Button, Input, Tooltip, Badge,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined, FilterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/axios';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const TYPE_CONFIG = {
  purchase:   { color: 'green',  label: 'Purchase',   icon: <ArrowUpOutlined /> },
  sale:       { color: 'red',    label: 'Sale',        icon: <ArrowDownOutlined /> },
  return:     { color: 'orange', label: 'Return',      icon: <ArrowUpOutlined /> },
  adjustment: { color: 'blue',   label: 'Adjustment',  icon: null },
};

const StockMovements = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [products, setProducts]   = useState([]);
  const [stats, setStats]         = useState({ in: 0, out: 0, total: 0 });
  const [filters, setFilters]     = useState({ productId: '', type: '', dateFrom: '', dateTo: '' });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 30, total: 0 });

  const fetchMovements = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.pageSize };
      if (filters.productId) params.productId = filters.productId;
      if (filters.type)      params.type       = filters.type;
      if (filters.dateFrom)  params.dateFrom   = filters.dateFrom;
      if (filters.dateTo)    params.dateTo     = filters.dateTo;

      const { data } = await api.get('/stock-movements', { params });
      setMovements(data.data);
      setPagination((p) => ({ ...p, current: page, total: data.pagination.total }));

      // Compute quick stats from current page
      const inQty  = data.data.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0);
      const outQty = data.data.filter((m) => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0);
      setStats({ in: inQty, out: outQty, total: data.pagination.total });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.pageSize]);

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await api.get('/products', { params: { limit: 200, isActive: 'all' } });
      setProducts(data.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchMovements(1); }, [filters]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDateRange = (_, [from, to]) => {
    setFilters((f) => ({ ...f, dateFrom: from || '', dateTo: to || '' }));
  };

  const clearFilters = () => setFilters({ productId: '', type: '', dateFrom: '', dateTo: '' });

  const columns = [
    {
      title: 'Date & Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (d) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{dayjs(d).format('DD MMM YYYY')}</span>
          <span style={{ fontSize: 11, color: '#888' }}>{dayjs(d).format('HH:mm:ss')}</span>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type) => {
        const cfg = TYPE_CONFIG[type] || { color: 'default', label: type };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Product',
      key: 'product',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.productId?.name || '—'}</span>
          <span style={{ fontSize: 11, color: '#888' }}>{record.productId?.category}</span>
        </Space>
      ),
    },
    {
      title: 'SKU',
      dataIndex: 'variantSku',
      key: 'sku',
      render: (sku) => <Tag style={{ fontFamily: 'monospace' }}>{sku}</Tag>,
    },
    {
      title: 'Qty Change',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      align: 'center',
      render: (qty) => (
        <span style={{ color: qty > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 700, fontSize: 15 }}>
          {qty > 0 ? `+${qty}` : qty}
        </span>
      ),
    },
    {
      title: 'Stock Change',
      key: 'stockChange',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space>
          <span style={{ color: '#888' }}>{record.previousStock}</span>
          <span style={{ color: '#888' }}>→</span>
          <span style={{ fontWeight: 600 }}>{record.newStock}</span>
        </Space>
      ),
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      render: (ref) => ref ? <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{ref}</Tag> : '—',
    },
    {
      title: 'By',
      key: 'performedBy',
      render: (_, record) => record.performedBy?.name || <span style={{ color: '#ccc' }}>System</span>,
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (n) => n || '—',
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Stock Movement Log</Title>
        <div className="page-header-actions">
          <Button icon={<ReloadOutlined />} onClick={() => fetchMovements(1)}>Refresh</Button>
        </div>
      </div>

      {/* Stats row */}
      <Row gutter={[12, 12]} className="stat-cards-row">
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Total Entries"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Stock In (page)"
              value={stats.in}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Stock Out (page)"
              value={stats.out}
              prefix={<ArrowDownOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small">
        <Row gutter={[12, 8]} className="filter-row" align="middle">
          <Col xs={24} sm={7}>
            <Select
              allowClear
              showSearch
              placeholder="Filter by product"
              style={{ width: '100%' }}
              value={filters.productId || undefined}
              onChange={(v) => setFilters((f) => ({ ...f, productId: v || '' }))}
              filterOption={(input, option) =>
                option?.children?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {products.map((p) => (
                <Option key={p._id} value={p._id}>{p.name}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={4}>
            <Select
              allowClear
              placeholder="Movement type"
              style={{ width: '100%' }}
              value={filters.type || undefined}
              onChange={(v) => setFilters((f) => ({ ...f, type: v || '' }))}
            >
              <Option value="purchase">Purchase</Option>
              <Option value="sale">Sale</Option>
              <Option value="return">Return</Option>
              <Option value="adjustment">Adjustment</Option>
            </Select>
          </Col>
          <Col xs={12} sm={10}>
            <RangePicker
              style={{ width: '100%' }}
              value={
                filters.dateFrom && filters.dateTo
                  ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)]
                  : null
              }
              onChange={handleDateRange}
            />
          </Col>
          <Col xs={24} sm={3}>
            <Button block onClick={clearFilters} icon={<FilterOutlined />}>Clear</Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={movements}
        rowKey="_id"
        loading={loading}
        size="small"
        scroll={{ x: 1000 }}
        rowClassName={(record) => (record.quantity < 0 ? 'row-out' : 'row-in')}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: ['15', '30', '50', '100'],
          showTotal: (t) => `${t} movements`,
          onChange: (page, size) => {
            setPagination((p) => ({ ...p, pageSize: size }));
            fetchMovements(page);
          },
        }}
      />
    </Space>
  );
};

export default StockMovements;
