"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ExternalLink } from "lucide-react";

const items = [
  {
    title: "Lens Flare Wizard",
    desc: "Python/Blender toolkit for generating synthetic training images with realistic lens flare effects. Developed as part of the Space Master scientific project to improve computer vision model robustness.",
    tags: ["Python", "Blender", "Computer Vision", "Data Augmentation"],
    color: "#209dd7",
    status: "Completed",
  },
  {
    title: "LLM Testing Framework",
    desc: "Master's thesis research: evaluating the feasibility of using Large Language Models to automate software testing in space systems contexts.",
    tags: ["LLM", "Software Testing", "Space Software", "Research"],
    color: "#ecad0a",
    status: "Published",
  },
  {
    title: "ft_transcendence",
    desc: "Full-stack web application built as part of the 42 School curriculum. Multiplayer Pong game with user authentication, real-time gameplay, and a chat system — built as a group project.",
    tags: ["TypeScript", "WebSockets", "Docker", "42 School"],
    color: "#753991",
    status: "In Progress",
  },
];

export default function Portfolio() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="portfolio" className="py-24 px-6" style={{ background: "#0a1a30" }}>
      <div className="max-w-5xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#ecad0a" }}>
            Portfolio
          </p>
          <h2 className="text-4xl font-black mb-3" style={{ color: "#e8edf5" }}>
            Selected <span style={{ color: "#209dd7" }}>Projects</span>
          </h2>
          <p className="text-sm" style={{ color: "#888888" }}>
            More projects coming as the portfolio grows.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.1 }}
              className="rounded-2xl p-7 flex flex-col group cursor-default transition-transform hover:-translate-y-1"
              style={{
                background: "#0d2040",
                border: `1px solid ${item.color}20`,
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-3 h-3 rounded-full mt-1"
                  style={{ background: item.color }}
                />
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: `${item.color}15`,
                    color: item.color,
                  }}
                >
                  {item.status}
                </span>
              </div>

              <h3 className="text-lg font-bold mb-3" style={{ color: "#e8edf5" }}>
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: "#888888" }}>
                {item.desc}
              </p>

              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: `${item.color}12`,
                      color: `${item.color}cc`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center"
        >
          <a
            href="https://www.linkedin.com/in/attilanemet"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[#209dd7]"
            style={{ color: "#888888" }}
          >
            See more on LinkedIn
            <ExternalLink size={14} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
