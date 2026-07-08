import React, { useState, useEffect } from 'react'

export default function ChatbotEmbed() {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [headerOffset, setHeaderOffset] = useState(0)

  useEffect(() => {
    function onResize() {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches)
    }
    onResize()
    window.addEventListener('resize', onResize)
    // compute header offset so chatbot sits below header
    function updateHeaderOffset() {
      const hdr = document.querySelector('header')
      const h = hdr ? hdr.getBoundingClientRect().height : 0
      setHeaderOffset(Math.ceil(h))
    }
    updateHeaderOffset()
    window.addEventListener('resize', updateHeaderOffset)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('resize', updateHeaderOffset)
    }
  }, [])

  // Styles kept inline to avoid adding global CSS
  const iframeStyle = isMobile
    ? {
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: '0',
        zIndex: 9999,
        background: 'white'
      }
    : {
        position: 'fixed',
        right: 24,
        top: headerOffset ? headerOffset + 12 : 24,
        width: 380,
        height: 560,
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 10px 30px rgba(2,6,23,0.12)',
        zIndex: 9999,
        overflow: 'hidden'
      }

  const toggleBtnStyle = {
    position: 'fixed',
    right: 24,
    bottom: 24,
    zIndex: 10001,
    background: 'linear-gradient(180deg,#06b6d4,#0369a1)',
    color: 'white',
    border: 'none',
    width: 56,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    boxShadow: '0 8px 24px rgba(3,105,161,0.18)',
    cursor: 'pointer'
  }

  return (
    <>
      {!open && (
        <button
          title="Open chatbot"
          aria-label="Open chatbot"
          style={toggleBtnStyle}
          onClick={() => setOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 21l4-4H20a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v16z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}

      {open && (
        <div>
          <iframe
            title="HOSPITECHVERSE Chatbot"
            src="/chatbot.html"
            style={iframeStyle}
            allow="microphone; autoplay; clipboard-read; clipboard-write"
          />
          <button
            aria-label="Close chatbot"
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              right: isMobile ? 12 : 24,
              top: isMobile ? 12 : headerOffset ? headerOffset + 12 : 24,
              bottom: isMobile ? 'auto' : 'auto',
              zIndex: 10001,
              background: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: 'none',
              padding: '8px 10px',
              borderRadius: 8
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  )
}
