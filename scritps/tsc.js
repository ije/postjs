#!/usr/bin/env node
const arg = require('arg')
const { spawn } = require('child_process')
const fs = require('fs-extra')
const path = require('path')

const root = path.join(__dirname, '../')
const { _: args } = arg({})

function tsc(name) {
    const sources = fs.readdirSync(path.join(root, name))
        .filter(file => !file.startsWith('.') && file.endsWith('.ts'))
        .map(file => path.join(name, file))

    console.log(`🛠   Start build ${name}...`)
    fs.remove(path.join(root, `dist/${name}`))
    spawn(
        path.join(root, 'node_modules', '.bin', 'tsc'),
        [
            '--outDir', `dist/${name}`,
            '--baseUrl', root,
            '--target', 'es2015',
            '--lib', 'es2020',
            '--module', 'commonjs',
            '--moduleResolution', 'node',
            '--allowSyntheticDefaultImports',
            '--esModuleInterop',
            '--alwaysStrict',
            '--strictNullChecks',
            '--noImplicitThis',
            '--noImplicitReturns',
            '--noUnusedLocals',
            '--skipLibCheck',
            '--removeComments',
            '--newLine', 'LF',
            ...sources
        ],
        { stdio: 'inherit' }
    )
}

args.forEach(tsc)
