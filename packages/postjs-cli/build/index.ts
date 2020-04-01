import * as React from 'react'
import * as ReactDom from 'react-dom'
import * as Postjs from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import { appEntry, getAppConfig } from './app'
import { html, renderPage, runJS, ssrStaticMethods } from './render'
import { Compiler } from './webpack'

export const peerDeps = {
    'react': React,
    'react-dom': ReactDom,
    '@postjs/core': Postjs
}

export default async (appDir: string) => {
    const appConfig = await getAppConfig(appDir)
    const { chunks: ssrChunks } = await new Compiler(appDir, `
        const r = require.context('./pages', true, /\\.(js|ts)x?$/i)
        const pages = {}

        r.keys().filter(key => /^[a-z0-9\\.\\/\\$\\-\\*_~ ]+$/i.test(key)).forEach(key => {
            const pagePath = key.replace(/^[\\.]+/, '').replace(/(\\/index)?\\.(js|ts)x?$/i, '').replace(/ /g, '-') || '/'
            pages[pagePath] = {
                reqPath: './pages/' + key.replace(/^[\\.\\/]+/, ''),
                component: () => {
                    const mod = r(key)
                    const component = mod.default || mod
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
        target: 'node',
        mode: 'production',
        externals: Object.keys(peerDeps)
    }).compile()
    const { pages } = runJS(ssrChunks.get('app')!.content, peerDeps)
    const { hash, chunks, warnings, errors, startTime, endTime } = await new Compiler(appDir, Object.keys(pages).reduce((entries, pagePath) => {
        const pageName = pagePath.replace(/^\/+/, '') || 'index'
        entries[`pages/${pageName}`] = `
            import component from '${path.join(appDir, pages[pagePath].reqPath)}'

            const exportAs = { path: '${pagePath}', component }
            if (!window.__POST_INITIAL_PAGE) {
                window.__POST_INITIAL_PAGE = exportAs
            }
            (window.__POST_PAGES = window.__POST_PAGES || {})['${pagePath}'] = exportAs
        `
        return entries
    }, { app: appEntry(appConfig.baseUrl) } as Record<string, string>), {
        mode: 'development',
        splitVendorChunk: true
        // enableTerser: true,
    }).compile()
    const buildManifest: Record<string, any> = { hash, warnings, errors, startTime, endTime, pages: {} }
    const buildDir = path.join(appDir, '.post/builds', hash)
    for (const chuck of chunks.values()) {
        const jsFile = path.join(buildDir, '_post', `${chuck.name}.js`)
        await fs.ensureDir(path.dirname(jsFile))
        await fs.writeFile(jsFile, chuck.content)
    }
    for (const pagePath of Object.keys(pages)) {
        const pageName = pagePath.replace(/^\/+/, '') || 'index'
        const url = { pagePath, pathname: pagePath, params: {}, query: {} }
        const { staticProps, helmet, body } = await renderPage(url, pages[pagePath].component())
        const htmlFile = path.join(buildDir, pageName + '.html')
        const dataJS = 'window.__POST_SSR_DATA = ' + JSON.stringify({ url, staticProps })
        await fs.ensureDir(path.dirname(htmlFile))
        await fs.writeFile(htmlFile, html({
            lang: appConfig.lang,
            body,
            helmet,
            scripts: [
                dataJS,
                { src: `_post/build-manifest.js?v=${hash}`, async: true },
                ...Array.from(chunks.values()).filter(({ name }) => !name.startsWith('pages/') || name === 'pages/' + pageName)
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