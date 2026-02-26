"use client";

import { motion } from "framer-motion";
import { ArrowDown, Linkedin, Mail } from "lucide-react";

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#209dd7 1px, transparent 1px), linear-gradient(90deg, #209dd7 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Accent glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-10"
        style={{ background: "radial-gradient(circle, #209dd7, #753991)" }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Eyebrow */}
        <motion.p
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-semibold tracking-[0.25em] uppercase mb-6"
          style={{ color: "#ecad0a" }}
        >
          Luxembourg &bull; ICT &bull; Space &bull; AI
        </motion.p>

        {/* Name */}
        <motion.h1
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl sm:text-7xl font-black tracking-tight mb-4"
          style={{ color: "#e8edf5" }}
        >
          Attila{" "}
          <span style={{ color: "#209dd7" }}>Nemet</span>
        </motion.h1>

        {/* Title */}
        <motion.p
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl font-light mb-8"
          style={{ color: "#888888" }}
        >
          ICT Professional &middot; Space Technologies Master &middot; 42 School
        </motion.p>

        {/* Tagline */}
        <motion.p
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ color: "#888888" }}
        >
          20+ years engineering resilient telecom networks across 4 continents.
          Now expanding into space technologies, AI, and systems programming.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-4 justify-center mb-14"
        >
          <a
            href="#career"
            className="px-8 py-3 rounded-full font-semibold text-sm transition-all duration-200 hover:opacity-90 hover:scale-105"
            style={{ background: "#209dd7", color: "white" }}
          >
            View My Journey
          </a>
          <a
            href="#contact"
            className="px-8 py-3 rounded-full font-semibold text-sm border transition-all duration-200 hover:opacity-90 hover:scale-105"
            style={{
              border: "1px solid #753991",
              color: "#753991",
            }}
          >
            Get in Touch
          </a>
        </motion.div>

        {/* Social icons */}
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          className="flex gap-6 justify-center mb-16"
        >
          <a
            href="https://www.linkedin.com/in/attilanemet"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[#209dd7]"
            style={{ color: "#888888" }}
            aria-label="LinkedIn"
          >
            <Linkedin size={22} />
          </a>
          <a
            href="mailto:attila.nemet@gmail.com"
            className="transition-colors hover:text-[#209dd7]"
            style={{ color: "#888888" }}
            aria-label="Email"
          >
            <Mail size={22} />
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.a
        href="#about"
        initial={false}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{ delay: 1, duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        style={{ color: "#ecad0a" }}
        aria-label="Scroll down"
      >
        <ArrowDown size={24} />
      </motion.a>
    </section>
  );
}
