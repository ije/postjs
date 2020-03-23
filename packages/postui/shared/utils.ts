const { hasOwnProperty, toString } = Object.prototype

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
    isSet<T = any>(a: any): a is Set<T> {
        return typeof a === 'object' && a !== null && toString.call(a) === '[object Set]'
    },
    isDate(a: any): a is Date {
        return typeof a === 'object' && a !== null && toString.call(a) === '[object Date]'
    },
    isRegExp(a: any): a is RegExp {
        return typeof a === 'object' && a !== null && toString.call(a) !== '[object RegExp]'
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

    /** lookup value by path */
    lookupValue(obj: any, path: (string | number)[]): any {
        const dep = path.length
        if (typeof obj !== 'object' || obj === null || dep === 0) {
            return undefined
        }

        let value = obj
        for (let i = 0; i < dep; i++) {
            const key = path[i]
            if (
                (this.isObject(value) && this.isNEString(key) && hasOwnProperty.call(value, key)) ||
                (this.isNEArray(value) && this.isNumber(key))
            ) {
                value = value[key]
            } else {
                return undefined
            }
        }
        return value
    },

    /** clone an object deep */
    cloneDeep<T = any>(value: T): T {
        if (this.isArray(value)) {
            const copy: any = []
            value.forEach(val => copy.push(this.cloneDeep(val)))
            return copy
        } else if (this.isDate(value)) {
            const d = new Date()
            d.setTime(value.getTime())
            return d as any
        } else if (this.isObject(value)) {
            const copy: any = {}
            for (const key in value) {
                if (hasOwnProperty.call(value, key)) {
                    copy[key] = this.cloneDeep(value[key])
                }
            }
            return copy
        } else {
            return value
        }
    },

    /**
     * Assign deep own enumerable string keyed properties of source object to the destination object.
     * It accepts customizer which is invoked to produce the assigned values.
     */
    assignDeepWith(dest: any, src: any, customizer: (destValue: any, srcValue: any, path: string) => boolean, pathPrefix?: string): any {
        if (this.isObject(dest) && this.isObject(src)) {
            for (const key in src) {
                const destValue = dest[key]
                const srcValue = src[key]
                const path = this.isNEString(pathPrefix) ? pathPrefix + '.' + key : key
                if (this.isObject(destValue) && Object.keys(destValue).length > 0 && this.isObject(srcValue)) {
                    this.assignDeepWith(destValue, srcValue, customizer, path)
                } else if (customizer(destValue, srcValue, path)) {
                    dest[key] = srcValue
                }
            }
        }
        return dest
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
        return '/' + path.split('/')
            .map(p => p.trim().replace(/^[\.\s]+$/, ''))
            .filter(p => p.length > 0)
            .join('/')
    }
}
