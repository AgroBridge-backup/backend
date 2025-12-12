import React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delay: 0.5,
      duration: 0.8,
      when: "beforeChildren",
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: [0.45, 0.05, 0.55, 0.95],
    },
  },
};

const buttonVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.8,
      delay: 0.6,
      type: 'spring',
      stiffness: 200,
      damping: 20,
    },
  },
};

export function GlassMorphUI() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{
        pointerEvents: 'auto',
        background: "rgba(10, 14, 26, 0.6)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        borderRadius: "24px",
        padding: "48px",
        width: "clamp(300px, 90vw, 500px)",
        color: "#fff",
        textAlign: 'center',
      }}
    >
      <motion.h1
        variants={itemVariants}
        style={{ fontSize: "3rem", textShadow: "0 2px 24px #00f5ff", margin: 0 }}
      >
        AgroBridge
      </motion.h1>
      <motion.p
        variants={itemVariants}
        style={{ marginTop: '1rem', marginBottom: '2rem', fontSize: '1.2rem', opacity: 0.8 }}
      >
        Conectando la agricultura con blockchain
      </motion.p>
      <motion.button
        variants={buttonVariants}
        whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(102, 126, 234, 0.5)" }}
        whileTap={{ scale: 0.95 }}
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          border: "none",
          padding: "18px 48px",
          borderRadius: "32px",
          fontSize: "1.5rem",
          color: "#fff",
          cursor: 'pointer',
        }}
      >
        Comenzar
      </motion.button>
    </motion.div>
  );
}