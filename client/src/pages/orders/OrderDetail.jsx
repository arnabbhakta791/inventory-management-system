import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Space, Tag, Typography, Descriptions,
  Table, Steps, message, Popconfirm, Row, Col,
  Timeline, Alert, Modal, InputNumber, Progress, Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CarOutlined,
  CloseOutlined, TrophyOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/axios';
import { useRole } from '../../hooks/useRole';

const { Title, Text } = Typography;

const STATUS_STEPS  = ['pending', 'confirmed', 'shipped', 'delivered'];
const STATUS_CONFIG = {
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
  const { isManagerOrAbove } = useRole();

  const [order, setOrder]                   = useState(null);
  const [loading, setLoading]               = useState(true);
  const [actionLoading, setActionLoading]   = useState(false);

  // Fulfill modal state
  const [fulfillOpen, setFulfillOpen]       = useState(false);
  const [fulfillQtys, setFulfillQtys]       = useState({});   // { variantSku: number }
  const [fulfillLoading, setFulfillLoading] = useState(false);

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

  // ── Fulfill modal helpers ──────────────────────────────────────────────────
  const openFulfillModal = () => {
    // Pre-fill each item with its remaining quantity (max convenient default)
    const defaults = {};
    order.items.forEach((i) => {
      const remaining = i.quantity - (i.fulfilledQuantity || 0);
      if (remaining > 0) defaults[i.variantSku] = remaining;
    });
    setFulfillQtys(defaults);
    setFulfillOpen(true);
  };

  const handleFulfill = async () => {
    const items = Object.entries(fulfillQtys)
      .filter(([, qty]) => qty > 0)
      .map(([variantSku, quantity]) => ({ variantSku, quantity }));

    if (items.length === 0) {
      message.warning('Enter at least one quantity to fulfill');
      return;
    }

    try {
      setFulfillLoading(true);
      await api.post(`/orders/${id}/fulfill`, { items });
      message.success('Fulfillment recorded');
      setFulfillOpen(false);
      fetchOrder();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to record fulfillment');
    } finally {
      setFulfillLoading(false);
    }
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loading) return <Card loading />;
  if (!order)  return <Alert message="Order not found" type="error" />;

  const cfg         = STATUS_CONFIG[order.status] || {};
  const stepIndex   = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';

  const canConfirm  = order.status === 'pending';
  const canShip     = order.status === 'confirmed';
  const canDeliver  = order.status === 'shipped';
  const canFulfill  = ['pending', 'confirmed', 'shipped', 'partially_fulfilled'].includes(order.status);
  const canCancel   = ['pending', 'confirmed', 'shipped', 'partially_fulfilled'].includes(order.status);

  // ── Items table columns ────────────────────────────────────────────────────
  const itemColumns = [
    {
      title: 'Product',
      key: 'product',
      render: (_, r) => r.productId?.name || r.productName,
    },
    {
      title: 'SKU',
      dataIndex: 'variantSku',
      render: (s) => <Tag style={{ fontFamily: 'monospace' }}>{s}</Tag>,
    },
    { title: 'Ordered', dataIndex: 'quantity', align: 'center' },
    {
      title: 'Fulfilled',
      key: 'fulfilled',
      align: 'center',
      render: (_, r) => {
        const fulfilled = r.fulfilledQuantity || 0;
        const pct       = Math.round((fulfilled / r.quantity) * 100);
        const color     = fulfilled === r.quantity ? '#52c41a'
                        : fulfilled > 0            ? '#fa8c16'
                        : '#d9d9d9';
        return (
          <Tooltip title={`${fulfilled} of ${r.quantity} fulfilled (${pct}%)`}>
            <Space direction="vertical" size={2} style={{ width: 80 }}>
              <Text style={{ color, fontWeight: 600, fontSize: 13 }}>
                {fulfilled} / {r.quantity}
              </Text>
              <Progress
                percent={pct}
                showInfo={false}
                size="small"
                strokeColor={color}
                style={{ margin: 0 }}
              />
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      render: (v) => `₹${v?.toLocaleString('en-IN')}`,
    },
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

  // ── Fulfill modal table columns ────────────────────────────────────────────
  const fulfillColumns = [
    {
      title: 'Product / SKU',
      key: 'item',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.productId?.name || r.productName}</Text>
          <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.variantSku}</Tag>
        </Space>
      ),
    },
    {
      title: 'Ordered',
      dataIndex: 'quantity',
      align: 'center',
      width: 80,
    },
    {
      title: 'Already Fulfilled',
      key: 'done',
      align: 'center',
      width: 130,
      render: (_, r) => (
        <Text style={{ color: r.fulfilledQuantity > 0 ? '#52c41a' : '#999' }}>
          {r.fulfilledQuantity || 0}
        </Text>
      ),
    },
    {
      title: 'Remaining',
      key: 'remaining',
      align: 'center',
      width: 90,
      render: (_, r) => {
        const rem = r.quantity - (r.fulfilledQuantity || 0);
        return <Text type={rem === 0 ? 'secondary' : undefined}>{rem}</Text>;
      },
    },
    {
      title: 'Fulfill Now',
      key: 'fulfillNow',
      align: 'center',
      width: 120,
      render: (_, r) => {
        const remaining = r.quantity - (r.fulfilledQuantity || 0);
        if (remaining === 0) return <Tag color="green">Done</Tag>;
        return (
          <InputNumber
            min={0}
            max={remaining}
            value={fulfillQtys[r.variantSku] ?? 0}
            onChange={(val) =>
              setFulfillQtys((prev) => ({ ...prev, [r.variantSku]: val || 0 }))
            }
            style={{ width: 80 }}
          />
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>Back</Button>
          <Title level={3} style={{ margin: 0 }}>{order.orderNumber}</Title>
          <Tag color={cfg.color} style={{ fontSize: 13 }}>{cfg.label}</Tag>
        </Space>

        {/* Action buttons — manager / owner only */}
        {isManagerOrAbove && (
          <div className="page-header-actions">
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
            {canFulfill && (
              <Button icon={<InboxOutlined />} onClick={openFulfillModal}
                style={{ borderColor: '#fa8c16', color: '#fa8c16' }}>
                Fulfill Items
              </Button>
            )}
            {canCancel && (
              <Popconfirm
                title="Cancel this order? Unfulfilled stock will be released back."
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
          </div>
        )}
      </div>

      {/* Progress stepper */}
      {!isCancelled && !isDelivered && order.status !== 'partially_fulfilled' && (
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
      {order.status === 'partially_fulfilled' && (
        <Alert
          type="warning"
          showIcon
          message="Partially Fulfilled"
          description={
            <>
              Some items have been dispatched but the order is not yet complete.
              Use <strong>Fulfill Items</strong> to record more dispatches, or{' '}
              <strong>Cancel Order</strong> to release unfulfilled stock.
            </>
          }
        />
      )}
      {isCancelled && (
        <Alert
          message="This order has been cancelled. Unfulfilled stock has been released back to inventory."
          type="error"
          showIcon
        />
      )}
      {isDelivered && (
        <Alert message="This order has been fully delivered." type="success" showIcon />
      )}

      <Row gutter={16}>
        {/* Left — Order details + items */}
        <Col xs={24} lg={16}>
          <Card title="Order Details">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Order Number">
                <Text code>{order.orderNumber}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Customer">{order.customerName}</Descriptions.Item>
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
              scroll={{ x: 650 }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={5} align="right">
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

      {/* ── Fulfill Items Modal ──────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <InboxOutlined style={{ color: '#fa8c16' }} />
            Fulfill Items — {order.orderNumber}
          </Space>
        }
        open={fulfillOpen}
        onCancel={() => setFulfillOpen(false)}
        onOk={handleFulfill}
        okText="Record Fulfillment"
        okButtonProps={{ loading: fulfillLoading, style: { background: '#fa8c16', borderColor: '#fa8c16' } }}
        width={700}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message='Enter how many units you are dispatching now. Leave "Fulfill Now" as 0 to skip an item.'
          description='When all items reach their full quantity the order will automatically move to Delivered.'
        />
        <Table
          dataSource={order.items}
          columns={fulfillColumns}
          rowKey="variantSku"
          pagination={false}
          size="small"
        />
      </Modal>
    </Space>
  );
};

export default OrderDetail;
