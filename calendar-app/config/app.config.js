/**
 * 微应用配置文件
 * 应用基础配置
 */


export default {
  // =======================
  // 应用基础信息
  // =======================
  // 配置文件格式版本
  appJsonVersion: '1.1',
  // 作者标识
  author: 'zhousansui',
  // 应用唯一标识（作者标识-应用标识）
  microAppId: 'zhousansui-holiday-count-down',
  // 应用版本
  version: '2.5.261021-beta',
  // 入口文件
  entry: 'main.js',
  // 图标
  icon: 'icon.png',
  // 调试模式（测试打包时自动强制为 true；正式发布请设置为 false）
  debug: false,

  // 应用信息（使用 '$t: xxx' 可以引用翻译）
  appInfo: {
    appName: '$t:APP_NAME',
    description: '$t:APP_DESCRIPTION',
    networkDescription: '$t:NETWORK_DESCRIPTION',
  },

  // 语言文件映射（appJsonVersion:1.1 新增）
  // 格式：{ 语言代码: 文件名 }
  // 文件名相对于 locales/ 目录，支持多语言代码指向同一文件
  locales: {
    'zh-CN': 'zh-CN.json',
    'en-US': 'en-US.json',
    // 'zh-TW': 'zh-CN.json',  // 示例：繁体中文可指向简体中文文件
  },

  // 默认语言（当主应用语言在微应用中不存在时，回退到此语言）
  // 如果不设置，默认为 'en-US'
  defaultLocale: 'zh-CN',

  // 权限配置
  permissions: [
    'network',
    'dataNode',
  ],

  // 网络域名白名单
  networkDomains: [
    'cdn.jsdelivr.net',
  ],

  // 数据节点配置
  dataNodes: {
    // 节假日数据缓存（所有用户共享，公开可读）
    holidayCache: {
      scope: 'app',
      isPublic: true,
    },
    // 用户日程与设置（每用户隔离，仅登录用户可读写）
    userData: {
      scope: 'user',
      isPublic: false,
    },
  },
};
