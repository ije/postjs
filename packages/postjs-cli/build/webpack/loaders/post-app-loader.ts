import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (rawRequest: string) => `
    var postjs = require('@postjs/core')
    var hotEmitter = require('webpack/hot/emitter')

    if (module.hot) {
        module.hot.accept(${rawRequest}, function() {
            var Component = req()
            setTimeout(function() {
                hotEmitter.emit('postAppHotUpdate', Component)
            }, 0)
        })
    }

    function req() {
        var mod = require(${rawRequest})
        return (window.__POST_APP = window.__POST_APP || {}).Component = postjs.utils.isComponentModule(mod, 'app')
    }
    req()
`

const transform: webpack.loader.Loader = function () {
    const { rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(rawRequest))
}

export default transform
