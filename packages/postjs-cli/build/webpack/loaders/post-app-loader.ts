import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (rawRequest: string) => `
    const React = require('react')
    const { isValidElementType } = require('react-is')
    const hotEmitter = require('webpack/hot/emitter')

     function validComponent(component) {
       if (component === undefined) {
            return () => React.createElement('p', {style: {color: 'red'}}, 'bad app: miss default export')
        } else if (!isValidElementType(component)) {
            return () => React.createElement('p', {style: {color: 'red'}}, 'bad app: invalid element type')
        }
        return component
    }

    if (module.hot) {
        module.hot.accept(${rawRequest}, () => {
            const { default: component } = require(${rawRequest})
            hotEmitter.emit('postAppHotUpdate', validComponent(component))
        })
    }

    const { default: component } = require(${rawRequest})
    window.__POST_APP = validComponent(component)
`

const loader: webpack.loader.Loader = function () {
    const { rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(rawRequest))
}

export default loader
