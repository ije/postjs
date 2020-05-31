import { walkSync } from "https://deno.land/std@v0.52.0/fs/walk.ts"
import { existsSync, path } from '../deps.ts'
import log from '../log.ts'
import util from '../util.ts'
export interface AppConfig {
    readonly rootDir: string
    readonly srcDir: string
    readonly outputDir: string
    readonly cacheDeps: boolean
    readonly baseUrl: string
    readonly defaultLocale: string
    readonly locales: Record<string, Record<string, string>>
    readonly importMap: {
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
        locales: {},
        importMap: {
            imports: {}
        }
    }

    const { POSTJS_IMPORT_MAP } = globalThis as any
    if (POSTJS_IMPORT_MAP) {
        try {
            const { imports } = POSTJS_IMPORT_MAP
            Object.assign(config.importMap, { imports: Object.assign({}, config.importMap.imports, imports) })
        } catch (err) {
            log.error('bad POSTJS_IMPORT_MAP: ', err)
        }
    }

    try {
        const mapFile = path.join(appDir, 'import_map.json')
        if (existsSync(mapFile)) {
            const { imports } = JSON.parse(Deno.readTextFileSync(mapFile))
            Object.assign(config.importMap, { imports: Object.assign({}, config.importMap.imports, imports) })
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
        const w = walkSync(i18nDir, { includeDirs: false, exts: ['.json'], maxDepth: 1 })
        for (const { path: fp, name, isDirectory } of w) {
            if (isDirectory) {
                // todo: find i18n files(json)
            } else if (/^[a-z]{2}(\-[a-z0-9]+)?\.json$/i.test(name)) {
                const [l, c] = util.splitBy(util.trimSuffix(name, '.json'), '-')
                const locale = [l.toLowerCase(), c.toUpperCase()].filter(Boolean).join('-')
                try {
                    const dict = JSON.parse(Deno.readTextFileSync(fp))
                    if (util.isObject(dict)) {
                        const dictMap: Record<string, string> = {}
                        Object.entries(dict).forEach(([key, text]) => {
                            if (util.isNEString(text)) {
                                dictMap[key] = text
                            }
                        })
                        config.locales[locale] = dictMap
                    }
                } catch (error) {
                    log.error(`bad locale(${locale}):`, error)
                }
            }
        }
    }

    return config
}
