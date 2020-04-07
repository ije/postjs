import loaderUtils from 'loader-utils'
import webpack from 'webpack'

const template = (name: string, rawRequest: string) => `
    const React = require('react')
    const { isValidElementType } = require('react-is')
    const hotEmitter = require('webpack/hot/emitter')

    function validComponent(component) {
       if (component === undefined) {
            return () => React.createElement('p', {style: {color: 'red'}}, 'bad component: miss default export')
        } else if (!isValidElementType(component)) {
            return () => React.createElement('p', {style: {color: 'red'}}, 'bad component: invalid element type')
        }
        return component
    }

    if (module.hot) {
        module.hot.accept(${rawRequest}, () => {
            const { default: component } = require(${rawRequest})
            hotEmitter.emit('postComponentHotUpdate-' + ${name}, validComponent(component))
        })
    }

    (window.__POST_COMPONENTS = window.__POST_COMPONENTS || {})[${name}] = {
        name: ${name},
        reqComponent:() => {
            const { default: component } = require(${rawRequest})
            return validComponent(component)
        }
    }
`

const loader: webpack.loader.Loader = function () {
    const { name, rawRequest } = loaderUtils.getOptions(this)
    return template(JSON.stringify(name), JSON.stringify(rawRequest))
}

export default loader
