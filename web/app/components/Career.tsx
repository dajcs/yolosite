"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface Event {
  period: string;
  role: string;
  org: string;
  location: string;
  bullets: string[];
  accent: string;
}

const events: Event[] = [
  {
    period: "2025 — Present",
    role: "Common Core Student",
    org: "42 Luxembourg",
    location: "Luxembourg",
    bullets: [
      "Level 9.70, 89% Common Core completed",
      "Projects: minishell, miniRT, webserv, Inception, ft_transcendence",
      "C, C++, systems programming, Docker, HTTP server implementation",
    ],
    accent: "#ecad0a",
  },
  {
    period: "2022 — 2024",
    role: "MSc Student — Space Technologies & Business",
    org: "University of Luxembourg",
    location: "Luxembourg",
    bullets: [
      "Master's thesis: LLMs for space software testing",
      "Scientific project: Lens Flare Wizard (Python/Blender) for CV training datasets",
      "Focus areas: SatCom, Computer Vision, Space Robotics, Space Informatics",
    ],
    accent: "#209dd7",
  },
  {
    period: "2015 — 2023",
    role: "Business Analyst / Software Tester",
    org: "Ericsson",
    location: "Budapest, Hungary",
    bullets: [
      "Mass configuration of telecom equipment using AI and ML concepts",
      "Load testing design for routers and 4G/5G telecom nodes",
      "Python scripting for RAN (3G/4G/5G) configuration and automation",
    ],
    accent: "#753991",
  },
  {
    period: "2012 — 2015",
    role: "OPM Support / Technical Lead",
    org: "Ericsson",
    location: "Germany, Ireland, Hungary",
    bullets: [
      "Technical lead for Mosaic LTE Rollout program (Dublin, Ireland)",
      "RNC/EVO configuration support for Swisscom, E-Plus, KPN, EPT",
      "Scripts for simultaneous 2G/3G/4G integration of two Irish operators",
    ],
    accent: "#753991",
  },
  {
    period: "2004 — 2012",
    role: "Senior Network Integration Engineer",
    org: "Ericsson EMEA",
    location: "Europe & Africa",
    bullets: [
      "3G network rollout: Egypt (Etisalat), Montenegro, Sweden (Telia)",
      "MSS migration and RNC expansion in Hungary, Slovenia",
      "RBS swap and integration across Vodafone, O2, Meteor networks",
    ],
    accent: "#753991",
  },
  {
    period: "2002 — 2004",
    role: "Network Integration Engineer",
    org: "Ericsson EMEA",
    location: "Europe & Africa",
    bullets: [
      "HLR redundancy implementation in Tunis, Tunisia",
      "BSC, RNC and RBS start-up and integration in Hungary",
      "Perl scripting for RBS configuration file generation",
    ],
    accent: "#753991",
  },
];

function TimelineItem({ event, index }: { event: Event; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.55, delay: 0.05 }}
      className="relative flex gap-6 md:gap-10 group"
    >
      {/* Dot + line */}
      <div className="flex flex-col items-center">
        <div
          className="w-4 h-4 rounded-full mt-1 shrink-0 ring-4 ring-[#060f1e] transition-transform group-hover:scale-125"
          style={{ background: event.accent }}
        />
        <div className="flex-1 w-px mt-2" style={{ background: "rgba(32,157,215,0.15)" }} />
      </div>

      {/* Content */}
      <div className="pb-12 flex-1">
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: event.accent }}
        >
          {event.period}
        </span>
        <h3 className="text-lg font-bold mt-1 mb-0.5" style={{ color: "#e8edf5" }}>
          {event.role}
        </h3>
        <p className="text-sm mb-3" style={{ color: "#888888" }}>
          {event.org} &mdash; {event.location}
        </p>
        <ul className="space-y-1">
          {event.bullets.map((b, i) => (
            <li key={i} className="text-sm flex gap-2" style={{ color: "#888888" }}>
              <span style={{ color: event.accent, flexShrink: 0 }}>&#8250;</span>
              {b}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

export default function Career() {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-100px" });

  return (
    <section id="career" className="py-24 px-6" style={{ background: "#0a1a30" }}>
      <div className="max-w-3xl mx-auto" ref={headerRef}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#ecad0a" }}>
            Career Journey
          </p>
          <h2 className="text-4xl font-black" style={{ color: "#e8edf5" }}>
            Two Decades of <span style={{ color: "#209dd7" }}>Engineering</span>
          </h2>
        </motion.div>

        <div>
          {events.map((ev, i) => (
            <TimelineItem key={i} event={ev} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
