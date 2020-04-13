import { createContext, useContext } from 'react'

export * from './component'
export * from './head'
export * from './link'
export * from './page'
export * from './redirect'
export * from './router'
export * from './transition'
export * from './utils'

export interface AppConfig {
    lang?: string                      // default is 'en'
    baseUrl?: string                   // default is '/'
    srcDir?: string                    // default is '/'
    browserslist?: any                 // default is '> 1%, last 2 versions, Firefox ESR'
    polyfillsMode?: 'usage' | 'entry'  // default is 'usage'
    polyfills?: string[]               // default is ['core-js/stable', 'whatwg-fetch']
}

type AppContextProps = {
    config: {
        lang: string
        baseUrl: string
    }
    staticProps: Record<string, any>
}

export const AppContext = createContext<AppContextProps>({
    config: { lang: 'en', baseUrl: '/' },
    staticProps: {}
})
AppContext.displayName = 'AppContext'

export function useAppConfig() {
    const { config } = useContext(AppContext)
    return config
}

export function useAppStaticProps() {
    const { staticProps } = useContext(AppContext)
    return staticProps
}
