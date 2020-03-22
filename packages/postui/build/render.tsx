import * as React from 'react'
import { renderToString } from 'react-dom/server'

export default function (Component: React.ComponentType) {
    const html = renderToString(<Component />)
    console.log(`<html>
    <head></head>
    <body>
        ${html}
    </body>
</html>`)
}
