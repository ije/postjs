import * as React from 'react'
import * as ReactDom from 'react-dom'
import * as Postjs from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import fetch from 'node-fetch'
import { renderPage } from './renderer'
import { Compiler } from './webpack'
import utils from '../shared/utils'

const peerDeps = {
    'react': React,
    'react-dom': ReactDom,
    '@postjs/core': Postjs
}

Object.assign(globalThis, {
    fetch
})

export default async function (dir: string) {
    const appDir = path.resolve(dir)
    if (!fs.existsSync(appDir)) {
        console.error(`no such directory: ${dir}`)
        process.exit(0)
    }

    const appConfig: Record<string, any> = {}
    const configJson = path.join(appDir, 'post.config.json')
    if (fs.existsSync(configJson)) {
        const config = await fs.readJSON(configJson)
        Object.assign(appConfig, config)
    }

    let appLang = 'en'
    if (/^[a-z]{2}(\-[a-z0-9]+)?$/i.test(appConfig.lang)) {
        appLang = appConfig.lang
    }

    const { hash, chuncks } = await new Compiler(appDir, `
        import React from 'react'
        import ReactDom from 'react-dom'
        import { Router } from '@postjs/core'

        const req = require.context('./pages', true, /\\.(js|ts)x?$/i)
        const routes = []

        if (!window.globalThis) {
            window.globalThis = window
        }

        req.keys().forEach(path => {
            const pathname = path.replace(/^\\.+/, '').replace(/(\\/index)?\\.(js|ts)x?$/i, '') || '/'
            routes.push({
                path:pathname,
                component: req(path).default
            })
        })

        ReactDom.hydrate((
            <Router
                base="${utils.cleanPath(encodeURI(appConfig.baseUrl))}"
                routes={routes}
            />
        ), document.querySelector('main'))
    `, {
        mode: 'production'
    }).compile()
    const serv = await new Compiler(appDir, `
        const req = require.context('./pages', true, /\\.(js|ts)x?$/i)
        const pages = {}

        req.keys().forEach(path => {
            const pathname = path.replace(/^\\.+/, '').replace(/(\\/index)?\\\.(js|ts)x?$/i, '') || '/'
            pages[pathname] = () => req(path).default
        })

        exports.pages = pages
    `, {
        mode: 'development',
        target: 'node',
        externals: Object.keys(peerDeps)
    }).compile()
    const { pages } = run(serv.chuncks.get('app')!.content, peerDeps)

    chuncks.forEach(async ({ name, content }) => {
        const jsFile = path.join(appDir, '.post/builds', hash, '_dist', `${name}.js`)
        await fs.ensureDir(path.dirname(jsFile))
        await fs.writeFile(jsFile, content)
    })
    Object.keys(pages).map(async p => {
        const renderRet = await renderPage({ routePath: p, pathname: p, params: {}, query: {} }, pages[p]())
        const htmlFile = path.join(appDir, '.post/builds', hash, `${p === '/' ? 'index' : p}.html`)
        await fs.ensureDir(path.dirname(htmlFile))
        await fs.writeFile(htmlFile, `<!DOCTYPE html>
<html lang="${appLang}">
<head>${renderRet.helmet}</head>
<body>
    <main>${renderRet.body}</main>
    <script src="./_dist/vendor.js?v=${chuncks.get('vendor')?.hash}"></script>
    <script src="./_dist/app.js?v=${chuncks.get('app')?.hash}"></script>
</body>
</html>`)
    })
    console.log('done', hash)
}

function run(source: string, deps: Record<string, any>) {
    const exports: { [key: string]: any } = {}
    new Function('require', 'exports', 'module', source)((name: string) => deps[name], exports)
    return exports
}
