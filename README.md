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
        // 循环assets时调用， 下面的例子是通过正则将页面中的外链资源地址找出并加入离线缓存清单文件中
        assetEach({ key, assets, cache }) {
            if (!/(?!\.html)\.(js|css)$/.test(key)) {
                // 匹配 css 和 js 排除 .html.js
                return
            }

            let source = assets[key].source()
            if (typeof source != "string") {
                return
            }

            source = source.match(/(?:(["'])|\()(?:(?:https?|ftp):)?[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|](?:\1|\))/g)
            if (!source) {
                return
            }
            source.forEach(function(url) {
                url = url.slice(1, url.length - 1)
                let sort = url.split(/[?#]/)[0]
                if (/\.(?:png|jpe?g|gif|svg|js|css|woff2?|eot|ttf|otf)$/.test(sort)) {
                    // 加入缓存列表，而且必须为这些结尾的外链资源
                    cache.addAsset(url)
                    return
                }
            })
        },
        // pwa cache 需要的版本号，不传会自动生成
        version: "v111",
        // 非清单文件中的文件，如果匹配，会自动离线
        // 不传，将不离线清单外的资源
        swAutoCacheReg: /\/\/file.democdn.cn\//,
        // serviceWork 开启状态 -1 关闭  0 自动（appCache没有的时候开启） 1 始终开启 注意：如果浏览器本身不支持，也无效
        swType: 1
    }
])
```

### 正常使用

```js
// 全部使用默认值
new AssetCachePlugin()
```
