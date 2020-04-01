import { route } from '@postjs/core'
import { EventEmitter } from 'events'
import glob from 'glob'
import path from 'path'
import webpack from 'webpack'
import DynamicEntryPlugin from 'webpack/lib/DynamicEntryPlugin'
import { peerDeps } from '.'
import utils from '../shared/utils'
import { appEntry, getAppConfig } from './app'
import { html, renderPage, runJS, ssrStaticMethods } from './render'
import { ChunkWithContent, Compiler } from './webpack'

// A component returns nothing
const NullComponent = () => null

export class AppWatcher {
    private _appDir: string
    private _appLang: string
    private _pageFiles: string[]
    private _pageChunks: Map<string, ChunkWithContent & { html?: string, staticProps?: any }>
    private _commonChunks: Map<string, ChunkWithContent>
    private _buildManifest: Record<string, any> | null
    private _clientCompiler: Compiler

    constructor(appDir: string) {
        this._appDir = appDir
        this._appLang = 'en'
        this._pageFiles = glob.sync('pages/**/*.{js,jsx,ts,tsx}', { cwd: appDir }).map(p => utils.trimPrefix(p, 'pages/')).filter(p => /^[a-z0-9\.\/\$\-\*_~ ]+$/i.test(p))
        this._pageChunks = new Map()
        this._commonChunks = new Map()
        this._buildManifest = null
        this._clientCompiler = new Compiler(this._appDir, appEntry('/'), {
            mode: 'development',
            enableHMR: true,
            splitVendorChunk: true
        })
        getAppConfig(this._appDir).then(({ lang }) => this._appLang = lang)
    }

    get isInitiated() {
        return this._buildManifest !== null
    }

    // buildManifest returns the buildManifest as copy
    get buildManifest() {
        if (!this.isInitiated) {
            return null
        }
        return { ...this._buildManifest }
    }

    private async _renderPage(pagePath: string) {
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            const { chunks } = await new Compiler(this._appDir, `
                const React = require('react')
                const { isValidElementType } = require('react-is')
                const mod = require('./pages${pagePath}')

                export default () => {
                    const component = mod.default
                    if (component === undefined) {
                        return () => <p style={{color: 'red'}}>bad page: miss default export</p>
                    } else if (!isValidElementType(component)) {
                        return () => <p style={{color: 'red'}}>bad page: invalid element type</p>
                    }
                    const staticMethods = ${JSON.stringify(ssrStaticMethods)}
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
            const { default: component } = runJS(chunks.get('app')!.content, peerDeps)
            const url = { pagePath, pathname: pagePath, params: {}, query: {} }
            const { staticProps, helmet, body } = await renderPage(url, component())
            const dataJS = 'window.__POST_SSR_DATA = ' + JSON.stringify({ url, staticProps })
            const pageHtml = html({
                lang: this._appLang,
                helmet,
                body,
                scripts: [
                    dataJS,
                    { src: `_post/build-manifest.js?v=${this._buildManifest!.hash}`, async: true },
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
        if (!this.isInitiated) {
            return [403, html({
                lang: this._appLang,
                body: '<p><strong><code>403</code></strong><small>&nbsp;-&nbsp;</small><span>First compilation not ready</span></p>',
                helmet: ['<title>403 - First compilation not ready</title>']
            })]
        }

        const pageRoutes = Array.from(this._pageChunks.keys()).map(pagePath => ({ path: pagePath, component: NullComponent }))
        const [url] = route('/', pageRoutes, { location: { pathname } })
        const { pagePath } = url
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (pageChunk.html === undefined) {
                await this._renderPage(pagePath)
            }
            if (pageChunk.html) {
                return [200, pageChunk.html]
            }
        }

        return [404, html({
            lang: this._appLang,
            body: '<p><strong><code>404</code></strong><small>&nbsp;-&nbsp;</small><span>Page not found</span></p>',
            helmet: ['<title>404 - Page not found</title>']
        })]
    }

    async getPageStaticProps(pathname: string) {
        if (!this.isInitiated) {
            return undefined
        }

        const pageRoutes = Array.from(this._pageChunks.keys()).map(pagePath => ({ path: pagePath, component: NullComponent }))
        const [url] = route('/', pageRoutes, { location: { pathname } })
        const { pagePath } = url
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (pageChunk.staticProps === undefined) {
                await this._renderPage(pagePath)
            }
            return pageChunk.staticProps
        }
        return undefined
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

    getHotUpdateContent(filename: string) {
        if (!this.isInitiated) {
            return null
        }
        const memfs = this._clientCompiler!.memfs
        const filepath = path.join('/', filename)
        if (memfs.existsSync(filepath)) {
            return memfs.readFileSync(filepath).toString()
        }
        return null
    }

    async watch(emitter: EventEmitter) {
        this._clientCompiler.hooks.make.tapPromise(
            'addPageEntries',
            async compilation => Promise.all(this._pageFiles.map(pageFile => {
                const pagePath = ('/' + pageFile).replace(/(\/index)?\.(js|ts)x?$/i, '').replace(/ /g, '-') || '/'
                const pageName = pageFile.replace(/\.(js|ts)x?$/i, '')
                return addEntry(
                    compilation,
                    this._clientCompiler!.context,
                    `pages/${pageName}`,
                    [`post-page-loader?${JSON.stringify({ pagePath, rawRequest: './pages/' + pageFile })}!`]
                )
            })).catch(err => console.error(err))
        )

        this._clientCompiler.watch({
            aggregateTimeout: 150,
            ignored: /[\\/]node_modules[\\/]/
        }, (err, stats) => {
            if (err) {
                console.error(err)
                return
            }

            const memfs = this._clientCompiler!.memfs
            const { hash, startTime, endTime, compilation } = stats
            const { isInitiated } = this
            const errorsWarnings = stats.toJson('errors-warnings')

            // reset build manifest
            this._buildManifest = {
                hash,
                errors: errorsWarnings.errors,
                warnings: errorsWarnings.warnings,
                startTime,
                endTime,
                pages: {}
            }

            if (!stats.hasErrors()) {
                const removedPages = Array.from(this._pageChunks.keys()).reduce((set, key) => {
                    set.add(key)
                    return set
                }, new Set<string>())

                compilation.namedChunks.forEach(({ name, hash }) => {
                    const chunkFileName = '/' + name + '.js'
                    if (memfs.existsSync(chunkFileName)) {
                        if (name.startsWith('pages/')) {
                            const pageName = name.replace('pages/', '') || 'index'
                            const pagePath = '/' + name.replace(/^pages\/(index)?/, '')
                            const content = memfs.readFileSync(chunkFileName).toString()
                            removedPages.delete(pagePath)
                            if (!this._pageChunks.has(pagePath) || this._pageChunks.get(pagePath)!.hash !== hash) {
                                this._pageChunks.set(pagePath, { name: pageName, hash, content })
                            }
                            this._buildManifest!.pages[pagePath] = { name: pageName, hash }
                        } else if (!this._commonChunks.has(name) || this._commonChunks.get(name)!.hash !== hash) {
                            const content = memfs.readFileSync(chunkFileName).toString()
                            this._commonChunks.set(name, { name, hash, content })
                        }
                    }
                })

                // clear pages
                removedPages.forEach(pagePath => this._pageChunks.delete(pagePath))
            } else {
                console.error(errorsWarnings.errors)
            }

            if (isInitiated) {
                emitter.emit('webpackHotUpdate', this._buildManifest)
            }
        })
    }
}

// Based on https://github.com/webpack/webpack/blob/master/lib/DynamicEntryPlugin.js
function addEntry(
    compilation: webpack.compilation.Compilation,
    context: string,
    name: string,
    entry: string[]
) {
    return new Promise((resolve, reject) => {
        const dep = DynamicEntryPlugin.createDependency(entry, name)
        compilation.addEntry(context, dep, name, (err: Error | null) => {
            if (err) { return reject(err) }
            resolve()
        })
    })
}
