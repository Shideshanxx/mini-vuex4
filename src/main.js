import { createApp } from "vue";
import App from "./App.vue";
import store from "./store";

// 通过 Vue.use(store) 使用 vuex，会默认调用 store 中的 install 方法。
createApp(App).use(store, "my").mount("#app");
