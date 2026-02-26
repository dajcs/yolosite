import Nav from "./components/Nav";
import Hero from "./components/Hero";
import About from "./components/About";
import Career from "./components/Career";
import Skills from "./components/Skills";
import Education from "./components/Education";
import School42 from "./components/School42";
import Portfolio from "./components/Portfolio";
import DigitalTwin from "./components/DigitalTwin";
import Contact from "./components/Contact";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <About />
        <Career />
        <Skills />
        <Education />
        <School42 />
        <Portfolio />
        <DigitalTwin />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
