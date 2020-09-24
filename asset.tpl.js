;(function() {
    if (window.__asset_script_loaded_) {
        // 次函数只能执行一次
        return
    }
    var tagCss = "--tagCss--"
    var version = "--version--"
    var tagScript = "--tagScript--"
    var pwaName = "--pwaName--"
    var appCache = window.applicationCache
    var sw = window.navigator.serviceWorker
    if (!appCache && sw) {
        // 表示高级浏览器移除了 离线缓存，这时启动pwa
        if (sw.controller) {
            sw.controller.postMessage({
                version: version
            })
        }

        // 使用浏览器特定方法注册一个新的service worker
        sw.register("./" + pwaName).then(function(reg) {
            if (!reg.active) {
                reg.update()
            }
        })
    }

    window.document.write(tagCss + tagScript)
    window.__asset_script_loaded_ = 1
})()
