import log from '../log.ts'
import { fs, path } from '../package.ts'
import util from '../util.ts'

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

    try {
        const configJson = path.join(appDir, 'post.config.json')
        if (fs.existsSync(configJson)) {
            const {
                srcDir,
                ouputDir,
                baseUrl,
                lang,
                locales,
            } = fs.readJsonSync(configJson) as any
            if (util.isNEString(srcDir)) {
                Object.assign(config, { srcDir: util.cleanPath(srcDir) })
            }
            if (util.isNEString(ouputDir)) {
                Object.assign(config, { ouputDir: util.cleanPath(ouputDir) })
            }
            if (util.isNEString(baseUrl)) {
                Object.assign(config, { baseUrl: util.cleanPath(encodeURI(baseUrl)) })
            }
            if (util.isNEString(lang)) {
                Object.assign(config, { lang })
            }
            if (util.isObject(locales)) {
                Object.keys(locales).forEach(locale => {
                    const value = locales[locale]
                    if (util.isObject(value)) {
                        const dictMap = new Map<string, string>()
                        Object.entries(value).forEach(([key, text]) => {
                            if (util.isNEString(text)) {
                                dictMap.set(key, text)
                            }
                        })
                        config.locales.set(locale, dictMap)
                    }
                })
            }
        }
    } catch (err) {
        log.warn('bad app config: ', err)
    }
    return config
}
