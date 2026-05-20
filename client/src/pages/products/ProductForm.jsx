import React, { useEffect, useState, useCallback } from 'react';
import {
  Form, Input, InputNumber, Button, Card, Space, Typography,
  Select, Tag, Table, Divider, message, Row, Col, Tooltip, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Generate all SKU combinations from attribute values
const generateVariantCombinations = (attributes, attrValues) => {
  const keys = attributes.filter((a) => attrValues[a]?.length > 0);
  if (keys.length === 0) return [];

  const combos = keys.reduce((acc, key) => {
    const vals = attrValues[key];
    if (acc.length === 0) return vals.map((v) => ({ [key]: v }));
    return acc.flatMap((combo) => vals.map((v) => ({ ...combo, [key]: v })));
  }, []);

  return combos.map((combo) => {
    const skuSuffix = Object.values(combo).join('-').toUpperCase().replace(/\s+/g, '');
    return {
      sku: skuSuffix,
      attributes: combo,
      stock: 0,
      reservedStock: 0,
      costPrice: 0,
      sellingPrice: 0,
      lowStockThreshold: 10,
    };
  });
};

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [attributes, setAttributes] = useState([]); // e.g. ["size", "color"]
  const [attrValues, setAttrValues] = useState({}); // e.g. { size: ["S","M","L"], color: ["Red","Blue"] }
  const [variants, setVariants] = useState([{ sku: 'DEFAULT', attributes: {}, stock: 0, reservedStock: 0, costPrice: 0, sellingPrice: 0, lowStockThreshold: 10 }]);
  const [newAttr, setNewAttr] = useState('');

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data } = await api.get('/suppliers', { params: { limit: 100 } });
      setSuppliers(data.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get(`/products/${id}`);
      const p = data.data;
      form.setFieldsValue({
        name: p.name, description: p.description, category: p.category,
        brand: p.brand, supplierId: p.supplierId?._id, tags: p.tags,
      });
      setAttributes(p.attributes || []);
      // Rebuild attrValues from existing variants
      const av = {};
      (p.attributes || []).forEach((attr) => {
        av[attr] = [...new Set(p.variants.map((v) => v.attributes?.[attr]).filter(Boolean))];
      });
      setAttrValues(av);
      setVariants(p.variants.map((v) => ({ ...v, attributes: Object.fromEntries(v.attributes || []) })));
    } catch {
      message.error('Failed to load product');
    }
  }, [id, form]);

  useEffect(() => { fetchSuppliers(); fetchProduct(); }, [fetchSuppliers, fetchProduct]);

  const addAttribute = () => {
    const attr = newAttr.trim().toLowerCase();
    if (!attr || attributes.includes(attr)) return;
    setAttributes((prev) => [...prev, attr]);
    setAttrValues((prev) => ({ ...prev, [attr]: [] }));
    setNewAttr('');
    // Switch to multi-variant mode
    setVariants([]);
  };

  const removeAttribute = (attr) => {
    setAttributes((prev) => prev.filter((a) => a !== attr));
    setAttrValues((prev) => { const n = { ...prev }; delete n[attr]; return n; });
  };

  const handleAttrValuesChange = (attr, values) => {
    setAttrValues((prev) => ({ ...prev, [attr]: values }));
  };

  const regenerateVariants = () => {
    if (attributes.length === 0) {
      setVariants([{ sku: form.getFieldValue('name')?.toUpperCase().replace(/\s/g, '-') || 'DEFAULT', attributes: {}, stock: 0, reservedStock: 0, costPrice: 0, sellingPrice: 0, lowStockThreshold: 10 }]);
      return;
    }
    const generated = generateVariantCombinations(attributes, attrValues);
    if (generated.length === 0) { message.warning('Add values to each attribute first'); return; }

    // Preserve stock/price data for existing SKUs
    const existingMap = {};
    variants.forEach((v) => { existingMap[v.sku] = v; });

    const productName = form.getFieldValue('name') || 'PROD';
    const prefix = productName.toUpperCase().replace(/\s+/g, '-').slice(0, 6);
    const merged = generated.map((v) => {
      const fullSku = `${prefix}-${v.sku}`;
      return existingMap[fullSku]
        ? { ...existingMap[fullSku], attributes: v.attributes }
        : { ...v, sku: fullSku };
    });
    setVariants(merged);
    message.success(`Generated ${merged.length} variant(s)`);
  };

  const updateVariantField = (sku, field, value) => {
    setVariants((prev) => prev.map((v) => v.sku === sku ? { ...v, [field]: value } : v));
  };

  const removeVariant = (sku) => {
    setVariants((prev) => prev.filter((v) => v.sku !== sku));
  };

  const onFinish = async (values) => {
    if (variants.length === 0) { message.error('Add at least one variant'); return; }
    const skus = variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) { message.error('Duplicate SKUs detected'); return; }

    try {
      setLoading(true);
      const payload = { ...values, attributes, variants };
      if (isEdit) {
        await api.put(`/products/${id}`, payload);
        message.success('Product updated');
      } else {
        await api.post('/products', payload);
        message.success('Product created');
      }
      navigate('/products');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const variantColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (sku, record) => (
      <Input size="small" value={sku} onChange={(e) => updateVariantField(sku, 'sku', e.target.value)} style={{ width: 160 }} />
    )},
    ...(attributes.map((attr) => ({
      title: attr.charAt(0).toUpperCase() + attr.slice(1),
      key: attr,
      render: (_, record) => <Tag>{record.attributes?.[attr] || '—'}</Tag>,
    }))),
    { title: 'Stock', dataIndex: 'stock', key: 'stock', render: (v, record) => (
      <InputNumber size="small" min={0} value={v} onChange={(val) => updateVariantField(record.sku, 'stock', val || 0)} style={{ width: 80 }} />
    )},
    { title: 'Cost (₹)', dataIndex: 'costPrice', key: 'costPrice', render: (v, record) => (
      <InputNumber size="small" min={0} precision={2} value={v} onChange={(val) => updateVariantField(record.sku, 'costPrice', val || 0)} style={{ width: 90 }} />
    )},
    { title: 'Price (₹)', dataIndex: 'sellingPrice', key: 'sellingPrice', render: (v, record) => (
      <InputNumber size="small" min={0} precision={2} value={v} onChange={(val) => updateVariantField(record.sku, 'sellingPrice', val || 0)} style={{ width: 90 }} />
    )},
    { title: 'Low Stock Alert', dataIndex: 'lowStockThreshold', key: 'lowStockThreshold', render: (v, record) => (
      <InputNumber size="small" min={0} value={v} onChange={(val) => updateVariantField(record.sku, 'lowStockThreshold', val || 0)} style={{ width: 80 }} />
    )},
    { title: '', key: 'del', render: (_, record) => (
      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeVariant(record.sku)} disabled={variants.length === 1} />
    )},
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row align="middle" gutter={12}>
        <Col><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')}>Back</Button></Col>
        <Col><Title level={3} style={{ margin: 0 }}>{isEdit ? 'Edit Product' : 'New Product'}</Title></Col>
      </Row>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <Card title="Product Details">
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item name="name" label="Product Name" rules={[{ required: true }]}>
                    <Input placeholder="e.g. Classic T-Shirt" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="brand" label="Brand">
                    <Input placeholder="e.g. Nike" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                    <Input placeholder="e.g. Clothing, Electronics" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="supplierId" label="Supplier">
                    <Select placeholder="Select supplier" allowClear>
                      {suppliers.map((s) => <Option key={s._id} value={s._id}>{s.name}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="Description">
                <TextArea rows={3} placeholder="Product description..." />
              </Form.Item>
              <Form.Item name="tags" label="Tags">
                <Select mode="tags" placeholder="Add tags (press Enter)" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card
              title={<Space><span>Variant Attributes</span><Tooltip title="Define dimensions like size or color to auto-generate SKU combinations"><InfoCircleOutlined /></Tooltip></Space>}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Leave empty for single-variant products</Text>}
            >
              <Space wrap style={{ marginBottom: 12 }}>
                {attributes.map((attr) => (
                  <Tag key={attr} closable onClose={() => removeAttribute(attr)} color="blue" style={{ fontSize: 13 }}>
                    {attr}
                  </Tag>
                ))}
              </Space>

              <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
                <Input
                  placeholder="Add attribute (e.g. size, color)"
                  value={newAttr}
                  onChange={(e) => setNewAttr(e.target.value)}
                  onPressEnter={addAttribute}
                />
                <Button onClick={addAttribute} icon={<PlusOutlined />}>Add</Button>
              </Space.Compact>

              {attributes.map((attr) => (
                <Form.Item key={attr} label={`${attr.charAt(0).toUpperCase() + attr.slice(1)} values`}>
                  <Select
                    mode="tags"
                    placeholder={`e.g. ${attr === 'size' ? 'S, M, L, XL' : attr === 'color' ? 'Red, Blue, Green' : 'Value 1, Value 2'}`}
                    value={attrValues[attr] || []}
                    onChange={(vals) => handleAttrValuesChange(attr, vals)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              ))}

              {attributes.length > 0 && (
                <Button type="dashed" block icon={<PlusOutlined />} onClick={regenerateVariants}>
                  Generate Variants ({generateVariantCombinations(attributes, attrValues).length} combos)
                </Button>
              )}
            </Card>
          </Col>
        </Row>

        <Card
          title={`Variants (${variants.length})`}
          style={{ marginTop: 16 }}
          extra={
            attributes.length === 0 && (
              <Button size="small" icon={<PlusOutlined />} onClick={() => setVariants((prev) => [...prev, { sku: `SKU-${Date.now()}`, attributes: {}, stock: 0, reservedStock: 0, costPrice: 0, sellingPrice: 0, lowStockThreshold: 10 }])}>
                Add Variant
              </Button>
            )
          }
        >
          {variants.length === 0
            ? <Alert message="Click 'Generate Variants' above to create SKU combinations" type="info" showIcon />
            : (
              <Table
                dataSource={variants}
                columns={variantColumns}
                rowKey="sku"
                pagination={false}
                scroll={{ x: 700 }}
                size="small"
              />
            )
          }
        </Card>

        <Row justify="end" style={{ marginTop: 24 }}>
          <Space>
            <Button onClick={() => navigate('/products')}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {isEdit ? 'Update Product' : 'Create Product'}
            </Button>
          </Space>
        </Row>
      </Form>
    </Space>
  );
};

export default ProductForm;
