import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (rawRequest: string) => `
    const { utils } = require('@postjs/core')
    const hotEmitter = require('webpack/hot/emitter')

    if (module.hot) {
        module.hot.accept(${rawRequest}, () => {
            const Component = req()
            setTimeout(() => {
                hotEmitter.emit('postAppHotUpdate', Component)
            }, 0)
        })
    }

    function req() {
        const mod = require(${rawRequest})
        return (window.__POST_APP = window.__POST_APP || {}).Component = utils.isComponentModule(mod, 'app')
    }
    req()
`

const transform: webpack.loader.Loader = function () {
    const { rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(rawRequest))
}

export default transform
