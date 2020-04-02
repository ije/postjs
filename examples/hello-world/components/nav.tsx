import { fade, Link } from '@postjs/core'
import React from 'react'

export default function Nav() {
    return (
        <nav>
            <ul>
                <li><Link to="/" transition={fade(600)}>Home</Link></li>
                <li><Link to="/about" transition={fade(600)}>About</Link></li>
                <li>
                    <Link className="contact" style={{ color: 'grey' }} to="/contact">
                        <a className="link" style={{ textDecoration: 'none' }} onClick={() => console.log('contact clicked')}>Contact</a>
                    </Link>
                </li>
            </ul>
        </nav>
    )
}
