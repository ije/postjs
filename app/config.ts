 import { colorful } from '../colorful.ts'
import { fs, path } from '../package.ts'
import utils from '../utils.ts'

export interface AppConfig {
    readonly rootDir: string
    readonly srcDir: string
    readonly outputDir: string
    readonly baseUrl: string
    readonly lang: string
    readonly locales: Map<string, Map<string, string>>
}

export function loadAppConfig(appDir: string) {
    const config: AppConfig = {
        rootDir: path.resolve(appDir),
        srcDir: '/',
        outputDir: '/dist',
        baseUrl: '/',
        lang: 'en',
        locales: new Map()
    }
    const settings: Record<string, any> = {}

    try {
        const configJson = path.join(appDir, 'post.config.json')
        if (fs.existsSync(configJson)) {
            Object.assign(settings, fs.readJSONSync(configJson))
        }
    } catch (err) {
        console.warn(colorful('warn', 'yellow'), 'bad app config: ', err)
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
        Object.keys(locales).forEach(locale => {
            const value = locales[locale]
            if (utils.isObject(value)) {
                const dictMap = new Map<string, string>()
                utils.each(value, (text, key) => {
                    if (utils.isNEString(text)) {
                        dictMap.set(key, text)
                    }
                })
                config.locales.set(locale, dictMap)
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
