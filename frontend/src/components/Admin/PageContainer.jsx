import { motion } from 'framer-motion'

export default function PageContainer({ children, className = '' }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`p-6 space-y-6 ${className}`}
        >
            {children}
        </motion.div>
    )
}
