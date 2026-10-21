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
  version: '2.0.261021',
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
  //
  // 本应用只有一处联网请求，域名固定为 cdn.jsdelivr.net：
  //   GET https://cdn.jsdelivr.net/npm/chinese-days@latest/dist/years/<年份>.json
  //   （只取「当年」与「次年」两个文件，例如 2026 年运行即取 2026.json、2027.json）
  //
  // 用途：获取中国的法定节假日 / 调休（补班）安排。
  //   数据来源：npm 包 chinese-days（MIT）—— https://github.com/vsme/chinese-days
  //   该包已作为依赖打包进 main.js，内置 2004–2026 年的数据；
  //   联网只是为了在国务院发布次年的放假通知后，无需重新发版即可自动更新数据。
  //
  // 缓存与刷新（src/core/holiday-service.js）：
  //   - 拉到的数据写入 dataNode 的 holidayCache（应用级、公开可读，全用户共享）
  //   - 自动刷新间隔 24 小时；用户手动刷新最小间隔 60 秒
  //   - 三级回退：dataNode 缓存 → 网络拉取 → 内置兜底（src/core/holiday-fallback.js，含 2024–2026）
  //
  // 想彻底断网（完全离线）时可以这样改，但需知悉后果：
  //   1) 删掉本数组里的 'cdn.jsdelivr.net'（或整条 networkDomains）
  //   2) 从上面 permissions 里删掉 'network'
  //   3) 可再删掉 appInfo.networkDescription
  //   后果：节假日/调休只能使用打包时的内置数据（当前为 2004–2026）。
  //   次年放假通知发布后不会自动生效，必须升级 app 依赖（chinese-days）并重新打包发版。
  //   本应用的农历、节气、传统节日由本地库计算，不受此开关影响。
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
