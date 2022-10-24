import { createStore } from "@/vuex";

// vue2 中通过 new Store 创建仓库，vue3中通过 createStore 创建仓库
export default createStore({
  // 类似于组件中的data
  state: {
    count: 0,
  },
  // 类似于计算属性（不过 vuex4 中并没有实现计算属性）
  getters: {
    double(state) {
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
      setTimeout(() => {
        commit("add", payload);
      }, 1000);
    },
  },
  modules: {},
  strict: true,
});

// 严格模式
// dispatch(action) => commit(mutation) => 修改状态
