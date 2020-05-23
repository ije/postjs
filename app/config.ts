import { existsSync, path, walk } from '../deps.ts'
import log from '../log.ts'
import util from '../util.ts'

export interface AppConfig {
    readonly rootDir: string
    readonly srcDir: string
    readonly outputDir: string
    readonly cacheDeps: boolean
    readonly baseUrl: string
    readonly defaultLocale: string
    readonly locales: Map<string, Map<string, string>>
    readonly importMap?: {
        imports: Record<string, string>
    }
}

export function loadAppConfig(appDir: string) {
    const config: AppConfig = {
        rootDir: path.resolve(appDir),
        srcDir: '/',
        outputDir: '/out',
        cacheDeps: true,
        baseUrl: '/',
        defaultLocale: 'en',
        locales: new Map()
    }

    const { POSTJS_IMPORT_MAP } = globalThis as any
    if (POSTJS_IMPORT_MAP) {
        try {
            const { imports } = POSTJS_IMPORT_MAP
            Object.assign(config, { importMap: { imports: Object.assign({}, config.importMap?.imports, imports) } })
        } catch (err) {
            log.error('bad POSTJS_IMPORT_MAP: ', err)
        }
    }

    try {
        const mapFile = path.join(appDir, 'import_map.json')
        if (existsSync(mapFile)) {
            const { imports } = JSON.parse(Deno.readTextFileSync(mapFile))
            Object.assign(config, { importMap: { imports: Object.assign({}, config.importMap?.imports, imports) } })
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
                cacheDeps,
                lang
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
                Object.assign(config, { defaultLocale: lang })
            }
            if (typeof cacheDeps === 'boolean') {
                Object.assign(config, { cacheDeps })
            }
        }
    } catch (err) {
        log.error('bad app config: ', err)
    }

    const i18nDir = path.join(config.rootDir, 'i18n')
    if (existsSync(i18nDir)) {
        const w = walk(i18nDir, { includeDirs: false, exts: ['.json'], maxDepth: 1 })
        for await (const { path: fp } of w) {
            const name = util.trimSuffix(path.basename(fp), '.json')
            if (/^[a-z]{2}(\-[a-z0-9]+)?$/i.test(name)) {
                const [l, c] = util.splitBy(name, '-')
                const locale = [l.toLowerCase(), c.toUpperCase()].filter(Boolean).join('-')
                try {
                    const dict = JSON.parse(Deno.readTextFileSync(fp))
                    if (util.isObject(dict)) {
                        const dictMap = new Map<string, string>()
                        Object.entries(dict).forEach(([key, text]) => {
                            if (util.isNEString(text)) {
                                dictMap.set(key, text)
                            }
                        })
                        config.locales.set(locale, dictMap)
                    }
                } catch (error) {
                    log.error(`bad locale(${locale}):`, error)
                }
            }
        }
    }

    return config
}
