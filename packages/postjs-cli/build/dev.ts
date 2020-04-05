import { route } from '@postjs/core'
import { EventEmitter } from 'events'
import fs from 'fs-extra'
import glob from 'glob'
import path from 'path'
import React, { Fragment } from 'react'
import webpack from 'webpack'
import DynamicEntryPlugin from 'webpack/lib/DynamicEntryPlugin'
import { peerDeps } from '.'
import utils from '../shared/utils'
import { AppConfig, craeteAppEntry, loadAppConfig } from './app'
import { html, renderPage, runJS, ssrStaticMethods } from './ssr'
import { ChunkWithContent, Compiler } from './webpack'

// A component returns nothing
const NullComponent = () => null

export class DevWatcher {
    private _appConfig: AppConfig
    private _pageFiles: string[]
    private _pageChunks: Map<string, ChunkWithContent & { html?: string, staticProps?: any }>
    private _commonChunks: Map<string, ChunkWithContent>
    private _buildManifest: Record<string, any> | null
    private _compiler: Compiler

    constructor(appDir: string) {
        const appConfig = loadAppConfig(appDir)
        this._appConfig = appConfig
        this._pageFiles = this._getPageFiles()
        this._pageChunks = new Map()
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

    private get _srcDir() {
        const { rootDir, srcDir } = this._appConfig
        return path.join(rootDir, srcDir)
    }

    private _getPageFiles() {
        return glob.sync(
            'pages/**/*.{js,jsx,mjs,ts,tsx}',
            { cwd: this._srcDir }
        ).map(p => utils.trimPrefix(p, 'pages/')).filter(p => /^[a-z0-9\.\/\$\-\*_~ ]+$/i.test(p))
    }

    private async _renderPage(pagePath: string) {
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            const appRequest = this._pageFiles.find(file => /^_app\.(jsx?|mjs|tsx?)$/.test(file))
            const { chunks } = await new Compiler(this._srcDir, `
                const React = require('react')
                const { isValidElementType } = require('react-is')
                const App = ${appRequest !== undefined} ? require('./pages/${appRequest}') : null
                const PageComponent = require('./pages${pagePath}')

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

            const url = { pagePath, pathname: pagePath, params: {}, query: {} }
            const { staticProps, head, body } = await renderPage(APP, appStaticProps, url, reqPageComponent())
            const pageHtml = html({
                lang: this._appConfig.lang,
                head: head.concat(mainCSS ? [`<style data-post-style="dev">${mainCSS.trim()}</style>`] : []),
                body,
                scripts: [
                    { json: true, id: 'ssr-data', data: { url, staticProps, appStaticProps } },
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
                await this._renderPage(pagePath)
            }
            if (pageChunk.html) {
                return [200, pageChunk.html]
            }
        }

        if (this._pageChunks.has('/_404')) {
            const pageChunk = this._pageChunks.get('/_404')!
            if (pageChunk.html === undefined) {
                await this._renderPage('/_404')
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
            'addPageEntries',
            async compilation => {
                this._pageFiles = this._pageFiles.filter(pageFile => {
                    return fs.existsSync(path.join(this._srcDir, 'pages', pageFile))
                })
                return Promise.all(this._pageFiles.map(pageFile => {
                    const pagePath = ('/' + pageFile).replace(/(\/index)?\.(js|ts)x?$/i, '').replace(/ /g, '-') || '/'
                    const pageName = pageFile.replace(/\.(js|ts)x?$/i, '')
                    const isApp = pageName === '_app'
                    return addEntry(
                        compilation,
                        this._compiler!.context,
                        isApp ? 'app' : `pages/${pageName}`,
                        [`post-${isApp ? 'app' : 'page'}-loader?${JSON.stringify({ pagePath, rawRequest: './pages/' + pageFile })}!`]
                    )
                })).catch(err => console.error(err))
            }
        )

        this._compiler.watch({
            aggregateTimeout: 150,
            ignored: /[\\/]node_modules[\\/]/
        }, (err, stats) => {
            if (err) {
                console.error(err)
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
                            if (compilation.namedChunks.has('app')) {
                                hash = compilation.namedChunks.get('app')!.hash + '.' + hash
                            }
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

                // clear
                removedPages.forEach(pagePath => this._pageChunks.delete(pagePath))
                if (this._commonChunks.has('app') && !compilation.namedChunks.has('app')) {
                    this._commonChunks.delete('app')
                }
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
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}
