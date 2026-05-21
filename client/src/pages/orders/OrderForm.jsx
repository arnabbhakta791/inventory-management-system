import React, { useEffect, useState, useCallback } from 'react';
import {
  Form, Input, Button, Card, Space, Typography, Select,
  Table, InputNumber, message, Row, Col, Divider, Tag, Alert,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined,
  SaveOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const { Title, Text } = Typography;
const { Option }      = Select;
const { TextArea }    = Input;

const OrderForm = () => {
  const navigate      = useNavigate();
  const [form]        = Form.useForm();
  const [loading, setLoading]   = useState(false);
  const [products, setProducts] = useState([]);
  const [items, setItems]       = useState([]);
  const [error, setError]       = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await api.get('/products', { params: { limit: 500 } });
      setProducts(data.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { key: Date.now(), productId: '', variantSku: '', productName: '', quantity: 1, unitPrice: 0, availableStock: null },
    ]);
  };

  const removeItem = (key) => setItems((prev) => prev.filter((i) => i.key !== key));

  const updateItem = (key, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const updated = { ...item, [field]: value };

        if (field === 'productId') {
          updated.variantSku     = '';
          updated.productName    = '';
          updated.unitPrice      = 0;
          updated.availableStock = null;
        }
        if (field === 'variantSku' && updated.productId) {
          const prod    = products.find((p) => p._id === updated.productId);
          const variant = prod?.variants?.find((v) => v.sku === value);
          updated.productName    = prod?.name || '';
          updated.unitPrice      = variant?.sellingPrice || 0;
          updated.availableStock = variant?.stock ?? null;
        }
        return updated;
      })
    );
  };

  const getVariants = (productId) => {
    const prod = products.find((p) => p._id === productId);
    return prod?.variants || [];
  };

  const totalAmount = items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);

  const onFinish = async (values) => {
    if (items.length === 0) { message.error('Add at least one item'); return; }
    const invalid = items.find((i) => !i.productId || !i.variantSku || i.quantity < 1);
    if (invalid) { message.error('Each item needs a product, variant, and quantity ≥ 1'); return; }

    // Warn if any item exceeds available stock (soft warning, server still validates)
    const overstock = items.find(
      (i) => i.availableStock !== null && i.quantity > i.availableStock
    );
    if (overstock) {
      message.warning(`Warning: ${overstock.variantSku} only has ${overstock.availableStock} in stock`);
    }

    try {
      setLoading(true);
      setError('');
      const payload = {
        customerName:  values.customerName,
        customerEmail: values.customerEmail || '',
        customerPhone: values.customerPhone || '',
        notes:         values.notes || '',
        items: items.map(({ productId, variantSku, quantity, unitPrice }) => ({
          productId, variantSku, quantity, unitPrice,
        })),
      };

      await api.post('/orders', payload);
      message.success('Order placed — stock deducted successfully');
      navigate('/orders');
    } catch (err) {
      // Explicit insufficient-stock error (409) from server
      if (err.response?.status === 409) {
        const d = err.response.data;
        setError(`Insufficient stock for ${d.sku}: only ${d.available} available, requested ${d.requested}`);
      } else {
        setError(err.response?.data?.message || 'Failed to create order');
      }
    } finally {
      setLoading(false);
    }
  };

  const itemColumns = [
    {
      title: 'Product',
      key: 'product',
      width: 200,
      render: (_, record) => (
        <Select
          showSearch
          placeholder="Select product"
          style={{ width: '100%' }}
          value={record.productId || undefined}
          onChange={(v) => updateItem(record.key, 'productId', v)}
          filterOption={(input, opt) =>
            opt?.children?.toLowerCase().includes(input.toLowerCase())
          }
        >
          {products.map((p) => (
            <Option key={p._id} value={p._id}>{p.name}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Variant / SKU',
      key: 'sku',
      width: 200,
      render: (_, record) => (
        <Select
          placeholder="Select variant"
          style={{ width: '100%' }}
          value={record.variantSku || undefined}
          onChange={(v) => updateItem(record.key, 'variantSku', v)}
          disabled={!record.productId}
        >
          {getVariants(record.productId).map((v) => {
            const isLow = v.stock < v.lowStockThreshold;
            return (
              <Option key={v.sku} value={v.sku} disabled={v.stock === 0}>
                <Space>
                  <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.sku}</Tag>
                  <Text
                    type={v.stock === 0 ? 'danger' : isLow ? 'warning' : 'secondary'}
                    style={{ fontSize: 11 }}
                  >
                    {v.stock === 0 ? 'Out of stock' : `Stock: ${v.stock}`}
                    {isLow && v.stock > 0 && <WarningOutlined style={{ marginLeft: 3 }} />}
                  </Text>
                </Space>
              </Option>
            );
          })}
        </Select>
      ),
    },
    {
      title: 'Available',
      key: 'avail',
      width: 90,
      align: 'center',
      render: (_, record) => {
        if (record.availableStock === null) return '—';
        const isLow = record.quantity > record.availableStock;
        return (
          <Tag color={isLow ? 'red' : record.availableStock < 10 ? 'orange' : 'green'}>
            {record.availableStock}
          </Tag>
        );
      },
    },
    {
      title: 'Qty',
      key: 'qty',
      width: 90,
      render: (_, record) => (
        <InputNumber
          min={1}
          max={record.availableStock || undefined}
          value={record.quantity}
          onChange={(v) => updateItem(record.key, 'quantity', v || 1)}
          style={{ width: '100%' }}
          status={record.availableStock !== null && record.quantity > record.availableStock ? 'error' : ''}
        />
      ),
    },
    {
      title: 'Unit Price (₹)',
      key: 'price',
      width: 120,
      render: (_, record) => (
        <InputNumber
          min={0}
          precision={2}
          value={record.unitPrice}
          onChange={(v) => updateItem(record.key, 'unitPrice', v || 0)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Subtotal',
      key: 'subtotal',
      width: 110,
      align: 'right',
      render: (_, record) => (
        <Text strong>
          ₹{((record.quantity || 0) * (record.unitPrice || 0)).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
          })}
        </Text>
      ),
    },
    {
      title: '',
      key: 'del',
      width: 40,
      render: (_, record) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.key)}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row align="middle" gutter={12}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>Back</Button>
        </Col>
        <Col>
          <Title level={3} style={{ margin: 0 }}>New Sales Order</Title>
        </Col>
      </Row>

      {error && (
        <Alert
          message="Order Failed"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError('')}
        />
      )}

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={24}>
          {/* Customer details */}
          <Col xs={24} lg={14}>
            <Card title="Customer Details">
              <Form.Item
                name="customerName"
                label="Customer Name"
                rules={[{ required: true, message: 'Customer name is required' }]}
              >
                <Input placeholder="e.g. Rahul Sharma" />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="customerEmail" label="Email">
                    <Input placeholder="customer@example.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="customerPhone" label="Phone">
                    <Input placeholder="+91 98765 43210" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={2} placeholder="Delivery instructions..." />
              </Form.Item>
            </Card>
          </Col>

          {/* Order summary */}
          <Col xs={24} lg={10}>
            <Card title="Order Summary">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row justify="space-between">
                  <Text type="secondary">Line items:</Text>
                  <Text strong>{items.length}</Text>
                </Row>
                <Row justify="space-between">
                  <Text type="secondary">Total units:</Text>
                  <Text strong>{items.reduce((s, i) => s + (i.quantity || 0), 0)}</Text>
                </Row>
                <Divider style={{ margin: '8px 0' }} />
                <Row justify="space-between">
                  <Text style={{ fontSize: 15 }}>Total:</Text>
                  <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                    ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </Row>
                <Alert
                  message="Stock is deducted immediately when the order is placed."
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Items table */}
        <Card
          title="Order Items"
          style={{ marginTop: 16 }}
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>
              Add Item
            </Button>
          }
        >
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#888' }}>
              Click "Add Item" to start building this order
            </div>
          ) : (
            <Table
              dataSource={items}
              columns={itemColumns}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ x: 750 }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={5} align="right">
                    <Text strong>Total:</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right">
                    <Text strong style={{ color: '#1890ff' }}>
                      ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell />
                </Table.Summary.Row>
              )}
            />
          )}
        </Card>

        <Row justify="end" style={{ marginTop: 24 }}>
          <Space>
            <Button onClick={() => navigate('/orders')}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              Place Order
            </Button>
          </Space>
        </Row>
      </Form>
    </Space>
  );
};

export default OrderForm;
