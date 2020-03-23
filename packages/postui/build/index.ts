import * as React from 'react'
import * as ReactDom from 'react-dom'
import fs from 'fs-extra'
import path from 'path'
import fetch from 'node-fetch'
import { renderPage } from './renderer'
import { Compiler } from './webpack'
import * as Head from '../framework/head'
import * as Router from '../framework/router'
import * as Link from '../framework/link'
import utils from '../shared/utils'

const peerDeps = {
    'postui/head': Head,
    'postui/router': Router,
    'postui/link': Link,
    'react': React,
    'react-dom': ReactDom
}

Object.assign(globalThis, {
    fetch
})

export default async function (dir: string) {
    dir = path.resolve(dir)
    if (!fs.existsSync(dir)) {
        console.error(`no such directory: ${dir}`)
        process.exit(0)
    }

    const ret = await new Compiler(dir, `
        const req = require.context('./pages', true, /\\.(js|ts)x?$/i)
        const pages = {}

        req.keys().forEach(path => {
            const name = path.replace(/^\\.+/, '').replace(/(\\/index)?\\.(js|ts)x?$/i, '') || '/'
            pages[name] = () => req(path).default
        })

        exports.pages = pages
    `, {
        mode: 'development',
        target: 'node',
        externals: Object.keys(peerDeps)
    }).compile()
    const { pages } = run(ret.chuncks.app, peerDeps)
    // const routes = Object.keys(pages).map(path => ({
    //     path: '/' + path.split('/')
    //         .map(p => p.trim().replace(/^\$/, ':'))
    //         .filter(p => p.length > 0)
    //         .join('/'),
    //     component: pages[path]()
    // } as Router.Route))
    // console.log(routes)
    Object.keys(pages).map(path => {
        const component = pages[path]()
        renderPage(new Router.Router(), component)
    })
}

function run(source: string, deps: Record<string, any>) {
    const exports: { [key: string]: any } = {}
    new Function('require', 'exports', 'module', source)((name: string) => deps[name], exports)
    return exports
}
