export * from './404'
export * from './app'
export * from './component'
export * from './head'
export * from './link'
export * from './router'

export interface AppConfig {
    lang?: string                      // default is 'en'
    baseUrl?: string                   // default is '/'
    srcDir?: string                    // default is '/'
    browserslist?: any                 // default is '> 1%, last 2 versions, Firefox ESR'
    polyfillsMode?: 'usage' | 'entry'  // default is 'usage'
    polyfills?: string[]               // default is ['core-js/stable', 'whatwg-fetch']
}
