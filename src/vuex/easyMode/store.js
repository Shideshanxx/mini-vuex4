/**
 * 没有modules的简单版本
 */

import { forEachValue } from "./urils";
import { reactive, computed } from "vue";
import { storeKey } from "./injectKey";

/**
 * 创建容器，返回一个store
 * 1. 由于createStore可以多次使用，所以采用工厂模式（vuex4才具有多例模式，vue2中使用的vuex3只有单例）
 * 2. 多个store的具体使用方式：
 *    a. 引入store的时候设置标识：app.use(store, 'store1')；
 *    b. 使用store的时候传入该标识：const store = useStore('store1')
 * 3. options对象为创建store时传入的参数，包含state、getters、mutations、actions、modules、strict、plugins等
 */
export default class Store {
  constructor(options) {
    // vuex3 内部会创建一个vue实例来实现响应式，但是vuex4直接采用 vue3 提供的响应式方法
    const store = this;
    /**
     * 实现state的响应式
     * 【问】为何不直接使用 reactive(options.state)，要多包一层data属性？
     * 【答】因为在vuex中有一个重要的api replaceState（一般用来做状态持久化），它会直接重写整个state，导致无法触发响应式，如果包一层，则会对 store._state.data 进行修改，依然触发响应式。
     */
    // store._state.data
    store._state = reactive({ data: options.state });

    /**
     * 实现getters
     */
    const _getters = options.getters; // {getter1: fn1, getter2: fn2}
    store.getters = {};
    forEachValue(_getters, function (fn, key) {
      // Object.defineProperty(store.getters, key, {
      //   get: computed(() => fn(store.state)), // 用 computed 对 getters 进行缓存（vue3.2之后才支持使用computed对getter进行缓存）
      // });
      Object.defineProperty(store.getters, key, {
        enumerable: true,
        get: () => fn(store.state), // 用 computed 对 getters 进行缓存（vue3.2之后才支持使用computed对getter进行缓存）
      });
    });

    /**
     * 实现mutation和actions
     * 使用Object.create(null)创建空对象没有原型链，而使用 {} 创建空对象是由原型链的。
     *
     */
    store._mutations = Object.create(null);
    store._actions = Object.create(null);
    const _mutations = options.mutations;
    const _actions = options.actions;
    forEachValue(_mutations, (mutation, key) => {
      store._mutations[key] = (payload) => {
        mutation.call(store, store.state, payload);
      };
    });
    forEachValue(_actions, (action, key) => {
      store._actions[key] = (payload) => {
        action.call(store, store, payload);
      };
    });
  }
  // commit、dispatch必须写成箭头函数，来保证commit、dispatch里面的this指向store实例
  commit = (type, payload) => {
    this._mutations[type](payload);
  };
  dispatch = (type, payload) => {
    this._actions[type](payload);
  };
  get state() {
    return this._state.data;
  }
  // createApp().use(store,key) 相当于调用 store.install(app,key)，所以install方法接受两个参数：app 和 key
  install(app, injectKey) {
    // 全局暴露一个变量，暴露的是store实例
    app.provide(injectKey || storeKey, this); // this 指向 store 实例
    // 在vue2中为：Vue.prototype.$store = this
    app.config.globalProperties.$store = this; // 设置全局变量 $store
  }
}
