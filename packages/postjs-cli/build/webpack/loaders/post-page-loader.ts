import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (pagePath: string, rawRequest: string) => `
    const { utils } = require('@postjs/core')
    const hotEmitter = require('webpack/hot/emitter')

    if (module.hot) {
        module.hot.accept(${rawRequest}, () => {
            const mod = require(${rawRequest})
            hotEmitter.emit('postPageHotUpdate:' + ${pagePath}, utils.isComponentModule(mod, 'page'))
        })
    }

    (window.__POST_PAGES = window.__POST_PAGES || {})[${pagePath}] = {
        path: ${pagePath},
        reqComponent:() => {
            const mod = require(${rawRequest})
            const component = utils.isComponentModule(mod, 'page')
            component.hasGetStaticPropsMethod = typeof mod['getStaticProps'] === 'function' || typeof component['getStaticProps'] === 'function'
            return component
        }
    }
`

const loader: webpack.loader.Loader = function () {
    const { pagePath, rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(pagePath), JSON.stringify(rawRequest))
}

export default loader
