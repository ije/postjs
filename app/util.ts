import { React } from '../package.ts'
import util from '../util.ts'

export function isComponentModule(mod: any, type: string = 'component', staticMethods?: string[]): any {
    const { default: component } = mod
    if (component === undefined) {
        return () => React.createElement('div', null, React.createElement('p', null, `bad ${type}: miss default export`))
    } else if (!util.isFunction(component)) {
        return () => React.createElement('div', null, React.createElement('p', null, `bad ${type}: not a valid component`))
    }
    staticMethods?.forEach(name => {
        if (util.isFunction(mod[name]) && !util.isFunction(component[name])) {
            component[name] = mod[name]
        }
    })
    return component
}
