import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Input, Select, Typography,
  Popconfirm, message, Badge, Tooltip, Card, Row, Col, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  DeleteOutlined, WarningOutlined, ReloadOutlined, ShopOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { useRole } from '../../hooks/useRole';

const { Title } = Typography;
const { Option } = Select;

const ProductList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isManagerOrAbove } = useRole();

  // Pre-fill supplier filter from URL (e.g. navigated from Suppliers page)
  const urlSupplierId   = searchParams.get('supplierId')   || '';
  const urlSupplierName = searchParams.get('supplierName') || '';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);   // raw: products with any variant below threshold
  const [poSafeCount,   setPoSafeCount]   = useState(0);   // how many of those are already covered by a PO
  // alertMap: { "productId::sku": alertObject } — only contains variants that NEED action (not PO-covered)
  const [alertMap,      setAlertMap]      = useState({});
  const [filters, setFilters] = useState({
    search: '', category: '', isActive: 'true',
    supplierId: urlSupplierId,
  });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchProducts = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.pageSize, ...filters };
      if (!params.search)     delete params.search;
      if (!params.category)   delete params.category;
      if (!params.supplierId) delete params.supplierId;
      const { data } = await api.get('/products', { params });
      setProducts(data.data);
      setPagination((p) => ({ ...p, current: page, total: data.pagination.total }));
    } catch {
      message.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.pageSize]);

  const fetchMeta = useCallback(async () => {
    try {
      const [catRes, lowStockRes] = await Promise.all([
        api.get('/products/categories'),
        api.get('/products/low-stock'),
      ]);
      setCategories(catRes.data.data);
      const raw    = lowStockRes.data.rawCount ?? lowStockRes.data.count;
      const smart  = lowStockRes.data.count;
      setLowStockCount(raw);
      setPoSafeCount(raw - smart);
      // Build lookup map from smart alerts (variants that still need action)
      const map = {};
      (lowStockRes.data.data || []).forEach((a) => {
        map[`${a.productId}::${a.sku}`] = a;
      });
      setAlertMap(map);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProducts(1); }, [filters]);
  useEffect(() => { fetchMeta(); }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/products/${id}`);
      message.success('Product deactivated');
      fetchProducts(pagination.current);
    } catch {
      message.error('Failed to delete product');
    }
  };

  const columns = [
    {
      title: 'Product',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{name}</span>
          <span style={{ fontSize: 12, color: '#888' }}>{record.brand}</span>
        </Space>
      ),
    },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (c) => <Tag color="blue">{c}</Tag> },
    {
      title: 'Variants',
      key: 'variants',
      render: (_, record) => (
        <Space wrap>
          {record.variants.slice(0, 3).map((v) => {
            const isLow        = v.stock < v.lowStockThreshold;
            const alert        = alertMap[`${record._id}::${v.sku}`];
            // needsAction: below threshold AND no PO is covering it
            const needsAction  = isLow && !!alert;
            // coveredByPO: below threshold BUT a pending PO will replenish it
            const coveredByPO  = isLow && !alert;

            const tooltipText = needsAction
              ? `Stock: ${v.stock} / Threshold: ${v.lowStockThreshold}${alert.pendingPOQty > 0 ? ` · ${alert.pendingPOQty} incoming via PO (still not enough)` : ''} — needs restocking`
              : coveredByPO
              ? `Stock: ${v.stock} / Threshold: ${v.lowStockThreshold} — covered by a pending Purchase Order`
              : `Stock: ${v.stock} / Threshold: ${v.lowStockThreshold}`;

            return (
              <Tooltip key={v.sku} title={tooltipText}>
                <Tag
                  color={needsAction ? 'red' : coveredByPO ? 'orange' : 'default'}
                  icon={needsAction ? <WarningOutlined /> : coveredByPO ? <InboxOutlined /> : null}
                >
                  {v.sku}: {v.stock}
                </Tag>
              </Tooltip>
            );
          })}
          {record.variants.length > 3 && <Tag>+{record.variants.length - 3} more</Tag>}
        </Space>
      ),
    },
    {
      title: 'Total Stock',
      key: 'totalStock',
      render: (_, record) => {
        const total       = record.variants.reduce((s, v) => s + v.stock, 0);
        const hasAction   = record.variants.some((v) => v.stock < v.lowStockThreshold && !!alertMap[`${record._id}::${v.sku}`]);
        const hasCovered  = record.variants.some((v) => v.stock < v.lowStockThreshold && !alertMap[`${record._id}::${v.sku}`]);
        const color       = hasAction ? '#ff4d4f' : hasCovered ? '#fa8c16' : 'inherit';
        const badge       = hasAction ? '!' : hasCovered ? '↓' : 0;
        return (
          <Tooltip title={hasAction ? 'Needs restocking' : hasCovered ? 'Low stock covered by pending PO' : undefined}>
            <Badge count={badge} size="small" offset={[4, 0]}
              style={{ backgroundColor: hasAction ? '#ff4d4f' : '#fa8c16' }}>
              <span style={{ color, fontWeight: 600 }}>{total}</span>
            </Badge>
          </Tooltip>
        );
      },
    },
    {
      title: 'Supplier',
      key: 'supplier',
      render: (_, record) => record.supplierId?.name || <span style={{ color: '#ccc' }}>—</span>,
    },
    { title: 'Status', dataIndex: 'isActive', key: 'isActive', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
    // Actions column only visible to manager / owner
    ...(isManagerOrAbove ? [{
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/products/${record._id}/edit`)}>Edit</Button>
          <Popconfirm title="Deactivate this product?" onConfirm={() => handleDelete(record._id)} okText="Yes" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  const clearSupplierFilter = () => {
    setFilters((f) => ({ ...f, supplierId: '' }));
    setSearchParams({});
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Supplier filter banner */}
      {filters.supplierId && (
        <Alert
          type="info"
          showIcon
          icon={<ShopOutlined />}
          message={
            <span>
              Showing products linked to supplier{' '}
              <strong>{urlSupplierName || filters.supplierId}</strong>
            </span>
          }
          action={
            <Button size="small" onClick={clearSupplierFilter}>
              Clear filter
            </Button>
          }
          style={{ borderRadius: 8 }}
        />
      )}

      <Row justify="space-between" align="middle">
        <Col><Title level={3} style={{ margin: 0 }}>Products</Title></Col>
        <Col>
          <Space>
            {lowStockCount > 0 && (
              <Tooltip
                title={
                  poSafeCount > 0
                    ? `${poSafeCount} of these ${lowStockCount} item${lowStockCount > 1 ? 's are' : ' is'} already covered by a pending Purchase Order — no action needed for those.`
                    : 'All low-stock items need restocking'
                }
              >
                <Tag color="red" icon={<WarningOutlined />}>
                  {lowStockCount} Low Stock
                  {poSafeCount > 0 && (
                    <span style={{ marginLeft: 5, opacity: 0.85, fontSize: 11 }}>
                      · {poSafeCount} covered by PO
                    </span>
                  )}
                </Tag>
              </Tooltip>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => fetchProducts(1)}>Refresh</Button>
            {isManagerOrAbove && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/new')}>Add Product</Button>
            )}
          </Space>
        </Col>
      </Row>

      <Card size="small">
        <Row gutter={12}>
          <Col flex="auto">
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Category"
              allowClear
              style={{ width: 160 }}
              value={filters.category || undefined}
              onChange={(v) => setFilters((f) => ({ ...f, category: v || '' }))}
            >
              {categories.map((c) => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Col>
          <Col>
            <Select
              value={filters.isActive}
              style={{ width: 120 }}
              onChange={(v) => setFilters((f) => ({ ...f, isActive: v }))}
            >
              <Option value="true">Active</Option>
              <Option value="false">Inactive</Option>
              <Option value="all">All</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (t) => `${t} products`,
          onChange: (page, size) => { setPagination((p) => ({ ...p, pageSize: size })); fetchProducts(page); },
        }}
        scroll={{ x: 900 }}
      />
    </Space>
  );
};

export default ProductList;
