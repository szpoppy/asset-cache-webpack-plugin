# asset-cache-webpack-plugin

离线缓存自动生成工具

> 注意：基本上只测试 vue-cli 上，其他有问题，可以提

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
        exclude: [/\.map$/, /\/_/],
        // 注解部分
        comment: env.subDir,
        // 自定义 资源加载 可选参数
        assetLoader() {}
    }
])
```

### 正常使用

```js
new AssetCachePlugin({
    // 离线缓存排除文件
    exclude: [/\.map$/, /\/_/],
    // 注解部分
    comment: env.subDir,
    // 自定义 资源加载 可选参数
    assetLoader() {}
})
```
