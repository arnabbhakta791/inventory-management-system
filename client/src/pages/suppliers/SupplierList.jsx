import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Input, Typography, Popconfirm,
  message, Card, Row, Col, Avatar, Tooltip,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  DeleteOutlined, PhoneOutlined, MailOutlined,
  TeamOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useRole } from '../../hooks/useRole';

const { Title } = Typography;

const SupplierList = () => {
  const navigate = useNavigate();
  const { isManagerOrAbove } = useRole();
  const [suppliers, setSuppliers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchSuppliers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.pageSize };
      if (search) params.search = search;
      const { data } = await api.get('/suppliers', { params });
      setSuppliers(data.data);
      setPagination((p) => ({ ...p, current: page, total: data.pagination.total }));
    } catch {
      message.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [search, pagination.pageSize]);

  useEffect(() => { fetchSuppliers(1); }, [search]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/suppliers/${id}`);
      message.success('Supplier deactivated');
      fetchSuppliers(pagination.current);
    } catch {
      message.error('Failed to delete supplier');
    }
  };

  const columns = [
    {
      title: 'Supplier',
      key: 'supplier',
      render: (_, record) => (
        <Space>
          <Avatar style={{ backgroundColor: '#1890ff' }}>
            {record.name.charAt(0).toUpperCase()}
          </Avatar>
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 600 }}>{record.name}</span>
            {record.contactPerson && (
              <span style={{ fontSize: 12, color: '#888' }}>
                <TeamOutlined /> {record.contactPerson}
              </span>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.email && (
            <span style={{ fontSize: 12 }}>
              <MailOutlined style={{ marginRight: 4, color: '#1890ff' }} />
              <a href={`mailto:${record.email}`}>{record.email}</a>
            </span>
          )}
          {record.phone && (
            <span style={{ fontSize: 12 }}>
              <PhoneOutlined style={{ marginRight: 4, color: '#52c41a' }} />
              {record.phone}
            </span>
          )}
        </Space>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_, record) => {
        const { city, state, country } = record.address || {};
        const parts = [city, state, country].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : <span style={{ color: '#ccc' }}>—</span>;
      },
    },
    {
      title: 'Products',
      key: 'products',
      align: 'center',
      render: (_, record) => {
        const count = record.productCount || 0;
        return (
          <Tag
            color="blue"
            style={{ cursor: count > 0 ? 'pointer' : 'default' }}
            onClick={() => count > 0 && navigate(`/products?supplierId=${record._id}&supplierName=${encodeURIComponent(record.name)}`)}
          >
            {count} linked
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    // Actions column only visible to manager / owner
    ...(isManagerOrAbove ? [{
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/suppliers/${record._id}/edit`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Deactivate this supplier?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Remove
            </Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Suppliers</Title>
        <div className="page-header-actions">
          <Button icon={<ReloadOutlined />} onClick={() => fetchSuppliers(1)}>Refresh</Button>
          {isManagerOrAbove && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/suppliers/new')}>
              Add Supplier
            </Button>
          )}
        </div>
      </div>

      <Card size="small">
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search by supplier name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 360 }}
        />
      </Card>

      <Table
        columns={columns}
        dataSource={suppliers}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (t) => `${t} suppliers`,
          onChange: (page, size) => {
            setPagination((p) => ({ ...p, pageSize: size }));
            fetchSuppliers(page);
          },
        }}
        scroll={{ x: 800 }}
      />
    </Space>
  );
};

export default SupplierList;
