<template>
  <div>
    {{ count }} {{ $store.state.count }}
    <hr />
    <!-- {{ double }} {{ $store.getters.double }} -->
    <button @click="$store.state.count++">错误地直接修改state</button>
    <!-- <button @click="add">提交mutation修改</button>
    <button @click="asyncAdd">提交action修改</button> -->
  </div>
</template>

<script>
import { computed } from "vue";
import { useStore } from "@/vuex";

function useCount(store) {
  function add() {
    store.commit("add", 1);
  }
  function asyncAdd() {
    store.dispatch("asyncAdd", 1);
  }
  return { add, asyncAdd };
}

export default {
  name: "App",
  setup() {
    const store = useStore("my");
    console.log(store);
    function add() {
      store.commit("add", 1);
    }
    function asyncAdd() {
      store.dispatch("asyncAdd", 1);
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
