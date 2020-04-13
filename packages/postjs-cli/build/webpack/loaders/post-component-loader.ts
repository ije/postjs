import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (name: string, rawRequest: string) => `
    const { utils } = require('@postjs/core')
    const hotEmitter = require('webpack/hot/emitter')

    if (module.hot) {
        module.hot.accept(${rawRequest}, () => {
            const mod = require(${rawRequest})
            hotEmitter.emit('postComponentHotUpdate:' + ${name}, utils.isComponentModule(mod))
        })
    }

    (window.__POST_COMPONENTS = window.__POST_COMPONENTS || {})[${name}] = {
        name: ${name},
        reqComponent:() => {
            const mod = require(${rawRequest})
            return utils.isComponentModule(mod)
        }
    }
`

const loader: webpack.loader.Loader = function () {
    const { name, rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(name), JSON.stringify(rawRequest))
}

export default loader
