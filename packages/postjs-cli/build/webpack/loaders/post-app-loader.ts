import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (rawRequest: string) => `
    const { utils } = require('@postjs/core')
    const hotEmitter = require('webpack/hot/emitter')
    const mod = require(${rawRequest})

    if (module.hot) {
        module.hot.accept(${rawRequest}, () => {
            const mod = require(${rawRequest})
            hotEmitter.emit('postAppHotUpdate', utils.isComponentModule(mod, 'app'))
        })
    }

    (window.__POST_APP = window.__POST_APP || {}).Component = utils.isComponentModule(mod, 'app')
`

const loader: webpack.loader.Loader = function () {
    const { rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(rawRequest))
}

export default loader
