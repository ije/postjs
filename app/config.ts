import { existsSync, path } from '../deps.ts'
import log from '../log.ts'
import util from '../util.ts'

export interface AppConfig {
    readonly framework: 'react' | 'preact' | 'vue'
    readonly rootDir: string
    readonly srcDir: string
    readonly outputDir: string
    readonly downloadRemoteModules: boolean
    readonly baseUrl: string
    readonly lang: string
    readonly locales: Map<string, Map<string, string>>
    readonly importmap?: {
        imports: Record<string, string>
    }
}

export function loadAppConfig(appDir: string) {
    const config: AppConfig = {
        framework: 'react',
        rootDir: path.resolve(appDir),
        srcDir: '/',
        outputDir: '/out',
        downloadRemoteModules: true,
        baseUrl: '/',
        lang: 'en',
        locales: new Map()
    }

    const { POSTJS_IMPORT_MAP } = globalThis as any
    if (POSTJS_IMPORT_MAP && POSTJS_IMPORT_MAP.imports) {
        try {
            const { imports } = POSTJS_IMPORT_MAP
            Object.assign(config, { importmap: { imports: Object.assign({}, config.importmap?.imports, imports) } })
        } catch (err) {
            log.error('bad POSTJS_IMPORT_MAP: ', err)
        }
    }

    try {
        const mapFile = path.join(appDir, 'import_map.json')
        if (existsSync(mapFile)) {
            const { imports } = JSON.parse(Deno.readTextFileSync(mapFile))
            Object.assign(config, { importmap: { imports: Object.assign({}, config.importmap?.imports, imports) } })
        }
    } catch (err) {
        log.error('bad import_map.json:', err)
    }

    try {
        const configFile = path.join(appDir, 'post.config.json')
        if (existsSync(configFile)) {
            const {
                srcDir,
                ouputDir,
                baseUrl,
                downloadRemoteModules,
                lang,
                locales,
            } = JSON.parse(Deno.readTextFileSync(configFile))
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
            if (downloadRemoteModules === false) {
                Object.assign(config, { downloadRemoteModules: false })
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
        log.error('bad app config: ', err)
    }
    return config
}
