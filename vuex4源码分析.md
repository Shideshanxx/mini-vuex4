## 前言
Vuex 是一个专为 Vue.js 应用程序开发的 **状态管理模式** 。它借鉴了Flux、redux的基本思想，将共享的数据抽离到全局，同时利用Vue.js的 **响应式** 机制来进行高效的状态管理与更新。想要掌握了解基础知识可以查阅Vuex官网，本篇主要是对 [vuex4.x版本的源码](https://github.com/vuejs/vuex) 进行研究分析。
## Vuex 核心原理
使用方式：
1. 创建 `store`
    ```js
    import { createStore } from "@/vuex";

    const store = createStore({
    state: {
        count: 0,
    },
    getters: {
        double: (state) => {
        return state.count * 2;
        },
    },
    mutations: {
        add(state, payload) {
        state.count += payload;
        },
    },
    actions: {
        asyncAdd({ commit }, payload) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
            commit("add", payload);
            resolve();
            }, 1000);
        });
        },
    },
    });

    export default store;
    ```
2. 引入 `store`
    ```js
    import store from "./store";
    // 传入key值，标识 store
    createApp(App).use(store, "my").mount("#app");
    ```
3. 使用 `store`
    ```vue
    <template>
        <div>
            count：{{ count }}
            <hr />
            getter：{{ double }}
            <hr />
            <button @click="$store.state.count++">直接修改state</button>
            <button @click="add">同步修改</button>
            <button @click="asyncAdd">异步修改</button>
        </div>
    </template>
    <script>
    import { computed } from "vue";
    import { useStore } from "@/vuex";
    export default {
        name: "App",
        setup() {
            // 传入 key 使用特定的 store
            const store = useStore("my");
            function add() {
                store.commit("add", 1);
            }
            function asyncAdd() {
                store.dispatch("asyncAdd", 1).then(() => {
                    console.log("ok");
                });
            }
            return {
                count: computed(() => store.state.count),
                double: computed(() => store.getters.double),
                add,
                asyncAdd,
            };
        },
    };
    </script>
    ```

[Vuex](https://vuex.vuejs.org/zh/) 的运作流程如下图所示：
![vuex](https://vuex.vuejs.org/vuex.png)

核心原理：
+ `vuex4` 是一个插件，所以创建的 `store` 实例需要实现一个 `install` 方法
+ `vuex4` 需要导出 `createStore`，用于创建 `store` ，接受一个 `options` 对象，
+ `vuex4` 需要导出 `useStore` ，用于在组件中使用 `store` 
+ `store` 是一个全局状态库，并且是响应式的，可以在各个组件中使用 `store` 中的状态
+ 可以创建多个 `store` 实例，通过 `key` 标识来区分不同的 `store`

## 实现一个简易版的 vuex
首先不考虑 `modules`、插件、严格模式、动态模块等功能，实现一个简易版的vuex；该版本包含的功能有：
1. `state` 的派发和注册
2. `state` 的响应式
3. `getters`、`mutations`、`actions`、`commit`、`dispatch`
4. 通过 `key` 标识多个 `store`

#### 实现 store 的派发和注册、响应式、injectKey
+ 通过 `provide/inject` 实现 `store` 的派发和注册
+ 通过 `reactive` 实现 `state` 的响应式
+ 通过在 `provide/inject` 时传入 `injectKey` ，来标识不同的 `store`

```js
import { inject, reactive } from "vue";
const storeKey = "store";
class Store {
    constructor(options) {
        const store = this;
        // state 响应式
        // 做状态持久化时需要整体替换state，为了保持state的响应式，用data进行包裹
        store._state = reactive({ data: options.state });
    }
    // 代理 store._state.data 到 store.state 上
    get state() {
        return this._state.data;
    }
    install(app, injectKey) {
        // 全局暴露一个变量，暴露的是store实例
        app.provide(injectKey || storeKey, this); // this 指向 store 实例
        // 设置全局变量 $store
        app.config.globalProperties.$store = this;
    }
}
export function createStore(options) {
  return new Store(options);
}
export function useStore(injectKey = storeKey) {
  return inject(injectKey);
}
```

#### 实现 getters、mutations、actions、commit、dispatch
+ `getters` 的实现：将 `options.getters` 代理到 `store.getters`，并传入参数 `store.state`；在vue3.2以上版本，可以使用 `computed` 实现 `getters` 的缓存。
+ `mutations` 的实现：将 `options.mutations` 代理到 `store._mutations` 上，绑定 `mutation` 的 `this` 为 `store`，并传入参数 `store.state` 和 `payload` ；`actions` 的实现类似。
+ `commit` 和 `dispatch` 的实现：它们是一个函数，通过传入的 `type` 和 `payload` 匹配并执行对应的 `mutation` 和 `action `

```js
// 遍历 obj，对每一项执行 fn(obj[key], key)
export function forEachValue(obj, fn) {
  Object.keys(obj).forEach((key) => fn(obj[key], key));
}
class Store {
  constructor(options) {
    const store = this;
    store._state = reactive({ data: options.state });
    /**
     * 实现getters
     */
    const _getters = options.getters; // {getter1: fn1, getter2: fn2}
    store.getters = {};
    forEachValue(_getters, function (fn, key) {
      Object.defineProperty(store.getters, key, {
        get: computed(() => fn(store.state)), // 用 computed 对 getters 进行缓存
      });
    });

    /**
     * 实现 mutation 和 actions
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
  /**
   * 实现 commit 和 dispatch
   * commit、dispatch必须写成箭头函数，来保证commit、dispatch里面的this指向store实例
   */
  commit = (type, payload) => {
    this._mutations[type](payload);
  };
  dispatch = (type, payload) => {
    this._actions[type](payload);
  };
  get state() {
    return this._state.data;
  }
  install(app, injectKey) {
    app.provide(injectKey || storeKey, this);
    app.config.globalProperties.$store = this;
  }
}
```

## 源码解析
当项目变得复杂，我们就不得不使用 `modules` 让项目结构更清晰，更具可维护性。
### ModuleCollection
`modules` 包含 `rootModule` 以及 `options.modules` 中的各个子模块，我们 **期望将用户传入的所有 `module` 转化成以下树状结构，并存放到 `store._modules` 变量中** ：
```js
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
```
实现方式：
```js
// vuex/store.js
import { storeKey } from "./injectKey";
import ModuleCollection from "./module/module-collection";
export default class Store {
  constructor(options) {
    const store = this;
    // 1. modules 数据格式化
    store._modules = new ModuleCollection(options);
  }
  install(app, injectKey) {
    app.provide(injectKey || storeKey, this);
    app.config.globalProperties.$store = this;
  }
}
```
```js
// module/module-collection.js
import Module from "./module";
import { forEachValue } from "../utils";
export default class ModuleCollection {
  constructor(rootModule) {
    this.root = null;
    this.register(rootModule, []);
  }
  register(rawModule, path) {
    const newModule = new Module(rawModule);
    // 1. 如果是根模块
    if (path.length === 0) {
      this.root = newModule;
    } else {
      // 2. 如果不是根模块，则设置父模块的 _children 属性
      const parent = path.slice(0, -1).reduce((module, current) => {
        return module.getChild(current);
      }, this.root);
      // key 为 path 的最后一位
      parent.addChild(path[path.length - 1], newModule);
    }
    // 递归处理 modules
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(rawChildModule, path.concat(key));
      });
    }
  }
}
```
```js
// module/module.js
import { forEachValue } from "../utils";
export default class Module {
  constructor(rawModule) {
    this._raw = rawModule;
    this.state = rawModule.state;
    this._children = {};
  }
  addChild(key, module) {
    this._children[key] = module;
  }
  getChild(key) {
    return this._children[key];
  }
  forEachChild(fn) {
    forEachValue(this._children, fn);
  }
}
```

#### installModule
另外，当我们取子 `module` 中的 `state` 时，采用的方式是：`store.state.moduleA.count`，是直接从`store.state` 上链式获取的。我们 **期望在 `store._state` 上包含所有 `modules` 中的数据，其结构如下** ：
```js
{
    count: 0,
    moduleA: {
        count: 0
        moduleC: {
            count: 0
        }
    },
    moduleB: {
        count: 0
    }
}
```
所以我们首先需要将 `store._modules.root.state` 插入各个模块的 `state` 之后，改造成上述结构：
```js
// vuex/store.js
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
    store._modules = new ModuleCollection(options);

    // 2. 改造 store._modules.root.state
    const state = store._modules.root.state; // 根状态
    installModule(store, state, [], store._modules.root);
  }
}
```

#### resetStoreState
创建 `store._wrappedGetters`、`store._mutations`、`store._actions` 用来存储所有模块的 `getters`、`mutations`、`actions`，期望的格式如下：
```js
store: {
    // actions 和 mutations 都是数组格式
    _actions: {
        'moduleB/asyncAdd': [ ƒ ]
    },
    _mutations: {
        'moduleA/add': [ ƒ ]
        'moduleA/moduleC/add': [ ƒ ]
        'add': [ ƒ ]
        'moduleB/add': [ ƒ ]
    }
    _wrappedGetters: {
        'moduleB/plus': () => (...)
        'double': () => (...)
    }
}
```
具体实现：
```js
// vuex/store.js
// 根据路径，获取store上面的最新状态（因为store.state是响应式的，通过store.state.xx.xx获取的也是响应式的）
function getNestedState(state, path) {
  return path.reduce((state, key) => state[key], state);
}
function isPromise(val) {
  return val && typeof val.then === "function";
}
function installModule(store, rootState, path, module) {
  // 略...

  // getters  module._raw.getters
  module.forEachGetter((getter, key) => {
    store._wrappedGetters[key] = () => {
      return getter(getNestedState(store.state, path)); //  getter(module.state) 不可行，因为如果直接使用模块自己的状态，此状态不是响应式的
    };
  });
  // mutation：{add: [mutation1,mutation2], double: [mutation3]} 不同modules中的同名mutation放到同一个数组中
  module.forEachMutation((mutation, key) => {
    const entry = store._mutations[key] || (store._mutations[key] = []);
    entry.push((payload) => {
      // 也通过 getNestedState(store.state, path) 获取module的最新状态
      mutation.call(store, getNestedState(store.state, path), payload);
    });
  });
  // action：【action执行完返回一个Promise】
  module.forEachAction((action, key) => {
    const entry = store._actions[key] || (store._actions[key] = []);
    entry.push((payload) => {
      let res = action.call(store, store, payload);
      if (!isPromise(res)) {
        return Promise.resolve(res);
      }
      return res;
    });
  });

  // 【遍历】 module._children，【递归】执行各个module 的 installModule
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child);
  });
}
export default class Store {
  constructor(options) {
    const store = this;
    // 在store上定义变量，用来存储getters、mutations、actions
    store._wrappedGetters = Object.create(null);
    store._mutations = Object.create(null);
    store._actions = Object.create(null);
  }
}
```
```js
// module/module.js
import { forEachValue } from "../utils";
export default class Module {
    // ...略
  forEachGetter(fn) {
    if (this._raw.getters) {
      forEachValue(this._raw.getters, fn);
    }
  }
  forEachMutation(fn) {
    if (this._raw.mutations) {
      forEachValue(this._raw.mutations, fn);
    }
  }
  forEachAction(fn) {
    if (this._raw.actions) {
      forEachValue(this._raw.actions, fn);
    }
  }
}
```

然后执行 `resetStoreState` ，实现数据响应式，并创建`getters`
```js
// vuex/store.js
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
    // 在store上定义变量，用来存储getters、mutations、actions
    store._wrappedGetters = Object.create(null);
    store._mutations = Object.create(null);
    store._actions = Object.create(null);

    store._modules = new ModuleCollection(options);
    const state = store._modules.root.state;
    installModule(store, state, [], store._modules.root);

    // state数据响应式、创建store.getters
    resetStoreState(store, state);
  }
  get state() {
    return this._state.data;
  }
}
```

实现 `commit` 和 `dispatch`：
```js
export default class Store {
    // ...略
  commit = (type, payload) => {
    const entry = this._mutations[type] || [];
    entry.forEach((handler) => handler(payload));
  };
  dispatch = (type, payload) => {
    const entry = this._actions[type] || [];
    // action 返回的是一个 Promise
    return Promise.all(entry.map((handler) => handler(payload)));
  };
}
```

#### namespaced
在没有设置命名空间的情况下，模块内部的 `action`、 `mutation` 和 `getters` 是注册在全局命名空间的，这样可能会导致多个模块对同一个 `action` 或 `mutation` 作出响应。启用命名空间会让模块内部的状态拥有私有局部空间，不受其他模块影响。
首先修改 `Module` 类，增加一个 `namespaced` 属性：
```js
// vuex/module/module.js
export default class Module {
  constructor(rawModule) {
    this._raw = rawModule;
    this.state = rawModule.state;
    this._children = {};
    this.namespaced = rawModule.namespaced;
  }
}
```
然后创建 `store._modules` 实例的 `getNamespaced` 方法，用来获取 `namespaced` 路径，形如 `moduleA/moduleC/`
```js
// vuex/module/module-collection.js
export default class ModuleCollection {
    // ...略

    // 获取 namespaced 的路径，形如 moduleA/moduleC/
    getNamespaced(path) {
        let module = this.root;
        return path.reduce((namespacedStr, key) => {
            module = module.getChild(key);
            return namespacedStr + (module.namespaced ? key + "/" : "");
        }, "");
    }
}
```
最后修改 `store._mutations`、`store._actions`、`store.__wrappedGetters` 中子模块相关的路径：
```js
// vuex/store.js
function installModule(store, rootState, path, module) {
  // 略...

  const namespaced = store._modules.getNamespaced(path);

  // getters
  module.forEachGetter((getter, key) => {
    store._wrappedGetters[namespaced + key] = () => {
      return getter(getNestedState(store.state, path));
    };
  });
  // mutation
  module.forEachMutation((mutation, key) => {
    const entry = store._mutations[namespaced + key] || (store._mutations[namespaced + key] = []);
    entry.push((payload) => {
      mutation.call(store, getNestedState(store.state, path), payload);
    });
  });
  // action
  module.forEachAction((action, key) => {
    const entry = store._actions[namespaced + key] || (store._actions[namespaced + key] = []);
    entry.push((payload) => {
      let res = action.call(store, store, payload);
      if (!isPromise(res)) {
        return Promise.resolve(res);
      }
      return res;
    });
  });

  // ...略
}
```

#### 严格模式
用户在 `options` 中通过 `strict: true` 开启严格模式；
+ 在严格模式中，`mutation` 只能执行同步操作
+ 修改 `store` 的状态只能在 `mutation` 中进行

实现严格模式的原理：
+ 设置一个初始状态 `_commiting` 为 false；当执行fn回调时，将 `_commiting` 设为 `true`，最后将 `_commiting` 设为 `false`；**如果 `fn` 是同步的，那么在 `fn` 中获取到的 `_commiting` 就为 `true`**，否则 在 `fn` 中获取到的 `_commiting` 为 `false`；
+ 如果没有通过 `mutation` 修改数据，那么 `_commiting` 依然为初始值 `false`；

具体实现：
```js
// vuex/store.js
import { watch } from "vue";
function resetStoreState(store, state) {
  // ...略

  if (store.strict) {
    enableStricMode(store);
  }
}
function enableStricMode(store) {
  // 监控数据变化
  // 1. 如果是mutation同步修改数据，则 store._commiting 为 true，不会报错
  // 2. 如果是mutation异步修改数据、或通过其它方式修改数据，则store._commiting 为 false，会报错
  watch(
    () => store._state.data,
    () => {
      // 当第一个参数是false是，会打印出警告
      console.assert(
        store._commiting,
        "do not mutate vuex store state outside mutation handlers"
      );
    },
    { deep: true, flush: "sync" } // watch 默认是异步的，这里改成同步（状态改变立刻执行回调）监听
  );
}
export default class Store {
    // 先把 this._commiting 改为 true，执行fn后，再将 this._commiting 改回去；如果fn是同步的，则在fn中this._commiting为true。
  _withCommit(fn) {
    const commiting = this._commiting;
    this._commiting = true;
    fn();
    this._commiting = commiting;
  }
  constructor(options) {
    // ...略
    this.strict = options.strict || false;
    this._commiting = false;
  }
  commit = (type, payload) => {
    const entry = this._mutations[type] || [];
    this._withCommit(() => {
      entry.forEach((handler) => handler(payload));
    });
  };
}
```

#### 插件系统
手写一个状态持久化插件：
```js
// vuex插件就是一个函数
// 实现一个数据持久化插件
function persistedStatePlugin(store) {
  // 从缓存中读取数据，并替换store中的state
  let local = localStorage.getItem("VUEX:STATE");
  if (local) {
    store.replaceState(JSON.parse(local));
  }
  // 每当状态变化（执行了mutation），就会执行subscribe的回调
  store.subscribe((mutation, state) => {
    // 缓存状态
    localStorage.setItem("VUEX:STATE", JSON.stringify(state));
  });
}
export default createStore({
    plugins: [persistedStatePlugin],
})
```
该插件有几个重点：
1. vuex插件本质上是一个函数，接收一个参数 `store `
2. `store.replaceState()` 方法会替换掉 `state`
3. 每当通过 `mutation` 修改了状态，都会执行 `store.subscribe(fn)` 里的回调函数（发布订阅模式）

具体实现：
```js
// vuex/store.js
export default class Store {
    constructor(options) {
        // ...略

        // 执行插件（本质是一个函数）
        store._subscribers = [];
        options.plugins.forEach((plugin) => plugin(store));
    }
    subscribe(fn) {
        this._subscribers.push(fn);
    }
    replaceState(newState) {
        // 直接修改state会报错，所以使用 _withCommit 包裹一下
        this._withCommit(() => {
            this._state.data = newState;
        });
    }
    commit = (type, payload) => {
        const entry = this._mutations[type] || [];
        this._withCommit(() => {
            entry.forEach((handler) => handler(payload));
        });

        // 每次 commit 的时候执行所有的 subscribers
        this._subscribers.forEach((sub) => sub({ type, payload }, this.state));
    };
}
```

#### store.registerModule
vuex 可以使用store.registerModule 动态注册modules，使用方式如下：
```js
import { createStore } from "@/vuex";
const store = createStore({
    // ...略
})
// 在moduleA内部创建一个moduleC
store.registerModule(["moduleA", "moduleC"], {
  namespaced: true,
  state: { count: 0 },
  mutations: {
    add(state, payload) {
      state.count += payload;
    },
  },
});

export default store;
```
具体实现：
1. 创建 `store.registerModule` 方法
```js
export default class Store {
    registerModule(path, rawModule) {
        const store = this;
        if (typeof path === "string") {
            path = [path];
        }
        // 1. 在原有模块基础上新增加一个module
        const newModule = store._modules.register(rawModule, path);
        // 2. 再把模块安装上
        installModule(store, store.state, path, newModule);
        // 3. 重置容器
        resetStoreState(store, store.state);
    }
}
```
2. 修改 `ModuleCollection` 的 `register` 方法，返回新的 `newModule`
   ```js
   export default class ModuleCollection {
        // ...
        register(rawModule, path) {
            const newModule = new Module(rawModule);
            // ...略
            return newModule;
        }
        // ...
    }
   ```
3. 在 `installModule` 中设置 `parentState` 的 `state` 时，使用 `store._withCommit()` 进行包裹，否则会警告（严格模式下）
   ```js
    function installModule(store, rootState, path, module) {
        if (!isRoot) {
        let parentState = path
            .slice(0, -1)
            .reduce((state, key) => state[key], rootState);
        store._withCommit(() => {
            parentState[path[path.length - 1]] = module.state;
        });

        module.forEachChild((child, key) => {
            installModule(store, rootState, path.concat(key), child);
        });
    }
    }
   ```

## 写在最后
本篇主要是对 vuex4.0 源码的学习总结，源代码仓库可以查看 [mini-vuex4](https://github.com/Shideshanxx/mini-vuex4)。如果本篇对你有所帮助，欢迎点赞收藏，顺便给个 star ～～。





