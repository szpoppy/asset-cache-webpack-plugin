;(function() {
    //#servicework#//
    if (window.__asset_script_loaded_) {
        // 次函数只能执行一次
        return
    }
    var tagCss = "--tagCss--"
    var tagScript = "--tagScript--"

    window.document.write(tagCss + tagScript)
    window.__asset_script_loaded_ = 1
})()
