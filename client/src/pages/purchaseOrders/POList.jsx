import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Select, Typography,
  message, Card, Row, Col, Tooltip, Badge,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, ReloadOutlined,
  ClockCircleOutlined, CheckCircleOutlined,
  SendOutlined, CloseCircleOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/axios';
import { useRole } from '../../hooks/useRole';

const { Title } = Typography;
const { Option } = Select;

const STATUS_CONFIG = {
  draft:              { color: 'default',  label: 'Draft',              icon: <ClockCircleOutlined /> },
  sent:               { color: 'blue',     label: 'Sent',               icon: <SendOutlined /> },
  confirmed:          { color: 'cyan',     label: 'Confirmed',          icon: <CheckCircleOutlined /> },
  partially_received: { color: 'orange',   label: 'Partial',            icon: <InboxOutlined /> },
  received:           { color: 'green',    label: 'Received',           icon: <CheckCircleOutlined /> },
  cancelled:          { color: 'red',      label: 'Cancelled',          icon: <CloseCircleOutlined /> },
};

const POList = () => {
  const navigate = useNavigate();
  const { isManagerOrAbove } = useRole();
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [statusFilter, setStatus] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.pageSize };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/purchase-orders', { params });
      setOrders(data.data);
      setPagination((p) => ({ ...p, current: page, total: data.pagination.total }));
    } catch {
      message.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pagination.pageSize]);

  useEffect(() => { fetchOrders(1); }, [statusFilter]);

  const columns = [
    {
      title: 'Order #',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (num, record) => (
        <Button
          type="link"
          style={{ padding: 0, fontFamily: 'monospace', fontWeight: 600 }}
          onClick={() => navigate(`/purchase-orders/${record._id}`)}
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
      title: 'Supplier',
      key: 'supplier',
      render: (_, r) => r.supplierId?.name || '—',
    },
    {
      title: 'Items',
      key: 'items',
      align: 'center',
      render: (_, r) => (
        <Tooltip title={r.items?.map((i) => `${i.variantSku} × ${i.quantity}`).join(', ')}>
          <Tag>{r.items?.length || 0} SKUs</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (v) => <span style={{ fontWeight: 600 }}>₹{(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: 'Expected Delivery',
      dataIndex: 'expectedDeliveryDate',
      key: 'expectedDelivery',
      render: (d) => {
        if (!d) return <span style={{ color: '#ccc' }}>—</span>;
        const isOverdue = dayjs(d).isBefore(dayjs()) ;
        return (
          <span style={{ color: isOverdue ? '#ff4d4f' : 'inherit' }}>
            {dayjs(d).format('DD MMM YYYY')}
            {isOverdue && <Tag color="red" style={{ marginLeft: 4 }}>Overdue</Tag>}
          </span>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d) => dayjs(d).format('DD MMM YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/purchase-orders/${record._id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Purchase Orders</Title>
        <div className="page-header-actions">
          <Button icon={<ReloadOutlined />} onClick={() => fetchOrders(1)}>Refresh</Button>
          {isManagerOrAbove && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/purchase-orders/new')}>
              New PO
            </Button>
          )}
        </div>
      </div>

      <Card size="small">
        <Row gutter={[12, 8]} className="filter-row" align="middle">
          <Col xs={24} sm={12} md={8}>
            <Select
              allowClear
              placeholder="All statuses"
              style={{ width: '100%' }}
              value={statusFilter || undefined}
              onChange={(v) => setStatus(v || '')}
            >
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                <Option key={val} value={val}>
                  <Tag color={cfg.color}>{cfg.label}</Tag>
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={16}>
            <Space wrap>
              {['sent', 'confirmed', 'partially_received'].map((s) =>
                statusCounts[s] ? (
                  <Tag key={s} color={STATUS_CONFIG[s].color}>
                    {statusCounts[s]} {STATUS_CONFIG[s].label}
                  </Tag>
                ) : null
              )}
            </Space>
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
        scroll={{ x: 900 }}
      />
    </Space>
  );
};

export default POList;
