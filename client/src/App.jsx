import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './hooks/useAuth';
import AppLayout from './components/Layout/AppLayout';
import PrivateRoute from './components/PrivateRoute';
import RoleRoute from './components/RoleRoute';

// Auth pages (single component handles both login + register with animation)
import AuthPage from './pages/auth/AuthPage';

// App pages (lazy loaded)
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ProductList = React.lazy(() => import('./pages/products/ProductList'));
const ProductForm = React.lazy(() => import('./pages/products/ProductForm'));
const SupplierList = React.lazy(() => import('./pages/suppliers/SupplierList'));
const SupplierForm = React.lazy(() => import('./pages/suppliers/SupplierForm'));
const POList = React.lazy(() => import('./pages/purchaseOrders/POList'));
const POForm = React.lazy(() => import('./pages/purchaseOrders/POForm'));
const PODetail = React.lazy(() => import('./pages/purchaseOrders/PODetail'));
const OrderList = React.lazy(() => import('./pages/orders/OrderList'));
const OrderForm = React.lazy(() => import('./pages/orders/OrderForm'));
const OrderDetail = React.lazy(() => import('./pages/orders/OrderDetail'));
const StockMovements = React.lazy(() => import('./pages/inventory/StockMovements'));
const UserManagement = React.lazy(() => import('./pages/users/UserManagement'));

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <React.Suspense fallback={<div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}><Spin size="large" /></div>}>
      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />

        {/* Protected routes */}
        <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/new"      element={<RoleRoute minRole="manager"><ProductForm /></RoleRoute>} />
          <Route path="/products/:id/edit" element={<RoleRoute minRole="manager"><ProductForm /></RoleRoute>} />
          <Route path="/suppliers" element={<SupplierList />} />
          <Route path="/suppliers/new"      element={<RoleRoute minRole="manager"><SupplierForm /></RoleRoute>} />
          <Route path="/suppliers/:id/edit" element={<RoleRoute minRole="manager"><SupplierForm /></RoleRoute>} />
          <Route path="/purchase-orders" element={<POList />} />
          <Route path="/purchase-orders/new" element={<RoleRoute minRole="manager"><POForm /></RoleRoute>} />
          <Route path="/purchase-orders/:id" element={<PODetail />} />
          <Route path="/orders" element={<OrderList />} />
          <Route path="/orders/new" element={<OrderForm />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/inventory" element={<StockMovements />} />
          <Route path="/users" element={<RoleRoute minRole="manager"><UserManagement /></RoleRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  );
}

export default App;
