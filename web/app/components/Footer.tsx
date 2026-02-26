export default function Footer() {
  return (
    <footer
      className="py-8 px-6 text-center text-xs"
      style={{
        background: "#060f1e",
        borderTop: "1px solid rgba(32,157,215,0.1)",
        color: "#888888",
      }}
    >
      <p>
        &copy; {new Date().getFullYear()} Attila Nemet &mdash; Luxembourg
      </p>
    </footer>
  );
}
