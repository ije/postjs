const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const getSources = dir => fs.readdirSync(path.join(__dirname, dir))
    .filter(file => /^[^\.].+\.tsx?$/.test(file))
    .map(file => path.join(dir, file))

spawn(
    path.join(__dirname, 'node_modules', '.bin', 'tsc'),
    [
        '--outDir', 'dist',
        '--baseUrl', __dirname,
        '--target', 'es2018',
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
        '--removeComments',
        ...getSources('cli')
    ],
    { stdio: 'inherit' }
)