import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (pagePath: string, rawRequest: string) => `
    const React = require('react')
    const { isValidElementType } = require('react-is')
    const hotEmitter = require('webpack/hot/emitter')

    function validComponent(component) {
       if (component === undefined) {
            return () => React.createElement('p', {style: {color: 'red'}}, 'bad page: miss default export')
        } else if (!isValidElementType(component)) {
            return () => React.createElement('p', {style: {color: 'red'}}, 'bad page: invalid element type')
        }
        return component
    }

    if (module.hot) {
        module.hot.accept(${rawRequest}, () => {
            const { default: component } = require(${rawRequest})
            hotEmitter.emit('postPageHotUpdate', ${pagePath}, validComponent(component))
        })
    }

    const exportAs = {
        path: ${pagePath},
        reqComponent:() => {
            const mod = require(${rawRequest})
            const component =  validComponent(mod.default)
            component.hasGetStaticPropsMethod = typeof mod['getStaticProps'] === 'function' || typeof component['getStaticProps'] === 'function'
            return component
        }
    }
    if (!window.__POST_INITIAL_PAGE) {
        window.__POST_INITIAL_PAGE = exportAs
    }
    (window.__POST_PAGES = window.__POST_PAGES || {})[${pagePath}] = exportAs
`

const loader: webpack.loader.Loader = function () {
    const { pagePath, rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(pagePath), JSON.stringify(rawRequest))
}

export default loader
