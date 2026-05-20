import { useEffect } from 'react';
import { notification } from 'antd';
import { FireOutlined, WarningOutlined } from '@ant-design/icons';
import { useSocket } from '../hooks/useSocket';

/**
 * Null-rendering component that lives inside AppLayout.
 * Subscribes to Socket.io stock events and surfaces Ant Design
 * notifications so every page sees real-time alerts.
 *
 * Events handled:
 *   stock:low     → warning (or error if critical) notification
 *   stock:updated → silent (too noisy to show per-movement)
 */
const StockAlertListener = () => {
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!socket || !connected) return;

    const handleStockLow = (data) => {
      const isCritical = data.severity === 'critical';

      notification[isCritical ? 'error' : 'warning']({
        // Unique key prevents duplicate toasts for same SKU in same second
        key: `stock-low-${data.variantSku}-${data.productId}`,
        message: isCritical ? 'Stock Critical — Out of Stock' : 'Low Stock Alert',
        description: (
          <span>
            <strong>SKU: {data.variantSku}</strong> — stock is{' '}
            <strong style={{ color: isCritical ? '#ff4d4f' : '#faad14' }}>
              {data.currentStock}
            </strong>{' '}
            (threshold: {data.threshold})
            {data.pendingPOQty > 0 && (
              <span style={{ color: '#1890ff' }}>
                {' '}· {data.pendingPOQty} units in pending PO
              </span>
            )}
          </span>
        ),
        icon: isCritical
          ? <FireOutlined style={{ color: '#ff4d4f' }} />
          : <WarningOutlined style={{ color: '#faad14' }} />,
        placement: 'bottomRight',
        duration: isCritical ? 0 : 8, // critical stays until manually dismissed
      });
    };

    socket.on('stock:low', handleStockLow);

    return () => {
      socket.off('stock:low', handleStockLow);
    };
  }, [socket, connected]);

  return null;
};

export default StockAlertListener;
