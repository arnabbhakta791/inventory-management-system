import React, { useEffect, useState, useCallback } from 'react';
import {
  Form, Input, InputNumber, Button, Card, Space, Typography,
  Select, DatePicker, Table, message, Row, Col, Divider, Tag, Tooltip,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/axios';

const { Title, Text } = Typography;
const { Option }      = Select;
const { TextArea }    = Input;

const POForm = () => {
  const navigate      = useNavigate();
  const [form]        = Form.useForm();
  const [loading, setLoading]     = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts]   = useState([]);
  const [items, setItems]         = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [suppRes, prodRes] = await Promise.all([
        api.get('/suppliers', { params: { limit: 100 } }),
        api.get('/products',  { params: { limit: 500 } }),
      ]);
      setSuppliers(suppRes.data.data || []);
      setProducts(prodRes.data.data  || []);
    } catch {
      message.error('Failed to load suppliers or products');
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // When supplier changes, pre-filter products linked to them
  const handleSupplierChange = (supplierId) => {
    const supp = suppliers.find((s) => s._id === supplierId);
    setSelectedSupplier(supp || null);
    setItems([]);
  };

  const addItem = () => {
    setItems((prev) => [...prev, {
      key:         Date.now(),
      productId:   '',
      variantSku:  '',
      productName: '',
      quantity:    1,
      unitPrice:   0,
    }]);
  };

  const removeItem = (key) => setItems((prev) => prev.filter((i) => i.key !== key));

  const updateItem = (key, field, value) => {
    setItems((prev) => prev.map((item) => {
      if (item.key !== key) return item;
      const updated = { ...item, [field]: value };

      // Auto-fill product name and default price when product+variant selected
      if (field === 'productId') {
        updated.variantSku  = '';
        updated.productName = '';
        updated.unitPrice   = 0;
      }
      if (field === 'variantSku' && updated.productId) {
        const prod    = products.find((p) => p._id === updated.productId);
        const variant = prod?.variants?.find((v) => v.sku === value);
        updated.productName = prod?.name || '';
        updated.unitPrice   = variant?.costPrice || 0;
      }
      return updated;
    }));
  };

  const getVariantsForProduct = (productId) => {
    const prod = products.find((p) => p._id === productId);
    return prod?.variants || [];
  };

  const totalAmount = items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);

  const onFinish = async (values) => {
    if (items.length === 0) { message.error('Add at least one item'); return; }
    const invalid = items.find((i) => !i.productId || !i.variantSku || i.quantity < 1);
    if (invalid) { message.error('Each item needs a product, variant, and quantity ≥ 1'); return; }

    try {
      setLoading(true);
      const payload = {
        supplierId:           values.supplierId,
        expectedDeliveryDate: values.expectedDeliveryDate?.toISOString(),
        notes:                values.notes || '',
        items:                items.map(({ productId, variantSku, productName, quantity, unitPrice }) => ({
          productId, variantSku, productName, quantity, unitPrice,
        })),
      };
      await api.post('/purchase-orders', payload);
      message.success('Purchase order created');
      navigate('/purchase-orders');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to create PO');
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
          filterOption={(input, opt) => opt?.children?.toLowerCase().includes(input.toLowerCase())}
        >
          {(selectedSupplier?.products?.length > 0
            ? products.filter((p) => selectedSupplier.products.some((sp) => sp.productId === p._id))
            : products
          ).map((p) => <Option key={p._id} value={p._id}>{p.name}</Option>)}
        </Select>
      ),
    },
    {
      title: 'Variant / SKU',
      key: 'sku',
      width: 170,
      render: (_, record) => (
        <Select
          placeholder="Select variant"
          style={{ width: '100%' }}
          value={record.variantSku || undefined}
          onChange={(v) => updateItem(record.key, 'variantSku', v)}
          disabled={!record.productId}
        >
          {getVariantsForProduct(record.productId).map((v) => (
            <Option key={v.sku} value={v.sku}>
              <Space>
                <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.sku}</Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>Stock: {v.stock}</Text>
              </Space>
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Qty',
      key: 'qty',
      width: 90,
      render: (_, record) => (
        <InputNumber
          min={1}
          value={record.quantity}
          onChange={(v) => updateItem(record.key, 'quantity', v || 1)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Unit Price (₹)',
      key: 'price',
      width: 130,
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
          ₹{((record.quantity || 0) * (record.unitPrice || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
        <Col><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/purchase-orders')}>Back</Button></Col>
        <Col><Title level={3} style={{ margin: 0 }}>New Purchase Order</Title></Col>
      </Row>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <Card title="Order Details">
              <Form.Item name="supplierId" label="Supplier" rules={[{ required: true, message: 'Select a supplier' }]}>
                <Select
                  showSearch
                  placeholder="Select supplier"
                  onChange={handleSupplierChange}
                  filterOption={(input, opt) => opt?.children?.toLowerCase().includes(input.toLowerCase())}
                >
                  {suppliers.map((s) => <Option key={s._id} value={s._id}>{s.name}</Option>)}
                </Select>
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="expectedDeliveryDate" label="Expected Delivery">
                    <DatePicker
                      style={{ width: '100%' }}
                      disabledDate={(d) => d && d.isBefore(dayjs(), 'day')}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={2} placeholder="Delivery instructions, terms..." />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="Summary">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row justify="space-between">
                  <Text type="secondary">Items:</Text>
                  <Text strong>{items.length}</Text>
                </Row>
                <Row justify="space-between">
                  <Text type="secondary">Total SKUs:</Text>
                  <Text strong>{items.reduce((s, i) => s + (i.quantity || 0), 0)}</Text>
                </Row>
                <Divider style={{ margin: '8px 0' }} />
                <Row justify="space-between">
                  <Text style={{ fontSize: 16 }}>Total Amount:</Text>
                  <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                    ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </Row>
              </Space>
            </Card>
          </Col>
        </Row>

        <Card
          title="Order Items"
          style={{ marginTop: 16 }}
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>
              Add Item
            </Button>
          }
        >
          {items.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#888' }}>
                <InboxOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                Click "Add Item" to start adding products to this order
              </div>
            )
            : (
              <Table
                dataSource={items}
                columns={itemColumns}
                rowKey="key"
                pagination={false}
                size="small"
                scroll={{ x: 700 }}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={4} align="right">
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
            )
          }
        </Card>

        <Row justify="end" style={{ marginTop: 24 }}>
          <Space>
            <Button onClick={() => navigate('/purchase-orders')}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              Create Purchase Order
            </Button>
          </Space>
        </Row>
      </Form>
    </Space>
  );
};

export default POForm;
