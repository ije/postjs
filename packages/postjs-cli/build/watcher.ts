import { route } from '@postjs/core'
import path from 'path'
import { createHash } from 'crypto'
import { EventEmitter } from 'events'
import { peerDeps } from '.'
import { appEntry, getAppConfig, pageComponentStaticMethods } from './app'
import { html, renderPage, runJS } from './render'
import { ChunkWithContent, Compiler } from './webpack'
import utils from '../shared/utils'

// a component returns nothing
const NullComponent = () => null

export class AppWatcher {
    private _appDir: string
    private _appLang: string
    private _pageChunks: Map<string, ChunkWithContent & { html?: string, staticProps?: any }>
    private _commonChunks: Map<string, ChunkWithContent>
    private _buildManifest: Record<string, any>
    private _lashHash?: string
    private _mainCompiler?: Compiler

    constructor(appDir: string) {
        this._appDir = appDir
        this._appLang = 'en'
        this._pageChunks = new Map()
        this._commonChunks = new Map()
        this._buildManifest = {}
        getAppConfig(this._appDir).then(({ lang }) => this._appLang = lang)
    }

    get isWatching() {
        return !!this._lashHash
    }

    // buildManifest returns the buildManifest as copy
    get buildManifest() {
        if (!this.isWatching) {
            return null
        }
        return { ...this._buildManifest }
    }

    private async _renderPage(pagePath: string) {
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            const { chunks: chunksForNode } = await new Compiler(this._appDir, `
                import * as mod from './pages${pagePath}'

                export default () => {
                    const component = mod.default
                    const staticMethods = ${JSON.stringify(pageComponentStaticMethods)}
                    staticMethods.forEach(name => {
                        if (typeof mod[name] === 'function' && typeof component[name] !== 'function') {
                            component[name] = mod[name]
                        }
                    })
                    return component
                }
            `, {
                target: 'node',
                mode: 'production',
                externals: Object.keys(peerDeps)
            }).compile()
            const { default: component } = runJS(chunksForNode.get('app')!.content, peerDeps)
            const url = { pagePath, pathname: pagePath, params: {}, query: {} }
            const { staticProps, helmet, body } = await renderPage(url, component())
            const dataJS = 'window.__POST_SSR_DATA = ' + JSON.stringify({ url, staticProps })
            const pageHtml = html({
                lang: this._appLang,
                helmet,
                body,
                scripts: [
                    dataJS,
                    { src: `_post/build-manifest.js?v=${this._lashHash}`, async: true },
                    { src: `_post/pages/${pagePath.replace(/^\/+/, '') || 'index'}.js?v=${pageChunk.hash}`, async: true },
                    ...Array.from(this._commonChunks.values()).map(({ name, hash }) => ({ src: `_post/${name}.js?v=${hash}`, async: true }))
                ]
            })
            pageChunk.html = pageHtml
            pageChunk.staticProps = staticProps
            console.log('render page: ' + pagePath)
        }
    }

    async getPageHtml(pathname: string): Promise<[number, string]> {
        if (!this.isWatching) {
            return [403, html({
                lang: this._appLang,
                helmet: '<title>403 - First compilation not ready</title>',
                body: '<p><strong><code>403</code></strong><small>&nbsp;-&nbsp;</small><span>First compilation not ready</span></p>',
                scripts: []
            })]
        }

        const pageRoutes = Array.from(this._pageChunks.keys()).map(pagePath => ({ path: pagePath, component: NullComponent }))
        const [url] = route('/', pageRoutes, { location: { pathname } })
        const { pagePath } = url
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (!pageChunk.html) {
                await this._renderPage(pagePath)
            }
            if (pageChunk.html) {
                return [200, pageChunk.html]
            }
        }
        return [404, html({
            lang: this._appLang,
            helmet: '<title>404 - Page not found</title>',
            body: '<p><strong><code>404</code></strong><small>&nbsp;-&nbsp;</small><span>Page not found</span></p>'
        })]
    }

    async getPageStaticProps(pathname: string) {
        if (!this.isWatching) {
            return null
        }

        const pageRoutes = Array.from(this._pageChunks.keys()).map(pagePath => ({ path: pagePath, component: NullComponent }))
        const [url] = route('/', pageRoutes, { location: { pathname } })
        const { pagePath } = url
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (!pageChunk.staticProps) {
                await this._renderPage(pagePath)
            }
            return pageChunk.staticProps
        }
        return null
    }

    getChunk(name: string): ChunkWithContent | null {
        name = utils.trimSuffix(name, '.js')
        if (name.startsWith('pages/')) {
            const pagePath = '/' + name.replace(/^pages\/(index)?/, '')
            if (this._pageChunks.has(pagePath)) {
                return this._pageChunks.get(pagePath)!
            }
        } else if (this._commonChunks.has(name)) {
            return this._commonChunks.get(name)!
        }
        return null
    }

    getHotUpdate(filename: string) {
        if (!this.isWatching) {
            return null
        }
        const memfs = this._mainCompiler!.memfs
        const filepath = path.join('/dist/', filename)
        if (memfs.existsSync(filepath)) {
            return memfs.readFileSync(filepath).toString()
        }
        return null
    }

    async watch(emitter: EventEmitter) {
        this._mainCompiler = new Compiler(this._appDir, {
            app: appEntry('/'),
            pages_loader: `
                const r = require.context('./pages', true, /\\.(js|ts)x?$/i, 'lazy')

                for (const key of r.keys()) {
                    const pageName = key.replace(/^[\\.\\/]+/, '').replace(/\\.(js|ts)x?$/i, '')
                    import(
                        /* webpackChunkName: "page-[request]" */
                        /* webpackMode: "lazy" */
                        './pages/' + pageName
                    )
                }
            `
        }, {
            mode: 'development',
            enableHMR: true,
            splitVendorChunk: true
        })
        this._mainCompiler.watch({
            aggregateTimeout: 150,
            ignored: /[\\/]node_modules[\\/]/
        }, (err, stats) => {
            if (err) {
                console.error(err)
                return
            }

            // reset build manifest
            this._buildManifest = {
                hash: stats.hash,
                pages: {},
                startTime: stats.startTime,
                endTime: stats.endTime,
                errors: stats.compilation.errors,
                warnings: stats.compilation.warnings
            }

            const memfs = this._mainCompiler!.memfs
            if (!stats.hasErrors()) {
                const removedPages = Array.from(this._pageChunks.keys()).reduce((set, key) => {
                    set.add(key)
                    return set
                }, new Set<string>())

                stats.compilation.namedChunks.forEach(({ name, hash }) => {
                    if (memfs.existsSync('/dist/' + name + '.js')) {
                        if (name.startsWith('page-')) {
                            const pageName = name.replace('page-', '') || 'index'
                            const pagePath = '/' + name.replace('page-', '')
                            const content = memfs.readFileSync('/dist/' + name + '.js').toString()
                            const hash = createHash('md5').update(content).digest('hex')
                            removedPages.delete(pagePath)
                            if (!this._pageChunks.has(pagePath) || this._pageChunks.get(pagePath)!.hash !== hash) {
                                this._pageChunks.set(pagePath, { name: pageName, hash, content })
                            }
                            this._buildManifest.pages[pagePath] = {
                                name: pageName,
                                hash
                            }
                        } else if (name !== 'pages_loader') {
                            if (!this._commonChunks.has(name) || this._commonChunks.get(name)!.hash !== hash) {
                                const content = memfs.readFileSync('/dist/' + name + '.js').toString()
                                this._commonChunks.set(name, { name, hash, content })
                            }
                        }
                    }
                })
                // clear pages
                removedPages.forEach(pagePath => this._pageChunks.delete(pagePath))

                this._lashHash = stats.hash
            }

            emitter.emit('webpackUpdate', this._buildManifest)
        })
    }
}
