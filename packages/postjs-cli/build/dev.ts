import { URL } from '@postjs/core'
import { route } from '@postjs/core/dist/router/route'
import { EventEmitter } from 'events'
import fs from 'fs-extra'
import path from 'path'
import React, { Fragment } from 'react'
import { peerDeps } from '.'
import utils from '../shared/utils'
import { AppConfig, craeteAppEntry, loadAppConfig } from './app'
import { html, renderPage, ssrStaticMethods } from './ssr'
import { addEntry, getJSXFiles, NullComponent, runJS } from './utils'
import { ChunkWithContent, Compiler } from './webpack'

export class DevWatcher {
    private _appConfig: AppConfig
    private _jsxFiles: string[]
    private _pageChunks: Map<string, ChunkWithContent & { html?: string, staticProps?: any }>
    private _componentChunks: Map<string, ChunkWithContent>
    private _commonChunks: Map<string, ChunkWithContent>
    private _buildManifest: Record<string, any> | null
    private _compiler: Compiler

    constructor(appDir: string) {
        const appConfig = loadAppConfig(appDir)
        this._appConfig = appConfig
        this._jsxFiles = [
            ...getJSXFiles('components/', this._srcDir),
            ...getJSXFiles('pages/', this._srcDir)
        ]
        this._pageChunks = new Map()
        this._componentChunks = new Map()
        this._commonChunks = new Map()
        this._buildManifest = null
        this._compiler = new Compiler(this._srcDir, craeteAppEntry(this._appConfig), {
            enableHMR: true,
            splitVendorChunk: true,
            babelPresetEnv: {
                targets: appConfig.browserslist,
                useBuiltIns: appConfig.polyfillsMode
            }
        })
    }

    private get _srcDir() {
        const { rootDir, srcDir } = this._appConfig
        return path.join(rootDir, srcDir)
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

    private async _renderPage(url: URL) {
        const pageRawRequest = this._jsxFiles.find(name => {
            const chunkName = name.replace(/\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-')
            const _pagePath = utils.trimPrefix(chunkName, 'pages').replace(/\/index$/, '') || '/'
            return _pagePath === url.pagePath
        })
        if (pageRawRequest && this._pageChunks.has(url.pagePath)) {
            const pageChunk = this._pageChunks.get(url.pagePath)!
            const appRawRequest = this._jsxFiles.find(name => /^pages\/_app\.(jsx?|mjs|tsx?)$/i.test(name))
            const { hash, chunks } = await new Compiler(this._srcDir, `
                const React = require('react')
                const { isValidElementType } = require('react-is')
                const App = ${appRawRequest !== undefined} ? require('./${appRawRequest}') : null
                const PageComponent = require(${JSON.stringify(pageRawRequest)})

                function validComponent(mod, name) {
                    const component = mod.default
                    if (component === undefined) {
                        return () => <p style={{color: 'red'}}>bad {name}: miss default export</p>
                    } else if (!isValidElementType(component)) {
                        return () => <p style={{color: 'red'}}>bad {name}: invalid element type</p>
                    }
                    const staticMethods = ${JSON.stringify(ssrStaticMethods)}
                    staticMethods.forEach(name => {
                        if (typeof mod[name] === 'function' && typeof component[name] !== 'function') {
                            component[name] = mod[name]
                        }
                    })
                    return component
                }

                exports.reqApp = () => App ? validComponent(App, 'app') : null
                exports.reqPageComponent = () => validComponent(PageComponent, 'page')
            `, {
                isServer: true,
                externals: Object.keys(peerDeps)
            }).compile()
            const { content: mainJS, css: mainCSS } = chunks.get('main')!
            const { reqApp, reqPageComponent } = runJS(mainJS, peerDeps)

            let APP: React.ComponentType<any> = reqApp() || Fragment
            let appStaticProps: any = null
            if (APP !== Fragment && 'getStaticProps' in APP) {
                const getStaticProps = APP['getStaticProps'] as any
                if (typeof getStaticProps === 'function') {
                    const props = await getStaticProps(this._appConfig)
                    if (utils.isObject(props)) {
                        appStaticProps = props
                    }
                }
            }

            const { staticProps, head, body } = await renderPage(APP, appStaticProps, url, reqPageComponent())
            const pageHtml = html({
                lang: this._appConfig.lang,
                head: head.length > 0 ? head.concat('<meta name="post-head-end" content="true" />') : head,
                styles: mainCSS ? [{ 'data-post-style': 'dev', content: mainCSS }] : undefined,
                scripts: [
                    { type: 'application/json', id: 'ssr-data', innerText: JSON.stringify({ url, staticProps, appStaticProps }) },
                    { src: `/_post/build-manifest.js?v=${hash}`, async: true },
                    { src: `/_post/pages/${url.pagePath.replace(/^\/+/, '') || 'index'}.js?v=${pageChunk.hash}`, async: true },
                    ...Array.from(this._commonChunks.values()).map(({ name, hash }) => ({ src: `/_post/${name}.js?v=${hash}`, async: true }))
                ],
                body
            })

            pageChunk.html = pageHtml
            pageChunk.staticProps = staticProps
            console.log('render page: ' + url.pagePath)
        }
    }

    async getPageHtml(pathname: string): Promise<[number, string]> {
        if (!this.isInitiated) {
            return [403, html({
                lang: this._appConfig.lang,
                head: ['<title>403 - First compilation not ready</title>'],
                body: '<p style="margin: 50px"><strong><code>403</code></strong><small>&nbsp;-&nbsp;</small><span>First compilation not ready</span></p>'
            })]
        }

        const pageRoutes = Array.from(this._pageChunks.keys()).map(pagePath => ({ path: pagePath, component: NullComponent }))
        const [url] = route('/', pageRoutes, { location: { pathname } })
        const { pagePath } = url
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (pageChunk.html === undefined) {
                await this._renderPage(url)
            }
            if (pageChunk.html) {
                return [200, pageChunk.html]
            }
        }

        if (this._pageChunks.has('/_404')) {
            const pageChunk = this._pageChunks.get('/_404')!
            if (pageChunk.html === undefined) {
                await this._renderPage({ ...url, pagePath: '/_404' })
            }
            if (pageChunk.html) {
                return [404, pageChunk.html]
            }
        }

        return [404, html({
            lang: this._appConfig.lang,
            head: ['<title>404 - Page not found</title>'],
            body: '<p style="margin: 50px"><strong><code>404</code></strong><small>&nbsp;-&nbsp;</small><span>Page not found</span></p>'
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
                await this._renderPage(url)
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
        } if (name.startsWith('components/')) {
            name = utils.trimPrefix(name, 'components/')
            if (this._componentChunks.has(name)) {
                return this._componentChunks.get(name)!
            }
        } else if (this._commonChunks.has(name)) {
            return this._commonChunks.get(name)!
        }
        return null
    }

    getOutputContent(filename: string) {
        if (!this.isInitiated) {
            return null
        }
        const memfs = this._compiler!.memfs
        const filepath = path.join('/', filename)
        if (memfs.existsSync(filepath)) {
            return memfs.readFileSync(filepath)
        }
        return null
    }

    async watch(emitter: EventEmitter) {
        this._compiler.hooks.make.tapPromise(
            'add entries',
            async compilation => {
                this._jsxFiles = this._jsxFiles.filter(jsxFile => {
                    return fs.existsSync(path.join(this._srcDir, jsxFile))
                })
                return Promise.all(this._jsxFiles.map(jsxFile => {
                    let loader = { type: '', options: { rawRequest: './' + jsxFile } }
                    let chunkName = jsxFile.replace(/\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-')
                    if (chunkName === 'pages/_app') {
                        loader.type = 'app'
                        chunkName = 'app'
                    } else if (chunkName.startsWith('pages/')) {
                        const pagePath = utils.trimPrefix(chunkName, 'pages').replace(/\/index$/i, '') || '/'
                        loader.type = 'page'
                        loader.options['pagePath'] = pagePath
                    } else if (chunkName.startsWith('components/')) {
                        const name = utils.trimPrefix(chunkName, 'components/')
                        loader.type = 'component'
                        loader.options['name'] = name
                    } else {
                        return Promise.resolve()
                    }

                    return addEntry(
                        compilation,
                        this._srcDir,
                        chunkName,
                        [`post-${loader.type}-loader?${JSON.stringify(loader.options)}!`]
                    )
                })).catch(err => console.error(err))
            }
        )

        this._compiler.watch({
            aggregateTimeout: 150,
            ignored: /[\\/]node_modules[\\/]/
        }, (err, stats) => {
            if (err) {
                console.error('watch error:', err)
                return
            }

            const memfs = this._compiler!.memfs
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
                components: {},
                pages: {}
            }

            if (!stats.hasErrors()) {
                compilation.namedChunks.forEach(({ name, hash, rawRequest }) => {
                    const chunkFileName = '/' + name + '.js'
                    if (memfs.existsSync(chunkFileName)) {
                        const content = memfs.readFileSync(chunkFileName).toString()
                        if (name.startsWith('pages/')) {
                            const pageName = utils.trimPrefix(name, 'pages/')
                            const pagePath = ('/' + pageName).replace(/\/index$/i, '') || '/'
                            name = utils.trimPrefix(name, 'pages/')
                            if (!this._pageChunks.has(pagePath) || this._pageChunks.get(pagePath)!.hash !== hash) {
                                this._pageChunks.set(pagePath, { name: pageName, hash, content })
                            }
                            this._buildManifest!.pages[pagePath] = { name: pageName, hash }
                        } else if (name.startsWith('components/')) {
                            name = utils.trimPrefix(name, 'components/')
                            if (!this._componentChunks.has(name) || this._componentChunks.get(name)!.hash !== hash) {
                                this._componentChunks.set(name, { name, hash, content })
                            }
                            this._buildManifest!.components[name] = { hash }
                        } else if (!this._commonChunks.has(name) || this._commonChunks.get(name)!.hash !== hash) {
                            this._commonChunks.set(name, { name, hash, content })
                        }
                    }
                })

                // clear
                if (this._commonChunks.has('app') && !compilation.namedChunks.has('app')) {
                    this._commonChunks.delete('app')
                }
                Array.from(this._pageChunks.keys()).filter(pagePath => !Object.keys(this._buildManifest!.pages).includes(pagePath)).forEach(pagePath => {
                    this._pageChunks.delete(pagePath)
                })
                Array.from(this._componentChunks.keys()).filter(name => !Object.keys(this._buildManifest!.components).includes(name)).forEach(name => {
                    this._componentChunks.delete(name)
                })
            } else {
                console.error('watch error:', errorsWarnings.errors)
            }

            if (isInitiated) {
                emitter.emit('webpackHotUpdate', this._buildManifest)
            }
        })
    }
}
