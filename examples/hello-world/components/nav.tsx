import { Link } from '@postjs/core'
import React from 'react'

export default function Nav() {
    return (
        <nav>
            <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/about">About</Link></li>
                <li><Link to="/contact">Contact</Link></li>
            </ul>
        </nav>
    )
}
