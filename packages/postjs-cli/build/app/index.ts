import { AppContext, RouterContext, RouterStore, URL, utils } from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import React, { ComponentType, createElement, Fragment } from 'react'
import { renderToString } from 'react-dom/server'
import { colorful } from '../../shared/colorful'
import { callGetStaticProps, createHtml, matchPath, runJS } from '../utils'
import { Compiler } from '../webpack'
import { AppConfig, loadAppConfig } from './config'
import './router'

const activatedLazyComponents = new Set<string>()
const headElements = new Map<string, { type: string, props: any }>()
Object.assign(global, { activatedLazyComponents, headElements })

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
                        { (window['__POST_APP'] =  window['__POST_APP'] || {}).config = ${JSON.stringify(this._publicConfig)} }
                        { (window['__POST_SSR_DATA'] =  window['__POST_SSR_DATA'] || {})[url.asPath] = { staticProps } }

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

    private get _publicConfig() {
        const { lang, locales, baseUrl } = this.config
        return { lang, locales, baseUrl }
    }

    private get _peerDependencies() {
        const peerDependencies: Record<string, any> = {
            'react': require('react'),
            'react-dom': require('react-dom'),
            '@postjs/core': require('@postjs/core')
        }
        if (this.config.useStyledComponents) {
            peerDependencies['styled-components'] = require('styled-components')
        }
        return peerDependencies
    }

    async build() {
        const { rootDir, lang, useSass, useStyledComponents, browserslist, polyfillsMode } = this.config
        const { customApp, pages: ssrPages, lazyComponents } = await this.renderAll()
        const compiler = new Compiler(
            this.srcDir,
            Object.keys(ssrPages).reduce((entries, pagePath) => {
                const pageName = pagePath.replace(/^\/+/, '') || 'index'
                const fullPath = path.join(this.srcDir, 'pages', pagePath)
                entries[`pages/${pageName}`] = `
                    const { utils } = require('@postjs/core');
                    (window.__POST_PAGES = window.__POST_PAGES || {})['${pagePath}'] = {
                        path: '${pagePath}',
                        Component: (() => {
                            const mod = require(${JSON.stringify(fullPath)})
                            const component = utils.isComponentModule(mod, 'page')
                            component.hasGetStaticPropsMethod = typeof mod['getStaticProps'] === 'function' || typeof component['getStaticProps'] === 'function'
                            return component
                        })()
                    }
                `
                return entries
            }, lazyComponents.reduce((entries, name) => {
                const fullPath = path.join(this.srcDir, 'components', name)
                entries[`components/${name}`] = `
                    const { utils } = require('@postjs/core');
                    (window.__POST_COMPONENTS = window.__POST_COMPONENTS || {})['${name}'] = {
                        name: '${name}',
                        Component: utils.isComponentModule(require(${JSON.stringify(fullPath)}))
                    }
                `
                return entries
            }, {
                app: customApp ? `
                    const { utils } = require('@postjs/core');
                    (window.__POST_APP = window.__POST_APP || {}).Component = utils.isComponentModule(require('./pages/_app'), 'app')
                ` : '',
                main: this.entryJS
            })),
            {
                isProduction: true,
                useSass,
                useStyledComponents,
                browserslist,
                polyfillsMode
            }
        )

        const { hash, chunks, warnings, errors, startTime, endTime } = await compiler.compile()
        const buildManifest = { hash, warnings, errors, startTime, endTime, pages: {} as Record<string, any>, components: {} as Record<string, any> }
        const buildDir = path.join(rootDir, '.post/builds', hash)
        const publicDir = path.join(rootDir, 'public')

        for (const chunk of chunks.values()) {
            const filepath = path.join(buildDir, '_post', `${chunk.name}.js`)
            const content = chunk.css ? `(function(d){var h=d.head;if(!h.querySelector('style[data-post-style=${JSON.stringify(chunk.name)}]'))` +
                `{var e=d.createElement("style");e.setAttribute("data-post-style",${JSON.stringify(chunk.name)});` +
                `e.innerText=${JSON.stringify(chunk.css.trim())};h.appendChild(e)}})(window.document);${chunk.content}` : chunk.content
            await fs.ensureDir(path.dirname(filepath))
            if (chunk.name === 'app') {
                await fs.writeFile(filepath, `(window.__POST_APP=window.__POST_APP||{}).staticProps=${JSON.stringify(customApp.staticProps)};${content}`)
            } else {
                await fs.writeFile(filepath, content)
            }
        }

        for (const pagePath of Object.keys(ssrPages)) {
            const pageName = pagePath.replace(/^\/+/, '') || 'index'
            buildManifest.pages[pagePath] = {
                name: pageName,
                hash: chunks.get('pages/' + pageName)!.hash
            }
            for (const ssrPage of ssrPages[pagePath]) {
                const { url, staticProps, html, head, styledTags } = ssrPage
                const { asPath } = url
                const asName = asPath.replace(/^\/+/, '') || 'index'
                const depth = asName.split('/').length - 1
                const htmlFile = path.join(buildDir, asName + '.html')
                const exposedChunks = Array.from(chunks.values()).filter(({ name }) => !(/^(pages|components)\//.test(name)) || name === 'pages/' + pageName)
                await fs.ensureDir(path.dirname(htmlFile))
                await fs.writeFile(htmlFile, createHtml({
                    lang,
                    head: head.concat('<meta name="post-head-end" content="true" />'),
                    styles: [
                        ...exposedChunks.map(({ name, css }) => ({ 'data-post-style': name, content: css || '' })),
                        { plain: true, content: styledTags }
                    ],
                    scripts: [
                        { type: 'application/json', id: 'ssr-data', innerText: JSON.stringify({ url, staticProps }) },
                        { src: '../'.repeat(depth) + `_post/build-manifest.js?v=${hash}`, async: true },
                        ...exposedChunks.map(({ name, hash }) => ({ src: '../'.repeat(depth) + `_post/${name}.js?v=${hash}`, async: true }))
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
        if (fs.existsSync(publicDir)) {
            await fs.copy(publicDir, buildDir, { recursive: true })
        }
        await fs.copy(buildDir, this.outputDir, { recursive: true })

        return buildManifest
    }

    async renderAll() {
        const { useSass, useStyledComponents } = this.config
        const compiler = new Compiler(this.srcDir, `
            const { utils } = require('@postjs/core')
            const r = require.context('./pages', true, /\\.(jsx?|mjs|tsx?)$/i)
            const pages = {}

            r.keys().filter(key => /^[a-z0-9/.$*_~ -]+$/i.test(key)).forEach(key => {
                const pagePath = key.replace(/^[.]+/, '').replace(/(\\/index)?\\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-') || '/'
                pages[pagePath] = {
                    rawRequest: './pages/' + key.replace(/^[./]+/, ''),
                    Component: utils.isComponentModule(r(key), 'page', ['getStaticProps', 'getStaticPaths'])
                }
            })

            exports.pages = pages
        `, {
            isServer: true,
            useSass,
            useStyledComponents,
            externals: Object.keys(this._peerDependencies)
        })
        const { chunks, hash, warnings, startTime, endTime } = await compiler.compile()
        const { pages } = runJS(chunks.get('main')!.content, this._peerDependencies)

        type RenderedPage = { url: URL, staticProps: any, html: string, head: string[], styledTags: string }
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
            App = pages['/_app'].Component
            renderRet.customApp = { staticProps: await callGetStaticProps(App, this._publicConfig) }
        }

        for (const pagePath of Object.keys(pages).filter(pagePath => pagePath !== '/_app')) {
            const pageName = pagePath.replace(/^\/+/, '') || 'index'
            const pagePaths = new Set([pagePath])
            const PageComponent = pages[pagePath].Component
            const getStaticPaths = PageComponent['getStaticPaths']

            if (utils.isFunction(getStaticPaths)) {
                const v = await getStaticPaths()
                if (utils.isNEArray(v)) {
                    v.filter(utils.isNEString).forEach(v => pagePaths.add(utils.cleanPath(v)))
                }
            }

            renderRet.pages[pagePath] = []
            for (const asPath of pagePaths) {
                const url = { pagePath, asPath, params: {}, query: {} }
                if (asPath !== pagePath) {
                    const [params, ok] = matchPath(pagePath, asPath)
                    if (!ok) {
                        console.log(`invalid static path '${asPath}' of page '${pageName}'`)
                        continue
                    }
                    url.params = params
                }
                const { staticProps, html, head, styledTags } = await this._renderPage(App, renderRet.customApp?.staticProps, PageComponent, url)
                renderRet.pages[pagePath].push({ url, staticProps, html, head, styledTags })
            }
        }

        renderRet.lazyComponents = Array.from(activatedLazyComponents)
        activatedLazyComponents.clear()

        return renderRet
    }

    async getStaticProps() {
        const { useSass, useStyledComponents } = this.config
        const compiler = new Compiler(this.srcDir, `
            const { utils } = require('@postjs/core')
            const r = require.context('./pages', false, /\\.\\/_app\\.(jsx?|mjs|tsx?)$/i)

            exports.App = (() => {
                const rKeys = r.keys()
                if (rKeys.length === 1) {
                    return utils.isComponentModule(r(rKeys[0]), 'app', ['getStaticProps'])
                }
                return null
            })()
        `, {
            isServer: true,
            useSass,
            useStyledComponents,
            externals: Object.keys(this._peerDependencies)
        })
        const { chunks } = await compiler.compile()
        const { content: js } = chunks.get('main')!
        const { App } = runJS(js, this._peerDependencies)

        if (App) {
            return await callGetStaticProps(App, this._publicConfig)
        }
        return null
    }

    async renderPage(url: URL) {
        const { useSass, useStyledComponents } = this.config
        const compiler = new Compiler(this.srcDir, `
            const { utils } = require('@postjs/core')
            const r = require.context('./pages', false, /\\.\\/_app\\.(jsx?|mjs|tsx?)$/i)

            exports.App = (() => {
                const rKeys = r.keys()
                if (rKeys.length === 1) {
                    return utils.isComponentModule(r(rKeys[0]), 'app', ['getStaticProps'])
                }
                return null
            })()
            exports.PageComponent = utils.isComponentModule(require('./pages${url.pagePath}'), 'page', ['getStaticProps'])
        `, {
            isServer: true,
            useSass,
            useStyledComponents,
            externals: Object.keys(this._peerDependencies)
        })
        const { chunks } = await compiler.compile()
        const { content: js, css } = chunks.get('main')!
        const { App, PageComponent } = runJS(js, this._peerDependencies)

        let appStaticProps: any = null
        if (App) {
            appStaticProps = await callGetStaticProps(App, this._publicConfig)
        }

        const { staticProps, html, head, styledTags } = await this._renderPage(App || Fragment, appStaticProps, PageComponent, url)
        return { staticProps, html, head, styledTags, css }
    }

    private async _renderPage(
        App: React.ComponentType,
        appStaticProps: any,
        PageComponent: React.ComponentType,
        url: URL
    ) {
        const { lang, locales, baseUrl } = this.config
        const pageStaticProps: any = await callGetStaticProps(PageComponent, url)
        const sheet = (() => {
            if (this.config.useStyledComponents) {
                const { ServerStyleSheet } = require('styled-components')
                return new ServerStyleSheet()
            }
            return {
                collectStyles: (el: any) => el,
                getStyleTags: () => ''
            }
        })()
        const el = sheet.collectStyles(createElement(
            AppContext.Provider,
            {
                value: {
                    config: { lang, locales, baseUrl },
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
                        pageStaticProps
                    )
                )
            )
        ))

        let html: string = ''
        let head: string[] = []
        let styledTags: string = ''
        try {
            html = renderToString(el)
            head = getHeadTags()
            styledTags = sheet.getStyleTags()
        } catch (error) {
            const pageName = url.pagePath.replace(/^\/+/, '') || 'index'
            const msg = `render page '${pageName}' failed: ${error.message}`
            html = `<p><strong><code>500</code></strong><small>&nbsp;-&nbsp;</small><span>${msg}</span></p>`
            console.log(colorful(`[error] [ssr] ${msg}`, 'red'))
            console.log(colorful(error.stack, 'dim'))
        } finally {
            sheet.seal()
        }

        return {
            staticProps: pageStaticProps,
            html,
            head,
            styledTags
        }
    }
}

function getHeadTags(): string[] {
    const tags: string[] = []
    headElements.forEach(({ type, props }) => {
        if (type === 'title') {
            if (utils.isNEString(props.children)) {
                tags.push(`<title>${props.children}</title>`)
            } else if (utils.isNEArray(props.children)) {
                tags.push(`<title>${props.children.join('')}</title>`)
            }
        } else {
            const attrs = Object.keys(props)
                .filter(key => key !== 'children')
                .map(key => ` ${key}=${JSON.stringify(props[key])}`)
                .join('')
            if (utils.isNEString(props.children)) {
                tags.push(`<${type}${attrs}>${props.children}</${type}>`)
            } else if (utils.isNEArray(props.children)) {
                tags.push(`<${type}${attrs}>${props.children.join('')}</${type}>`)
            } else {
                tags.push(`<${type}${attrs} />`)
            }
        }
    })
    headElements.clear()
    return tags
}
