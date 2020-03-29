import * as React from 'react'
import * as ReactDom from 'react-dom'
import * as Postjs from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import { appEntry, getAppConfig, pageComponentStaticMethods } from './app'
import { html, renderPage, runJS } from './render'
import { Compiler } from './webpack'

export const peerDeps = {
    'react': React,
    'react-dom': ReactDom,
    '@postjs/core': Postjs
}

export default async (appDir: string) => {
    const appConfig = await getAppConfig(appDir)
    const { chunks: chunksForNode } = await new Compiler(appDir, `
        const r = require.context('./pages', true, /\\.(js|ts)x?$/i)
        const pages = {}

        r.keys().forEach(key => {
            const pagePath = key.replace(/^\\.+/, '').replace(/(\\/index)?\\.(js|ts)x?$/i, '') || '/'
            pages[pagePath] = () => {
                const mod = r(key)
                const component = mod.default
                const staticMethods = ${JSON.stringify(pageComponentStaticMethods)}
                staticMethods.forEach(name => {
                    if (typeof mod[name] === 'function' && typeof component[name] !== 'function') {
                        component[name] = mod[name]
                    }
                })
                return component
            }
        })

        exports.pages = pages
    `, {
        target: 'node',
        mode: 'production',
        externals: Object.keys(peerDeps)
    }).compile()
    const { pages } = runJS(chunksForNode.get('app')!.content, peerDeps)
    const { hash, chunks, startTime, endTime } = await new Compiler(appDir, {
        app: appEntry(appConfig.baseUrl),
        pages_loader: Object.keys(pages)
            .map(pagePath => pagePath.replace(/^\/+/, '') || 'index')
            .map(pageName => `import(/* webpackChunkName: "pages/${pageName}" */ './pages/${pageName}')`)
            .join('\n')
    }, {
        mode: 'production',
        enableTerser: true,
        splitVendorChunk: true
    }).compile()
    const chunksArray = Array.from(chunks.values()).filter(({ name }) => name !== 'pages_loader')
    const buildManifest: Record<string, any> = { hash, pages: {}, startTime, endTime }
    const buildDir = path.join(appDir, '.post/builds', hash)
    for (const chuck of chunksArray) {
        const jsFile = path.join(buildDir, '_post', `${chuck.name}.js`)
        await fs.ensureDir(path.dirname(jsFile))
        await fs.writeFile(jsFile, chuck.content)
    }
    for (const pagePath of Object.keys(pages)) {
        const pageName = pagePath.replace(/^\/+/, '') || 'index'
        const url = { pagePath, pathname: pagePath, params: {}, query: {} }
        const { staticProps, helmet, body } = await renderPage(url, pages[pagePath]())
        const htmlFile = path.join(buildDir, pageName + '.html')
        const dataJS = 'window.__POST_SSR_DATA = ' + JSON.stringify({ url, staticProps })
        await fs.ensureDir(path.dirname(htmlFile))
        await fs.writeFile(htmlFile, html({
            lang: appConfig.lang,
            helmet,
            body,
            scripts: [
                dataJS,
                { src: `_post/build-manifest.js?v=${hash}`, async: true },
                ...chunksArray.filter(({ name }) => !name.startsWith('pages/') || name === 'pages/' + pageName)
                    .map(({ name, hash }) => ({ src: `_post/${name}.js?v=${hash}`, async: true }))
            ]
        }))
        if (staticProps !== null) {
            const dataFile = path.join(buildDir, '_post/data', pageName + '.json')
            await fs.ensureDir(path.dirname(dataFile))
            await fs.writeJSON(dataFile, { staticProps })
        }
        buildManifest.pages[pagePath] = {
            name: pageName,
            hash: chunks.get('pages/' + pageName)!.hash
        }
    }
    await fs.writeFile(path.join(buildDir, '_post/build-manifest.js'), 'window.__POST_BUILD_MANIFEST = ' + JSON.stringify(buildManifest))
    console.log('done', hash)
}
