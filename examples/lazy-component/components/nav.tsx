import { Link } from '@postjs/core'
import React from 'react'
import '../style/nav.less'

export default function Nav() {
    return (
        <nav>
            <Link className="rocket" to="/story/$name" as="/story/rocket">🚀Rock&middot;et</Link>
            <br />
            <Link className="dinosaur" to="/story/$name" as="/story/dinosaur">🦕Dino&middot;saur</Link>
        </nav>
    )
}
