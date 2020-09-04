import React from 'react'
import { RouterContext, RouterURL } from './router.ts'
import ReactDomServer from './vendor/react-dom/server.js'
export { renderHead } from './head.ts'

export function renderPage(
    url: RouterURL,
    App: { Component: React.ComponentType, staticProps: any } | undefined,
    Page: { Component: React.ComponentType, staticProps: any },
) {
    const El = React.createElement(
        RouterContext.Provider,
        { value: url },
        React.createElement(
            Page.Component,
            Page.staticProps
        )
    )
    const html = ReactDomServer.renderToString(App ? React.createElement(App.Component, App.staticProps, El) : El)
    return html
}
