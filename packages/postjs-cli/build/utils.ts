import glob from 'glob'
import { JSDOM } from 'jsdom'
import fetch from 'node-fetch'
import webpack from 'webpack'
import DynamicEntryPlugin from 'webpack/lib/DynamicEntryPlugin'

// A component returns nothing
export const NullComponent = () => null

export function getJSXFiles(dir: string, root: string) {
    return glob.sync(
        dir + '**/*.{js,jsx,mjs,ts,tsx}',
        { cwd: root }
    ).filter(p => /^[a-z0-9\.\/\$\*\-_~ ]+$/i.test(p))
}

export function runJS(code: string, peerDeps: Record<string, any>, globalVars?: Record<string, any>) {
    const fn = new Function('require', 'exports', 'module', code)
    const exports: Record<string, any> = {}
    const { window } = new JSDOM(undefined, { url: 'http://localhost/', pretendToBeVisual: true })
    Object.keys(window).filter(key => {
        return !key.startsWith('_') && !/^(set|clear)(Timeout|Interval)$/.test(key)
    }).forEach(key => {
        globalThis[key] = window[key]
    })
    Object.assign(globalThis, { fetch }, globalVars)
    fn((name: string) => peerDeps[name], exports, undefined)
    return exports
}

// Based on https://github.com/webpack/webpack/blob/master/lib/DynamicEntryPlugin.js
export function addEntry(
    compilation: webpack.compilation.Compilation,
    context: string,
    name: string,
    entry: string[]
) {
    return new Promise((resolve, reject) => {
        const dep = DynamicEntryPlugin.createDependency(entry, name)
        compilation.addEntry(context, dep, name, (err: Error | null) => {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}
