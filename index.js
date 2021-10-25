let fs = require("fs")
let path = require("path")
let UglifyJS = require("uglify-js")

// 加载器模版
let assetJSTpl = fs.readFileSync(path.resolve(__dirname, "asset.tpl.js"), "utf8")

// pwa模版
let assetPwaTpl = fs.readFileSync(path.resolve(__dirname, "pwa.tpl.js"), "utf8")

function assetTplReplace(text, hash, min = true) {
    let txt = text.replace(/"--(\w+)--"/g, function (s0, s1) {
        let val = hash[s1] || ""
        if (val instanceof RegExp) {
            return val.toString()
        }
        return JSON.stringify(val)
    })
    if (min) {
        let uJS = UglifyJS.minify(txt)
        // if (!uJS.code) {
        //     console.error(uJS)
        // }
        return uJS.code || txt
    }
    // console.log(txt)
    return txt
}

function assetsSource(text) {
    return {
        source() {
            return text
        },
        size() {
            return Buffer.byteLength(text, "utf8")
        }
    }
}

// 资源缓存cache
class AssetCache {
    constructor({ comment }) {
        this.assets = []
        this.comment = comment
    }

    addAsset(asset, isPre = false) {
        if (asset.constructor == Array) {
            for (let i = 0; i < asset.length; i += 1) {
                this.addAsset(asset[i], isPre)
            }
            return
        }
        let src = encodeURI(asset)
        if (this.assets.indexOf(src) < 0) {
            this.assets[isPre ? "unshift" : "push"](src)
        }
    }

    size() {
        return Buffer.byteLength(this.source(), "utf8")
    }

    source() {
        return `CACHE MANIFEST
# ${this.comment}

CACHE:
${this.assets.join("\n")}

NETWORK:
*
`
    }
}

// 讲html文件中的 css和js全部匹配出来
function getRes(text) {
    // script 加载 重写，防止更新缓慢
    // script src
    let script = []
    // script的标签
    let tagScript = []
    // 样式 src
    let css = []
    // 样式的标签
    let tagCss = []

    return {
        tagScript,
        script,
        tagCss,
        css,
        html: text
            .replace(/<script[^>]+?src=(['"])(.+?)\1[^>]*?>\s*?<\/script>/g, function (match, quot, src) {
                // 正常的script正则
                // cache.addAsset(src)
                script.push(src)
                tagScript.push(match)
                return ""
            })
            .replace(/<script[^>]+?src=([\S]+?)(?:[\s*>]|\s+[^>]+>)\s*?<\/script>/g, function (match, src) {
                // console.log("match", match, src)
                // 属性无引号的正则
                // cache.addAsset(src)
                script.push(src)
                tagScript.push(match)
                return ""
            })
            .replace(/<link[^>]+?href=(['"]?)(.+?)\1[^>]*?\/?>/g, function (match, quot, src) {
                // 正常css
                if (/\.css$/.test(src)) {
                    // cache.addAsset(src)
                    css.push(src)
                    tagCss.push(match)
                    return ""
                }
                return match
            })
            .replace(/<link[^>]+?href=([\S]+?)(?:>|\s+\/?>)/g, function (match, src) {
                // 属性无css的
                if (/\.css$/.test(src)) {
                    // cache.addAsset(src)
                    css.push(src)
                    tagCss.push(match)
                    return ""
                }
                return match
            })
    }
}

// 默认的资源加载重写器
function assetDefLoader({ assets, asset, text, cache, version, swUrl, swType }) {
    let { tagScript, tagCss, html, script, css } = getRes(text)

    const serviceWorkText = `
var canUse = ${swType} || !window.applicationCache
var sw = window.navigator.serviceWorker
if (sw && canUse) {
    if (sw.controller) {
        sw.controller.postMessage({
            version: "${version}"
        })
    }

    // 使用浏览器特定方法注册一个新的service worker
    sw.register("${swUrl}").then(function(reg) {
        if (!reg.active) {
            reg.update()
        }
    })
}`

    // 分析出来的js和css加入缓存
    cache.addAsset(script)
    cache.addAsset(css)

    let assetJS = asset + ".js"
    // 基本的，容灾使用
    let assetTplText = assetTplReplace(
        assetJSTpl,
        {
            tagCss: tagCss.join(""),
            tagScript: tagScript.join("")
        },
        false
    )
    let assetTplTextJs = assetTplText
    if (swType >= 0) {
        // 加入 service
        assetTplTextJs = assetTplText.replace("//#servicework#//", serviceWorkText)
    }
    assetTplTextJs = UglifyJS.minify(assetTplTextJs).code || assetTplTextJs

    assetTplText = UglifyJS.minify(assetTplText).code || assetTplText
    assets[assetJS] = assetsSource(assetTplTextJs)

    // 加入时间差，办证加载器无缓存
    let scriptBody = `<script>window.document.write('<script src="${assetJS}?' + new Date().getTime() + '"></'+'script>')</script><script>${assetTplText}</script>`

    // 加入 代码
    const bodyRegExp = /(<\/body\s*>)/i
    if (bodyRegExp.test(html)) {
        // Append assets to body element
        html = html.replace(bodyRegExp, function (match) {
            return scriptBody + match
        })
    } else {
        // Append scripts to the end of the file if no <body> element exists:
        html += scriptBody
    }

    return html
}

// html代码增加 manifest
function assetMakeHTML(assets, asset, assetName, compilation, swName) {
    console.log("zzzz", assets, asset, assetName, swName)
    // , this.assetLoader || assetDefLoader, this.cache
    // manifest
    let manifest = asset.replace(/[^/]+\/+/g, "../").replace(/[^/]+$/, assetName)
    let swUrl = asset.replace(/[^/]+\/+/g, "../").replace(/[^/]+$/, swName)
    let text = assets[asset].source().replace(/(<html[^>]*)(>)/i, (match, start, end) => {
        // Append the manifest only if no manifest was specified
        if (/\smanifest\s*=/.test(match)) {
            return match
        }
        return start + ' manifest="' + manifest + '"' + end
    })

    let assetLoader = this.assetLoader || assetDefLoader
    let param = { assets, asset, text, cache: this.cache, version: this.version, swUrl, swType: this.swType }
    text = assetLoader.call(
        this,
        Object.assign({}, param, {
            getRes,
            compilation,
            assetDefLoader() {
                return assetDefLoader(param)
            }
        })
    )

    // 重写 html asset
    assets[asset] = assetsSource(text)
}

// webpack 插件入口
class AssetCachePlugin {
    constructor({ exclude = [], name = "asset", comment, assetLoader, version, swAutoCacheReg, assetEach, swType = 0, assetLoaderEnd } = {}) {
        if (swAutoCacheReg && swAutoCacheReg instanceof RegExp) {
            this.swAutoCacheReg = swAutoCacheReg
        }
        // serviceWork 工作状态 -1 不使用 0 自动 1 使用
        this.swType = typeof swType == "number" ? swType : 0
        this.version = version || "pwa" + new Date().getTime().toString(36)
        // manifest 名称
        this.name = name
        this.cache = new AssetCache({ comment })
        // 自定义资源加载器 方便做容灾
        this.assetLoader = assetLoader

        this.assetEach = assetEach

        // Convert exclusion strings to RegExp.
        this.exclude = exclude.map(exclusion => {
            if (exclusion instanceof RegExp) return exclusion
            return new RegExp(`^${exclusion}$`)
        })

        this.assetLoaderEnd = assetLoaderEnd
    }

    apply(compiler) {
        const { options: { output: outputOptions = {} } = {} } = compiler
        const { publicPath = "" } = outputOptions

        const buildAppCache = compilation => {
            const version = this.version
            const assets = compilation.assets
            const cache = this.cache
            const swAutoCacheReg = this.swAutoCacheReg
            const swType = this.swType
            const assetName = this.name + ".appcache"
            const swName = this.name + ".sw.js"
            let assetEach = this.assetEach || function () {}
            for (let key in assets) {
                let isExclude = this.exclude.some(pattern => pattern.test(key))
                if (isExclude) {
                    continue
                }
                assetEach.call(this, {
                    key,
                    assets,
                    cache,
                    swAutoCacheReg
                })
                if (/\.html$/.test(key)) {
                    // 处理html
                    assetMakeHTML.call(this, assets, key, assetName, compilation, swName)
                    continue
                }

                if (/\.appcache$/.test(key)) {
                    // 不用离线
                    continue
                }

                // 排除不需要缓存的url
                cache.addAsset(publicPath + key)
            }

            this.assetLoaderEnd &&
                this.assetLoaderEnd({
                    compilation,
                    setAsset(name, text) {
                        assets[swName] = assetsSource(text)
                    },
                    getSWAsset(param = {}) {
                        return assetsSource(assetTplReplace(assetPwaTpl, Object.assign({ version, cacheArr: cache.assets, swAutoCacheReg }, param)))
                    }
                })

            if (!assets[assetName]) {
                assets[assetName] = cache
            }

            if (!assets[swName] && swType >= 0) {
                assets[swName] = assetsSource(assetTplReplace(assetPwaTpl, { version, cacheArr: cache.assets, swAutoCacheReg }))
            }
        }

        let emit = compiler.hooks && compiler.hooks.emit
        // Detect Webpack 4 API.
        if (emit) {
            emit.tap("AssetCachePlugin", buildAppCache)
        } else {
            // webpack3一下注册
            compiler.plugin("emit", (compilation, callback) => {
                buildAppCache(compilation)
                callback()
            })
        }
    }
}

module.exports = AssetCachePlugin
