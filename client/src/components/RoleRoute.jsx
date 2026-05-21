import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';

/**
 * RoleRoute — route-level role guard.
 * Redirects to "/" if the logged-in user's role is below `minRole`.
 *
 * Usage in App.jsx:
 *   <Route path="/products/new"
 *     element={<RoleRoute minRole="manager"><ProductForm /></RoleRoute>} />
 */
const RoleRoute = ({ children, minRole = 'manager' }) => {
  const { can } = useRole();
  return can(minRole) ? children : <Navigate to="/" replace />;
};

export default RoleRoute;
