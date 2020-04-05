import { Link } from '@postjs/core'
import React, { PropsWithChildren } from 'react'
import '../style/app.less'

export function getStaticProps() {
    return {
        name: 'postjs'
    }
}

export default function APP({ name, children }: PropsWithChildren<{ name: string }>) {
    return (
        <div className="app">
            <header>
                <h1>- {name}</h1>
                <nav>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/about">About</Link></li>
                    </ul>
                </nav>
            </header>
            {children /* page */}
        </div>
    )
}
