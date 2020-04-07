import * as postjs from '@postjs/core'
import { matchPath } from '@postjs/core/dist/router/route'
import fs from 'fs-extra'
import path from 'path'
import * as React from 'react'
import * as ReactDom from 'react-dom'
import utils from '../shared/utils'
import { craeteAppEntry, loadAppConfig } from './app'
import { html, renderPage, ssrStaticMethods } from './ssr'
import { runJS } from './utils'
import { Compiler } from './webpack'

export const peerDeps = {
    'react': React,
    'react-dom': ReactDom,
    '@postjs/core': postjs
}

export default async (appDir: string) => {
    const appConfig = loadAppConfig(appDir)
    const srcDir = path.join(appDir, appConfig.srcDir)
    const hasComponentsDir = fs.existsSync(path.join(srcDir, 'components'))
    const { chunks: ssrChunks } = await new Compiler(srcDir, `
        const React = require('react')
        const { isValidElementType } = require('react-is')
        const r = require.context('./pages', true, /\\.(jsx?|mjs|tsx?)$/i)
        ${hasComponentsDir ? '' : '// '}const r2 = require.context('./components', true, /\\.(jsx?|mjs|tsx?)$/i)
        const pages = {}
        const components = {}
        const filterFn = key => /^[a-z0-9\\.\\/\\$\\-\\*_~ ]+$/i.test(key)

        r.keys().filter(filterFn).forEach(key => {
            const pagePath = key.replace(/^[\\.]+/, '').replace(/(\\/index)?\\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-') || '/'
            pages[pagePath] = {
                rawRequest: './pages/' + key.replace(/^[\\.\\/]+/, ''),
                reqComponent: () => {
                    const mod = r(key)
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
            }
        })

        ${hasComponentsDir ? '' : '// '}r2.keys().filter(filterFn).forEach(each)
        function each(key) {
            const name = key.replace(/^[\\.]+\\//, '').replace(/\\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-')
            components[name] = {
                rawRequest: './components/' + key.replace(/^[\\.\\/]+/, ''),
                reqComponent: () => {
                    const {default: component} = r2(key)
                    if (component === undefined) {
                        return () => <p style={{color: 'red'}}>bad component: miss default export</p>
                    } else if (!isValidElementType(component)) {
                        return () => <p style={{color: 'red'}}>bad component: invalid element type</p>
                    }
                    return component
                }
            }
        }

        exports.pages = pages
        exports.components = components
    `, {
        isServer: true,
        externals: Object.keys(peerDeps)
    }).compile()
    const { pages: ssrPages, components: ssrComponents } = runJS(ssrChunks.get('main')!.content, peerDeps)
    const { hash, chunks, warnings, errors, startTime, endTime } = await new Compiler(srcDir, Object.keys(ssrPages).reduce((entries, pagePath) => {
        const pageName = pagePath.replace(/^\/+/, '') || 'index'
        const fullPath = path.join(srcDir, ssrPages[pagePath].rawRequest)
        if (pageName === '_app') {
            entries['app'] = `
                const React = require('react')
                const { isValidElementType } = require('react-is')

                const mod = require(${JSON.stringify(fullPath)})
                const component = mod.default
                if (component === undefined) {
                    component = () => <p style={{color: 'red'}}>bad app: miss default export</p>
                } else if (!isValidElementType(component)) {
                    component = () => <p style={{color: 'red'}}>bad app: invalid element type</p>
                }

                window.__POST_APP = component
            `
        } else {
            entries[`pages/${pageName}`] = `
                const React = require('react')
                const { isValidElementType } = require('react-is')

                const exportAs = {
                    path: '${pagePath}',
                    reqComponent:() => {
                        const mod = require(${JSON.stringify(fullPath)})
                        const component = mod.default
                        if (component === undefined) {
                            return () => <p style={{color: 'red'}}>bad page: miss default export</p>
                        } else if (!isValidElementType(component)) {
                            return () => <p style={{color: 'red'}}>bad page: invalid element type</p>
                        }
                        component.hasGetStaticPropsMethod = typeof mod['getStaticProps'] === 'function' || typeof component['getStaticProps'] === 'function'
                        return component
                    }
                }

                if (!window.__POST_INITIAL_PAGE) {
                    window.__POST_INITIAL_PAGE = exportAs
                }
                (window.__POST_PAGES = window.__POST_PAGES || {})['${pagePath}'] = exportAs
            `
        }
        return entries
    }, Object.keys(ssrComponents).reduce((entries, name) => {
        const fullPath = path.join(srcDir, ssrComponents[name].rawRequest)
        entries[`components/${name}`] = `
            const React = require('react')
            const { isValidElementType } = require('react-is')

            {(window.__POST_COMPONENTS = window.__POST_COMPONENTS || {})['${name}'] = {
                name: '${name}',
                style: '/*COMPONENT-STYLE*/',
                reqComponent:() => {
                    const { default: component } = require(${JSON.stringify(fullPath)})
                    if (component === undefined) {
                        return () => <p style={{color: 'red'}}>bad component: miss default export</p>
                    } else if (!isValidElementType(component)) {
                        return () => <p style={{color: 'red'}}>bad component: invalid element type</p>
                    }
                    return component
                }
            }}
        `
        return entries
    }, { main: craeteAppEntry(appConfig) })), {
        isProduction: true,
        splitVendorChunk: true,
        babelPresetEnv: {
            targets: appConfig.browserslist,
            useBuiltIns: appConfig.polyfillsMode
        }
    }).compile()

    let APP: React.ComponentType<any> = React.Fragment
    let appStaticProps: any = null
    if (chunks.has('app')) {
        APP = ssrPages['/_app'].reqComponent()
        if ('getStaticProps' in APP) {
            const getStaticProps = APP['getStaticProps'] as any
            if (typeof getStaticProps === 'function') {
                const props = await getStaticProps(appConfig)
                if (utils.isObject(props)) {
                    appStaticProps = props
                }
            }
        }
    }

    const buildManifest: Record<string, any> = { hash, warnings, errors, startTime, endTime, pages: {}, components: {} }
    const buildDir = path.join(appDir, '.post/builds', hash)

    for (const chuck of chunks.values()) {
        const jsFile = path.join(buildDir, '_post', `${chuck.name}.js`)
        await fs.ensureDir(path.dirname(jsFile))
        if (chuck.name.startsWith('components/')) {
            await fs.writeFile(jsFile, chuck.content.replace('"/*COMPONENT-STYLE*/"', JSON.stringify((chuck.css || '').trim())))
        } else {
            await fs.writeFile(jsFile, chuck.content)
        }
    }

    for (const pagePath of Object.keys(ssrPages).filter(p => p !== '/_app')) {
        const ssrPageComponent = ssrPages[pagePath].reqComponent()
        const getStaticPaths = ssrPageComponent['getStaticPaths']
        const pageName = pagePath.replace(/^\/+/, '') || 'index'
        const pageChunk = chunks.get('pages/' + pageName)!
        const buildInfo: Record<string, any> = {
            name: pageName,
            hash: pageChunk.hash
        }
        buildManifest.pages[pagePath] = buildInfo

        let pagePaths = new Set([pagePath])
        if (utils.isFunction(getStaticPaths)) {
            const a = await getStaticPaths()
            if (utils.isNEArray(a)) {
                a.filter(utils.isNEString).forEach(v => pagePaths.add(utils.cleanPath(v)))
            }
        }
        for (const asPath of pagePaths) {
            const params = {}
            if (asPath !== pagePath) {
                const [r, ok] = matchPath(pagePath, asPath)
                if (!ok) {
                    console.log(`bad static path '${asPath}' of page '${pageName}'`)
                    continue
                }
                (buildInfo.staticPaths = buildInfo.staticPaths || []).push(asPath)
                Object.assign(params, r)
            }
            const url = { pagePath, asPath, params, query: {} }
            const { staticProps, head, body } = await renderPage(APP, appStaticProps, url, ssrPageComponent)
            const asName = asPath.replace(/^\/+/, '') || 'index'
            const depth = asName.split('/').length - 1
            const htmlFile = path.join(buildDir, asName + '.html')
            await fs.ensureDir(path.dirname(htmlFile))
            await fs.writeFile(htmlFile, html({
                lang: appConfig.lang,
                head: head.length > 0 ? head.concat(['<meta name="post-head-end" content="true" />']) : head,
                styles: Array.from(chunks.values()).filter(({ css, name }) => css && !name.startsWith('components/')).map(({ name, css }) => ({ 'data-post-style': name, content: css! })),
                scripts: [
                    { type: 'application/json', id: 'ssr-data', innerText: JSON.stringify({ url, staticProps, appStaticProps }) },
                    { src: '../'.repeat(depth) + `_post/build-manifest.js?v=${hash}`, async: true },
                    ...Array.from(chunks.values())
                        .filter(({ name }) => !(/^(pages|components)\//.test(name)) || name === 'pages/' + pageName)
                        .map(({ name, hash }) => ({ src: '../'.repeat(depth) + `_post/${name}.js?v=${hash}`, async: true }))
                ],
                body
            }))
            if (staticProps !== null) {
                const dataFile = path.join(buildDir, '_post/pages', asName + '.json')
                await fs.ensureDir(path.dirname(dataFile))
                await fs.writeJSON(dataFile, { staticProps })
            }
        }
    }

    for (const name of Object.keys(ssrComponents)) {
        const componentChunk = chunks.get('components/' + name)!
        buildManifest.components[name] = {
            hash: componentChunk.hash
        }
    }

    await fs.writeFile(path.join(buildDir, '_post/build-manifest.js'), 'window.__POST_BUILD_MANIFEST = ' + JSON.stringify(buildManifest))
    await fs.remove(path.join(appDir, 'dist'))
    await fs.copy(buildDir, path.join(appDir, 'dist'), { recursive: true })

    if (warnings.length > 0) {
        warnings.forEach(warning => console.log(warning))
    }
    console.log('done', hash)
}
