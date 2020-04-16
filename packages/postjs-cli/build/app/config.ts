import { utils } from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import postcss from 'postcss'

export interface AppConfig {
    readonly rootDir: string
    readonly srcDir: string
    readonly outputDir: string
    readonly baseUrl: string
    readonly lang: string
    readonly locales: Map<string, Map<string, string>>
    readonly useSass: boolean
    readonly useStyledComponents: boolean
    readonly browserslist?: string | string[] | Record<string, any>
    readonly polyfillsMode?: 'usage' | 'entry'
    readonly polyfills?: string[]
    readonly postcss?: {
        plugins?: postcss.AcceptedPlugin[]
    }
}

export function loadAppConfig(appDir: string) {
    const config: AppConfig = {
        rootDir: path.resolve(appDir),
        srcDir: '/',
        outputDir: '/dist',
        baseUrl: '/',
        lang: 'en',
        locales: new Map(),
        useSass: false,
        useStyledComponents: false
    }
    const settings: Record<string, any> = {}

    try {
        if (require.resolve('styled-components')) {
            Object.assign(config, { useStyledComponents: true })
        }
    } catch (error) {
        // styled-components not found
    }

    try {
        if (require.resolve('sass-loader')) {
            Object.assign(config, { useSass: true })
        }
    } catch (error) {
        // sass-loader not found
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
        lang,
        locales,
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
    if (/^[a-z]{2}(-[a-z0-9]+)?$/i.test(lang)) {
        Object.assign(config, { lang })
    }
    if (utils.isObject(locales)) {
        Object.keys(locales).forEach(key => {
            const value = locales[key]
            if (utils.isObject(value)) {
                const dictMap = new Map<string, string>()
                utils.each(value, (text, key) => {
                    if (utils.isNEString(text)) {
                        dictMap.set(key, text)
                    }
                })
                Object.assign(config, { [key]: dictMap })
            }
        })
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
