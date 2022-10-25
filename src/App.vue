<template>
  <div>
    count：{{ count }}
    <hr />
    getter：{{ double }}
    <hr />
    a模块：{{ aCount }} b模块：{{ bCount }} c模块：{{ cCount }} <br />
    <button @click="$store.commit('aCount/add', 1)">改a</button>
    <button @click="$store.commit('bCount/add', 1)">改b</button>
    <button @click="$store.commit('aCount/cCount/add', 1)">改c</button>
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
      aCount: computed(() => store.state.aCount.count),
      bCount: computed(() => store.state.bCount.count),
      cCount: computed(() => store.state.aCount.cCount.count),
      add,
      asyncAdd,
    };
  },
};
</script>
