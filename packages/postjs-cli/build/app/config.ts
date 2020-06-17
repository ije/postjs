import { utils } from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import postcss from 'postcss'

export interface AppConfig {
    readonly rootDir: string
    readonly srcDir: string
    readonly outputDir: string
    readonly baseUrl: string
    readonly useSass: boolean
    readonly useStyledComponents: boolean
    readonly defaultLocale: string
    readonly locales: Record<string, Record<string, string>>
    readonly browserslist?: string | string[] | Record<string, any>
    readonly polyfillsMode?: 'usage' | 'entry'
    readonly polyfills?: string[]
    readonly postcss?: {
        plugins?: postcss.AcceptedPlugin[]
    }
}

export function loadAppConfigSync(appDir: string) {
    const config: AppConfig = {
        rootDir: path.resolve(appDir),
        srcDir: '/',
        outputDir: '/dist',
        baseUrl: '/',
        defaultLocale: 'en',
        locales: {},
        useSass: false,
        useStyledComponents: false
    }
    const settings: Record<string, any> = {}

    try {
        if (require.resolve('styled-components')) {
            Object.assign(config, { useStyledComponents: true })
        }
    } catch (error) { }

    try {
        if (require.resolve('sass-loader')) {
            Object.assign(config, { useSass: true })
        }
    } catch (error) { }

    // todo: load i18n files
    const i18nDir = path.join(config.rootDir, 'i18n')
    if (fs.existsSync(i18nDir)) {
        const items = fs.readdirSync(i18nDir, { withFileTypes: true })
        for (const item of items) {
            if (item.isDirectory()) {
                // todo: find i18n files(json)
            } else if (/^[a-z]{2}(-[a-z0-9]+)?\.json$/i.test(name)) {
                const [l, c] = utils.trimSuffix(name, '.json').split('-')
                const locale = [l.toLowerCase(), c.toUpperCase()].filter(Boolean).join('-')
                try {
                    const dict = fs.readJSONSync(path.join(i18nDir, item.name))
                    if (utils.isObject(dict)) {
                        const dictMap: Record<string, string> = {}
                        Object.entries(dict).forEach(([key, text]) => {
                            if (utils.isNEString(text)) {
                                dictMap[key] = text
                            }
                        })
                        config.locales[locale] = dictMap
                    }
                } catch (error) {
                    console.warn(`bad locale(${locale}):`, error)
                }
            }
        }
    }

    try {
        const configJson = path.join(appDir, 'post.config.json')
        if (fs.existsSync(configJson)) {
            Object.assign(settings, fs.readJSONSync(configJson))
        }
    } catch (err) {
        console.warn('bad app config: ', err)
        return config
    }

    const {
        srcDir,
        ouputDir,
        baseUrl,
        defaultLocale,
        browserslist,
        polyfillsMode,
        polyfills
    } = settings

    if (utils.isNEString(srcDir)) {
        Object.assign(config, { srcDir: utils.cleanPath(srcDir) })
    }
    if (utils.isNEString(ouputDir)) {
        Object.assign(config, { ouputDir: utils.cleanPath(ouputDir) })
    }
    if (utils.isNEString(baseUrl)) {
        Object.assign(config, { baseUrl: utils.cleanPath(encodeURI(baseUrl)) })
    }
    if (/^[a-z]{2}(-[a-z0-9]+)?$/i.test(defaultLocale) && Object.keys(config.locales).includes(defaultLocale)) {
        Object.assign(config, { defaultLocale })
    }
    if (config.defaultLocale === 'en' && !Object.keys(config.locales).includes('en')) {
        Object.assign(config, { defaultLocale: Object.keys(config.locales)[0] })
    }
    if (utils.isNEString(browserslist) || utils.isNEArray(browserslist) || utils.isObject(browserslist)) {
        Object.assign(config, { browserslist })
    }
    if (/^usage|entry$/.test(polyfillsMode)) {
        Object.assign(config, { polyfillsMode })
    }
    if (utils.isNEArray(polyfills)) {
        Object.assign(config, { polyfills: polyfills.filter(utils.isNEString) })
    }

    return config
}
