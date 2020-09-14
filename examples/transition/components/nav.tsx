import { fadeIn, fadeOut, NavLink } from '@postjs/core'
import React, { PropsWithChildren } from 'react'

const linkStyle = { color: 'inherit', fontSize: 18, textDecoration: 'none', opacity: 0.9 }
const linkActiveStyle = { borderBottom: '1px solid rgba(255,255,255,0.75)' }
const dotStyle = { padding: '0 9px', opacity: 0.5, fontSize: 18 }
const transition = { enter: fadeIn(1200), exit: fadeOut(1200) }

function NLink({ to, children }: PropsWithChildren<{ to: string }>) {
    return (
        <NavLink
            to={to}
            style={linkStyle}
            activeStyle={linkActiveStyle}
            transition={transition}
        >{children}</NavLink>
    )
}

export default function Nav() {
    return (
        <nav style={{ margin: 50 }}>
            <NLink to="/r">R</NLink>
            <span style={dotStyle}>&middot;</span>
            <NLink to="/g">G</NLink>
            <span style={dotStyle}>&middot;</span>
            <NLink to="/b">B</NLink>
        </nav>
    )
}
