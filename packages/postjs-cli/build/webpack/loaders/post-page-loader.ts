import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (pagePath: string, rawRequest: string) => `
    var postjs = require('@postjs/core')
    var hotEmitter = require('webpack/hot/emitter')

    if (module.hot) {
        module.hot.accept(${rawRequest}, function() {
            var mod = req()
            setTimeout(function() {
                hotEmitter.emit('postPageHotUpdate:' + ${pagePath}, mod.Component)
            }, 0)
        })
    }

    function req() {
        var utils = postjs.utils
        var mod = require(${rawRequest})
        var component = utils.isComponentModule(mod, 'page')
        component.hasGetStaticPropsMethod = utils.isFunction(mod['getStaticProps']) || utils.isFunction(component['getStaticProps'])
        return (window.__POST_PAGES = window.__POST_PAGES || {})[${pagePath}] = {
            path: ${pagePath},
            Component: component
        }
    }
    req()
`

const transform: webpack.loader.Loader = function () {
    const { pagePath, rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(pagePath), JSON.stringify(rawRequest))
}

export default transform
