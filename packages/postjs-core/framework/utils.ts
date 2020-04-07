const { hasOwnProperty } = Object.prototype

export default {
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

    /**
     * Perform the specified action for each element in an array or object,
     * break loop when the stepCallback return false.
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
            for (const key in a) {
                if (hasOwnProperty.call(a, key)) {
                    if (stepCallback(a[key], key) === false) {
                        break
                    }
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

    cleanPath(path: string): string {
        return '/' + path.replace(/^[\.\/]+/, '').split('/')
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .join('/')
    }
}

export const isServer = !process['browser']
