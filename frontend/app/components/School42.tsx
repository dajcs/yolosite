"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface Project {
  name: string;
  skills: string;
  result: string;
  date: string;
  hours: string;
}

const projects: Project[] = [
  { name: "Libft", skills: "Imperative programming, Algorithms", result: "Pass + bonus", date: "Jun 2025", hours: "70h" },
  { name: "get_next_line", skills: "Algorithms, Unix", result: "Pass + bonus", date: "Jun 2025", hours: "55h" },
  { name: "Born2beroot", skills: "System administration", result: "Pass + bonus", date: "Jun 2025", hours: "50h" },
  { name: "ft_printf", skills: "Algorithms, Variadic functions", result: "Pass + bonus", date: "Jul 2025", hours: "55h" },
  { name: "pipex", skills: "Imperative programming, Unix", result: "Pass + bonus", date: "Jul 2025", hours: "50h" },
  { name: "push_swap", skills: "Sorting algorithms", result: "Pass + bonus", date: "Jul 2025", hours: "50h" },
  { name: "FdF", skills: "Graphics, 3D wireframe rendering", result: "Pass + bonus", date: "Jul 2025", hours: "60h" },
  { name: "Philosophers", skills: "Concurrent programming, threading", result: "Pass + bonus", date: "Jul 2025", hours: "70h" },
  { name: "minishell", skills: "Shell implementation, parsing", result: "Pass", date: "Sep 2025", hours: "210h" },
  { name: "miniRT", skills: "Raytracing, Graphics", result: "Pass + bonus", date: "Oct 2025", hours: "280h" },
  { name: "NetPractice", skills: "TCP/IP, Subnetting, Routing", result: "Pass", date: "Oct 2025", hours: "50h" },
  { name: "CPP Modules 00–09", skills: "Object-oriented programming in C++", result: "Pass (all)", date: "Oct–Nov 2025", hours: "185h" },
  { name: "webserv", skills: "HTTP server, Unix, Networking", result: "Pass + bonus", date: "Jan 2026", hours: "175h" },
  { name: "Inception", skills: "Docker, System administration", result: "Pass + bonus", date: "Jan 2026", hours: "150h" },
  { name: "ft_transcendence", skills: "Web, Group collaboration", result: "In progress", date: "2026", hours: "245h" },
];

export default function School42() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="42" className="py-24 px-6">
      <div className="max-w-5xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#ecad0a" }}>
            42 School Luxembourg
          </p>
          <h2 className="text-4xl font-black mb-4" style={{ color: "#e8edf5" }}>
            Common Core <span style={{ color: "#209dd7" }}>Progress</span>
          </h2>

          {/* Progress bar */}
          <div className="flex items-center gap-4 mb-2">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(32,157,215,0.12)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #ecad0a, #209dd7)" }}
                initial={{ width: 0 }}
                animate={inView ? { width: "89%" } : {}}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
              />
            </div>
            <span className="text-sm font-bold" style={{ color: "#ecad0a" }}>89%</span>
          </div>
          <p className="text-sm" style={{ color: "#888888" }}>
            Level 9.70 &middot; Common Core &middot; Selected March 2025 &middot; Started June 2025
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="overflow-x-auto rounded-2xl"
          style={{ border: "1px solid rgba(32,157,215,0.15)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#0d2040" }}>
                <th className="text-left px-5 py-4 font-semibold" style={{ color: "#ecad0a" }}>Project</th>
                <th className="text-left px-5 py-4 font-semibold hidden md:table-cell" style={{ color: "#ecad0a" }}>Skills</th>
                <th className="text-left px-4 py-4 font-semibold" style={{ color: "#ecad0a" }}>Result</th>
                <th className="text-right px-5 py-4 font-semibold hidden sm:table-cell" style={{ color: "#ecad0a" }}>Date</th>
                <th className="text-right px-5 py-4 font-semibold hidden sm:table-cell" style={{ color: "#ecad0a" }}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <tr
                  key={p.name}
                  className="border-t transition-colors hover:bg-[#0d2040]"
                  style={{ borderColor: "rgba(32,157,215,0.08)" }}
                >
                  <td className="px-5 py-3 font-medium" style={{ color: "#e8edf5" }}>{p.name}</td>
                  <td className="px-5 py-3 hidden md:table-cell" style={{ color: "#888888" }}>{p.skills}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={
                        p.result === "In progress"
                          ? { background: "rgba(236,173,10,0.15)", color: "#ecad0a" }
                          : p.result.includes("bonus")
                          ? { background: "rgba(32,157,215,0.12)", color: "#209dd7" }
                          : { background: "rgba(117,57,145,0.12)", color: "#753991" }
                      }
                    >
                      {p.result}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right hidden sm:table-cell" style={{ color: "#888888" }}>{p.date}</td>
                  <td className="px-5 py-3 text-right hidden sm:table-cell" style={{ color: "#888888" }}>{p.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
