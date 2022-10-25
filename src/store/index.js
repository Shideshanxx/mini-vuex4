import { createStore } from "@/vuex";

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

// vue2 中通过 new Store 创建仓库，vue3中通过 createStore 创建仓库
const store = createStore({
  // 类似于组件中的data
  state: {
    count: 0,
  },
  // 类似于计算属性（不过 vuex4 中并没有实现计算属性）
  getters: {
    double: (state) => {
      return state.count * 2;
    },
  },
  // 可以更改状态，必须是同步的
  mutations: {
    add(state, payload) {
      state.count += payload;
    },
  },
  // 可以是同步或者异步，可以调用其它的action 或 mutation
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
  // 子模块实现逻辑拆分
  modules: {
    aCount: {
      namespaced: true,
      state: { count: 0 },
      mutations: {
        add(state, payload) {
          state.count += payload;
        },
      },
      // modules: {
      //   cCount: {
      //     namespaced: true,
      //     state: { count: 0 },
      //     mutations: {
      //       add(state, payload) {
      //         state.count += payload;
      //       },
      //     },
      //   },
      // },
    },
    bCount: {
      namespaced: true,
      state: { count: 0 },
      getters: {
        hahaha: (state) => {
          return state.count * 2;
        },
      },
      mutations: {
        add(state, payload) {
          state.count += payload;
        },
      },
    },
  },
  // 开启严格模式，只能在mutation中同步修改状态，否则会提示错误
  strict: true,
  // 插件会按照注册顺序依次执行
  plugins: [persistedStatePlugin],
});

store.registerModule(["aCount", "cCount"], {
  namespaced: true,
  state: { count: 0 },
  mutations: {
    add(state, payload) {
      state.count += payload;
    },
  },
});

export default store;
