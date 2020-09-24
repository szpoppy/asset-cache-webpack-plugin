# asset-cache-webpack-plugin

离线缓存自动生成工具

> 注意：基本上只测试 vue-cli 上，其他有问题，可以提

[2020年9月24日] 介于chrome85+移除了离线缓存，添加pwa存储，功能一样。当chrome85+时，会启用pwa缓存。

## 安装

> npm i asset-cache-webpack-plugin --save

## 特点

-   完全自动化生成离线缓存文件 appcache
-   资源加载由 html 文件转移到一个 js 文件加载，保证离线缓存更新及时
-   极好的兼容性

## 使用

### vue chain-webpack

```js
const AssetCachePlugin = require("asset-cache-webpack-plugin")
// 启用离线缓存
// conf.plugin("app-cache").use(CachePlugin, [])
conf.plugin("asset-cache").use(AssetCachePlugin, [
    {
        // 离线缓存排除文件
        exclude: [/\.map$/],
        // 注解部分
        comment: "manifest",
        // 自定义 资源加载 可选参数
        assetLoader() {},
        // pwa cache 需要的版本号，不传会自动生成
        version: "v111",
        // 非清单文件中的文件，如果匹配，会自动离线
        // 不传，将不离线清单外的资源
        pwaAutoCacheReg: /\/\/file.40017.cn\//
    }
])
```

### 正常使用

```js
// 全部使用默认值
new AssetCachePlugin()
```
