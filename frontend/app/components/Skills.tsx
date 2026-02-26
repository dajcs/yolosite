"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface Skill {
  name: string;
  level: number;
}

const technical: Skill[] = [
  { name: "Python", level: 85 },
  { name: "C / C++", level: 80 },
  { name: "Perl", level: 70 },
  { name: "AI / ML / LLMs", level: 75 },
  { name: "Network Engineering (RAN)", level: 95 },
  { name: "Docker / Linux", level: 75 },
  { name: "Git / CI", level: 70 },
];

const categories = [
  {
    title: "Protocols & Standards",
    items: ["GSM / WCDMA / LTE / 5G NR", "TCP/IP, HTTP, DNS", "XML, JSON", "GPS / SatCom"],
    color: "#209dd7",
  },
  {
    title: "AI & Data",
    items: ["Large Language Models", "NumPy / Pandas / Matplotlib", "Computer Vision", "Self-Driving Car algorithms"],
    color: "#ecad0a",
  },
  {
    title: "Tools",
    items: ["VS Code / Jupyter", "Blender (Python API)", "OSS / BSS platforms", "Ericsson NodeB / RNC / EVO"],
    color: "#753991",
  },
];

function Bar({ skill, delay }: { skill: Skill; delay: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref} className="mb-5">
      <div className="flex justify-between text-sm mb-1.5">
        <span style={{ color: "#e8edf5" }}>{skill.name}</span>
        <span style={{ color: "#888888" }}>{skill.level}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(32,157,215,0.12)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #209dd7, #753991)" }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${skill.level}%` } : {}}
          transition={{ duration: 0.8, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function Skills() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="skills" className="py-24 px-6">
      <div className="max-w-5xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#ecad0a" }}>
            Skills
          </p>
          <h2 className="text-4xl font-black" style={{ color: "#e8edf5" }}>
            Technical <span style={{ color: "#209dd7" }}>Expertise</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Skill bars */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {technical.map((s, i) => (
              <Bar key={s.name} skill={s} delay={0.1 + i * 0.07} />
            ))}
          </motion.div>

          {/* Category tags */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            {categories.map((cat) => (
              <div key={cat.title}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: cat.color }}>
                  {cat.title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((item) => (
                    <span
                      key={item}
                      className="text-xs px-3 py-1.5 rounded-full"
                      style={{
                        background: `${cat.color}18`,
                        color: cat.color,
                        border: `1px solid ${cat.color}35`,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
