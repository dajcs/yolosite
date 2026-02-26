"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Mail, Linkedin, MapPin, Phone } from "lucide-react";

const contacts = [
  {
    icon: Mail,
    label: "Email",
    value: "attila.nemet@gmail.com",
    href: "mailto:attila.nemet@gmail.com",
    color: "#209dd7",
  },
  {
    icon: Linkedin,
    label: "LinkedIn",
    value: "linkedin.com/in/attilanemet",
    href: "https://www.linkedin.com/in/attilanemet",
    color: "#209dd7",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+352 661 118 922",
    href: "tel:+352661118922",
    color: "#753991",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Luxembourg, Luxembourg",
    href: null,
    color: "#ecad0a",
  },
];

export default function Contact() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="contact" className="py-24 px-6">
      <div className="max-w-4xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "#ecad0a" }}>
            Contact
          </p>
          <h2 className="text-4xl font-black mb-4" style={{ color: "#e8edf5" }}>
            Get in <span style={{ color: "#209dd7" }}>Touch</span>
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: "#888888" }}>
            Open to opportunities in ICT, AI/ML engineering, space technologies, and consulting.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {contacts.map((c, i) => {
            const Icon = c.icon;
            const inner = (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
                className="rounded-2xl p-6 flex items-center gap-5 transition-all hover:-translate-y-0.5"
                style={{
                  background: "#0a1a30",
                  border: `1px solid ${c.color}20`,
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${c.color}18` }}
                >
                  <Icon size={20} style={{ color: c.color }} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#888888" }}>
                    {c.label}
                  </p>
                  <p className="text-sm font-medium" style={{ color: "#e8edf5" }}>
                    {c.value}
                  </p>
                </div>
              </motion.div>
            );

            return c.href ? (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="block"
              >
                {inner}
              </a>
            ) : (
              <div key={c.label}>{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
