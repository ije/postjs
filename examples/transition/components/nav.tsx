import { NavLink, Transition } from '@postjs/core'
import React from 'react'

const linkStyle = { color: 'inherit', fontSize: 18, textDecoration: 'none', opacity: 0.9 }
const linkActiveStyle = { borderBottom: '1px solid rgba(255,255,255,0.75)' }
const dotStyle = { padding: '0 9px', opacity: 0.5, fontSize: 18 }
const fade = Transition.fade(900)

export default function Nav() {
    return (
        <nav style={{ margin: 50 }}>
            <NavLink to="/r" style={linkStyle} activeStyle={linkActiveStyle} effect={fade}>R</NavLink>
            <span style={dotStyle}>&middot;</span>
            <NavLink to="/g" style={linkStyle} activeStyle={linkActiveStyle} effect={fade}>G</NavLink>
            <span style={dotStyle}>&middot;</span>
            <NavLink to="/b" style={linkStyle} activeStyle={linkActiveStyle} effect={fade}>B</NavLink>
        </nav>
    )
}
