import React from 'react'
import { Link } from '@postjs/core'

export default function Nav() {
    return (
        <nav>
            <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/about">About</a></li>
            </ul>
        </nav>
    )
}
