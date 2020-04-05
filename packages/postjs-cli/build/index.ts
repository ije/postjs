import * as postjs from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import * as React from 'react'
import * as ReactDom from 'react-dom'
import utils from '../shared/utils'
import { craeteAppEntry, loadAppConfig } from './app'
import { html, renderPage, runJS, ssrStaticMethods } from './ssr'
import { Compiler } from './webpack'

export const peerDeps = {
    'react': React,
    'react-dom': ReactDom,
    '@postjs/core': postjs
}

export default async (appDir: string) => {
    const appConfig = loadAppConfig(appDir)
    const { chunks: ssrChunks } = await new Compiler(path.join(appDir, appConfig.srcDir), `
        const React = require('react')
        const { isValidElementType } = require('react-is')
        const r = require.context('./pages', true, /\\.(jsx?|mjs|tsx?)$/i)
        const pages = {}

        r.keys().filter(key => /^[a-z0-9\\.\\/\\$\\-\\*_~ ]+$/i.test(key)).forEach(key => {
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

        exports.pages = pages
    `, {
        isServer: true,
        externals: Object.keys(peerDeps)
    }).compile()
    const { pages: ssrPages } = runJS(ssrChunks.get('main')!.content, peerDeps)
    const { hash, chunks, warnings, errors, startTime, endTime } = await new Compiler(path.join(appDir, appConfig.srcDir), Object.keys(ssrPages).reduce((entries, pagePath) => {
        const pageName = pagePath.replace(/^\/+/, '') || 'index'
        const fullPath = path.join(appDir, appConfig.srcDir, ssrPages[pagePath].rawRequest)
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
                    path: ${JSON.stringify(pagePath)},
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
                (window.__POST_PAGES = window.__POST_PAGES || {})[${JSON.stringify(pagePath)}] = exportAs
            `
        }
        return entries
    }, { main: craeteAppEntry(appConfig) } as Record<string, string>), {
        isProduction: true,
        splitVendorChunk: true,
        babelPresetEnv: {
            targets: appConfig.browserslist,
            useBuiltIns: appConfig.polyfillsMode
        }
    }).compile()
    const buildManifest: Record<string, any> = { hash, warnings, errors, startTime, endTime, pages: {} }
    const buildDir = path.join(appDir, '.post/builds', hash)
    for (const chuck of chunks.values()) {
        const jsFile = path.join(buildDir, '_post', `${chuck.name}.js`)
        await fs.ensureDir(path.dirname(jsFile))
        await fs.writeFile(jsFile, chuck.content)
    }

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

    for (const pagePath of Object.keys(ssrPages).filter(p => p !== '/_app')) {
        const pageName = pagePath.replace(/^\/+/, '') || 'index'
        const pageChunk = chunks.get('pages/' + pageName)!
        const url = { pagePath, pathname: pagePath, params: {}, query: {} }
        const { staticProps, head, body } = await renderPage(APP, appStaticProps, url, ssrPages[pagePath].reqComponent())
        const htmlFile = path.join(buildDir, pageName + '.html')
        await fs.ensureDir(path.dirname(htmlFile))
        await fs.writeFile(htmlFile, html({
            lang: appConfig.lang,
            head: head.length > 0 ? head.concat('<meta name="post-head-end" content="true" />') : head,
            styles: Array.from(chunks.values()).filter(({ css }) => Boolean(css)).map(({ name, css }) => ({ 'data-post-style': name, content: css! })),
            scripts: [
                { type: 'application/json', id: 'ssr-data', innerText: JSON.stringify({ url, staticProps, appStaticProps }) },
                ...Array.from(chunks.values())
                    .filter(({ name }) => !name.startsWith('pages/') || name === 'pages/' + pageName)
                    .map(({ name, hash }) => ({ src: `_post/${name}.js?v=${hash}`, async: true }))
            ],
            body
        }))
        if (staticProps !== null) {
            const dataFile = path.join(buildDir, '_post/pages', pageName + '.json')
            await fs.ensureDir(path.dirname(dataFile))
            await fs.writeJSON(dataFile, { staticProps })
        }
        buildManifest.pages[pagePath] = {
            name: pageName,
            hash: pageChunk.hash
        }
    }
    await fs.writeJSON(path.join(buildDir, 'build-manifest.json'), buildManifest)
    await fs.remove(path.join(appDir, 'dist'))
    await fs.copy(buildDir, path.join(appDir, 'dist'), { recursive: true })

    if (warnings.length > 0) {
        warnings.forEach(warning => console.log(warning))
    }
    console.log('done', hash)
}
