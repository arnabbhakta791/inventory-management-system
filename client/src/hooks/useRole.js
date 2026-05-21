import { useAuth } from './useAuth';

// Role level map — higher number = more permissions
const ROLE_LEVEL = { owner: 3, manager: 2, staff: 1 };

/**
 * useRole — role-aware helpers for conditional UI rendering.
 *
 * Usage:
 *   const { isOwner, isManagerOrAbove, can } = useRole();
 *   {isManagerOrAbove && <Button>Add Product</Button>}
 *   {can('manager') && <Button>Edit</Button>}
 */
export const useRole = () => {
  const { user } = useAuth();
  const role  = user?.role || 'staff';
  const level = ROLE_LEVEL[role] || 0;

  return {
    role,
    isOwner:          role === 'owner',
    isManager:        role === 'manager',
    isStaff:          role === 'staff',
    isManagerOrAbove: level >= ROLE_LEVEL.manager,   // manager + owner
    // Generic check: can('manager') → true for manager and owner
    can: (minRole) => level >= (ROLE_LEVEL[minRole] || 0),
  };
};
