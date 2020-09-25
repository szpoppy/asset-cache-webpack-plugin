//一个存储空间
var version = "--version--"
// 需要离线缓存的数组
var cacheArr = "--cacheArr--"
// 自动离线的正则
var autoCacheReg = "--swAutoCacheReg--"

self.addEventListener("message", function(event) {
    // console.log("[message]", version, event.data);
    if (event.data && event.data.version) {
        version = event.data.version
        // reSetCacheKeys()
    }
})

// 转全路径
var cacheArrFull = {}
cacheArr.forEach(function(url) {
    var loc = location
    var fUrl = ""
    if (/^\w+:/.test(url)) {
        fUrl = url
    } else if (/^\/\//.test(url)) {
        fUrl = loc.protocol + url
    } else if (/^\//.test(url)) {
        fUrl = loc.origin + url
    } else {
        fUrl = url.replace(/^(\.\/)*/, loc.origin + loc.pathname.replace(/[^/]*$/, ""))
    }
    cacheArrFull[fUrl] = true
})

// function appendCacheKeys() {
//     caches.open(version).then(function(cache) {
//         cache.keys().then(function(arr) {
//             arr.forEach(function(req) {
//                 cacheArrFull[req.url] = true
//             })
//             console.log("cacheKeys", cacheArrFull)
//         })
//     })
// }

// 跳过等待阶段
self.skipWaiting()

// 缓存
self.addEventListener("install", function(event) {
    var cachePutArr = cacheArr.slice(0)
    // 获取数据并且加入cacheStorge
    var getAndPutErrNum = 0
    function getAndPut(cache) {
        if (cachePutArr.length == 0 || getAndPutErrNum > 5) {
            return
        }
        var url = cachePutArr.shift()
        // console.log("cachePutArr  -- ", url);
        caches.match(url).then(function(res) {
            if (res) {
                cache.put(url, res.clone())
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

    if (cacheArrFull[req.url] || (autoCacheReg instanceof RegExp && autoCacheReg.test(req.url))) {
        // 走缓存
        event.respondWith(
            caches.match(req).then(function(cRes) {
                // console.log("match", req, cRes)
                if (cRes) {
                    return cRes
                }
                // var reqCache = req.clone()
                // reqCache.mode = "cors"
                // console.log("++++++++++++++", req)
                return fetch(req.url, { mode: "cors" }).then(function(fRes) {
                    // console.log("+++++++++++++fRes+xxxxx", fRes, req.url)
                    if (fRes && fRes.status == 200) {
                        // console.log("++fetch++", autoCacheReg, autoCacheReg.test, autoCacheReg.test(req.url), req.url)
                        var xRes = fRes.clone()
                        // 满足自动加入缓存
                        // 匹配完成
                        caches.open(version).then(function(cache) {
                            // console.log("++cache++", xRes, version, cache)
                            cache.put(xRes.url, xRes)
                            cacheArrFull[xRes.url] = true
                        })
                    }
                    return fRes
                })
            })
        )
    }
})
