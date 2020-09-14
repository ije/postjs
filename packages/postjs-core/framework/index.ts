import { createContext, useContext, useMemo } from 'react'

export * from './component'
export * from './head'
export * from './link'
export * from './page'
export * from './redirect'
export * from './router'
export * from './transition'
export * from './utils'

export interface AppConfig {
    defaultLocale?: string             // default is the first key of locales or 'en'
    baseUrl?: string                   // default is '/'
    srcDir?: string                    // default is '/'
    outputDir?: string                 // default is '/dist'
    browserslist?: any                 // default is '> 1%, last 2 versions, Firefox ESR'
    polyfillsMode?: 'usage' | 'entry'  // default is 'usage'
    polyfills?: string[]               // default is ['core-js/stable', 'whatwg-fetch']
}

type AppContextProps = {
    config: {
        defaultLocale: string
        baseUrl: string
    }
    translations: Record<string, string>
    staticProps: Record<string, any>
}
export const AppContext = createContext<AppContextProps>({ config: { defaultLocale: 'en', baseUrl: '/' }, translations: {}, staticProps: {} })
AppContext.displayName = 'AppContext'

export function useAppConfig() {
    const { config } = useContext(AppContext)
    return config
}

export function useAppStaticProps<T = Record<string, any>>(): T {
    const { staticProps } = useContext(AppContext)
    return staticProps as T
}

type I18nContextProps = {
    locale: string
    translations: Record<string, string>
}
export const I18nContext = createContext<I18nContextProps>({ locale: 'en', translations: {} })
I18nContext.displayName = 'I18nContext'

export function useLocale() {
    const { locale } = useContext(I18nContext)
    return locale
}

export function useTranslate(text: string) {
    const { translations } = useContext(I18nContext)
    return useMemo(() => translations[text] || text, [translations, text])
}
