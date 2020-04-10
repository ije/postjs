import { activatedLazyComponents, renderHeadToString, RouterContext, RouterStore, URL, utils } from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import React, { ComponentType, createElement, Fragment } from 'react'
import { renderToString } from 'react-dom/server'
import { createHtml, peerDeps, runJS } from '../utils'
import { Compiler } from '../webpack'
import { AppConfig, loadAppConfig } from './config'
import { matchPath } from './router'

export class App {
    config: AppConfig
    hash: string | null
    component: ComponentType | null
    private staticProps: Record<string, any> | null

    constructor(appDir: string) {
        this.config = loadAppConfig(appDir)
        this.hash = null
        this.component = null
        this.staticProps = null
    }

    get srcDir() {
        const { rootDir, srcDir } = this.config
        return path.join(rootDir, srcDir)
    }

    get outputDir() {
        const { rootDir, outputDir } = this.config
        return path.join(rootDir, outputDir)
    }

    get isCustom() {
        return this.component !== null
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
            import { AppRouter } from '@postjs/cli/dist/build/app/router'

            // ployfills
            ${polyfillsMode === 'entry' ? polyfills.map(name => `import ${JSON.stringify(name)}`).join('\n') : "import 'whatwg-fetch'"}
            ${polyfillsMode === 'entry' ? "import 'regenerator-runtime/runtime'" : ''}

            window.addEventListener('load', () => {
                const dataEl = document.getElementById('ssr-data')
                if (dataEl) {
                    const ssrData = JSON.parse(dataEl.innerHTML)
                    if (ssrData && 'url' in ssrData) {
                        const { url, staticProps } = ssrData
                        const preloadEl = document.head.querySelector('link[href*="_post/"][rel="preload"][as="script"]');

                        if (preloadEl) {
                            window['__post_loadScriptBaseUrl'] = preloadEl.getAttribute('href').split('_post/')[0]
                        }
                        if (!window['__POST_SSR_DATA']) {
                            window['__POST_SSR_DATA'] = {}
                        }
                        window['__POST_SSR_DATA'][url.pagePath] = { staticProps }

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
                            <AppRouter baseUrl="${baseUrl}" initialUrl={url} />
                        ), document.querySelector('main'))
                    }
                }
            })
        `)
    }

    async update(hash: string | null, component: ComponentType | null) {
        this.hash = hash
        this.component = component
        this.staticProps = null
        console.log('app updated, hash:', hash)
    }

    async getStaticProps() {
        if (this.staticProps === null && this.component) {
            const getStaticProps = this.component!['getStaticProps']
            if (typeof getStaticProps === 'function') {
                const props = await getStaticProps()
                if (utils.isObject(props)) {
                    this.staticProps = props
                } else {
                    this.staticProps = {}
                }
            }
        }
        return this.staticProps
    }

    async build() {
        const { pages: ssrPages, lazyComponents, hash: R } = await this.ssr()
        const compiler = new Compiler(this.srcDir, Object.keys(ssrPages).reduce((entries, pagePath) => {
            const pageName = pagePath.replace(/^\/+/, '') || 'index'
            const fullPath = path.join(this.srcDir, 'pages', pagePath)
            entries[`pages/${pageName}`] = `
                const { utils } = require('@postjs/core');
                (window.__POST_PAGES = window.__POST_PAGES || {})['${pagePath}'] = {
                    path: '${pagePath}',
                    reqComponent:() => {
                        const mod = require(${JSON.stringify(fullPath)})
                        const component = utils.isComponent(mod.default, 'page')
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
                        const { default: component } = require(${JSON.stringify(fullPath)})
                        return utils.isComponent(component)
                    }
                }
            `
            return entries
        }, {
            app: this.isCustom ? `
            const { utils } = require('@postjs/core')
            const { default: component } = require('./pages/_app')

            window.__POST_APP = {
                staticProps: '/*APP-STATIC-PROPS-${R}*/',
                Component: utils.isComponent(component, 'app')
            }
        ` : '',
            main: this.entryJS
        })), {
            isProduction: true,
            splitVendorChunk: true,
            browserslist: this.config.browserslist,
            useBuiltIns: this.config.polyfillsMode
        })

        const { hash, chunks, warnings, errors, startTime, endTime } = await compiler.compile()
        const buildManifest: Record<string, any> = { hash, warnings, errors, startTime, endTime, pages: {}, components: {} }
        const buildDir = path.join(this.config.rootDir, '.post/builds', hash)

        for (const chuck of chunks.values()) {
            const jsFile = path.join(buildDir, '_post', `${chuck.name}.js`)
            await fs.ensureDir(path.dirname(jsFile))
            if (chuck.name === 'app') {
                const appStaticProps = await this.getStaticProps()
                await fs.writeFile(jsFile, chuck.content.replace(`"/*APP-STATIC-PROPS-${R}*/"`, JSON.stringify(appStaticProps)))
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
                const { asPath } = url
                const asName = asPath.replace(/^\/+/, '') || 'index'
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
                if (asPath !== pagePath) {
                    (buildManifest.pages[pagePath].staticPaths = buildManifest.pages[pagePath].staticPaths || []).push(asPath)
                }
            }
        }

        for (const name of lazyComponents) {
            const componentChunk = chunks.get('components/' + name)!
            buildManifest.components[name] = { hash: componentChunk.hash }
        }

        await fs.writeFile(path.join(buildDir, '_post/build-manifest.js'), 'window.__POST_BUILD_MANIFEST = ' + JSON.stringify(buildManifest))
        await fs.remove(this.outputDir)
        await fs.copy(buildDir, this.outputDir, { recursive: true })

        if (warnings.length > 0) {
            warnings.forEach(msg => console.warn(msg))
        }

        return buildManifest
    }

    async ssr() {
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
                        const mod = r(key)
                        const component = utils.isComponent(mod.default, 'page')
                        const staticMethods = ['getStaticProps', 'getStaticPaths']
                        staticMethods.forEach(name => {
                            if (typeof mod[name] === 'function' && typeof component[name] !== 'function') {
                                component[name] = mod[name]
                            }
                        })
                        return component
                    }
                }
            })

            ${hasComponentsDir ? 'r2.keys().filter(isValidName).forEach(each)' : ''}
            function each(key) {
                const name = key.replace(/^[.]+\\//, '').replace(/\\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-')
                components[name] = {
                    rawRequest: './components/' + key.replace(/^[./]+/, ''),
                    reqComponent: () => {
                        return utils.isComponent(component)
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
        const renderRet = { hash, warnings, startTime, endTime, pages: {} as Record<string, Array<RenderedPage>>, lazyComponents: [] as Array<string> }

        if ('/_app' in pages) {
            this.update(hash, pages['/_app'].reqComponent())
        }

        for (const pagePath of Object.keys(pages).filter(pagePath => pagePath !== '/_app')) {
            const pageName = pagePath.replace(/^\/+/, '') || 'index'
            const pagePaths = new Set([pagePath])
            const pageComponent = pages[pagePath].reqComponent()
            const getStaticPaths = pageComponent['getStaticPaths']

            if (utils.isFunction(getStaticPaths)) {
                const v = await getStaticPaths()
                if (utils.isNEArray(v)) {
                    v.filter(utils.isNEString).forEach(v => pagePaths.add(utils.cleanPath(v)))
                }
            }
            renderRet.pages[pagePath] = renderRet.pages[pagePath] || []

            for (const asPath of pagePaths) {
                const params = {}
                if (asPath !== pagePath) {
                    const [r, ok] = matchPath(pagePath, asPath)
                    if (!ok) {
                        console.log(`bad static path '${asPath}' of page '${pageName}'`)
                        continue
                    }
                    Object.assign(params, r)
                }
                const url = { pagePath, asPath, params, query: {} }
                const { staticProps, html } = await this.renderPage(url, pageComponent)
                const head = renderHeadToString()
                renderRet.pages[pagePath].push({ url, staticProps, html, head })
            }
        }

        renderRet.lazyComponents = Object.keys(components).filter(name => activatedLazyComponents.has(name))
        activatedLazyComponents.clear()

        return renderRet
    }

    async renderPage(
        url: URL,
        PageComponent: React.ComponentType
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

        const el = createElement(
            RouterContext.Provider,
            { value: new RouterStore(url) },
            createElement(
                this.component || Fragment,
                await this.getStaticProps(),
                createElement(
                    PageComponent,
                    staticProps
                )
            )
        )

        return {
            html: renderToString(el),
            staticProps
        }
    }

    async requirePage(pagePath: string) {
        const { chunks } = await new Compiler(this.srcDir, `
            const { utils } = require('@postjs/core')

            exports.reqComponent = () => {
                const mod = require('./pages${pagePath}')
                const component = utils.isComponent(mod.default, 'page')
                const staticMethods = ['getStaticProps', 'getStaticPaths']
                staticMethods.forEach(name => {
                    if (typeof mod[name] === 'function' && typeof component[name] !== 'function') {
                        component[name] = mod[name]
                    }
                })
                return component
            }
        `, {
            isServer: true,
            externals: Object.keys(peerDeps)
        }).compile()
        const { content: js, css } = chunks.get('main')!
        const { reqComponent } = runJS(js, peerDeps)
        return { reqComponent, css }
    }
}
