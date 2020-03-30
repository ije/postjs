import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (pagePath: string, filePath: string) => `
    const hotEmitter = require('webpack/hot/emitter')

    if (module.hot) {
        module.hot.accept(${filePath}, () => {
            const { default: component } = require(${filePath})
            hotEmitter.emit('postPageHotUpdate', ${pagePath}, component)
        })
    }

    const exportAs = {
        path: ${pagePath},
        reqComponent:() => {
            const { default: component } = require(${filePath})
            return component
        }
    }

    if (!window.__POST_INITIAL_PAGE) {
        window.__POST_INITIAL_PAGE = exportAs
    }
    (window.__POST_PAGES = window.__POST_PAGES || {})[${pagePath}] = exportAs
`

const loader: webpack.loader.Loader = function () {
    const { filePath, pagePath } = loaderUtils.getOptions(this)
    return template(JSON.stringify(pagePath), JSON.stringify(filePath))
}

export default loader
