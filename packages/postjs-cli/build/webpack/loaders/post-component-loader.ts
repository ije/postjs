import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (name: string, rawRequest: string) => `
    var postjs = require('@postjs/core')
    var hotEmitter = require('webpack/hot/emitter')

    if (module.hot) {
        module.hot.accept(${rawRequest}, function() {
            var mod = req()
            setTimeout(function() {
                hotEmitter.emit('postComponentHotUpdate:' + ${name}, mod.Component)
            }, 0)
        })
    }

    function req() {
        return (window.__POST_COMPONENTS = window.__POST_COMPONENTS || {})[${name}] = {
            name: ${name},
            Component: postjs.utils.isComponentModule(require(${rawRequest}))
        }
    }
    req()
`

const transform: webpack.loader.Loader = function () {
    const { name, rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(name), JSON.stringify(rawRequest))
}

export default transform
