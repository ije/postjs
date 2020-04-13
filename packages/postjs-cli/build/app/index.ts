import { activatedLazyComponents, AppContext, renderHeadToString, RouterContext, RouterStore, URL, utils } from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import React, { ComponentType, createElement, Fragment } from 'react'
import { renderToString } from 'react-dom/server'
import { createHtml, peerDeps, runJS } from '../utils'
import { Compiler } from '../webpack'
import { AppConfig, loadAppConfig } from './config'
import './router'

export class App {
    config: AppConfig

    constructor(appDir: string) {
        this.config = loadAppConfig(appDir)
    }

    get srcDir() {
        const { rootDir, srcDir } = this.config
        return path.join(rootDir, srcDir)
    }

    get outputDir() {
        const { rootDir, outputDir } = this.config
        return path.join(rootDir, outputDir)
    }

    get entryJS(): string {
        const {
            baseUrl,
            polyfillsMode = 'usage',
            polyfills = ['core-js/stable', 'whatwg-fetch']
        } = this.config
        return (`
            import React from 'react'
            import ReactDom from 'react-dom'
            import { AppContext } from '@postjs/core'
            import { AppRouter } from '@postjs/cli/dist/build/app/router'

            // ployfills
            ${polyfillsMode === 'entry' ? polyfills.map(name => `import ${JSON.stringify(name)}`).join('\n') : 'import "whatwg-fetch"'}
            ${polyfillsMode === 'entry' ? 'import "regenerator-runtime/runtime"' : ''}

            // onload
            window.addEventListener('load', () => {
                const dataEl = document.getElementById('ssr-data')
                if (dataEl) {
                    const ssrData = JSON.parse(dataEl.innerHTML)
                    if (ssrData && 'url' in ssrData) {
                        const preloadEl = document.head.querySelector('link[href*="_post/"][rel="preload"][as="script"]');
                        const { url, staticProps } = ssrData

                        // inject global variables
                        if (preloadEl) {
                            window['__post_loadScriptBaseUrl'] = preloadEl.getAttribute('href').split('_post/')[0]
                        }
                        { (window['__POST_APP'] =  window['__POST_APP'] || {}).config = ${JSON.stringify(this.config, ['lang', 'baseUrl'])} }
                        { (window['__POST_SSR_DATA'] =  window['__POST_SSR_DATA'] || {})[url.pagePath] = { staticProps } }

                        // delete ssr head elements
                        const postEndEl = document.head.querySelector('meta[name="post-head-end"]')
                        if (postEndEl !== null) {
                            let torms = []
                            let prev = postEndEl.previousElementSibling
                            while (prev) {
                                const tagName = prev.tagName.toLowerCase()
                                if (tagName !== 'title' && !(tagName === 'meta' && prev.hasAttribute('charSet'))) {
                                    torms.push(prev)
                                }
                                prev = prev.previousElementSibling
                            }
                            torms.forEach(el => document.head.removeChild(el))
                            torms = null
                        }

                        // hydrate app
                        ReactDom.hydrate((
                            <AppContext.Provider value={{
                                config: Object.assign({}, window['__POST_APP'].config),
                                staticProps: Object.assign({}, window['__POST_APP'].staticProps)
                            }}>
                                <AppRouter baseUrl="${baseUrl}" initialUrl={url} />
                            </AppContext.Provider>
                        ), document.querySelector('main'))
                    }
                }
            })
        `)
    }

    async build() {
        const { customApp, pages: ssrPages, lazyComponents, hash: R } = await this.renderAll()
        const compiler = new Compiler(this.srcDir, Object.keys(ssrPages).reduce((entries, pagePath) => {
            const pageName = pagePath.replace(/^\/+/, '') || 'index'
            const fullPath = path.join(this.srcDir, 'pages', pagePath)
            entries[`pages/${pageName}`] = `
                const { utils } = require('@postjs/core');
                (window.__POST_PAGES = window.__POST_PAGES || {})['${pagePath}'] = {
                    path: '${pagePath}',
                    reqComponent:() => {
                        const mod = require(${JSON.stringify(fullPath)})
                        const component = utils.isComponentModule(mod, 'page')
                        component.hasGetStaticPropsMethod = typeof mod['getStaticProps'] === 'function' || typeof component['getStaticProps'] === 'function'
                        return component
                    }
                }
            `
            return entries
        }, lazyComponents.reduce((entries, name) => {
            const fullPath = path.join(this.srcDir, 'components', name)
            entries[`components/${name}`] = `
                const { utils } = require('@postjs/core');
                (window.__POST_COMPONENTS = window.__POST_COMPONENTS || {})['${name}'] = {
                    name: '${name}',
                    style: '/*COMPONENT-STYLE-${R}*/',
                    reqComponent:() => {
                        const mod = require(${JSON.stringify(fullPath)})
                        return utils.isComponentModule(mod)
                    }
                }
            `
            return entries
        }, {
            app: customApp ? `
                const { utils } = require('@postjs/core')
                const mod = require('./pages/_app')

                window.__POST_APP = {
                    staticProps: '/*APP-STATIC-PROPS-${R}*/',
                    Component: utils.isComponentModule(mod, 'app')
                }
            ` : '',
            main: this.entryJS
        })), {
            isProduction: true,
            browserslist: this.config.browserslist,
            useBuiltIns: this.config.polyfillsMode
        })

        const { hash, chunks, warnings, errors, startTime, endTime } = await compiler.compile()
        const buildManifest = { hash, warnings, errors, startTime, endTime, pages: {} as Record<string, any>, components: {} as Record<string, any> }
        const buildDir = path.join(this.config.rootDir, '.post/builds', hash)
        const publicDir = path.join(this.config.rootDir, 'public')

        for (const chuck of chunks.values()) {
            const jsFile = path.join(buildDir, '_post', `${chuck.name}.js`)
            await fs.ensureDir(path.dirname(jsFile))
            if (chuck.name === 'app') {
                await fs.writeFile(jsFile, chuck.content.replace(`"/*APP-STATIC-PROPS-${R}*/"`, JSON.stringify(customApp.staticProps)))
            } else if (chuck.name.startsWith('components/')) {
                await fs.writeFile(jsFile, chuck.content.replace(`"/*COMPONENT-STYLE-${R}*/"`, JSON.stringify(chuck.css?.trim() || '')))
            } else {
                await fs.writeFile(jsFile, chuck.content)
            }
        }

        for (const pagePath of Object.keys(ssrPages)) {
            const pageName = pagePath.replace(/^\/+/, '') || 'index'
            buildManifest.pages[pagePath] = {
                name: pageName,
                hash: chunks.get('pages/' + pageName)!.hash
            }
            for (const ssrPage of ssrPages[pagePath]) {
                const { url, staticProps, html, head } = ssrPage
                const { pathname } = url
                const asName = pathname.replace(/^\/+/, '') || 'index'
                const depth = asName.split('/').length - 1
                const htmlFile = path.join(buildDir, asName + '.html')
                await fs.ensureDir(path.dirname(htmlFile))
                await fs.writeFile(htmlFile, createHtml({
                    lang: this.config.lang,
                    head: head.concat('<meta name="post-head-end" content="true" />'),
                    styles: Array.from(chunks.values()).filter(({ css, name }) => css && !name.startsWith('components/')).map(({ name, css }) => ({ 'data-post-style': name, content: css! })),
                    scripts: [
                        { type: 'application/json', id: 'ssr-data', innerText: JSON.stringify({ url, staticProps }) },
                        { src: '../'.repeat(depth) + `_post/build-manifest.js?v=${hash}`, async: true },
                        ...Array.from(chunks.values())
                            .filter(({ name }) => !(/^(pages|components)\//.test(name)) || name === 'pages/' + pageName)
                            .map(({ name, hash }) => ({ src: '../'.repeat(depth) + `_post/${name}.js?v=${hash}`, async: true }))
                    ],
                    body: html
                }))
                if (staticProps !== null) {
                    const dataFile = path.join(buildDir, '_post/pages', asName + '.json')
                    await fs.ensureDir(path.dirname(dataFile))
                    await fs.writeJSON(dataFile, { staticProps })
                }
                if (pathname !== pagePath) {
                    (buildManifest.pages[pagePath].staticPaths = buildManifest.pages[pagePath].staticPaths || []).push(pathname)
                }
            }
        }

        for (const name of lazyComponents) {
            const componentChunk = chunks.get('components/' + name)!
            buildManifest.components[name] = { hash: componentChunk.hash }
        }

        await fs.writeFile(path.join(buildDir, '_post/build-manifest.js'), 'window.__POST_BUILD_MANIFEST = ' + JSON.stringify(buildManifest))
        await fs.remove(this.outputDir)
        if (fs.existsSync(publicDir)) {
            await fs.copy(publicDir, buildDir, { recursive: true })
        }
        await fs.copy(buildDir, this.outputDir, { recursive: true })

        return buildManifest
    }

    async renderAll() {
        const hasComponentsDir = fs.existsSync(path.join(this.srcDir, 'components'))
        const compiler = new Compiler(this.srcDir, `
            const { utils } = require('@postjs/core')
            const r = require.context('./pages', true, /\\.(jsx?|mjs|tsx?)$/i)
            ${hasComponentsDir ? "const r2 = require.context('./components', true, /\\.(jsx?|mjs|tsx?)$/i)" : ''}
            const isValidName = key => /^[a-z0-9/.$*_~ -]+$/i.test(key)
            const pages = {}
            const components = {}

            r.keys().filter(isValidName).forEach(key => {
                const pagePath = key.replace(/^[.]+/, '').replace(/(\\/index)?\\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-') || '/'
                pages[pagePath] = {
                    rawRequest: './pages/' + key.replace(/^[./]+/, ''),
                    reqComponent: () => {
                        return utils.isComponentModule(r(key), 'page', ['getStaticProps', 'getStaticPaths'])
                    }
                }
            })

            ${hasComponentsDir ? 'r2.keys().filter(isValidName).forEach(each)' : ''}
            function each(key) {
                const name = key.replace(/^[.]+\\//, '').replace(/\\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-')
                components[name] = {
                    rawRequest: './components/' + key.replace(/^[./]+/, ''),
                    reqComponent: () => {
                        return utils.isComponentModule(r2(key))
                    }
                }
            }

            exports.pages = pages
            exports.components = components
        `, {
            isServer: true,
            externals: Object.keys(peerDeps)
        })
        const { chunks, hash, warnings, startTime, endTime } = await compiler.compile()
        const { pages, components } = runJS(chunks.get('main')!.content, peerDeps)

        type RenderedPage = { url: URL, staticProps: any, html: string, head: string[] }
        const renderRet = {
            hash,
            warnings,
            startTime,
            endTime,
            customApp: null as any,
            pages: {} as Record<string, Array<RenderedPage>>,
            lazyComponents: [] as Array<string>
        }

        let App: ComponentType = Fragment
        if ('/_app' in pages) {
            App = pages['/_app'].reqComponent()
            renderRet.customApp = { staticProps: await this._getStaticProps(App) }
        }

        for (const pagePath of Object.keys(pages).filter(pagePath => pagePath !== '/_app')) {
            const pageName = pagePath.replace(/^\/+/, '') || 'index'
            const pagePaths = new Set([pagePath])
            const PageComponent = pages[pagePath].reqComponent()
            const getStaticPaths = PageComponent['getStaticPaths']

            if (utils.isFunction(getStaticPaths)) {
                const v = await getStaticPaths()
                if (utils.isNEArray(v)) {
                    v.filter(utils.isNEString).forEach(v => pagePaths.add(utils.cleanPath(v)))
                }
            }

            renderRet.pages[pagePath] = []
            for (const pathname of pagePaths) {
                const params = {}
                if (pathname !== pagePath) {
                    const [r, ok] = utils.matchPath(pagePath, pathname)
                    if (!ok) {
                        console.log(`invalid static path '${pathname}' of page '${pageName}'`)
                        continue
                    }
                    Object.assign(params, r)
                }
                const url = { pagePath, pathname, params, query: {} }
                const { staticProps, html } = await this._renderPage(App, renderRet.customApp?.staticProps, PageComponent, url)
                const head = renderHeadToString()
                renderRet.pages[pagePath].push({ url, staticProps, html, head })
            }
        }

        renderRet.lazyComponents = Object.keys(components).filter(name => activatedLazyComponents.has(name))
        activatedLazyComponents.clear()

        return renderRet
    }

    async renderPage(url: URL) {
        const { chunks } = await new Compiler(this.srcDir, `
            const { utils } = require('@postjs/core')
            const r = require.context('./pages', false, /\\.\\/_app\\.(jsx?|mjs|tsx?)$/i)

            exports.reqApp = () => {
                const rKeys = r.keys()
                if (rKeys.length === 1) {
                   return utils.isComponentModule(r(rKeys[0]), 'app', ['getStaticProps'])
                }
                return null
            }
            exports.reqComponent = () => {
                const mod = require('./pages${url.pagePath}')
                return utils.isComponentModule(mod, 'page', ['getStaticProps'])
            }
        `, {
            isServer: true,
            externals: Object.keys(peerDeps)
        }).compile()
        const { content: js, css } = chunks.get('main')!
        const { reqApp, reqComponent } = runJS(js, peerDeps)

        const App: ComponentType = reqApp() || Fragment
        const appStaticProps: any = await this._getStaticProps(App)

        const { staticProps, html } = await this._renderPage(App || Fragment, appStaticProps, reqComponent(), url)
        return { staticProps, html, css }
    }

    async getStaticProps() {
        const { chunks } = await new Compiler(this.srcDir, `
            const { utils } = require('@postjs/core')
            const r = require.context('./pages', false, /\\.\\/_app\\.(jsx?|mjs|tsx?)$/i)

            let getStaticProps = null
            const rKeys = r.keys()
            if (rKeys.length === 1) {
                const mod = r(rKeys[0])
                if (mod.default && utils.isFunction(mod.default.getStaticProps)) {
                    getStaticProps = mod.default.getStaticProps
                } else if (utils.isFunction(mod.getStaticProps)) {
                    getStaticProps = mod.getStaticProps
                }
            }

            exports.App = {getStaticProps}
        `, {
            isServer: true,
            externals: Object.keys(peerDeps)
        }).compile()
        const { content: js } = chunks.get('main')!
        const { App } = runJS(js, peerDeps)

        return await this._getStaticProps(App)
    }

    private async _getStaticProps(App: ComponentType) {
        const getStaticProps = App['getStaticProps']
        if (utils.isFunction(getStaticProps)) {
            const { lang, baseUrl } = this.config
            const props = await getStaticProps({ lang, baseUrl })
            if (utils.isObject(props)) {
                return props
            }
        }
        return null
    }

    private async _renderPage(
        App: React.ComponentType,
        appStaticProps: any,
        PageComponent: React.ComponentType,
        url: URL
    ) {
        let staticProps: any = null
        const getStaticProps = PageComponent['getStaticProps']
        if (utils.isFunction(getStaticProps)) {
            const props = await getStaticProps(url)
            if (utils.isObject(props)) {
                staticProps = props
            } else {
                staticProps = {}
            }
        }

        const { lang, baseUrl } = this.config
        const el = createElement(
            AppContext.Provider,
            {
                value: {
                    config: { lang, baseUrl },
                    staticProps: appStaticProps
                }
            },
            createElement(
                RouterContext.Provider,
                { value: new RouterStore(url) },
                createElement(
                    App,
                    appStaticProps,
                    createElement(
                        PageComponent,
                        staticProps
                    )
                )
            )
        )

        return {
            html: renderToString(el),
            staticProps
        }
    }
}
