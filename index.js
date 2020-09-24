let fs = require("fs")
let path = require("path")
let UglifyJS = require("uglify-js")

// 加载器模版
let assetJSTpl = fs.readFileSync(path.resolve(__dirname, "asset.tpl.js"), "utf8")

// pwa模版
let assetPwaTpl = fs.readFileSync(path.resolve(__dirname, "pwa.tpl.js"), "utf8")

class TplData {
    constructor(val, type) {
        this.val = val
        this.type = type || "def"
    }
    toString() {
        if (this.type == "tags") {
            return `"${this.val.join("").replace(/"/g, '\\"').replace(/<\//g, '" + endTag + "')}"`
        }
        return this.val.toString()
    }
}

function assetTplReplace(text, hash, min = true) {
    let txt = text.replace(/"--(\w+)--"/g, function (s0, s1) {
        let val = hash[s1] || ""
        if (val instanceof RegExp || val instanceof TplData) {
            return val.toString()
        }
        return JSON.stringify(val)
    })
    if (min) {
        return UglifyJS.minify(txt).code || txt
    }
    return text
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

    addAsset(asset) {
        if (asset.constructor == Array) {
            for (let i = 0; i < asset.length; i += 1) {
                this.addAsset(asset[i])
            }
            return
        }
        let src = encodeURI(asset)
        if (this.assets.indexOf(src) < 0) {
            this.assets.push(src)
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
function assetDefLoader({ assets, asset, text, cache, version, pwaName }) {
    let { tagScript, tagCss, html, script, css } = getRes(text)

    // 分析出来的js和css加入缓存
    cache.addAsset(script)
    cache.addAsset(css)

    let assetJS = asset + ".js"
    let assetTplText = assetTplReplace(assetJSTpl, {
        pwaName,
        version,
        // new TplData(tagCss, "tags")
        tagCss: tagCss.join(""),
        tagScript: tagScript.join("")
    })
    // 加入时间差，办证加载器无缓存
    let scriptBody = `<script>window.document.write('<script src="${assetJS}?' + new Date().getTime() + '"></'+'script>')</script><script>${assetTplText}</script>`
    assets[assetJS] = assetsSource(assetTplText)

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
function assetMakeHTML(assets, asset, name, assetLoader, cache, compilation, version, pwaName) {
    // manifest
    let manifest = asset.replace(/[^/]+\/+/g, "../").replace(/[^/]+$/, name)
    let text = assets[asset].source().replace(/(<html[^>]*)(>)/i, (match, start, end) => {
        // Append the manifest only if no manifest was specified
        if (/\smanifest\s*=/.test(match)) {
            return match
        }
        return start + ' manifest="' + manifest + '"' + end
    })

    text = assetLoader({
        assets,
        asset,
        text,
        cache,
        getRes,
        compilation,
        assetDefLoader() {
            return assetDefLoader({ assets, asset, text, cache, version, pwaName })
        },
        version,
        pwaName
    })

    // 重写 html asset
    assets[asset] = assetsSource(text)
}

// webpack 插件入口
class AssetCachePlugin {
    constructor({ exclude = [], name = "asset", comment, assetLoader, version, pwaAutoCacheReg } = {}) {
        if (pwaAutoCacheReg && pwaAutoCacheReg instanceof RegExp) {
            this.pwaAutoCacheReg = pwaAutoCacheReg
        }
        this.version = version || "pwa" + new Date().getTime().toString(36)
        // manifest 名称
        this.name = name
        this.cache = new AssetCache({ comment })
        // 自定义资源加载器 方便做容灾
        this.assetLoader = assetLoader

        // Convert exclusion strings to RegExp.
        this.exclude = exclude.map(exclusion => {
            if (exclusion instanceof RegExp) return exclusion
            return new RegExp(`^${exclusion}$`)
        })
    }

    apply(compiler) {
        const { options: { output: outputOptions = {} } = {} } = compiler
        const { publicPath = "" } = outputOptions

        const buildAppCache = compilation => {
            let version = this.version
            let assets = compilation.assets

            const assetName = this.name + ".appcache"
            const pwaName = this.name + ".pwa.js"
            for (let asset in compilation.assets) {
                if (/\.html$/.test(asset)) {
                    // 处理html
                    assetMakeHTML(assets, asset, assetName, this.assetLoader || assetDefLoader, this.cache, compilation, version, pwaName)
                    continue
                }

                if (/\.appcache$/.test(asset)) {
                    // 不用离线
                    continue
                }

                // 排除不需要缓存的url
                if (!this.exclude.some(pattern => pattern.test(asset))) {
                    this.cache.addAsset(publicPath + asset)
                }
            }

            if (!assets[assetName]) {
                assets[assetName] = this.cache
            }

            if (!assets[pwaName]) {
                assets[pwaName] = assetsSource(assetTplReplace(assetPwaTpl, { version, cacheArr: this.cache.assets, pwaAutoCacheReg: this.pwaAutoCacheReg }))
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
