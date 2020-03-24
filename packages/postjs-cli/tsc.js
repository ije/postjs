#!/usr/bin/env node
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

function tsc() {
    const sources = fs.readdirSync(path.join(__dirname, 'cli'))
        .filter(file => /^[^\.].+\.tsx?$/.test(file))
        .map(file => path.join('cli', file))

    console.log('🛠   Start compiling types...')
    spawn(
        path.join(__dirname, 'node_modules', '.bin', 'tsc'),
        [
            '--outDir', 'dist',
            '--baseUrl', __dirname,
            '--target', 'es2018',
            '--lib', 'es2020',
            '--module', 'commonjs',
            '--moduleResolution', 'node',
            '--jsx', 'react',
            '--allowSyntheticDefaultImports',
            '--esModuleInterop',
            '--alwaysStrict',
            '--strictNullChecks',
            '--noImplicitThis',
            '--noImplicitReturns',
            '--noUnusedLocals',
            '--removeComments',
            ...sources
        ],
        { stdio: 'inherit' }
    )
}

tsc()
