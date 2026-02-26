"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { GraduationCap } from "lucide-react";

const education = [
  {
    degree: "MSc Space Technologies and Business",
    institution: "University of Luxembourg",
    period: "2022 — 2024",
    details: [
      "Thesis: LLMs for space software testing",
      "Lens Flare Wizard: Python/Blender toolkit for CV training data augmentation",
      "Modules: SatCom, Computer Vision, Space Robotics, Space Informatics, Business Economics",
    ],
    color: "#209dd7",
    wide: false,
  },
  {
    degree: "School 42 — Common Core",
    institution: "42 Luxembourg",
    period: "2025 — present",
    details: [
      "Level 9.70 · Selected March 2025 · Started June 2025",
      "Projects: Libft, minishell, miniRT, webserv, Inception, ft_transcendence",
      "Skills: C, C++, Unix, Networking, Docker, algorithms, concurrent programming",
    ],
    color: "#ecad0a",
    wide: false,
  },
  {
    degree: "MSc Electronics & Telecommunications Engineering",
    institution: "Technical University of Cluj-Napoca, Romania",
    period: "Graduated 1991",
    details: [
      "Foundation in electronics, radio frequency engineering and telecommunications",
      "Basis for 20+ year career in network integration and optimization",
    ],
    color: "#753991",
    wide: true,
  },
];

const certifications = [
  "Ericsson Certified Associate — Radio Access Networks",
  "Self-Driving Car Nanodegree (Udacity)",
  "Machine Learning Engineer Nanodegree (Udacity)",
  "Deep Learning Foundations Nanodegree (Udacity)",
  "Machine Learning — Stanford University (Coursera)",
  "State Estimation & Localization for Self-Driving Cars (Coursera)",
  "LLM Engineering: Master AI, Large Language Models & Agents",
  "Andrej Karpathy — GPT Tokenizer & Reproducing GPT-2",
  "Blockchain Basics",
  "Motion Planning for Self-Driving Cars (Coursera)",
];

export default function Education() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="education" className="py-24 px-6" style={{ background: "#0a1a30" }}>
      <div className="max-w-5xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#ecad0a" }}>
            Education
          </p>
          <h2 className="text-4xl font-black" style={{ color: "#e8edf5" }}>
            Academic <span style={{ color: "#209dd7" }}>Background</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 mb-14">
          {education.map((edu, i) => (
            <motion.div
              key={edu.degree}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.1 }}
              className={`rounded-2xl p-8 group hover:border-opacity-40 transition-all${edu.wide ? " md:col-span-2" : ""}`}
              style={{
                background: "#0d2040",
                border: `1px solid ${edu.color}25`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${edu.color}20` }}
              >
                <GraduationCap size={20} style={{ color: edu.color }} />
              </div>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: edu.color }}>
                {edu.period}
              </span>
              <h3 className="text-lg font-bold mt-1 mb-1" style={{ color: "#e8edf5" }}>
                {edu.degree}
              </h3>
              <p className="text-sm mb-4" style={{ color: "#888888" }}>
                {edu.institution}
              </p>
              <ul className="space-y-1.5">
                {edu.details.map((d, j) => (
                  <li key={j} className="text-sm flex gap-2" style={{ color: "#888888" }}>
                    <span style={{ color: edu.color, flexShrink: 0 }}>&#8250;</span>
                    {d}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Certifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-5" style={{ color: "#ecad0a" }}>
            Certifications & Courses
          </p>
          <div className="flex flex-wrap gap-2">
            {certifications.map((c) => (
              <span
                key={c}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(32,157,215,0.08)",
                  color: "#888888",
                  border: "1px solid rgba(32,157,215,0.18)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
