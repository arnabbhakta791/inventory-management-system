import React, { useEffect, useState, useCallback } from 'react';
import {
  Form, Input, Button, Card, Space, Typography,
  Row, Col, Divider, message, Select,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const SupplierForm = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [form]    = Form.useForm();
  const isEdit    = !!id;
  const [loading, setLoading]   = useState(false);
  const [products, setProducts] = useState([]);

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await api.get('/products', { params: { limit: 200 } });
      setProducts(data.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchSupplier = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get(`/suppliers/${id}`);
      const s = data.data;
      form.setFieldsValue({
        name:          s.name,
        email:         s.email,
        phone:         s.phone,
        contactPerson: s.contactPerson,
        notes:         s.notes,
        'address.street':  s.address?.street,
        'address.city':    s.address?.city,
        'address.state':   s.address?.state,
        'address.zip':     s.address?.zip,
        'address.country': s.address?.country,
        productIds: s.products?.map((p) => p.productId?._id || p.productId).filter(Boolean),
      });
    } catch {
      message.error('Failed to load supplier');
    }
  }, [id, form]);

  useEffect(() => { fetchProducts(); fetchSupplier(); }, [fetchProducts, fetchSupplier]);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      // Shape address from flat form fields into nested object
      const payload = {
        name:          values.name,
        email:         values.email || '',
        phone:         values.phone || '',
        contactPerson: values.contactPerson || '',
        notes:         values.notes || '',
        address: {
          street:  values['address.street']  || '',
          city:    values['address.city']    || '',
          state:   values['address.state']   || '',
          zip:     values['address.zip']     || '',
          country: values['address.country'] || '',
        },
        products: (values.productIds || []).map((pid) => ({
          productId:        pid,
          defaultUnitPrice: 0,
          leadTimeDays:     7,
        })),
      };

      if (isEdit) {
        await api.put(`/suppliers/${id}`, payload);
        message.success('Supplier updated');
      } else {
        await api.post('/suppliers', payload);
        message.success('Supplier created');
      }
      navigate('/suppliers');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row align="middle" gutter={12}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/suppliers')}>
            Back
          </Button>
        </Col>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            {isEdit ? 'Edit Supplier' : 'New Supplier'}
          </Title>
        </Col>
      </Row>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={24}>
          {/* Left column — Basic Info */}
          <Col xs={24} lg={14}>
            <Card title="Basic Information">
              <Row gutter={16}>
                <Col xs={24} sm={14}>
                  <Form.Item
                    name="name"
                    label="Supplier Name"
                    rules={[{ required: true, message: 'Name is required' }]}
                  >
                    <Input placeholder="e.g. Global Textiles Ltd." />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={10}>
                  <Form.Item name="contactPerson" label="Contact Person">
                    <Input placeholder="e.g. Ravi Kumar" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ type: 'email', message: 'Enter a valid email', warningOnly: false }]}
                  >
                    <Input placeholder="supplier@example.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label="Phone">
                    <Input placeholder="+91 98765 43210" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Payment terms, special instructions..." />
              </Form.Item>
            </Card>

            <Card title="Address" style={{ marginTop: 16 }}>
              <Form.Item name="address.street" label="Street">
                <Input placeholder="123 Industrial Area" />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="address.city" label="City">
                    <Input placeholder="Mumbai" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="address.state" label="State">
                    <Input placeholder="Maharashtra" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="address.zip" label="ZIP / PIN">
                    <Input placeholder="400001" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={16}>
                  <Form.Item name="address.country" label="Country">
                    <Input placeholder="India" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Right column — Linked Products */}
          <Col xs={24} lg={10}>
            <Card
              title="Linked Products"
              extra={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Optional — link products this supplier provides
                </Typography.Text>
              }
            >
              <Form.Item name="productIds" label="Products">
                <Select
                  mode="multiple"
                  placeholder="Select products..."
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    option?.children?.toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                >
                  {products.map((p) => (
                    <Option key={p._id} value={p._id}>
                      {p.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Linked products appear in the Purchase Order form when selecting this supplier.
              </Typography.Text>
            </Card>
          </Col>
        </Row>

        <Row justify="end" style={{ marginTop: 24 }}>
          <Space>
            <Button onClick={() => navigate('/suppliers')}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              {isEdit ? 'Update Supplier' : 'Create Supplier'}
            </Button>
          </Space>
        </Row>
      </Form>
    </Space>
  );
};

export default SupplierForm;
