import fs from 'fs-extra'
import path from 'path'
import * as React from 'react'
import * as ReactDom from 'react-dom'
import render from './render'
import { Compiler } from './webpack'

const peerDeps = {
    'react': React,
    'react-dom': ReactDom
}

export default function (dir: string) {
    dir = path.resolve(dir)
    if (!fs.existsSync(dir)) {
        console.error(`no such directory: ${dir}`)
        process.exit(0)
    }

    const compiler = new Compiler(dir, 'production')
    compiler.compile(async (err, ret) => {
        if (err !== null) {
            console.log(err)
            return
        }

        const exports = {}
        new Function('window', 'module', 'exports', 'require', ret!.chuncks.app)({}, undefined, exports, (name: string) => peerDeps[name])
        render(exports['pages']['index']())
    })
}
