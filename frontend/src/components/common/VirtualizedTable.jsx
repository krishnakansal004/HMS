import { useState, useMemo } from 'react'

/**
 * Reusable Virtualized Table component to render only visible items in the viewport
 * while preserving standard table layout and column alignments.
 * 
 * @param {object} props
 * @param {Array<any>} props.items The list of items to render
 * @param {number} props.rowHeight Height of each individual row in pixels
 * @param {number} props.viewportHeight Height of the scroll container in pixels
 * @param {function(any, number): React.ReactNode} props.renderRow Function to render each item row
 * @param {React.ReactNode} props.headers The thead elements to render (tr / th)
 * @param {number} props.colSpan The number of columns for spacer span
 * @param {string} props.className Optional table className
 */
export default function VirtualizedTable({ 
    items, 
    rowHeight = 72, 
    viewportHeight = 400, 
    renderRow, 
    headers, 
    colSpan,
    className = ""
}) {
    const [scrollTop, setScrollTop] = useState(0)

    const handleScroll = (e) => {
        setScrollTop(e.currentTarget.scrollTop)
    }

    const { visibleItems, startIndex, endIndex } = useMemo(() => {
        const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4)
        const end = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 4)
        return {
            visibleItems: items.slice(start, end),
            startIndex: start,
            endIndex: end
        }
    }, [items, scrollTop, rowHeight, viewportHeight])

    const paddingTop = startIndex * rowHeight
    const paddingBottom = Math.max(0, (items.length - endIndex) * rowHeight)

    return (
        <div 
            onScroll={handleScroll}
            className="overflow-y-auto w-full relative"
            style={{ height: viewportHeight }}
        >
            <table className={`w-full text-left border-collapse ${className}`}>
                <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {headers}
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {paddingTop > 0 && (
                        <tr>
                            <td style={{ height: paddingTop }} colSpan={colSpan} />
                        </tr>
                    )}
                    {visibleItems.map((item, index) => renderRow(item, startIndex + index))}
                    {paddingBottom > 0 && (
                        <tr>
                            <td style={{ height: paddingBottom }} colSpan={colSpan} />
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
