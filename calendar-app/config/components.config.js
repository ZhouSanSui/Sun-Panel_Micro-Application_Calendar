/**
 * 组件配置文件
 * 类似于 vue 路由配置，name 值全局不可以重复
 */

// 导入组件对象（只在浏览器环境使用）
import { Widget as CalendarWidget } from '../src/components/widget.js';
import { WidgetConfig as CalendarConfig } from '../src/components/widgetConfig.js';
import { MainPage as CalendarMain } from '../src/components/mainPage.js';

export default {
  // =======================
  // 页面注册
  // =======================
  pages: {
    // 卡片配置页面（Apple 设置风格）
    'calendar-config': {
      // 组件对象（直接引用）
      component: CalendarConfig,
      // 背景颜色 支持css样式，为空底色默认为白色
      background: '#F2F2F7',
      backgroundDark: '#000000',
      // 头部文字颜色
      headerTextColor: '#1D1D1F',
      headerTextColorDark: '#F5F5F7',
      // 窗口尺寸
      width: 560,
      height: 760,
      resize: true,
      move: true,
    },

    // 主页面（首页面组件）
    'calendar-main': {
      // 组件对象（直接引用）
      component: CalendarMain,
      // 页面类型：main 表示主页面，会在微应用列表处统一入口打开
      type: 'main',
      // 背景颜色 支持css样式，为空底色默认为白色
      background: '#F2F2F7',
      backgroundDark: '#000000',
      // 头部文字颜色
      headerTextColor: '#1D1D1F',
      headerTextColorDark: '#F5F5F7',
      // 是否显示全屏按钮（可选）
      showFullscreenBtn: true,
      // 窗口尺寸（v1.5 起加高；v1.8 再调到 1120 尝试更长。若 SunPanel 缓存旧尺寸，需移除应用后重新添加方能生效）
      width: 880,
      height: 1120,
      resize: true,
      move: true,
    },

  },

  // =======================
  // 小部件（卡片）注册
  // =======================
  widgets: {
    'calendar-widget': {
      // 组件对象（直接引用）widgetId
      component: CalendarWidget,
      // 绑定的小部件配置 Page 组件名字
      // 当主平台添加当前应用的小部件时会以窗口的形式打开此组件页面进行配置
      configComponentName: 'calendar-config',
      // 卡片尺寸: 1x1 1x2 2x1 2x2 2x4 4x4 1xfull
      // 1xfull = 宽 1 格、高度占满整列的长条卡片
      size: ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull'],
      // 为空使用Sun-Panel默认背景颜色作为底色 支持css样式
      background: '',
      // v1.1 新增字段
      widgetName: '$t:WIDGET_CALENDAR_NAME',
      widgetDescription: '$t:WIDGET_CALENDAR_DESCRIPTION',
      sort: 10, // 排序权重，数字越小越靠前
    },
  },
};
