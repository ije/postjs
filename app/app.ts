import React from 'react'
import { APIHandle } from '../api.ts'
import { colors, existsSync, path, ServerRequest, Sha1, walk } from '../deps.ts'
import { renderToTags } from '../head.ts'
import { createHtml } from '../html.ts'
import log from '../log.ts'
import { ILocation, route, RouterURL } from '../router.ts'
import { compile } from '../ts/compile.ts'
import util from '../util.ts'
import AnsiUp from '../vendor/ansi-up/ansi-up.ts'
import { apiRequest, apiResponse } from './api.ts'
import { AppConfig, loadAppConfigSync } from './config.ts'

const reHttp = /^https?:\/\//i
const reModuleExt = /\.(m?jsx?|tsx?)$/i

interface Module {
    sourceFile: string
    sourceHash: string
    sourceMap: string
    deps: { path: string, hash: string }[]
    jsFile: string
    js: string
    hash: string
}

export class App {
    readonly config: AppConfig
    readonly mode: 'development' | 'production'
    readonly ready: Promise<void>

    private _apis: Map<string, APIHandle> = new Map()
    private _deps: Map<string, Module> = new Map()
    private _modules: Map<string, Module> = new Map()
    private _pageModules: Record<string, string> = {}
    private _appModule: { Component: React.ComponentType, staticProps: any } = { Component: React.Fragment, staticProps: null }
    private _fsWatchQueue: Map<string, any> = new Map()

    constructor(appDir: string, mode: 'development' | 'production') {
        this.mode = mode
        this.config = loadAppConfigSync(appDir)
        this.ready = new Promise((resolve, reject) => {
            this._init().then(resolve).catch(reject)
        })
    }

    get isDev() {
        return this.mode === 'development'
    }

    get srcDir() {
        const { rootDir, srcDir } = this.config
        return path.join(rootDir, srcDir)
    }


    async build() {

    }

    async getPageHtml(location: ILocation, locale = this.config.defaultLocale): Promise<[number, string]> {
        const { baseUrl } = this.config
        const url = route(baseUrl, Object.keys(this._pageModules), { location, fallback: '/404' })
        const { code, head, body, ssrData } = await this._renderPage(url)
        const html = createHtml({
            lang: locale,
            head: [...head, `<meta name="postjs-head-end" content="end" />`],
            scripts: [
                { type: 'application/json', id: 'ssr-data', innerText: JSON.stringify(ssrData) },
                { src: path.join(baseUrl, 'main.js') + `?t=${performance.now()}`, type: 'module' },
            ],
            body
        })
        return [code, html]
    }

    async getPageStaticProps(location: ILocation, locale?: string): Promise<any> {
        const { defaultLocale, baseUrl } = this.config
        const url = route(baseUrl, Object.keys(this._pageModules), { location, fallback: '/404' })
        if (url.pagePath in this._pageModules) {
            const pageModule = this._modules.get(this._pageModules[url.pagePath])!
            const { default: Page, getStaticProps } = await import(path.join(this.srcDir, pageModule.sourceFile))
            if (util.isFunction(Page)) {
                const gsp = [Page.getStaticProps, getStaticProps].filter(util.isFunction)[0]
                const staticProps = gsp ? await gsp(url, locale || defaultLocale) : null
                return util.isObject(staticProps) ? staticProps : null
            }
        }
        return null
    }

    getModule(filename: string): Module | null {
        filename = '/' + util.trimPrefix(util.trimPrefix(filename, this.config.baseUrl), '/')
        if (filename.startsWith('/-/')) {
            filename = util.trimPrefix(filename, '/-/')
            if (this._deps.has(filename)) {
                return this._deps.get(filename)!
            }
        } else {
            filename = '.' + filename
            if (this._modules.has(filename)) {
                return this._modules.get(filename)!
            } else {
                filename = filename.replace(/\.[0-9a-f]{40}\.js$/, '.js')
                if (this._modules.has(filename)) {
                    return this._modules.get(filename)!
                }
            }
        }
        return null
    }

    callAPI(req: ServerRequest, location: ILocation) {
        const { pagePath, params, query } = route(
            this.config.baseUrl,
            Array.from(this._apis.keys()).map(p => path.join('/api/', p)),
            { location }
        )
        if (pagePath) {
            const handle = this._apis.get(util.trimPrefix(pagePath, '/api'))!
            handle(new apiRequest(req, params, query), new apiResponse(req))
            return
        }

        req.respond({
            status: 404,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                error: {
                    status: 404,
                    message: 'page not found'
                }
            })
        })
    }

    private async _init() {
        const walkOptions = { includeDirs: false, exts: ['.js', '.jsx', '.mjs', '.ts', '.tsx'], skip: [/\.d\.ts$/i] }
        const { baseUrl, defaultLocale, locales } = this.config
        const bootstrapConfig = {
            baseUrl,
            defaultLocale,
            locales,
            pageModules: this._pageModules,
            hmr: this.isDev
        }
        const w1 = walk(path.join(this.srcDir), { ...walkOptions, maxDepth: 1 })
        const w2 = walk(path.join(this.srcDir, 'pages'), walkOptions)
        const w3 = walk(path.join(this.srcDir, 'api'), walkOptions)

        for await (const { path: fp } of w1) {
            const name = path.basename(fp)
            if (name.replace(reModuleExt, '') === 'app') {
                const { default: Component, getStaticProps } = await import(fp)
                if (Component && util.isFunction(Component)) {
                    const gsp = [Component.getStaticProps, getStaticProps].filter(util.isFunction)[0]
                    if (gsp) {
                        const props = await gsp()
                        if (util.isObject(props)) {
                            this._appModule.staticProps = props
                        }
                    }
                    this._appModule.Component = Component
                }
                await this._compile('./' + name)
            }
        }

        for await (const { path: fp } of w2) {
            const name = path.basename(fp)
            const pagePath = '/' + name.replace(reModuleExt, '').replace(/\s+/g, '-').replace(/\/?index$/i, '')
            this._pageModules[pagePath] = './pages/' + name.replace(reModuleExt, '') + '.js'
            await this._compile('./pages/' + name)
        }

        await this._compile('./main.js', {
            sourceCode: `
                import { bootstrap } from 'https://postjs.io/app.ts'
                bootstrap(${JSON.stringify(bootstrapConfig)})
            `
        })

        await this._compile('./renderer.js', {
            sourceCode: `
                export * from 'https://postjs.io/app.ts'
            `
        })

        for await (const { path: fp } of w3) {
            const name = path.basename(fp)
            const apiPath = '/' + name.replace(reModuleExt, '').replace(/\s+/g, '-')
            const { default: handle } = await import(fp)
            if (util.isFunction(handle)) {
                this._apis.set(apiPath, handle)
            }
            await this._compile('./api/' + name)
        }

        log.info(colors.bold('Pages'))
        for (const path in this._pageModules) {
            const isIndex = path == '/'
            log.info('○', path, isIndex ? colors.dim('(index)') : '')
        }
        for (const path of this._apis.keys()) {
            log.info('λ', `/api${path}`)
        }

        if (this.isDev) {
            // this._watch()
        }
    }

    private async _watch() {
        const w = Deno.watchFs(this.srcDir, { recursive: true })
        log.info('Start watching code changes...')
        for await (const event of w) {
            for (const p of event.paths) {
                const { rootDir, outputDir } = this.config
                const rp = util.trimPrefix(util.trimPrefix(p, rootDir), '/')
                if (reModuleExt.test(rp) && !rp.startsWith('.postjs/') && !rp.startsWith(outputDir.slice(1))) {
                    const moduleName = `./${rp.replace(reModuleExt, '')}.js`
                    if (this._fsWatchQueue.has(moduleName)) {
                        clearTimeout(this._fsWatchQueue.get(moduleName)!)
                    }
                    this._fsWatchQueue.set(moduleName, setTimeout(() => {
                        this._fsWatchQueue.delete(moduleName)
                        if (rp.startsWith('api/')) {
                            console.log(rp)
                            // todo: re-import api
                            return
                        }
                        if (rp.split('.', 1)[0] === 'app') {
                            // todo: re-import custom app
                        }
                        if (existsSync(p)) {
                            this._compile('./' + rp, { transpileOnly: true })
                            if (this._modules.has(moduleName)) {
                                log.info('modify', './' + rp)
                            } else {
                                log.info('add', './' + rp)
                            }
                        } else if (this._modules.has(moduleName)) {
                            this._modules.delete(moduleName)
                            log.info('remove', './' + rp)
                        }
                    }, 150))
                }
            }
        }
    }

    private async _compile(sourceFile: string, options?: { sourceCode?: string, transpileOnly?: boolean }) {
        const { cacheDeps, rootDir, importMap } = this.config
        const isRemote = reHttp.test(sourceFile) || (sourceFile in importMap.imports && reHttp.test(importMap.imports[sourceFile]))
        const sourceFileExt = reModuleExt.test(sourceFile) ? path.extname(sourceFile) : '.js'
        const moduleName = util.trimSuffix(sourceFile, sourceFileExt).replace(reHttp, '') + '.js'

        // compile the deps only once
        if (isRemote && this._deps.has(moduleName)) {
            return this._deps.get(moduleName)!
        }

        // do not re-compile the local modules when not transpileOnly
        if (!isRemote && this._modules.has(moduleName) && !options?.transpileOnly) {
            return this._deps.get(moduleName)!
        }

        const saveDir = path.join(rootDir, '.postjs', path.dirname(isRemote ? sourceFile.replace(reHttp, '-/') : sourceFile))
        const name = util.trimSuffix(path.basename(sourceFile), sourceFileExt)
        const metaFile = path.join(saveDir, `${name}.meta.json`)
        const mod: Module = {
            sourceFile,
            sourceMap: '',
            sourceHash: '',
            hash: '',
            deps: [],
            jsFile: '',
            js: '',
        }
        let source = ''
        let fsync = false

        if (existsSync(metaFile)) {
            try {
                const { sourceHash, hash, deps } = JSON.parse(Deno.readTextFileSync(metaFile))
                if (util.isNEString(sourceHash) && util.isNEString(hash) && util.isArray(deps)) {
                    mod.sourceHash = sourceHash
                    mod.hash = hash
                    mod.deps = deps
                    mod.jsFile = path.join(saveDir, name + (isRemote ? '' : `.${hash}`)) + '.js'
                    mod.js = Deno.readTextFileSync(mod.jsFile)
                    try {
                        mod.sourceMap = Deno.readTextFileSync(mod.jsFile + '.map')
                    } catch (e) { }
                }
            } catch (err) { }
        }

        if (isRemote) {
            let url = sourceFile
            for (const importPath in importMap.imports) {
                const alias = importMap.imports[importPath]
                if (importPath === url) {
                    url = alias
                    break
                } else if (importPath.endsWith('/') && url.startsWith(importPath)) {
                    url = util.trimSuffix(alias, '/') + '/' + util.trimPrefix(url, importPath)
                    break
                }
            }
            if (mod.sourceHash === '') {
                log.info('Download', sourceFile, url != sourceFile ? colors.dim(`• ${url}`) : '')
                try {
                    source = await fetch(url).then(resp => {
                        if (resp.status == 200) {
                            return resp.text()
                        }
                        return Promise.reject(new Error(`${resp.status} - ${resp.statusText}`))
                    })
                    mod.sourceHash = (new Sha1()).update(source).hex()
                } catch (err) {
                    throw new Error(`Download ${sourceFile}: ${err.message}`)
                }
            } else if (/^http:\/\/(localhost|127.0.0.1)(:\d+)?\//.test(url)) {
                try {
                    const text = await fetch(url).then(resp => {
                        if (resp.status == 200) {
                            return resp.text()
                        }
                        return Promise.reject(new Error(`${resp.status} - ${resp.statusText}`))
                    })
                    const sourceHash = (new Sha1()).update(text).hex()
                    if (mod.sourceHash !== sourceHash) {
                        source = text
                        mod.sourceHash = sourceHash
                    }
                } catch (err) {
                    throw new Error(`Download ${sourceFile}: ${err.message}`)
                }
            }
        } else if (options?.sourceCode) {
            const sourceHash = (new Sha1()).update(options.sourceCode).hex()
            if (mod.sourceHash === '' || mod.sourceHash !== sourceHash) {
                source = options.sourceCode
                mod.sourceHash = sourceHash
            }
        } else {
            const filepath = path.join(this.srcDir, sourceFile)
            const fileinfo = await Deno.stat(filepath)

            // 10mb limit
            if (fileinfo.size > 10 * (1 << 20)) {
                throw new Error(`ignored module '${sourceFile}': too large(${(fileinfo.size / (1 << 20)).toFixed(2)}mb)`)
            }

            const text = await Deno.readTextFile(filepath)
            const sourceHash = (new Sha1()).update(text).hex()
            if (mod.sourceHash === '' || mod.sourceHash !== sourceHash) {
                source = text
                mod.sourceHash = sourceHash
            }
        }

        // compile source
        if (source != '') {
            const deps: Array<{ path: string, hash: string }> = []
            const rewriteImportPath = (importPath: string): string => {
                let rewrittenPath: string
                if (importPath in importMap.imports) {
                    importPath = importMap.imports[importPath]
                }
                if (reHttp.test(importPath)) {
                    if (cacheDeps || /\.(jsx|tsx?)$/i.test(importPath)) {
                        if (isRemote) {
                            rewrittenPath = path.relative(
                                path.dirname(path.resolve('/', sourceFile.replace(reHttp, '-/'))),
                                path.resolve('/', importPath.replace(reHttp, '-/'))
                            )
                        } else {
                            rewrittenPath = path.relative(
                                path.dirname(path.resolve('/', sourceFile)),
                                '/' + importPath.replace(reHttp, '-/')
                            )
                        }
                    } else {
                        rewrittenPath = importPath
                    }
                } else {
                    if (isRemote) {
                        const sourceUrl = new URL(sourceFile)
                        let pathname = importPath
                        if (!pathname.startsWith('/')) {
                            pathname = path.join(path.dirname(sourceUrl.pathname), importPath)
                        }
                        rewrittenPath = path.relative(
                            path.dirname(path.resolve('/', sourceFile.replace(reHttp, '-/'))),
                            '/' + path.join('-', sourceUrl.host, pathname)
                        )
                    } else {
                        rewrittenPath = importPath.replace(reModuleExt, '') + '.' + 'x'.repeat(40)
                    }
                }
                if (reHttp.test(importPath)) {
                    deps.push({ path: importPath, hash: '' })
                } else {
                    if (isRemote) {
                        const sourceUrl = new URL(sourceFile)
                        let pathname = importPath
                        if (!pathname.startsWith('/')) {
                            pathname = path.join(path.dirname(sourceUrl.pathname), importPath)
                        }
                        deps.push({ path: sourceUrl.protocol + '//' + sourceUrl.host + pathname, hash: '' })
                    } else {
                        deps.push({ path: '.' + path.resolve('/', path.dirname(sourceFile), importPath), hash: '' })
                    }
                }

                if (reHttp.test(rewrittenPath)) {
                    return rewrittenPath
                }

                if (!rewrittenPath.startsWith('.')) {
                    rewrittenPath = '.' + path.resolve('/', rewrittenPath)
                }
                return rewrittenPath.replace(reModuleExt, '') + '.js'
            }
            const t = performance.now()
            const { diagnostics, outputText, sourceMapText } = compile(sourceFile, source, { mode: this.mode, rewriteImportPath })
            if (diagnostics && diagnostics.length) {
                throw new Error(`compile ${sourceFile}: ${JSON.stringify(diagnostics)}`)
            }
            mod.hash = (new Sha1()).update(outputText).hex()
            mod.deps = deps
            mod.js = outputText
            mod.sourceMap = sourceMapText!
            if (!fsync) {
                fsync = true
            }

            log.debug(`${sourceFile} compiled in ${(performance.now() - t).toFixed(3)}ms`)
        }

        if (!options?.transpileOnly) {
            for (let dep of mod.deps) {
                const depmod = await this._compile(dep.path)
                if (dep.hash !== depmod.hash) {
                    dep.hash = depmod.hash
                    if (!dep.path.startsWith('http')) {
                        const depImportPath = path.relative(
                            path.dirname(path.resolve('/', sourceFile)),
                            path.resolve('/', dep.path.replace(reModuleExt, ''))
                        )
                        mod.js = mod.js.replace(/ from "(.+?)";/g, (s, importPath) => {
                            if (
                                /\.[0-9a-fx]{40}\.js$/.test(importPath) &&
                                importPath.slice(0, importPath.length - 44) === depImportPath
                            ) {
                                return ` from "${depImportPath}.${dep.hash}.js";`
                            }
                            return s
                        })
                        mod.hash = (new Sha1()).update(mod.js).hex()
                    }
                    if (!fsync) {
                        fsync = true
                    }
                }
            }
        }

        if (fsync) {
            mod.jsFile = path.join(saveDir, name + (isRemote ? '' : `.${mod.hash}`)) + '.js'
            await Promise.all([
                this._writeTextFile(metaFile, JSON.stringify({
                    sourceFile,
                    sourceHash: mod.sourceHash,
                    hash: mod.hash,
                    deps: mod.deps,
                }, undefined, 4)),
                this._writeTextFile(mod.jsFile, mod.js),
                this._writeTextFile(mod.jsFile + '.map', mod.sourceMap)
            ])
        }

        if (isRemote) {
            this._deps.set(moduleName, mod)
        } else {
            this._modules.set(moduleName, mod)
        }

        return mod
    }

    private async _renderPage(url: RouterURL) {
        const ret = {
            code: 404,
            head: ['<title>404 - page not found</title>'],
            body: '<p><strong><code>404</code></strong><small> - </small><span>page not found</span></p>',
            ssrData: { url, staticProps: null as any },
        }
        if (url.pagePath in this._pageModules) {
            try {
                const [
                    { renderPage },
                    { default: Page, getStaticProps }
                ] = await Promise.all([
                    import(this._modules.get('./renderer.js')!.jsFile),
                    await import(this._modules.get(this._pageModules[url.pagePath])!.jsFile)
                ])
                if (util.isFunction(Page)) {
                    const fn = [Page.getStaticProps, getStaticProps].filter(util.isFunction)[0]
                    const staticProps = fn ? await fn(url) : null
                    const html = renderPage(url, { Component: Page, staticProps }, this._appModule)
                    ret.code = 200
                    ret.head = renderToTags()
                    ret.body = `<main>${html}</main>`
                    ret.ssrData.staticProps = util.isObject(staticProps) ? staticProps : null
                } else {
                    ret.code = 500
                    ret.head = ['<title>500 - render error</title>']
                    ret.body = `<p><strong><code>500</code></strong><small> - </small><span>render error: bad page component</span></p>`
                }
            } catch (err) {
                ret.code = 500
                ret.head = ['<title>500 - render error</title>']
                ret.body = `<pre>${AnsiUp.ansi_to_html(err.message)}</pre>`
                log.error(err.message)
            }
        }
        return ret
    }

    private async _writeTextFile(filepath: string, content: string) {
        const dir = path.dirname(filepath)
        if (!existsSync(dir)) {
            await Deno.mkdir(dir, { recursive: true })
        }
        await Deno.writeTextFile(filepath, content)
    }
}
