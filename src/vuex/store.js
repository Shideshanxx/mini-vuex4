import { reactive } from "vue";
import { storeKey } from "./injectKey";
import ModuleCollection from "./module/module-collection";
import { isPromise, forEachValue } from "./utils";

/**
 * 1. 格式化用户的参数，转化成树状结构（递归设置 _children 属性）
    root = {
        _raw: rootModule,
        state: rootModule.state,
        _children: {
            aCount: {
                _raw: aModule,
                state: aModule.state,
                _children: {
                    cCount: {
                        _raw:cModule,
                        state: cModule.state,
                        _children:{}
                    }
                },
            },
            bCount: {
                _raw: bModule,
                state: bModule.state,
                _children: {},
            },
        },
    };
    2. 把 modules 中的state安装到根模块的state中，定义成类似于 store.state.aCount.cCount.state 形式的树状结构
    3. 在store上添加 getters、mutations、actions
 */

// 根据路径，获取store上面的最新状态（因为store.state是响应式的）
function getNestedState(state, path) {
  return path.reduce((state, key) => state[key], state);
}

function installModule(store, rootState, path, module) {
  let isRoot = !path.length;

  const namespaced = store._modules.getNamespaced(path);

  if (!isRoot) {
    let parentState = path
      .slice(0, -1)
      .reduce((state, key) => state[key], rootState);
    parentState[path[path.length - 1]] = module.state;
  }

  // getters  module._raw.getters
  module.forEachGetter((getter, key) => {
    store._wrappedGetters[namespaced + key] = () => {
      return getter(getNestedState(store.state, path)); //  getter(module.state) 不可行，因为如果直接使用模块自己的状态，此状态不是响应式的
    };
  });
  // mutation：{add: [mutation1,mutation2], double: [mutation3]} 不同modules中的同名mutation放到同一个数组中
  module.forEachMutation((mutation, key) => {
    const entry =
      store._mutations[namespaced + key] ||
      (store._mutations[namespaced + key] = []);
    entry.push((payload) => {
      // 也通过 getNestedState(store.state, path) 获取module的最新状态
      mutation.call(store, getNestedState(store.state, path), payload);
    });
  });
  // action：【action执行完返回一个Promise】
  module.forEachAction((action, key) => {
    const entry =
      store._actions[namespaced + key] ||
      (store._actions[namespaced + key] = []);
    entry.push((payload) => {
      let res = action.call(store, store, payload);
      if (!isPromise(res)) {
        return Promise.resolve(res);
      }
      return res;
    });
  });

  // 【遍历】 module._children，【递归】执行 installModule
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child);
  });
}

function resetStoreState(store, state) {
  // 由于state在状态持久化的时候可能会整体替换，为了维持响应式，给state包一层data属性
  store._state = reactive({ data: state });
  store.getters = {};
  forEachValue(store._wrappedGetters, (getter, key) => {
    Object.defineProperty(store.getters, key, {
      enumerable: true,
      get: () => getter(), // 在vue3.2版本后，可以用 computed 对 getter 值进行缓存
    });
  });
}

export default class Store {
  constructor(options) {
    const store = this;
    // 1. 数据格式化
    store._modules = new ModuleCollection(options);

    // 在store上定义变量，用来存储getters、mutations、actions
    store._wrappedGetters = Object.create(null);
    store._mutations = Object.create(null);
    store._actions = Object.create(null);

    // 2. 定义状态
    const state = store._modules.root.state; // 根状态
    installModule(store, state, [], store._modules.root);

    // 将state（store._modules.root.state）代理到store上
    resetStoreState(store, state);

    console.log(store);
  }
  get state() {
    return this._state.data;
  }
  commit = (type, payload) => {
    const entry = this._mutations[type] || [];
    entry.forEach((handler) => handler(payload));
  };
  dispatch = (type, payload) => {
    const entry = this._actions[type] || [];
    return Promise.all(entry.map((handler) => handler(payload)));
  };
  install(app, injectKey) {
    app.provide(injectKey || storeKey, this);
    app.config.globalProperties.$store = this;
  }
}
