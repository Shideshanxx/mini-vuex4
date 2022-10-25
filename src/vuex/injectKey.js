import { inject } from "vue";

export const storeKey = "store"; // store 的默认key
// 使用时在组件中引入
export function useStore(injectKey = storeKey) {
  return inject(injectKey);
}
