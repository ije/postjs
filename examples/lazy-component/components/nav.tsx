import { Link } from '@postjs/core'
import React from 'react'
import '../style/nav.less'

export default function Nav() {
    return (
        <nav>
            <Link to="/story/rocket" className="rocket" >🚀Rock&middot;et</Link>
            <br />
            <Link to="/story/dinosaur" className="dinosaur">🦕Dino&middot;saur</Link>
        </nav>
    )
}
