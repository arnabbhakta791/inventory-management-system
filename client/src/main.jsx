import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider
        theme={{
          algorithm: antTheme.defaultAlgorithm,

          // ── Global design tokens ─────────────────────────────────
          token: {
            // Brand
            colorPrimary:        '#6366F1',  // Indigo-500
            colorPrimaryHover:   '#4F46E5',
            colorPrimaryActive:  '#4338CA',

            // Surfaces
            colorBgBase:         '#F8FAFC',
            colorBgContainer:    '#ffffff',
            colorBgLayout:       '#F1F5F9',
            colorBgElevated:     '#ffffff',

            // Text
            colorText:           '#0F172A',
            colorTextSecondary:  '#64748B',
            colorTextTertiary:   '#94A3B8',
            colorTextHeading:    '#0F172A',

            // Borders
            colorBorder:         '#E2E8F0',
            colorBorderSecondary:'#F1F5F9',

            // Semantic
            colorSuccess:        '#10B981',
            colorWarning:        '#F59E0B',
            colorError:          '#EF4444',
            colorInfo:           '#6366F1',

            // Shape
            borderRadius:        8,
            borderRadiusSM:      6,
            borderRadiusLG:      12,
            borderRadiusXL:      16,

            // Typography
            fontFamily:          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize:            14,
            fontSizeLG:          16,
            fontSizeXL:          20,
            fontWeightStrong:    600,
            lineHeight:          1.6,

            // Shadows
            boxShadow:           '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
            boxShadowSecondary:  '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)',

            // Motion
            motionDurationMid:   '0.15s',
            motionDurationSlow:  '0.25s',
            motionEaseInOut:     'cubic-bezier(0.4,0,0.2,1)',
          },

          // ── Component-level overrides ─────────────────────────────
          components: {
            Layout: {
              siderBg:       'transparent',
              headerBg:      '#ffffff',
              bodyBg:        '#F1F5F9',
              triggerBg:     'rgba(255,255,255,0.08)',
              triggerColor:  '#fff',
            },

            Menu: {
              // Dark sidebar menu
              darkItemBg:           'transparent',
              darkSubMenuItemBg:    'transparent',
              darkItemColor:        '#94A3B8',
              darkItemHoverColor:   '#ffffff',
              darkItemHoverBg:      'rgba(255,255,255,0.06)',
              darkItemSelectedColor:'#ffffff',
              darkItemSelectedBg:   'rgba(99,102,241,0.18)',
              darkPopupBg:          '#1E1B4B',
              iconSize:             16,
              collapsedIconSize:    18,
            },

            Card: {
              headerBg:            'transparent',
              boxShadow:           '0 1px 3px rgba(0,0,0,0.08)',
              paddingLG:           20,
            },

            Button: {
              borderRadius:        8,
              paddingInline:       16,
              fontWeight:          500,
            },

            Input: {
              borderRadius:        8,
              paddingBlock:        8,
            },

            Select: {
              borderRadius:        8,
            },

            Table: {
              borderRadius:        8,
              headerBg:            '#F8FAFC',
              headerColor:         '#374151',
              headerSortActiveBg:  '#F1F5F9',
              rowHoverBg:          '#FAFAFA',
              borderColor:         '#F1F5F9',
              headerSplitColor:    '#E2E8F0',
            },

            Badge: {
              statusSize:          8,
            },

            Tag: {
              borderRadius:        6,
              defaultBg:           '#F1F5F9',
              defaultColor:        '#475569',
            },

            Modal: {
              borderRadius:        12,
            },

            Notification: {
              borderRadius:        12,
            },

            Statistic: {
              contentFontSize:     28,
            },

            Progress: {
              remainingColor:      '#F1F5F9',
            },
          },
        }}
      >
        <AuthProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
