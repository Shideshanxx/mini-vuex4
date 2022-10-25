import { reactive } from "vue";
import { storeKey } from "./injectKey";
import ModuleCollection from "./module/module-collection";

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
    2. 把状态定义成类似于 store.state.aCount.cCount.state 的形式
 */

function installModule(store, rootState, path, module) {
  let isRoot = !path.length;
  if (!isRoot) {
    let parentState = path
      .slice(0, -1)
      .reduce((state, key) => state[key], rootState);
    parentState[path[path.length - 1]] = module.state;
  }

  // 【遍历】 module._children，【递归】执行 installModule
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child);
  });
}

export default class Store {
  constructor(options) {
    const store = this;
    // 1. 数据格式化
    store._modules = new ModuleCollection(options);
    // 2. 定义状态
    const state = store._modules.root.state; // 根状态
    installModule(store, state, [], store._modules.root);

    console.log(store._modules);
  }
  install(app, injectKey) {
    app.provide(injectKey || storeKey, this);
    app.config.globalProperties.$store = this;
  }
}
