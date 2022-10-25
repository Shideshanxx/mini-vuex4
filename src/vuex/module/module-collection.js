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
  getNamespaced(path) {
    let module = this.root;
    return path.reduce((namespacedStr, key) => {
      module = module.getChild(key);
      return namespacedStr + (module.namespaced ? key + "/" : "");
    }, "");
  }
}
