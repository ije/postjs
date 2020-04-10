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
    readonly browserslist?: string | string[] | Record<string, any>
    readonly polyfillsMode?: 'usage' | 'entry'
    readonly polyfills?: string[]
    readonly postcss?: {
        plugins?: postcss.AcceptedPlugin[]
    }
}

export function loadAppConfig(appDir: string) {
    const appConfig: AppConfig = {
        rootDir: path.resolve(appDir),
        srcDir: '/',
        outputDir: '/dist',
        baseUrl: '/',
        lang: 'en'
    }
    let settings: any = {}

    try {
        const configJson = path.join(appDir, 'post.config.json')
        if (!fs.existsSync(configJson)) {
            return appConfig
        }
        settings = fs.readJSONSync(configJson)
    } catch (err) {
        console.warn('bad app config: ', err)
    }

    const {
        srcDir,
        ouputDir,
        baseUrl,
        lang,
        browserslist,
        polyfillsMode,
        polyfills
    } = settings
    if (utils.isNEString(srcDir)) {
        Object.assign(appConfig, { srcDir: utils.cleanPath(srcDir) })
    }
    if (utils.isNEString(ouputDir)) {
        Object.assign(appConfig, { ouputDir: utils.cleanPath(ouputDir) })
    }
    if (utils.isNEString(baseUrl)) {
        Object.assign(appConfig, { baseUrl: utils.cleanPath(encodeURI(baseUrl)) })
    }
    if (/^[a-z]{2}(-[a-z0-9]+)?$/i.test(lang)) {
        Object.assign(appConfig, { lang })
    }
    if (utils.isNEString(browserslist) || utils.isNEArray(browserslist) || utils.isObject(browserslist)) {
        Object.assign(appConfig, { browserslist })
    }
    if (/^usage|entry$/.test(polyfillsMode)) {
        Object.assign(appConfig, { polyfillsMode })
    }
    if (utils.isNEArray(polyfills)) {
        Object.assign(appConfig, { polyfills: polyfills.filter(utils.isNEString) })
    }
    return appConfig
}
