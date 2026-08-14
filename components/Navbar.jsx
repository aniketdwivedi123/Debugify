import React from 'react'

const Navbar = () => {
    return (
        <div className="nav flex items-center justify-between h-[90px] bg-zinc-900 text-white px-8">
            <div className="logo flex items-center gap-2 text-lg font-semibold">
                <span className="text-2xl">🤖</span>
                <span>Debugify</span>
            </div>
            <div className="icons">
                <span className="inline-flex items-center justify-center rounded-full bg-white p-2 text-zinc-900 cursor-pointer shadow-sm transition duration-200 ease-in-out hover:scale-110 hover:bg-zinc-100">
                    ☀️
                </span>
            </div>
        </div>
    )
}

export default Navbar
