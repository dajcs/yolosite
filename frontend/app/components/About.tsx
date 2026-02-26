"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-black mb-1" style={{ color: "#ecad0a" }}>
        {value}
      </div>
      <div className="text-xs uppercase tracking-widest" style={{ color: "#888888" }}>
        {label}
      </div>
    </div>
  );
}

export default function About() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-5xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#ecad0a" }}>
            About Me
          </p>
          <h2 className="text-4xl font-black mb-6" style={{ color: "#e8edf5" }}>
            Where Telecom Meets <span style={{ color: "#209dd7" }}>Space & AI</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-5"
          >
            <p className="leading-relaxed" style={{ color: "#888888" }}>
              With over two decades of broad experience in ICT at Ericsson, I have engineered
              resilient radio access networks across Europe, Africa, and beyond — bridging
              2G, 3G, 4G and 5G technologies for operators including Vodafone, O2, T-Mobile,
              Swisscom and KPN.
            </p>
            <p className="leading-relaxed" style={{ color: "#888888" }}>
              In 2022 I stepped back to pursue a Master&rsquo;s in Space Technologies and Business
              at the University of Luxembourg, writing my thesis on using Large Language Models
              for space software testing. I also built the <em>Lens Flare Wizard</em> — a
              Python/Blender toolkit that generates synthetic training images for computer
              vision models.
            </p>
            <p className="leading-relaxed" style={{ color: "#888888" }}>
              Since 2025 I have been deepening my systems programming skills at 42 School
              Luxembourg, currently at level 9.70 with 87% of the Common Core completed,
              working in C, C++, and increasingly exploring AI/LLM engineering.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Stats */}
            <div
              className="rounded-2xl p-8 grid grid-cols-2 gap-8 mb-6"
              style={{ background: "#0a1a30", border: "1px solid rgba(32,157,215,0.15)" }}
            >
              <Stat value="20+" label="Years in ICT" />
              <Stat value="20+" label="Countries" />
              <Stat value="MSc" label="Space Technologies" />
              <Stat value="9.70" label="42 School Level" />
            </div>

            {/* Languages */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#0a1a30", border: "1px solid rgba(32,157,215,0.15)" }}
            >
              <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#ecad0a" }}>
                Languages
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: "#888888" }}>
                {[
                  ["Hungarian", "Native"],
                  ["English", "C2 Fluent"],
                  ["Romanian", "C2 Fluent"],
                  ["French", "B1"],
                  ["German", "B1"],
                ].map(([lang, level]) => (
                  <div key={lang} className="flex justify-between pr-4">
                    <span style={{ color: "#e8edf5" }}>{lang}</span>
                    <span>{level}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
