import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Space, Tag, Typography, Descriptions, Table,
  Steps, Modal, InputNumber, message, Popconfirm, Row, Col,
  Divider, Timeline, Alert, Progress,
} from 'antd';
import {
  ArrowLeftOutlined, InboxOutlined, SendOutlined,
  CheckOutlined, CloseOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/axios';
import { useRole } from '../../hooks/useRole';

const { Title, Text } = Typography;

const STATUS_STEPS = ['draft', 'sent', 'confirmed', 'received'];
const STATUS_CONFIG = {
  draft:              { color: 'default', label: 'Draft' },
  sent:               { color: 'blue',    label: 'Sent' },
  confirmed:          { color: 'cyan',    label: 'Confirmed' },
  partially_received: { color: 'orange',  label: 'Partial' },
  received:           { color: 'green',   label: 'Received' },
  cancelled:          { color: 'red',     label: 'Cancelled' },
};

const PODetail = () => {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { isManagerOrAbove } = useRole();
  const [po, setPO]                     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [receiveModal, setReceiveModal] = useState(false);
  const [receiveQtys, setReceiveQtys]   = useState({});

  const fetchPO = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/purchase-orders/${id}`);
      setPO(data.data);
      // Initialise receive modal quantities to remaining
      const init = {};
      data.data.items.forEach((item) => {
        init[item.variantSku] = item.quantity - (item.receivedQuantity || 0);
      });
      setReceiveQtys(init);
    } catch {
      message.error('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPO(); }, [fetchPO]);

  const handleStatusChange = async (newStatus) => {
    try {
      setActionLoading(true);
      await api.patch(`/purchase-orders/${id}/status`, { status: newStatus });
      message.success(`Status updated to ${newStatus}`);
      fetchPO();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceive = async () => {
    const items = po.items
      .map((item) => ({
        variantSku:       item.variantSku,
        receivedQuantity: receiveQtys[item.variantSku] || 0,
      }))
      .filter((i) => i.receivedQuantity > 0);

    if (items.length === 0) { message.warning('Enter quantity for at least one item'); return; }

    try {
      setActionLoading(true);
      const { data } = await api.post(`/purchase-orders/${id}/receive`, { items });
      message.success(data.fullyReceived ? 'All items received — stock updated!' : 'Partial delivery recorded — stock updated!');
      setReceiveModal(false);
      fetchPO();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to receive items');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await api.delete(`/purchase-orders/${id}`);
      message.success('Purchase order cancelled');
      navigate('/purchase-orders');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Card loading />;
  if (!po) return <Alert message="Purchase order not found" type="error" />;

  const cfg         = STATUS_CONFIG[po.status] || {};
  const stepIndex   = STATUS_STEPS.indexOf(po.status === 'partially_received' ? 'confirmed' : po.status);
  const isCancelled = po.status === 'cancelled';
  const canSend     = po.status === 'draft';
  const canConfirm  = po.status === 'sent';
  const canReceive  = ['sent', 'confirmed', 'partially_received'].includes(po.status);
  const canCancel   = ['draft', 'sent', 'confirmed'].includes(po.status);

  const itemColumns = [
    { title: 'Product',  key: 'product',  render: (_, r) => r.productId?.name || '—' },
    {
      title: 'SKU',
      dataIndex: 'variantSku',
      render: (sku) => <Tag style={{ fontFamily: 'monospace' }}>{sku}</Tag>,
    },
    { title: 'Ordered',  dataIndex: 'quantity',         align: 'center' },
    {
      title: 'Received',
      key: 'received',
      align: 'center',
      render: (_, r) => {
        const rcvd  = r.receivedQuantity || 0;
        const pct   = Math.round((rcvd / r.quantity) * 100);
        return (
          <Space direction="vertical" size={2} style={{ width: 100 }}>
            <Text>{rcvd} / {r.quantity}</Text>
            <Progress percent={pct} size="small" showInfo={false}
              strokeColor={pct === 100 ? '#52c41a' : '#faad14'} />
          </Space>
        );
      },
    },
    {
      title: 'Remaining',
      key: 'remaining',
      align: 'center',
      render: (_, r) => {
        const rem = r.quantity - (r.receivedQuantity || 0);
        return rem > 0
          ? <Tag color="orange">{rem} pending</Tag>
          : <Tag color="green" icon={<CheckCircleOutlined />}>Complete</Tag>;
      },
    },
    { title: 'Unit Price', dataIndex: 'unitPrice', render: (v) => `₹${v?.toLocaleString('en-IN')}` },
    {
      title: 'Subtotal',
      key: 'subtotal',
      render: (_, r) => `₹${(r.quantity * r.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
  ];

  const receiveColumns = [
    { title: 'Product',       key: 'product',  render: (_, r) => r.productId?.name || '—' },
    { title: 'SKU',           dataIndex: 'variantSku', render: (sku) => <Tag style={{ fontFamily: 'monospace' }}>{sku}</Tag> },
    { title: 'Ordered',       dataIndex: 'quantity', align: 'center' },
    { title: 'Already Rcvd',  dataIndex: 'receivedQuantity', align: 'center', render: (v) => v || 0 },
    { title: 'Remaining',     key: 'rem',  align: 'center', render: (_, r) => r.quantity - (r.receivedQuantity || 0) },
    {
      title: 'Receive Now',
      key: 'receiveNow',
      align: 'center',
      render: (_, r) => {
        const max = r.quantity - (r.receivedQuantity || 0);
        return (
          <InputNumber
            min={0}
            max={max}
            value={receiveQtys[r.variantSku] ?? max}
            onChange={(v) => setReceiveQtys((prev) => ({ ...prev, [r.variantSku]: v || 0 }))}
            style={{ width: 80 }}
            disabled={max === 0}
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/purchase-orders')}>Back</Button>
          <Title level={3} style={{ margin: 0 }}>{po.orderNumber}</Title>
          <Tag color={cfg.color} style={{ fontSize: 13 }}>{cfg.label}</Tag>
        </Space>
        {/* Action buttons — manager / owner only */}
        {isManagerOrAbove && (
          <div className="page-header-actions">
            {canSend     && <Button type="primary"  icon={<SendOutlined />}    loading={actionLoading} onClick={() => handleStatusChange('sent')}>Mark Sent</Button>}
            {canConfirm  && <Button type="primary"  icon={<CheckOutlined />}   loading={actionLoading} onClick={() => handleStatusChange('confirmed')}>Confirm PO</Button>}
            {canReceive  && <Button type="primary"  icon={<InboxOutlined />}   loading={actionLoading} onClick={() => setReceiveModal(true)}>Receive Items</Button>}
            {canCancel   && (
              <Popconfirm title="Cancel this purchase order?" onConfirm={handleCancel} okText="Yes" cancelText="No">
                <Button danger icon={<CloseOutlined />} loading={actionLoading}>Cancel PO</Button>
              </Popconfirm>
            )}
          </div>
        )}
      </div>

      {/* Status stepper */}
      {!isCancelled && (
        <Card size="small">
          <Steps
            current={stepIndex}
            status={po.status === 'partially_received' ? 'process' : undefined}
            items={[
              { title: 'Draft' },
              { title: 'Sent' },
              { title: 'Confirmed' },
              { title: po.status === 'partially_received' ? 'Partial' : 'Received' },
            ]}
          />
        </Card>
      )}
      {isCancelled && <Alert message="This purchase order has been cancelled" type="error" showIcon />}

      <Row gutter={16}>
        {/* Left — PO details */}
        <Col xs={24} lg={16}>
          <Card title="Order Details">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Order Number">
                <Text code>{po.orderNumber}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Supplier">
                {po.supplierId?.name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Created By">
                {po.createdBy?.name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Created At">
                {dayjs(po.createdAt).format('DD MMM YYYY, HH:mm')}
              </Descriptions.Item>
              {po.expectedDeliveryDate && (
                <Descriptions.Item label="Expected Delivery">
                  {dayjs(po.expectedDeliveryDate).format('DD MMM YYYY')}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Total Amount">
                <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                  ₹{po.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Descriptions.Item>
              {po.notes && (
                <Descriptions.Item label="Notes" span={2}>{po.notes}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card title="Items" style={{ marginTop: 16 }}>
            <Table
              dataSource={po.items}
              columns={itemColumns}
              rowKey="variantSku"
              pagination={false}
              size="small"
              scroll={{ x: 700 }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={6} align="right">
                    <Text strong>Total</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell>
                    <Text strong style={{ color: '#1890ff' }}>
                      ₹{po.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
              items={(po.statusHistory || []).slice().reverse().map((h) => ({
                color: STATUS_CONFIG[h.status]?.color === 'default' ? 'gray' : STATUS_CONFIG[h.status]?.color,
                children: (
                  <Space direction="vertical" size={0}>
                    <Tag color={STATUS_CONFIG[h.status]?.color}>{STATUS_CONFIG[h.status]?.label || h.status}</Tag>
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

      {/* Receive Items Modal */}
      <Modal
        title={<Space><InboxOutlined />Receive Items — {po.orderNumber}</Space>}
        open={receiveModal}
        onCancel={() => setReceiveModal(false)}
        width={820}
        footer={[
          <Button key="cancel" onClick={() => setReceiveModal(false)}>Cancel</Button>,
          <Button key="receive" type="primary" icon={<InboxOutlined />} loading={actionLoading} onClick={handleReceive}>
            Confirm Receipt & Update Stock
          </Button>,
        ]}
      >
        <Alert
          message="Stock will be updated immediately for all quantities you enter above zero."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          dataSource={po.items}
          columns={receiveColumns}
          rowKey="variantSku"
          pagination={false}
          size="small"
          scroll={{ x: 600 }}
        />
      </Modal>
    </Space>
  );
};

export default PODetail;
