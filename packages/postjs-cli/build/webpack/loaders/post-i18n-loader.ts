import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (locale: string, rawRequest: string) => `
    var hotEmitter = require('webpack/hot/emitter')

    if (module.hot) {
        module.hot.accept(${rawRequest}, function() {
            var dict = require(${rawRequest})
            (window.__POST_I18N = window.__POST_I18N || {})[${locale}] = dict
        })
    }

    var dict = require(${rawRequest})
    return (window.__POST_I18N = window.__POST_I18N || {})[${locale}] = dict
`

const transform: webpack.loader.Loader = function () {
    const { locale, rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(locale), JSON.stringify(rawRequest))
}

export default transform
