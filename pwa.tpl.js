//一个存储空间
var version = "--version--"
// 需要离线缓存的数组
var cacheArr = "--cacheArr--"
// 自动离线的正则
var autoCacheReg = "--pwaAutoCacheReg--"

self.addEventListener("message", function(event) {
    // console.log("[message]", version, event.data);
    if (event.data && event.data.version) {
        version = event.data.version
    }
})

// 转全路径
// var cacheArr = []
// cachePutArr.forEach(function(url) {
//     let loc = location
//     let fUrl = ""
//     if (/^\w+:/.test(url)) {
//         fUrl = url
//     } else if (/^\/\//.test(url)) {
//         fUrl = loc.protocol + url
//     } else if (/^\//.test(url)) {
//         fUrl = loc.origin + url
//     } else {
//         fUrl = url.replace(/^(\.\/)*/, loc.origin + loc.pathname.replace(/[^/]*$/, ""))
//     }
//     cacheArr.push(fUrl)
// })

// 跳过等待阶段
self.skipWaiting()

// 缓存
self.addEventListener("install", function(event) {
    var cachePutArr = cacheArr.slice(0)
    // 获取数据并且加入cacheStorge
    var getAndPutErrNum = 0
    function getAndPut(cache) {
        // console.log("-----------------install 2", version, cachePutArr.length, getAndPutErrNum)
        if (cachePutArr.length == 0 || getAndPutErrNum > 5) {
            return
        }
        var url = cachePutArr.shift()
        // console.log("cachePutArr  -- ", url);
        caches.match(url).then(function(res) {
            if (res) {
                setTimeout(function() {
                    getAndPut(cache)
                }, 0)
            } else {
                fetch(url, {
                    mode: "cors"
                })
                    .then(function(fRes) {
                        if (fRes && fRes.status == 200) {
                            cache.put(fRes.url, fRes)
                        }
                        getAndPut(cache)
                    })
                    .catch(function() {
                        getAndPutErrNum += 1
                        getAndPut(cache)
                    })
            }
        })
    }
    // console.log("[install]", version);
    return event.waitUntil(
        caches.open(version).then(function(cache) {
            getAndPut(cache)
        })
    )
})

// 缓存更新
self.addEventListener("activate", function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    // 如果当前版本和缓存版本不一致
                    if (cacheName != version) {
                        return caches.delete(cacheName)
                    }
                })
            )
        })
    )
})

// 捕获请求并返回缓存数据
self.addEventListener("fetch", function(event) {
    // console.log("[fetch]", version, event.request)
    var req = event.request
    var method = (req.method || "").toLowerCase()
    // console.log("req.url", req.url, cacheArr.indexOf(req.url))
    if (method != "get") {
        // 非 get 不使用缓存
        return
    }

    // 走缓存
    event.respondWith(
        caches.match(req).then(function(cRes) {
            // console.log("match", req, cRes)
            if (cRes) {
                return cRes
            }
            var reqCache = req.clone()
            // console.log("++++++++++++++", req)
            return fetch(reqCache).then(function(fRes) {
                // console.log("+++++++++++++fRes+", fRes)
                if (fRes && fRes.status == 200) {
                    // console.log("++fetch++", autoCacheReg, autoCacheReg.test, autoCacheReg.test(req.url), req.url)
                    if (autoCacheReg && autoCacheReg.test && autoCacheReg.test(req.url)) {
                        var xRes = fRes.clone()
                        // 满足自动加入缓存
                        // 匹配完成
                        caches.open(version).then(function(cache) {
                            // console.log("++cache++", xRes)
                            cache.put(xRes.url, xRes)
                        })
                    }
                }
                return fRes
            })
        })
    )
})
