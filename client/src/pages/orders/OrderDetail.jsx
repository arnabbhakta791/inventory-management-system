import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Space, Tag, Typography, Descriptions,
  Table, Steps, message, Popconfirm, Row, Col,
  Timeline, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CarOutlined,
  CloseOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/axios';

const { Title, Text } = Typography;

const STATUS_STEPS   = ['pending', 'confirmed', 'shipped', 'delivered'];
const STATUS_CONFIG  = {
  pending:             { color: 'gold',   label: 'Pending' },
  confirmed:           { color: 'blue',   label: 'Confirmed' },
  shipped:             { color: 'cyan',   label: 'Shipped' },
  delivered:           { color: 'green',  label: 'Delivered' },
  cancelled:           { color: 'red',    label: 'Cancelled' },
  partially_fulfilled: { color: 'orange', label: 'Partial' },
};

const OrderDetail = () => {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [order, setOrder]                 = useState(null);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.data);
    } catch {
      message.error('Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleStatusChange = async (newStatus) => {
    try {
      setActionLoading(true);
      await api.patch(`/orders/${id}/status`, { status: newStatus });
      message.success(`Order ${newStatus}`);
      fetchOrder();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Card loading />;
  if (!order)  return <Alert message="Order not found" type="error" />;

  const cfg         = STATUS_CONFIG[order.status] || {};
  const stepIndex   = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const canConfirm  = order.status === 'pending';
  const canShip     = order.status === 'confirmed';
  const canDeliver  = order.status === 'shipped';
  const canCancel   = ['pending', 'confirmed', 'shipped'].includes(order.status);

  const itemColumns = [
    { title: 'Product',   key: 'product',    render: (_, r) => r.productId?.name || r.productName },
    { title: 'SKU',       dataIndex: 'variantSku', render: (s) => <Tag style={{ fontFamily: 'monospace' }}>{s}</Tag> },
    { title: 'Qty',       dataIndex: 'quantity',   align: 'center' },
    { title: 'Unit Price',dataIndex: 'unitPrice',   render: (v) => `₹${v?.toLocaleString('en-IN')}` },
    {
      title: 'Subtotal',
      key: 'subtotal',
      align: 'right',
      render: (_, r) => (
        <Text strong>
          ₹{(r.quantity * r.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Header */}
      <Row justify="space-between" align="middle">
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>Back</Button>
            <Title level={3} style={{ margin: 0 }}>{order.orderNumber}</Title>
            <Tag color={cfg.color} style={{ fontSize: 13 }}>{cfg.label}</Tag>
          </Space>
        </Col>
        <Col>
          <Space>
            {canConfirm && (
              <Button type="primary" icon={<CheckOutlined />} loading={actionLoading}
                onClick={() => handleStatusChange('confirmed')}>
                Confirm
              </Button>
            )}
            {canShip && (
              <Button type="primary" icon={<CarOutlined />} loading={actionLoading}
                onClick={() => handleStatusChange('shipped')}>
                Mark Shipped
              </Button>
            )}
            {canDeliver && (
              <Button type="primary" icon={<TrophyOutlined />} loading={actionLoading}
                onClick={() => handleStatusChange('delivered')}>
                Mark Delivered
              </Button>
            )}
            {canCancel && (
              <Popconfirm
                title="Cancel this order? Stock will be released back."
                onConfirm={() => handleStatusChange('cancelled')}
                okText="Yes, Cancel"
                cancelText="No"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<CloseOutlined />} loading={actionLoading}>
                  Cancel Order
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>

      {/* Progress stepper */}
      {!isCancelled && (
        <Card size="small">
          <Steps
            current={stepIndex >= 0 ? stepIndex : 0}
            items={[
              { title: 'Pending' },
              { title: 'Confirmed' },
              { title: 'Shipped' },
              { title: 'Delivered' },
            ]}
          />
        </Card>
      )}
      {isCancelled && (
        <Alert
          message="This order has been cancelled. Stock has been released back to inventory."
          type="error"
          showIcon
        />
      )}

      <Row gutter={16}>
        {/* Left — Order details + items */}
        <Col xs={24} lg={16}>
          <Card title="Order Details">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Order Number">
                <Text code>{order.orderNumber}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {order.customerName}
              </Descriptions.Item>
              {order.customerEmail && (
                <Descriptions.Item label="Email">{order.customerEmail}</Descriptions.Item>
              )}
              {order.customerPhone && (
                <Descriptions.Item label="Phone">{order.customerPhone}</Descriptions.Item>
              )}
              <Descriptions.Item label="Created By">
                {order.createdBy?.name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Created At">
                {dayjs(order.createdAt).format('DD MMM YYYY, HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Total">
                <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                  ₹{order.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Descriptions.Item>
              {order.notes && (
                <Descriptions.Item label="Notes" span={2}>{order.notes}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card title="Items" style={{ marginTop: 16 }}>
            <Table
              dataSource={order.items}
              columns={itemColumns}
              rowKey="variantSku"
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={4} align="right">
                    <Text strong>Total</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right">
                    <Text strong style={{ color: '#1890ff' }}>
                      ₹{order.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </Col>

        {/* Right — Status history */}
        <Col xs={24} lg={8}>
          <Card title="Status History">
            <Timeline
              items={(order.statusHistory || []).slice().reverse().map((h) => ({
                color: STATUS_CONFIG[h.status]?.color === 'default' ? 'gray'
                       : STATUS_CONFIG[h.status]?.color || 'blue',
                children: (
                  <Space direction="vertical" size={0}>
                    <Tag color={STATUS_CONFIG[h.status]?.color}>
                      {STATUS_CONFIG[h.status]?.label || h.status}
                    </Tag>
                    <Text style={{ fontSize: 12 }} type="secondary">
                      {dayjs(h.changedAt).format('DD MMM YYYY, HH:mm')}
                    </Text>
                    {h.notes && <Text style={{ fontSize: 12 }}>{h.notes}</Text>}
                  </Space>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default OrderDetail;
