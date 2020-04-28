import React from 'https://dev.jspm.io/react'
import utils from '../utils.ts'

export function isComponentModule(mod: any, type: string = 'component', staticMethods?: string[]): any {
    const { default: component } = mod
    if (component === undefined) {
        return () => React.createElement('div', null, React.createElement('p', null, `bad ${type}: miss default export`))
    } else if (!utils.isFunction(component)) {
        return () => React.createElement('div', null, React.createElement('p', null, `bad ${type}: not a valid component`))
    }
    staticMethods?.forEach(name => {
        if (utils.isFunction(mod[name]) && !utils.isFunction(component[name])) {
            component[name] = mod[name]
        }
    })
    return component
}
