const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const watch = process.argv.includes('--watch')
const getSources = dir => fs.readdirSync(path.join(__dirname, dir))
    .filter(file => /\.tsx?$/.test(file))
    .map(file => path.join(dir, file))

spawn(
    path.join(__dirname, 'node_modules', '.bin', 'tsc'),
    [
        '--outDir', 'dist',
        '--baseUrl', '.',
        '--target', 'es2015',
        '--lib', 'es2020,dom,dom.iterable,webworker.importscripts,scripthost',
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
        '--declaration',
        '--declarationDir', path.join(__dirname, 'typings'),
        watch && '--watch',
        ...getSources('framework')
    ].filter(Boolean),
    { stdio: 'inherit' }
)
