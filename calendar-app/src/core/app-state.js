/**
 * 应用级单例状态
 * widget / widgetConfig / mainPage 三个组件共享 HolidayService 与 UserStore
 * 第一个初始化的组件负责加载，其余组件订阅变更
 */
import { HolidayService } from './holiday-service.js';
import { UserStore } from './user-store.js';

let holidayService = null;
let userStore = null;
let initPromise = null;

export function getHolidayService() {
  return holidayService;
}

export function getUserStore() {
  return userStore;
}

/** 确保服务已初始化（幂等） */
export function ensureAppState(api) {
  if (!holidayService) {
    holidayService = new HolidayService(api);
    userStore = new UserStore(api);
  }
  if (!initPromise) {
    initPromise = Promise.all([holidayService.init(), userStore.init()]).catch(() => {});
  }
  return initPromise;
}

/** 订阅数据变化，返回取消订阅函数 */
export function subscribeAppState(fn) {
  const unsubs = [];
  if (holidayService) unsubs.push(holidayService.onChange(fn));
  if (userStore) unsubs.push(userStore.onChange(fn));
  return () => unsubs.forEach((u) => u());
}
