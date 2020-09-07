import React, { ReactType } from 'react'
import { isValidElementType } from 'react-is'

export const utils = {
    isNumber(a: any): a is number {
        return typeof a === 'number' && !Number.isNaN(a)
    },
    isUNumber(a: any): a is number {
        return this.isNumber(a) && a >= 0
    },
    isInt(a: any): a is number {
        return this.isNumber(a) && Number.isInteger(a)
    },
    isUInt(a: any): a is number {
        return this.isInt(a) && a >= 0
    },
    isString(a: any): a is string {
        return typeof a === 'string'
    },
    isNEString(a: any): a is string {
        return typeof a === 'string' && a.length > 0
    },
    isArray<T = any>(a: any): a is Array<T> {
        return Array.isArray(a)
    },
    isNEArray<T = any>(a: any): a is Array<T> {
        return Array.isArray(a) && a.length > 0
    },
    isObject(a: any): a is Object {
        return typeof a === 'object' && a !== null && !this.isArray(a)
    },
    isFunction(a: any): a is Function {
        return typeof a === 'function'
    },

    isComponentModule(mod: any, type: string = 'component', staticMethods?: string[]): ReactType {
        const { default: component } = mod
        if (component === undefined) {
            return () => React.createElement('div', null, React.createElement('p', null, `bad ${type}: miss default export`))
        } else if (!isValidElementType(component)) {
            return () => React.createElement('div', null, React.createElement('p', null, `bad ${type}: not a valid component`))
        }
        staticMethods?.forEach(name => {
            if (this.isFunction(mod[name]) && !this.isFunction(component[name])) {
                component[name] = mod[name]
            }
        })
        return component
    },

    /**
     * Perform the specified action for each element in an array or object,
     * break loop when the stepCallback returns false.
     */
    each(a: any, stepCallback: (value: any, key: any) => void | boolean) {
        if (this.isArray(a)) {
            const l = a.length
            for (let i = 0; i < l; i++) {
                if (stepCallback(a[i], i) === false) {
                    break
                }
            }
        } else if (this.isObject(a)) {
            for (const key of Object.keys(a)) {
                if (stepCallback(a[key], key) === false) {
                    break
                }
            }
        }
    },

    trimPrefix(s: string, prefix: string): string {
        if (prefix !== '' && s.startsWith(prefix)) {
            return s.slice(prefix.length)
        }
        return s
    },

    trimSuffix(s: string, suffix: string): string {
        if (suffix !== '' && s.endsWith(suffix)) {
            return s.slice(0, -suffix.length)
        }
        return s
    },

    splitBy(s: string, splitter: string): [string, string] {
        const i = s.indexOf(splitter)
        if (i >= 0) {
            return [s.slice(0, i), s.slice(i + 1)]
        }
        return [s, '']
    },

    cleanPath(path: string): string {
        return '/' + path.replace(/^[./]+/, '').split('/')
            .map(p => p.trim())
            .filter(Boolean)
            .join('/')
    }
}
