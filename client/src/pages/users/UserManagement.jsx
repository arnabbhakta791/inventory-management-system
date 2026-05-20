import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, Typography,
  Popconfirm, Tooltip, Badge, Alert, Card, Row, Col, Statistic,
  message,
} from 'antd';
import {
  UserAddOutlined, EditOutlined, StopOutlined,
  TeamOutlined, CrownOutlined, UserOutlined, ToolOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/axios';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text } = Typography;
const { Option } = Select;

// ── Role styling ──────────────────────────────────────────────────
const ROLE_CONFIG = {
  owner:   { color: 'gold',  icon: <CrownOutlined />, label: 'Owner'   },
  manager: { color: 'blue',  icon: <ToolOutlined />,  label: 'Manager' },
  staff:   { color: 'green', icon: <UserOutlined />,  label: 'Staff'   },
};

const RoleTag = ({ role }) => {
  const cfg = ROLE_CONFIG[role] || { color: 'default', label: role };
  return (
    <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight: 600 }}>
      {cfg.label}
    </Tag>
  );
};

// ─────────────────────────────────────────────────────────────────
const UserManagement = () => {
  const { user: me } = useAuth();

  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = invite new
  const [submitting,  setSubmitting]  = useState(false);

  const [form] = Form.useForm();

  // ── Fetch ────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Open invite modal ────────────────────────────────────────
  const openInvite = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  // ── Open edit-role modal ─────────────────────────────────────
  const openEdit = (record) => {
    setEditingUser(record);
    form.setFieldsValue({ role: record.role });
    setModalOpen(true);
  };

  // ── Submit (create or update role) ──────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingUser) {
        await api.patch(`/users/${editingUser._id}`, { role: values.role });
        message.success('Role updated');
      } else {
        await api.post('/users', values);
        message.success(`User "${values.name}" invited successfully`);
      }

      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      if (err?.response?.data?.message) {
        message.error(err.response.data.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Deactivate user ──────────────────────────────────────────
  const handleDeactivate = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      message.success('User deactivated');
      fetchUsers();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const isOwner = me?.role === 'owner';

  // ── Stats ────────────────────────────────────────────────────
  const activeCount  = users.filter((u) => u.isActive).length;
  const managerCount = users.filter((u) => u.role === 'manager').length;
  const staffCount   = users.filter((u) => u.role === 'staff').length;

  // ── Columns ──────────────────────────────────────────────────
  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <Text strong>{r.name}</Text>
            {r._id === me?._id && (
              <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px' }}>You</Tag>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (role) => <RoleTag role={role} />,
      filters: [
        { text: 'Owner',   value: 'owner'   },
        { text: 'Manager', value: 'manager' },
        { text: 'Staff',   value: 'staff'   },
      ],
      onFilter: (value, record) => record.role === value,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (active) =>
        active
          ? <Badge status="success" text={<Text style={{ color: '#52c41a' }}>Active</Text>} />
          : <Badge status="error"   text={<Text type="secondary">Deactivated</Text>} />,
      filters: [
        { text: 'Active',      value: true  },
        { text: 'Deactivated', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      render: (d) => (
        <Tooltip title={dayjs(d).format('DD MMM YYYY HH:mm')}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(d).format('DD MMM YYYY')}
          </Text>
        </Tooltip>
      ),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    ...(isOwner
      ? [{
          title: 'Actions',
          key: 'actions',
          align: 'right',
          render: (_, r) => {
            const isSelf = r._id === me?._id;
            return (
              <Space>
                <Tooltip title={isSelf ? 'Cannot change your own role' : 'Change role'}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(r)}
                    disabled={isSelf || !r.isActive}
                  >
                    Role
                  </Button>
                </Tooltip>

                {r.isActive && (
                  <Popconfirm
                    title="Deactivate user?"
                    description={`"${r.name}" will lose access immediately.`}
                    onConfirm={() => handleDeactivate(r._id)}
                    okText="Deactivate"
                    okButtonProps={{ danger: true }}
                    disabled={isSelf}
                  >
                    <Tooltip title={isSelf ? 'Cannot deactivate yourself' : 'Deactivate'}>
                      <Button
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        disabled={isSelf}
                      >
                        Deactivate
                      </Button>
                    </Tooltip>
                  </Popconfirm>
                )}
              </Space>
            );
          },
        }]
      : []),
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>

      {/* Header */}
      <Row justify="space-between" align="middle">
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8 }} />
            User Management
          </Title>
          <Text type="secondary">Manage team members and their access roles</Text>
        </Col>
        {isOwner && (
          <Col>
            <Button type="primary" icon={<UserAddOutlined />} onClick={openInvite}>
              Invite User
            </Button>
          </Col>
        )}
      </Row>

      {!isOwner && (
        <Alert
          message="View-only mode"
          description="Only owners can invite users or change roles."
          type="info"
          showIcon
        />
      )}

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: '3px solid #1890ff' }}>
            <Statistic
              title="Total Users"
              value={users.length}
              prefix={<TeamOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: '3px solid #52c41a' }}>
            <Statistic
              title="Active"
              value={activeCount}
              prefix={<CheckCircleOutlined />}
              loading={loading}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: '3px solid #1890ff' }}>
            <Statistic
              title="Managers"
              value={managerCount}
              prefix={<ToolOutlined />}
              loading={loading}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: '3px solid #722ed1' }}>
            <Statistic
              title="Staff"
              value={staffCount}
              prefix={<UserOutlined />}
              loading={loading}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Table
        dataSource={users}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        rowClassName={(r) => (!r.isActive ? 'ant-table-row-disabled' : '')}
      />

      {/* Invite / Edit-role Modal */}
      <Modal
        title={editingUser ? `Change Role — ${editingUser.name}` : 'Invite New User'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingUser ? 'Update Role' : 'Create User'}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {!editingUser && (
            <>
              <Form.Item
                label="Full Name"
                name="name"
                rules={[{ required: true, message: 'Name is required' }]}
              >
                <Input placeholder="Jane Smith" autoComplete="off" />
              </Form.Item>

              <Form.Item
                label="Email Address"
                name="email"
                rules={[
                  { required: true, message: 'Email is required' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input placeholder="jane@company.com" autoComplete="off" />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[
                  { required: true, message: 'Password is required' },
                  { min: 6, message: 'At least 6 characters' },
                ]}
              >
                <Input.Password placeholder="Min. 6 characters" autoComplete="new-password" />
              </Form.Item>
            </>
          )}

          <Form.Item
            label="Role"
            name="role"
            initialValue="staff"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="owner">
                <Space>
                  <CrownOutlined style={{ color: '#faad14' }} />
                  Owner — full access including user management
                </Space>
              </Option>
              <Option value="manager">
                <Space>
                  <ToolOutlined style={{ color: '#1890ff' }} />
                  Manager — manage inventory, orders &amp; POs
                </Space>
              </Option>
              <Option value="staff">
                <Space>
                  <UserOutlined style={{ color: '#52c41a' }} />
                  Staff — view and create orders
                </Space>
              </Option>
            </Select>
          </Form.Item>

          {!editingUser && (
            <Alert
              message="The user can log in immediately with the credentials you provide."
              type="info"
              showIcon
              style={{ marginTop: 8 }}
            />
          )}
        </Form>
      </Modal>

    </Space>
  );
};

export default UserManagement;
